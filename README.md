# Sim Wrestling Public Prototype v1.1.0

This is a static website with a deployment configuration generation step. It uses plain HTML, CSS and JavaScript and reads the existing Supabase views and functions directly.

## Included pages

- `index.html` — wrestler rankings with weight, state and type-ahead search filters
- `wrestler.html?wrestler=<uuid>` — complete wrestler profile and opponent selection
- `match.html?match=<uuid>` — half-speed progressive customer play-by-play with scoring alerts
- `statistics.html` — sortable public media statistics and per-match averages
- `about.html` — attribute categories and rating-band definitions

Every page uses the same navigation and the White Blaze Analytics footer.

## 1. Install the Supabase presentation update

In the Supabase SQL Editor, first run:

`supabase/College_Wrestling_Simulation_Public_Web_Enhancements_v1_1_0.sql`

This adds the public directory and statistics views used by the updated pages and removes numeric attribute ranges from the anonymous wrestler-profile payload. It does not change the engine or delete data.

If the public match endpoint has not already been installed, also run:

In the Supabase SQL Editor, run:

`supabase/College_Wrestling_Simulation_Public_Demo_API_v1_0_0.sql`

This creates `public.run_demo_match(uuid,uuid)`. It permits anonymous prototype matches, accepts only active wrestlers in the same weight class, and limits the demo to 60 requests per 10 minutes and 500 per rolling 24 hours.

The site expects these objects:

- `public.v_public_wrestler_directory`
- `public.v_public_wrestler_statistics`
- `public.get_wrestler_profile(uuid)`
- `public.v_customer_match_experience`

## Deployment configuration (dev/prod)

The Vercel build now generates browser configuration; the older build-free
instructions do not apply to this package. No npm dependencies are needed.

Upload changes to the GitHub `dev` branch first. Keep the folder paths intact.
Do not merge into `main` until production environment variables are configured.

Use Framework Preset Other, Build Command `node scripts/build.cjs`, Output
Directory `dist`. These commands are also declared in vercel.json. Remove any
conflicting dashboard overrides. The source js/config.js intentionally has no
connection values. Serve dist/ after building, not the source directory.

Each Vercel project needs:

| Variable | Development Vercel project | Live Vercel project |
| --- | --- | --- |
| SIM_WRESTLING_ENV | dev | production |
| SUPABASE_URL | simwrestling-dev HTTPS project URL | Existing live HTTPS project URL |
| SUPABASE_PUBLISHABLE_KEY | Development sb_publishable_ key | Live sb_publishable_ key |

Set these for the Vercel Production scope of EACH project. Vercel calls the
stable deployment of the development project Production too. Also use dev
values for Preview deployments, or disable those deployments. Missing values
fail the build; there is no production fallback. Environment changes require
a new deployment. Never use service-role or secret keys in these variables.
Publishable keys are included in browser code intentionally; RLS and database
permissions enforce access.

The guard recognizes the current live project hostname from the supplied
source package. It refuses that hostname for dev and requires it for production.
Update this guard deliberately if the live Supabase project changes. A key's
project ownership is verified during live connection testing, not by this build.

Connect the development Vercel project's production branch to GitHub dev.
Keep the existing live Vercel project tracking main and owning simwrestling.com.
A GitHub dev commit may also cause a Preview build in the live Vercel project;
configure that Preview scope with dev values or disable preview builds before
uploading. A preview does not replace the live domain, but its configuration
still matters. No Namecheap changes are required.

After the test URL is known, configure the DEVELOPMENT Supabase Auth Site URL
and redirect allowlist for that URL. Verify sign-in and recovery stay there.
Storage files, Edge Functions, SMTP, Realtime and other project settings may
need separate configuration after the database restore. Do not assume copying
the database copied every service setting.

Release tested code by merging dev into main only after live Vercel variables
are ready. Apply tested database migrations separately; never replace live
user/game data with the development database. No SQL migrations are included.

## Validation performed

Builds were checked using synthetic public keys and project URLs. Missing
settings, wrong environment/database combinations, secret keys, legacy
service-role JWTs and malformed URLs are rejected. Static output preserves
all supplied HTML/assets/scripts except generated config. No live Supabase
connection, login, or Vercel deployment has been tested by this package.

## Prototype boundaries

- The application has no login or team ownership yet.
- Coach analytics are intentionally visible to testers.
- All current wrestlers and match results are fictional test data.
- The match engine remains frozen at v0.1.3.
- The site does not expose private rating values or Supabase secret credentials.
