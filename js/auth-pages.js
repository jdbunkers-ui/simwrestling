/* Sim Wrestling v4.0.0 — register, sign in, recover, account */
(async function () {
  'use strict';
  const page = document.body.dataset.page;
  const form = document.querySelector('[data-auth-form]');
  const status = document.querySelector('[data-auth-status]');
  const submit = form?.querySelector('button[type="submit"]');
  const setStatus = (message, success = false) => {
    if (!status) return;
    status.textContent = message;
    status.className = `auth-status ${success ? 'auth-status-success' : 'auth-status-error'}`;
    status.hidden = false;
  };
  const setBusy = (busy) => { if (submit) { submit.disabled = busy; submit.textContent = busy ? 'Please wait…' : submit.dataset.label; } };
  const home = new URL('index.html', location.href).href;
  const login = new URL('login.html', location.href).href;
  const reset = new URL('reset-password.html', location.href).href;
  let auth;
  try { auth = await window.SimAuth.ready; }
  catch (error) { setStatus(error.message); if (submit) submit.disabled = true; return; }
  const client = auth.client;
  const params = new URLSearchParams(location.search);
  if (params.get('error_description')) setStatus('This authentication link could not be completed. Request a new email link.');

  if (page === 'login' && auth.user && !params.has('error')) {
    setStatus('You are signed in. Visit My Account to manage your profile.', true);
  }
  if (page === 'reset-password') {
    // Supabase recovery sessions can arrive through a code or a URL fragment.
    // Do not offer password editing unless a recovery event/session is confirmed.
    let recoveryAllowed = false;
    const unlock = () => {
      recoveryAllowed = true;
      if (form) form.hidden = false;
      const pending = document.querySelector('[data-recovery-pending]');
      if (pending) pending.hidden = true;
    };
    const hash = new URLSearchParams(location.hash.slice(1));
    if ((hash.get('type') === 'recovery' || auth.recoveryEventSeen) && auth.user) unlock();
    auth.onChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) unlock();
    });
    if (params.get('type') === 'recovery' && auth.user) unlock();
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!recoveryAllowed) return;
      const password = form.elements.password.value;
      const confirmation = form.elements.confirm_password.value;
      if (password !== confirmation) return setStatus('Passwords do not match.');
      setBusy(true);
      const { error } = await client.auth.updateUser({ password });
      setBusy(false);
      if (error) return setStatus(error.message);
      form.hidden = true;
      setStatus('Password updated. You can now sign in.', true);
    });
    return;
  }
  if (page === 'account') {
    const signedOut = document.querySelector('[data-account-signed-out]');
    const signedIn = document.querySelector('[data-account-signed-in]');
    const email = document.querySelector('[data-account-email]');
    const displayName = document.querySelector('[data-account-display]');
    const accountForm = document.querySelector('[data-account-form]');
    async function refresh() {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        signedOut.hidden = false;
        signedIn.hidden = true;
        return;
      }
      signedOut.hidden = true;
      signedIn.hidden = false;
      email.textContent = user.email || '—';
      const { data, error: profileError } = await client.from('app_user_profile').select('display_name,account_status').eq('user_id', user.id).single();
      if (profileError) { setStatus('Could not load your profile. Please contact support.'); return; }
      displayName.value = data.display_name;
      if (data.account_status !== 'active') setStatus('Your account currently has limited access.');
    }
    await refresh();
    accountForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = displayName.value.trim();
      if (!/^[A-Za-z0-9 _-]{3,30}$/.test(name)) return setStatus('Use 3–30 letters, numbers, spaces, underscores, or hyphens.');
      setBusy(true);
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) { setBusy(false); return setStatus('Please sign in again.'); }
      const { error } = await client.from('app_user_profile').update({ display_name: name }).eq('user_id', user.id);
      setBusy(false);
      setStatus(error ? error.message : 'Display name saved.', !error);
    });
    document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
      const { error } = await client.auth.signOut();
      if (error) return setStatus(error.message);
      location.assign(login);
    });
    return;
  }
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(true);
    if (status) status.hidden = true;
    try {
      const email = form.elements.email.value.trim();
      if (page === 'register') {
        const displayName = form.elements.display_name.value.trim();
        const password = form.elements.password.value;
        if (!/^[A-Za-z0-9 _-]{3,30}$/.test(displayName)) return setStatus('Display name must be 3–30 letters, numbers, spaces, underscores, or hyphens.');
        if (password !== form.elements.confirm_password.value) return setStatus('Passwords do not match.');
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { data: { display_name: displayName }, emailRedirectTo: login }
        });
        if (error) return setStatus(error.message);
        form.hidden = true;
        setStatus(data.session ? 'Account created. You are signed in.' : 'Check your inbox for a verification email. Follow the link to activate your account.', true);
      } else if (page === 'login') {
        const { error } = await client.auth.signInWithPassword({ email, password: form.elements.password.value });
        if (error) return setStatus(error.message);
        location.assign('account.html');
      } else if (page === 'forgot-password') {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: reset });
        if (error) return setStatus(error.message);
        form.hidden = true;
        setStatus('If this email is registered, a password-reset link will arrive shortly.', true);
      }
    } catch (_) { setStatus('A connection problem occurred. Please try again.'); }
    finally { setBusy(false); }
  });
})();
