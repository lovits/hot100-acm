'use strict';
function storageSettings(){
  modal('进度保存位置',`<form id="directory-form"><label for="directory-field">本地文件夹</label><div class="directory-line"><input id="directory-field" type="text" required spellcheck="false" value="${esc(session.directory)}">${window.practiceDesktop?'<button type="button" class="button" id="browse-directory">选择文件夹</button>':''}</div><p class="small muted">当前进度和备份会复制到所选目录，以后在该目录保存。原目录保留一份副本。</p><p id="directory-error" role="status"></p><div class="confirm-actions"><button type="button" class="button" id="cancel-directory">取消</button><button class="button submit" type="submit">保存位置</button></div></form>`);
  $('#cancel-directory').onclick=closeModal;
  if($('#browse-directory'))$('#browse-directory').onclick=async()=>{
    const path=await window.practiceDesktop.chooseFolder();if(path)$('#directory-field').value=path;
  };
  $('#directory-form').onsubmit=async e=>{
    e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;
    try{
      saveCode();if(!await flushDisk())throw Error('当前修改尚未写入磁盘，请稍后重试。');
      const r=await fetch('/api/directory',{method:'POST',headers:{'Content-Type':'application/json','X-Hot100-Token':session.token},body:JSON.stringify({directory:$('#directory-field').value.trim()})});
      const data=await r.json();if(!r.ok)throw Error(data.error);
      session.directory=data.directory;localStorage.setItem('hot100-directory',data.directory);
      closeModal();notify('保存位置已更新');
    }catch(error){$('#directory-error').textContent=error.message;}finally{button.disabled=false;}
  };
}
function installDrawerResize(){
  const drawer=$('#sidebar'), grip=$('#drawer-resizer');
  let preferred=Number.isFinite(state.drawerWidth)?state.drawerWidth:416;
  let start=null;
  function bounds(){
    const max=Math.max(1,document.documentElement.clientWidth-12);
    return {min:Math.min(292,max),max};
  }
  function apply(width,remember=false){
    const {min,max}=bounds();
    const actual=Math.round(Math.max(min,Math.min(max,width)));
    drawer.style.setProperty('--drawer-width',actual+'px');
    grip.setAttribute('aria-valuemin',min);
    grip.setAttribute('aria-valuemax',max);
    grip.setAttribute('aria-valuenow',actual);
    grip.setAttribute('aria-valuetext',actual+' 像素');
    if(remember){preferred=actual;state.drawerWidth=actual;persist();}
  }
  grip.onpointerdown=event=>{
    if(event.button!==0||start)return;
    start={x:event.clientX,width:drawer.offsetWidth,id:event.pointerId};
    grip.setPointerCapture(event.pointerId);
    drawer.classList.add('resizing');
    event.preventDefault();
  };
  grip.onpointermove=event=>{
    if(start?.id===event.pointerId)apply(start.width+event.clientX-start.x);
  };
  function finish(event){
    if(start?.id!==event.pointerId)return;
    start=null;drawer.classList.remove('resizing');
    if(event.type==='pointerup')apply(drawer.offsetWidth,true);
    else apply(preferred);
  }
  grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=finish;
  grip.ondblclick=()=>apply(416,true);
  grip.onkeydown=event=>{
    const {min,max}=bounds();
    const widths={ArrowLeft:drawer.offsetWidth-16,ArrowRight:drawer.offsetWidth+16,Home:min,End:max};
    if(Object.hasOwn(widths,event.key)){event.preventDefault();apply(widths[event.key],true);}
  };
  window.addEventListener('resize',()=>apply(preferred));
  apply(preferred);
}
