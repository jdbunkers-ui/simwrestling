/* Sim Wrestling v4.5.10: one cosmetic college identity banner across Coaching tabs. */
(function(){'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=name=>String(name||'').split(/\s+/).filter(w=>w&&!/^(of|the|and|at|for)$/i.test(w)).map(w=>w[0]).join('').slice(0,4).toUpperCase()||'SW';
  const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):null;
  const textColor=hex=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722>.36?'#14263b':'#ffffff';};
  async function load(client,teamGuid){
    if(!teamGuid)return null;
    try{const {data,error}=await client.rpc('get_college_identity_v459',{p_team_guid:teamGuid});if(error){console.warn('College identity unavailable:',error.message);return null;}return data||null;}
    catch(error){console.warn('College identity unavailable:',error.message);return null;}
  }
  function render({identity,teamName,context='CURRENT SEASON',detail='',suffix='',fallbackAbbr}={}){
    const name=String(identity?.display_name||teamName||'My College');
    const abbr=String(identity?.abbreviation||fallbackAbbr||initials(name));
    const mascot=String(identity?.mascot||'');
    const metadata=[mascot,detail].filter(Boolean).join(' · ');
    return `<section class="coach-live-hero college-unified-hero"><div><p class="eyebrow">YOUR COLLEGE · ${esc(context)}</p><h1>${esc(name)}${suffix?` ${esc(suffix)}`:''}</h1>${metadata?`<p class="college-hero-meta">${esc(metadata)}</p>`:''}</div><div class="coach-hero-seal" aria-hidden="true">${esc(abbr)}</div></section>`;
  }
  function apply(container,identity){
    const hero=container?.querySelector('.college-unified-hero');if(!hero)return;
    const primary=safeColor(identity?.primary_color)||'#142B4C';
    const accent=safeColor(identity?.secondary_color)||'#E6AD24';
    const foreground=textColor(primary);
    hero.style.background=primary;hero.style.color=foreground;
    const eyebrow=hero.querySelector('.eyebrow');if(eyebrow)eyebrow.style.color=accent;
    const meta=hero.querySelector('.college-hero-meta');if(meta)meta.style.color=foreground;
    const seal=hero.querySelector('.coach-hero-seal');if(seal){seal.style.borderColor=accent;seal.style.color=accent;}
  }
  window.CoachIdentityBanner={load,render,apply};
})();
