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

        // Store in KV namespace (bound as TRIAL_STORE)
        if (env.TRIAL_STORE) {
          await env.TRIAL_STORE.put(email, JSON.stringify({
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
        console.log("DEBUG: Google Verify Response Status:", verifyRes.status);
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          console.log("DEBUG: Token Payload Aud:", payload.aud);
          console.log("DEBUG: Env Google Client ID:", env.GOOGLE_CLIENT_ID);
          // Check Google Client ID
          if (payload.aud === env.GOOGLE_CLIENT_ID) {
            userEmail = payload.email.trim().toLowerCase();
            console.log("DEBUG: Extracted Email:", userEmail);
            // Verify email against KV
            if (env.TRIAL_STORE) {
              const entry = await env.TRIAL_STORE.get(userEmail);
              console.log("DEBUG: KV Whitelist Entry for email:", entry);
              if (entry) {
                isAuthorized = true;
              }
            } else {
              console.log("DEBUG: env.TRIAL_STORE is UNDEFINED!");
            }
          } else {
            console.log("DEBUG: Client ID Mismatch!");
          }
        }
      } catch (e) {
        console.log("DEBUG: Verification Exception:", e.message);
        return new Response(JSON.stringify({ error: { message: 'Google Token validation failed: ' + e.message } }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Fallback: Old access code logic
      console.log("DEBUG: Using manual access code logic, token:", token);
      const TRIAL_CODES = ['COBAGRATIS', 'TRIALGURU', 'COBADULU'];
      if (TRIAL_CODES.includes(token)) {
        isAuthorized = true;
      } else if (env.PREMIUM_ACCESS_CODES) {
        const allowedCodes = env.PREMIUM_ACCESS_CODES.split(',');
        if (allowedCodes.includes(token)) {
          isAuthorized = true;
        }
      }
    }

    console.log("DEBUG: Final isAuthorized status:", isAuthorized);

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: { message: `Akses ditolak. Email ${userEmail || 'Anda'} belum terdaftar sebagai pembeli premium.` } }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Profile sync endpoint
    if (url.pathname === '/profile') {
      if (!userEmail) {
         return new Response(JSON.stringify({ error: { message: 'Email required for profile access (please login with Google).' } }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }
      
      const profileKey = `profile_${userEmail}`;
      
      if (request.method === 'GET') {
         const profileData = await env.TRIAL_STORE.get(profileKey);
         return new Response(profileData || "{}", {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      } else if (request.method === 'POST') {
         const bodyText = await request.text();
         await env.TRIAL_STORE.put(profileKey, bodyText);
         return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      } else {
         return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }
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
