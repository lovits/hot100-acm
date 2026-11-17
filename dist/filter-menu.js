'use strict';
function installFilterMenus(){
  const menu=document.createElement('div');
  menu.id='drawer-filter-menu';menu.className='filter-menu';menu.setAttribute('role','listbox');menu.hidden=true;document.body.append(menu);
  let opened=null,active=0;
  const controls=[];
  function close(){
    if(opened){opened.button.setAttribute('aria-expanded','false');opened.button.removeAttribute('aria-activedescendant');}
    menu.hidden=true;opened=null;
  }
  function position(){
    if(!opened)return;
    const r=opened.button.getBoundingClientRect();
    menu.style.left=r.left+'px';menu.style.top=(r.bottom+6)+'px';menu.style.width=r.width+'px';
    menu.style.maxHeight=Math.max(40,Math.min(280,innerHeight-r.bottom-14))+'px';
  }
  function highlight(index){
    active=index;
    [...menu.children].forEach((node,i)=>node.classList.toggle('active',i===index));
    opened.button.setAttribute('aria-activedescendant',menu.children[index].id);
    menu.children[index].scrollIntoView({block:'nearest'});
  }
  function choose(index){
    const control=opened;close();control.select.selectedIndex=index;
    control.select.dispatchEvent(new Event('change',{bubbles:true}));sync();control.button.focus();
  }
  function open(control){
    close();opened=control;menu.setAttribute('aria-label',control.select.getAttribute('aria-label')+'选项');
    menu.replaceChildren(...[...control.select.options].map((option,i)=>{
      const row=document.createElement('div');row.id='filter-option-'+i;row.className='filter-option';row.setAttribute('role','option');
      row.setAttribute('aria-selected',String(option.selected));
      const check=document.createElement('span');check.className='filter-check';check.setAttribute('aria-hidden','true');check.textContent=option.selected?'✓':'';
      const label=document.createElement('span');label.textContent=option.text;row.append(check,label);
      row.onpointermove=()=>highlight(i);row.onclick=()=>choose(i);return row;
    }));
    menu.hidden=false;control.button.setAttribute('aria-expanded','true');position();highlight(Math.max(0,control.select.selectedIndex));
  }
  function sync(){for(const {select,button} of controls)button.textContent=select.selectedOptions[0]?.text||'';}
  for(const select of $$('.sidebar .filters select')){
    const button=document.createElement('button');button.type='button';button.id=select.id+'-trigger';button.className='filter-trigger';
    button.setAttribute('role','combobox');button.setAttribute('aria-label',select.getAttribute('aria-label'));button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
    const control={select,button};controls.push(control);select.hidden=true;select.after(button);
    button.onclick=()=>opened===control?close():open(control);
    button.onkeydown=e=>{
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        e.preventDefault();e.stopPropagation();if(opened!==control){open(control);return;}
        highlight(e.key==='Home'?0:e.key==='End'?menu.children.length-1:(active+(e.key==='ArrowDown'?1:-1)+menu.children.length)%menu.children.length);
      }else if(opened===control&&['Enter',' ','Escape'].includes(e.key)){
        e.preventDefault();e.stopPropagation();if(e.key==='Escape')close();else choose(active);
      }else if(e.key==='Tab')close();
    };
    select.addEventListener('change',sync);
    new ResizeObserver(position).observe(button);
  }
  document.addEventListener('pointerdown',e=>{if(opened&&!menu.contains(e.target)&&!opened.button.contains(e.target))close();});
  document.addEventListener('scroll',e=>{if(e.target!==menu)position();},true);
  window.addEventListener('resize',position);
  const render=renderList;renderList=function(){render();sync();};
  sync();
}
