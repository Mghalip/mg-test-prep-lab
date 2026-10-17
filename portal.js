'use strict';
document.querySelectorAll('[data-course]').forEach(button=>button.addEventListener('click',()=>document.getElementById('course-'+button.dataset.course).showModal()));
document.querySelectorAll('dialog .close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
