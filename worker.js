export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID',
    };

    // Handle CORS preflight options request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 1. Webhook endpoint from Lynk.id
    if (url.pathname === '/lynk-webhook') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      // Check webhook secret
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== env.WEBHOOK_SECRET) {
        return new Response('Unauthorized Webhook Secret', { status: 401, headers: corsHeaders });
      }

      try {
        const payload = await request.json();
        // Extract email (handling common JSON webhook payload formats)
        const email = (payload.email || payload.customer_email || payload.data?.email || '').trim().toLowerCase();

        if (!email) {
          return new Response('Email not found in payload', { status: 400, headers: corsHeaders });
        }

        // Store in KV namespace (bound as WHITELIST_KV)
        if (env.WHITELIST_KV) {
          await env.WHITELIST_KV.put(email, JSON.stringify({
            status: 'active',
            addedAt: Date.now(),
            source: 'lynk-webhook'
          }));
        }

        return new Response(JSON.stringify({ success: true, whitelisted: email }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response('Error processing payload: ' + err.message, { status: 500, headers: corsHeaders });
      }
    }

    // 2. Main API requests proxying to Google Gemini
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: { message: 'Missing Authorization header' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7).trim();
    let isAuthorized = false;
    let userEmail = '';

    if (token.startsWith('google_jwt_token:')) {
      // Decode and verify Google login token
      const jwtToken = token.substring(17);
      const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${jwtToken}`;
      try {
        const verifyRes = await fetch(googleVerifyUrl);
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          // Check Google Client ID
          if (payload.aud === env.GOOGLE_CLIENT_ID) {
            userEmail = payload.email.trim().toLowerCase();
            // Verify email against KV
            if (env.WHITELIST_KV) {
              const entry = await env.WHITELIST_KV.get(userEmail);
              if (entry) {
                isAuthorized = true;
              }
            } else {
              // Fallback if KV is not bound (allow for testing)
              isAuthorized = true;
            }
          }
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: { message: 'Google Token validation failed: ' + e.message } }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Fallback: Old access code logic
      const TRIAL_CODES = ['COBAGRATIS', 'TRIALGURU', 'COBADULU'];
      if (TRIAL_CODES.includes(token)) {
        isAuthorized = true;
      } else if (env.PREMIUM_ACCESS_CODES) {
        const allowedCodes = env.PREMIUM_ACCESS_CODES.split(',');
        if (allowedCodes.includes(token)) {
          isAuthorized = true;
        }
      } else {
        // Fallback for direct Gemini keys
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: { message: `Akses ditolak. Email ${userEmail || 'Anda'} tidak terdaftar di whitelist.` } }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Proxy request to Gemini API
    const geminiUrl = new URL(request.url);
    geminiUrl.hostname = 'generativelanguage.googleapis.com';
    
    // Inject API key from Cloudflare secrets if set
    const realApiKey = env.GEMINI_API_KEY;
    if (realApiKey) {
      geminiUrl.searchParams.set('key', realApiKey);
    }

    // Clone headers and delete proxy custom headers
    const newHeaders = new Headers(request.headers);
    newHeaders.delete('Authorization');
    newHeaders.delete('X-Device-ID');
    
    const newRequest = new Request(geminiUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.method === 'POST' ? request.body : null
    });

    try {
      const response = await fetch(newRequest);
      // Inject CORS headers to response
      const newResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(corsHeaders)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    } catch (e) {
      return new Response(JSON.stringify({ error: { message: 'Failed to fetch Gemini API: ' + e.message } }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
