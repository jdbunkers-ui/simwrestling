/* Sim Wrestling v4.0.0 — browser authentication only. No service-role credentials. */
(function () {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js';
  function appendScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the authentication library. Please refresh.'));
      document.head.append(script);
    });
  }
  async function initialize() {
    if (!window.SIM_WRESTLING_CONFIG) await appendScript('js/config.js');
    const settings = window.SIM_WRESTLING_CONFIG || {};
    if (!settings.supabaseUrl || !settings.supabasePublishableKey ||
        settings.supabaseUrl.includes('YOUR-PROJECT') || settings.supabasePublishableKey.includes('YOUR-SUPABASE')) {
      throw new Error('Supabase configuration is missing. Check js/config.js in the deployed site.');
    }
    if (!window.supabase?.createClient) await appendScript(CDN);
    const client = window.supabase.createClient(settings.supabaseUrl, settings.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    let currentUser = null;
    let recoveryEventSeen = false;
    const listeners = new Set();
    function renderNav() {
      const link = document.querySelector('.account-nav-link');
      if (!link) return;
      link.textContent = currentUser ? 'My Account' : 'Sign In';
      link.href = currentUser ? 'account.html' : 'login.html';
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') recoveryEventSeen = true;
      currentUser = session?.user || null;
      renderNav();
      listeners.forEach((fn) => fn(_event, session));
    });
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    currentUser = result.data.session?.user || null;
    renderNav();
    return {
      client,
      get user() { return currentUser; },
      get recoveryEventSeen() { return recoveryEventSeen; },
      onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      dispose() { subscription.unsubscribe(); }
    };
  }
  window.SimAuth = { ready: initialize() };
  // Other public pages should continue working even if login initialization fails.
  window.SimAuth.ready.catch((error) => { console.warn('Sim Wrestling authentication unavailable:', error.message); });
})();
