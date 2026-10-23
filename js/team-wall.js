/* v4.5.11: text-only team discussions, server authorization, per-item receipts. */
(async function(){'use strict';
 const root=document.getElementById('wall-root'),e=SimSite.escape;
 let auth,coach=null,team=null,posts=[],loading=false;
 const entries=new Map(),seen=new Set();
 async function rpc(name,args={}){const {data,error}=await auth.client.rpc(name,args);if(error)throw error;return data;}
 const teamUrl=id=>'team.html?team='+encodeURIComponent(id);
 function byline(x){const date=new Date(x.created_at);return `<div class="wall-byline"><a href="${teamUrl(x.author_team_guid)}">${e(x.author_name)}</a><span>${e(x.author_team_name)}</span><time datetime="${e(x.created_at)}" title="${e(date.toLocaleString())}">${e(date.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}))}</time>${x.edited_at?'<span title="'+e(new Date(x.edited_at).toLocaleString())+'">Edited</span>':''}${coach&&x.unread?'<strong class="wall-new">New</strong>':''}</div>`;}
 const canPost=()=>!!coach?.can_post;
 function actions(x){return `<div class="wall-actions">${canPost()&&x.is_mine?`<button type="button" data-edit="${e(x.id)}">Edit</button><button type="button" data-delete="${e(x.id)}">Delete</button>`:''}${coach&&!x.is_mine?`<button type="button" data-report="${e(x.id)}">Report</button>`:''}</div>`;}
 function comment(x){entries.set(x.id,x);return `<article class="wall-comment" data-entry="${e(x.id)}">${byline(x)}<p class="wall-body">${e(x.body)}</p>${actions(x)}</article>`;}
 function post(x){entries.set(x.id,x);return `<article class="wall-post" data-entry="${e(x.id)}">${byline(x)}<p class="wall-body">${e(x.body)}</p><div class="wall-actions"><button type="button" data-comments="${e(x.id)}" aria-expanded="false">Comments (${Number(x.comment_count)})${coach&&x.unread_comments?' · '+Number(x.unread_comments)+' new':''}</button>${actions(x)}</div><div class="wall-comments" data-thread="${e(x.id)}" hidden></div></article>`;}
 function composer(parent=''){return `<form ${parent?'data-reply="'+e(parent)+'"':'id="wall-compose"'}><label>${parent?'Add a comment':'Write a post'}<textarea name="body" required maxlength="3000" placeholder="${parent?'Join the conversation…':'Congratulations, questions, rivalries—start a conversation…'}"></textarea></label><button type="submit">${parent?'Comment':'Post'}</button><span class="wall-reading-note"> 3,000 characters maximum</span><p class="wall-feedback" role="status"></p></form>`;}
 function feedback(message){document.getElementById('wall-feedback').textContent=message;}
 // Receipts are sent only for contributions actually scrolled into view.
 const observer=new IntersectionObserver(items=>{
  if(document.hidden||!coach)return;
  const ids=items.filter(x=>x.isIntersecting).map(x=>x.target.dataset.entry).filter(id=>!seen.has(id));
  if(!ids.length)return;ids.forEach(id=>seen.add(id));
  rpc('mark_team_wall_read_v4511',{p_ids:ids.slice(0,100)}).then(()=>{
   ids.forEach(id=>{const x=entries.get(id),node=root.querySelector(`[data-entry="${id}"]`);if(x)x.unread=false;node?.querySelector(':scope > .wall-byline .wall-new')?.remove();});
   window.dispatchEvent(new Event('team-wall-read'));
  }).catch(()=>ids.forEach(id=>seen.delete(id)));
 },{threshold:.1});
 function observe(){root.querySelectorAll('[data-entry]').forEach(node=>observer.observe(node));}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){observer.disconnect();observe();}});
 async function loadPosts(reset=false){
  if(loading)return;loading=true;const more=document.getElementById('wall-more');more.disabled=true;
  try{
   const rows=await rpc('get_team_wall_posts_v4511',{p_team:team,p_before:reset||!posts.length?null:posts[posts.length-1].id});
   if(reset){observer.disconnect();posts=[];entries.clear();document.getElementById('wall-feed').innerHTML='';}
   posts.push(...rows);document.getElementById('wall-feed').insertAdjacentHTML('beforeend',rows.map(post).join(''));
   document.getElementById('wall-empty').hidden=posts.length>0;more.hidden=rows.length<20;observe();
  }catch(err){feedback('Could not load posts: '+err.message);}finally{loading=false;more.disabled=false;}
 }
 async function loadComments(id,after=null){
  const holder=root.querySelector(`[data-thread="${id}"]`),button=root.querySelector(`[data-comments="${id}"]`);
  if(!after&&holder.dataset.loaded){holder.hidden=!holder.hidden;button.setAttribute('aria-expanded',String(!holder.hidden));return;}
  button.disabled=true;
  try{
   const rows=await rpc('get_team_wall_comments_v4511',{p_post:id,p_after:after});
   if(!after)holder.innerHTML='<div class="wall-comment-list"></div>'+(canPost()?composer(id):'');
   holder.querySelector('.wall-comment-list').insertAdjacentHTML('beforeend',rows.map(comment).join(''));
   holder.querySelector('[data-more-comments]')?.remove();
   if(rows.length===50){const more=document.createElement('button');more.type='button';more.dataset.moreComments=id;more.dataset.after=rows[rows.length-1].id;more.textContent='Load more comments';holder.querySelector('.wall-comment-list').append(more);}
   holder.hidden=false;holder.dataset.loaded='1';button.setAttribute('aria-expanded','true');observe();
  }finally{button.disabled=false;}
 }
 try{
  auth=await SimAuth.ready;
  if(auth.user){const status=await rpc('get_team_wall_status_v4511');coach=status.coach;}
  team=new URLSearchParams(location.search).get('team')||coach?.team_guid;
  if(!team){root.innerHTML='<section class="panel coach-live-panel"><h1>Team Wall</h1><p>Choose a team from <a href="rankings.html">Rankings</a> to read its wall. Sign in and claim a college to join the conversation.</p><a href="login.html">Sign in</a> · <a href="account.html">My Account</a></section>';return;}
  const [snapshot,identity]=await Promise.all([SimApi.publicTeamSnapshot(team),CoachIdentityBanner.load(auth.client,team)]);
  const name=identity?.display_name||snapshot?.profile?.team_name||'College';
  document.title=name+' — Team Wall | Sim Wrestling';
  const own=team===coach?.team_guid;
  const nav=own?'<nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a><a href="coach-identity.html">Identity</a></nav>':`<nav class="coach-subnav" aria-label="College profile sections"><a href="${teamUrl(team)}">Team</a><a href="${teamUrl(team)}#schedule">Schedule</a><a href="${teamUrl(team)}#fame">Wall of Fame</a><a class="active" aria-current="page" href="team-wall.html?team=${encodeURIComponent(team)}">Team Wall</a></nav>`;
  root.innerHTML=CoachIdentityBanner.render({identity,teamName:name,context:'TEAM WALL'})+nav+`<section class="panel coach-live-panel"><div class="wall-tools"><div><p class="eyebrow">THE CONVERSATION</p><h2>Team Wall</h2></div><button type="button" id="wall-refresh">Refresh posts</button></div><p class="wall-intro">Talk wrestling. Celebrate a signing. Start a rivalry. Friendly smack-talk is welcome; keep it about the game.</p>${canPost()?'<div class="wall-composer">'+composer()+'</div>':`<p>${coach?'Posting is currently suspended for your account.':'Only signed-in coaches with an active college assignment can post or comment. <a href="login.html">Sign in</a> · <a href="account.html">My Account</a>'}</p>`}<p class="wall-reading-note">Newest posts first. Comments read oldest to newest. Times use your device’s local time.</p><p id="wall-feedback" class="wall-feedback" role="status"></p><p id="wall-empty" hidden>No posts yet. Start the conversation.</p><div id="wall-feed" class="wall-feed"></div><button type="button" id="wall-more" class="wall-more" hidden>Load more posts</button></section>`;
  CoachIdentityBanner.apply(root,identity);
  document.getElementById('wall-refresh').onclick=()=>loadPosts(true);
  document.getElementById('wall-more').onclick=()=>loadPosts();
  root.addEventListener('submit',async ev=>{
   const form=ev.target;if(!form.matches('#wall-compose,[data-reply],.wall-edit'))return;ev.preventDefault();
   const button=form.querySelector('button[type=submit]'),message=form.querySelector('.wall-feedback');button.disabled=true;message.textContent='Saving…';
   try{
    if(form.dataset.editing){await rpc('change_team_wall_entry_v4511',{p_id:form.dataset.editing,p_body:form.elements.body.value,p_delete:false});await loadPosts(true);feedback('Contribution updated.');}
    else{await rpc('create_team_wall_entry_v4511',{p_team:team,p_body:form.elements.body.value,p_parent:form.dataset.reply||null});
     if(form.dataset.reply){const id=form.dataset.reply;const original=entries.get(id);if(original){original.comment_count=Number(original.comment_count||0)+1;root.querySelector(`[data-comments="${id}"]`).textContent=`Comments (${original.comment_count})`;}const holder=root.querySelector(`[data-thread="${id}"]`);delete holder.dataset.loaded;await loadComments(id);feedback('Comment added.');}
     else {form.reset();await loadPosts(true);feedback('Post added.');}
    }
   }catch(err){message.textContent=err.message;}finally{button.disabled=false;if(message.textContent==='Saving…')message.textContent='';}
  });
  root.addEventListener('click',async ev=>{
   const b=ev.target.closest('button');if(!b||b.disabled)return;
   try{
    if(b.dataset.comments)await loadComments(b.dataset.comments);
    if(b.dataset.moreComments){b.disabled=true;try{await loadComments(b.dataset.moreComments,b.dataset.after);}finally{b.disabled=false;}}
    if(b.dataset.edit){const x=entries.get(b.dataset.edit),article=b.closest('[data-entry]');if(article.querySelector('.wall-edit'))return;
     const form=document.createElement('form');form.className='wall-edit';form.dataset.editing=x.id;form.innerHTML='<label>Edit contribution<textarea name="body" required maxlength="3000"></textarea></label><button type="submit">Save changes</button> <button type="button" data-cancel-edit>Cancel</button><p class="wall-feedback" role="status"></p>';form.elements.body.value=x.body;article.append(form);form.elements.body.focus();}
    if(b.hasAttribute('data-cancel-edit'))b.closest('.wall-edit').remove();
    if(b.dataset.delete&&confirm('Delete this contribution? Deleting a post also hides its comments.')){b.disabled=true;try{await rpc('change_team_wall_entry_v4511',{p_id:b.dataset.delete,p_delete:true,p_body:null});await loadPosts(true);feedback('Contribution deleted.');}finally{b.disabled=false;}}
    if(b.dataset.report){const reason=prompt('Why are you reporting this contribution? (Up to 500 characters)');if(reason?.trim()){b.disabled=true;try{await rpc('report_team_wall_entry_v4511',{p_id:b.dataset.report,p_reason:reason});feedback('Report submitted for review.');}finally{b.disabled=false;}}}
   }catch(err){feedback(err.message);}
  });
  auth.onChange((event)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN')location.reload();});
  await loadPosts(true);
 }catch(err){root.innerHTML='<section class="panel coach-live-panel"><h1>Team Wall</h1><p>'+e(err.message)+'</p><p><a href="coach.html">Return to Coaching</a> · <a href="rankings.html">Browse teams</a></p></section>';}
})();
