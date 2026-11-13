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
  // Private HS Brackets are rendered by the authenticated recruiting app.
})();
