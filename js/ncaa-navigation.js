/* NCAA V2 navigation additions for existing static website. Pure browser UI; no league mutations. */
(function(){
  'use strict';
  function addMainLink(){
    const nav=document.querySelector('.main-nav');
    if(!nav || nav.querySelector('[data-ncaa-nav]'))return;
    const link=document.createElement('a');
    link.href='brackets.html';link.textContent='Brackets';link.dataset.ncaaNav='true';
    if(document.body.dataset.page==='brackets')link.setAttribute('aria-current','page');
    const schedule=Array.from(nav.querySelectorAll('a')).find(a=>a.getAttribute('href')?.split('?')[0]==='schedule.html');
    if(schedule)nav.insertBefore(link,schedule);else nav.appendChild(link);
  }
  addMainLink();
  // Treat the previous Overview tab as a high-school bracket browser, rather than merely renaming it.
  const root=document.getElementById('coach-recruiting-root');
  if(!root)return;
  let loading=null;
  async function loadBrowser(){
    if(window.SimNcaaBracketBrowser)return window.SimNcaaBracketBrowser;
    if(!loading)loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='js/brackets-browser.js?v=1';
      script.onload=()=>resolve(window.SimNcaaBracketBrowser);
      script.onerror=()=>reject(new Error('Bracket browser script is unavailable.'));
      document.head.appendChild(script);
    });
    return loading;
  }
  async function activateHs(){
    const panel=root.querySelector('#recruit-panel');if(!panel)return;
    root.querySelectorAll('.recruit-tabs [data-tab]').forEach(item=>{
      const active=item.dataset.tab==='overview';item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));
    });
    panel.innerHTML='<div class="ncaa-browser"><p class="ncaa-browser-summary">Loading high-school tournament brackets…</p></div>';
    try{const browser=await loadBrowser();if(!panel.isConnected||root.querySelector('[data-tab="overview"]')?.getAttribute('aria-selected')!=='true')return;await browser.mount(panel,{level:'HIGH_SCHOOL'});}
    catch(err){panel.textContent=`High-school bracket browser is unavailable: ${err.message}`;}
  }
  function ensureTab(){
    const tab=root.querySelector('.recruit-tabs [data-tab="overview"]');
    if(!tab)return;
    if(tab.textContent!=='HS Brackets')tab.textContent='HS Brackets';
    if(tab.getAttribute('aria-selected')==='true' && !root.querySelector('#recruit-panel .ncaa-browser'))void activateHs();
  }
  // Capture only the renamed tab; original Big Board and Search & Scout click behavior stays unchanged.
  root.addEventListener('click',event=>{
    const tab=event.target.closest('.recruit-tabs [data-tab="overview"]');
    if(!tab)return;
    event.preventDefault();event.stopImmediatePropagation();
    void activateHs();
  },true);
  const observer=new MutationObserver(ensureTab);
  observer.observe(root,{subtree:true,childList:true});
  ensureTab();
})();
