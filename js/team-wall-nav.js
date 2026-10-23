/* v4.5.11: shared Team Wall navigation and own-team unread status. */
(function(){'use strict';
 let status=null,client=null,busy=false;
 function render(){
  document.querySelectorAll('.coach-subnav').forEach(nav=>{
   // Public team profiles supply their own team-specific wall link.
   if(nav.getAttribute('aria-label')==='College profile sections')return;
   let link=nav.querySelector('[data-team-wall-nav]');
   if(!link){link=document.createElement('a');link.dataset.teamWallNav='';link.href='team-wall.html';link.append(document.createTextNode('Team Wall'));nav.append(link);}
   const viewedTeam=new URLSearchParams(location.search).get('team');
   const ownPage=location.pathname.endsWith('/team-wall.html')&&(!viewedTeam||viewedTeam===status?.coach?.team_guid);
   link.classList.toggle('active',ownPage);if(ownPage)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
   const n=Number(status?.unread_count||0);let dot=link.querySelector('.wall-dot');
   if(n&&!dot){dot=document.createElement('span');dot.className='wall-dot';dot.setAttribute('aria-hidden','true');dot.textContent='New';link.append(dot);}
   if(!n&&dot)dot.remove();
   link.setAttribute('aria-label',n?`Team Wall, ${n} unread posts or comments on your team wall`:'Team Wall');
   link.title=n?`${n} unread posts or comments on your team wall`:'Your team wall';
  });
 }
 async function refresh(){if(!client||busy)return;busy=true;try{const {data,error}=await client.rpc('get_team_wall_status_v4511');if(error)throw error;status=data;render();}catch(error){console.warn('Team Wall status unavailable:',error.message);}finally{busy=false;}}
 new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
 render();
 window.addEventListener('team-wall-read',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('focus',refresh);
 const timer=setInterval(()=>{if(!document.hidden)refresh();},60000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 if(window.SimAuth)SimAuth.ready.then(auth=>{client=auth.client;if(auth.user)refresh();auth.onChange((_event,session)=>{status=null;if(session?.user)refresh();else render();});}).catch(()=>{});
})();
