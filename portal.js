'use strict';
document.querySelectorAll('[data-course]').forEach(button=>button.addEventListener('click',()=>document.getElementById('course-'+button.dataset.course).showModal()));
document.querySelectorAll('dialog .close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
// Signed-in students see their own initial and name on the "My Results" shortcut.
window.addEventListener('load',()=>{if(!window.MG||!MG.ready)return;MG.ready.then(()=>{const u=MG.user;if(!u)return;const name=(u.user_metadata&&u.user_metadata.display_name)||u.email||'';const avatar=document.getElementById('account-avatar'),hint=document.getElementById('account-hint');if(avatar&&name){avatar.textContent=name.trim().charAt(0).toUpperCase();avatar.classList.add('signed-in')}if(hint)hint.textContent=(name?name+' · ':'')+'查看成绩与记录'}).catch(()=>{})});
