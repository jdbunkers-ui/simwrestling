# Sim Wrestling Public Prototype

This is a build-free static website. It uses plain HTML, CSS and JavaScript and reads the existing Supabase views and functions directly.

## Included pages

- `index.html` — overall wrestler rankings with a weight-class filter
- `wrestler.html?wrestler=<uuid>` — complete wrestler profile and opponent selection
- `match.html?match=<uuid>` — progressive customer play-by-play
- `statistics.html` — public media statistics
- `about.html` — attribute categories and rating-band definitions

Every page uses the same navigation and the White Blaze Analytics footer.

## 1. Install the public demo RPC

In the Supabase SQL Editor, run:

`supabase/College_Wrestling_Simulation_Public_Demo_API_v1_0_0.sql`

This creates `public.run_demo_match(uuid,uuid)`. It permits anonymous prototype matches, accepts only active wrestlers in the same weight class, and limits the demo to 60 requests per 10 minutes and 500 per rolling 24 hours.

The rest of the site expects these previously installed objects:

- `public.v_landing_wrestler_rankings`
- `public.v_wrestler_media_statistics`
- `public.get_wrestler_profile(uuid)`
- `public.v_customer_match_experience`

## 2. Connect Supabase

Open `js/config.js` and replace:

- `https://YOUR-PROJECT-REF.supabase.co`
- `YOUR-SUPABASE-PUBLISHABLE-KEY`

Find both values in the Supabase project **Connect** dialog or under **Settings → API Keys**.

Use the `sb_publishable_...` key. Never place a Supabase secret key or legacy `service_role` key in this project.

## 3. Put the files in GitHub

Create or open the GitHub repository that will contain the prototype. Upload the **contents of this folder** to the repository root. `index.html` should be visible at the top level of the repository—not inside an additional nested folder.

Suggested repository layout:

```text
index.html
wrestler.html
match.html
statistics.html
about.html
README.md
assets/
  styles.css
js/
  config.js
  api.js
  site.js
  rankings.js
  profile.js
  match.js
  statistics.js
supabase/
  College_Wrestling_Simulation_Public_Demo_API_v1_0_0.sql
```

Commit the files to the `main` branch.

## 4. Deploy through Vercel

1. In Vercel, select **Add New → Project**.
2. Import the GitHub repository.
3. Select **Other** as the framework preset if Vercel asks.
4. Leave the build command empty.
5. Leave the output directory empty or set it to `.`.
6. Deploy.

Vercel will assign a temporary `vercel.app` URL. Once the prototype works, add `simwrestling.com` in the Vercel project's Domain settings.

## Optional local check

Because the site calls browser APIs, open it through a small local web server rather than double-clicking `index.html`. VS Code Live Server is sufficient.

## Prototype boundaries

- The application has no login or team ownership yet.
- Coach analytics are intentionally visible to testers.
- All current wrestlers and match results are fictional test data.
- The match engine remains frozen at v0.1.3.
- The site does not expose private rating values or Supabase secret credentials.
