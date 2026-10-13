// Demonstration-only controls; no draft state or publishing code is loaded.
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-expand],[data-collapse]');if(!button)return;
 const id=button.dataset.expand||button.dataset.collapse,region=document.getElementById('details-'+id),control=document.querySelector('[data-expand="'+id+'"]');
 if(!region||!control)return;const expanded=button.hasAttribute('data-collapse')?false:region.hidden;
 region.hidden=!expanded;control.setAttribute('aria-expanded',String(expanded));control.querySelector('[data-label]').textContent=expanded?'Collapse':'Expand';control.setAttribute('aria-label',(expanded?'Collapse ':'Expand ')+(control.dataset.disclosureLabel||control.getAttribute('aria-label').replace(/^(Expand|Collapse) /,'').replace(/ details$/,''))+' details');if(!expanded)control.focus();
});
