'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
// Public project identifier. Prevent dev builds using the live database.
const productionHost = 'keacojzkyfpjzhitwyfo.supabase.co';
function fail(message) { throw new Error(message); }
try {
  const environment = (process.env.SIM_WRESTLING_ENV || '').trim();
  const rawUrl = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!['dev', 'production'].includes(environment)) fail('Set SIM_WRESTLING_ENV to dev or production.');
  if (!rawUrl || !key) fail('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('SUPABASE_URL must be the HTTPS Supabase project URL without a path.');
  if (environment === 'dev' && url.hostname === productionHost) fail('Dev build refused: SUPABASE_URL points to production.');
  if (environment === 'production' && url.hostname !== productionHost) fail('Production build refused: URL does not match the production project.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) fail('Use an sb_publishable_ browser key, never a secret or service-role key.');
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  for (const item of fs.readdirSync(root)) {
    if (item.endsWith('.html') || ['assets', 'js'].includes(item)) {
      fs.cpSync(path.join(root, item), path.join(out, item), {recursive: true});
    }
  }
  const config = {supabaseUrl: url.origin, supabasePublishableKey: key, environment};
  fs.writeFileSync(path.join(out, 'js/config.js'), '// Generated during deployment. Browser-public configuration only.\nwindow.SIM_WRESTLING_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');

  // NCAA V2 website integration: load navigation enhancement after the existing site scripts.
  // No modifications to legacy source JS or protected database permissions.
  const injection = '<link rel="stylesheet" href="assets/ncaa-navigation.css?v=1">\n<script src="js/ncaa-navigation.js?v=1"></script>';
  for (const filename of fs.readdirSync(out).filter(file => file.endsWith('.html'))) {
    const filepath = path.join(out, filename);
    const original = fs.readFileSync(filepath, 'utf8');
    if (!original.includes('js/ncaa-navigation.js') && /<\/body\s*>/i.test(original)) {
      fs.writeFileSync(filepath, original.replace(/<\/body\s*>/i, injection + '\n</body>'));
    }
  }
  console.log('Static site built successfully for ' + environment + '.');
} catch (error) {
  fs.rmSync(out, {recursive: true, force: true});
  console.error(error.message);
  process.exitCode = 1;
}
