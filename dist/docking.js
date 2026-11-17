'use strict';
function installDocking(){
  const names={problem:'题目描述',reading:'题解',history:'提交记录',code:'代码',test:'测试用例',result:'测试结果',notes:'笔记',leet:'Leet'};
  const panels={problem:$('.problem-panel'),reading:$('#pinned-reading'),history:$('#history-panel'),result:$('#result-panel'),code:$('.editor-panel'),test:$('.test-panel')};
  const notes=document.createElement('section');notes.className='panel dock-notes';
  const pad=document.createElement('textarea');pad.setAttribute('aria-label','本题笔记');pad.placeholder='记录这道题的思路、易错点和复习要点…';notes.append(pad);panels.notes=notes;
  pad.oninput=()=>{if(current){state.notes[current.id]=pad.value;const other=$('#notes');if(other)other.value=pad.value;persist();}};
  document.addEventListener('input',e=>{if(e.target.id==='notes')pad.value=e.target.value;});
  const guide=document.createElement('section');guide.className='panel dock-guide';panels.leet=guide;
  function guideContent(){if(!current)return;
    guide.innerHTML='<h3>本题提示</h3>'+current.idea.map((v,i)=>'<details><summary>提示 '+(i+1)+'</summary><p>'+esc(v)+'</p></details>').join('')+'<p class="small muted">来自本地题库</p>';
  }
  const contentBeforeNotes=renderContent;renderContent=function(){contentBeforeNotes();guideContent();if(current)pad.value=state.notes[current.id]||'';};
  const group=(...tabs)=>({tabs,active:tabs[0]});
  const split=(axis,a,b,ratio=.5)=>({axis,a,b,ratio});
  const standard=()=>split('x',group('problem','reading','history','notes','leet'),split('y',group('code'),group('test','result'),.67));
  function valid(tree){
    const ids=[];
    function visit(n,depth){
      if(!n||depth>8)return false;
      if(Array.isArray(n.tabs)){ids.push(...n.tabs);return n.tabs.length>0&&n.tabs.includes(n.active);}
      return ['x','y'].includes(n.axis)&&Number.isFinite(n.ratio)&&n.ratio>=.15&&n.ratio<=.85&&visit(n.a,depth+1)&&visit(n.b,depth+1);
    }
    return visit(tree,0)&&new Set(ids).size===ids.length&&ids.every(k=>Object.hasOwn(names,k))&&['problem','reading','code','test'].every(k=>ids.includes(k));
  }
  let tree=valid(state.panelLayout)?state.panelLayout:standard(), solo=null;
  function migrate(n){
    for(const [id,neighbor] of [['history','problem'],['result','test'],['leet','reading'],['notes','reading']]){
      if(!find(n,id))find(n,neighbor).tabs.push(id);
    }
    return n;
  }
  migrate(tree);
  const folded=new Set((state.foldedPanes||['notes','leet']).filter(id=>names[id]));
  if(folded.size===Object.keys(names).length)folded.delete('code');
  const visible=n=>n.tabs?n.tabs.some(id=>!folded.has(id)):visible(n.a)||visible(n.b);
  if(!state.panelLayout?.tabs&&!JSON.stringify(state.panelLayout||{}).includes('"leet"'))folded.add('leet');
  const strip=document.createElement('div');strip.id='folded-panes';$('.main-area').append(strip);
  function fold(id){
    if(Object.keys(names).length-folded.size<=1){notify('至少保留一个展开的面板');return;}
    folded.add(id);solo=null;render();save();
  }
  const dock=document.createElement('div');dock.id='dock-workspace';$('.main-area').append(dock);
  document.body.classList.add('dock-enabled');
  const el=(tag,cls)=>{const node=document.createElement(tag);node.className=cls;return node;};
  const button=(label,title,fn)=>{const b=el('button','dock-action');b.textContent=label;b.title=b.ariaLabel=title;b.onclick=fn;return b;};
  function save(){state.foldedPanes=[...folded];state.panelLayout=structuredClone(tree);persist();}
  function find(n,id){return n.tabs?(n.tabs.includes(id)?n:null):(find(n.a,id)||find(n.b,id));}
  function remove(n,id){
    if(n.tabs){n.tabs=n.tabs.filter(k=>k!==id);if(n.active===id)n.active=n.tabs[0];return n.tabs.length?n:null;}
    n.a=remove(n.a,id);n.b=remove(n.b,id);return n.a&&n.b?n:n.a||n.b;
  }
  function replace(n,old,next){if(n===old)return next;if(!n.tabs){n.a=replace(n.a,old,next);n.b=replace(n.b,old,next);}return n;}
  function move(source,target,zone){
    if(source===target)return;
    tree=remove(tree,source);const dest=find(tree,target);
    dest.compact=false;
    if(zone==='center'){dest.tabs.push(source);dest.active=source;}
    else{
      const first=['left','top'].includes(zone),other=group(source);
      tree=replace(tree,dest,split(['left','right'].includes(zone)?'x':'y',first?other:dest,first?dest:other));
    }
    folded.delete(source);folded.delete(target);solo=null;render();save();
  }
  function position(e,box){
    const r=box.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    const zones=[['left',x],['right',1-x],['top',y],['bottom',1-y]].sort((a,b)=>a[1]-b[1]);
    return zones[0][1]<.25?zones[0][0]:'center';
  }
  const paneIcons={problem:'file',reading:'flask',history:'history',code:'code',test:'check-square',result:'terminal',notes:'book',leet:'bulb'};
  const readingTabs={problem:'description',reading:'solution',history:'history'};
  function enableTabDrag(tab,id){
    tab.onpointerdown=e=>{
      if(solo||e.button!==0)return;
      const pointer=e.pointerId,startX=e.clientX,startY=e.clientY;
      let dragging=false,target=null,zone=null;
      tab.setPointerCapture(pointer);
      function track(event){
        if(event.pointerId!==pointer)return;
        if(!dragging && Math.hypot(event.clientX-startX,event.clientY-startY)<5)return;
        dragging=true;
        const pane=document.elementFromPoint(event.clientX,event.clientY)?.closest('.dock-pane');
        if(target && target!==pane)delete target.dataset.drop;
        target=pane&&(pane.dataset.current!==id||find(tree,id).tabs.some(k=>k!==id&&!folded.has(k)))?pane:null;
        if(target){
          zone=event.clientY<target.getBoundingClientRect().top+32?'center':position(event,target);
          target.dataset.drop=zone;
        }
      }
      function finish(event){
        if(event.pointerId!==pointer)return;
        if(target)delete target.dataset.drop;
        tab.removeEventListener('pointermove',track);
        tab.removeEventListener('pointerup',finish);
        tab.removeEventListener('pointercancel',finish);
        tab.removeEventListener('lostpointercapture',finish);
        if(!dragging)return;
        const suppress=click=>{click.preventDefault();click.stopImmediatePropagation();};
        document.addEventListener('click',suppress,true);
        setTimeout(()=>document.removeEventListener('click',suppress,true),0);
        if(event.type==='pointerup'&&target){
          const active=target.dataset.current;
          if(active!==id)move(id,active,zone);
          else if(zone!=='center')move(id,find(tree,id).tabs.find(k=>k!==id&&!folded.has(k)),zone);
        }
      }
      tab.addEventListener('pointermove',track);
      tab.addEventListener('pointerup',finish);
      tab.addEventListener('pointercancel',finish);
      tab.addEventListener('lostpointercapture',finish);
    };
  }
  function leaf(n,axis='y',first=false){
    const box=el('section','dock-pane'),bar=el('div','dock-tabs');bar.setAttribute('role','tablist');
    function select(k){
      n.compact=false;n.active=k;
      if(solo)solo=k;
      if(readingTabs[k] && mainTab!==readingTabs[k]){
        const detail=k==='reading'?solutionDetailId:k==='history'?historyDetailId:'';
        navigate(tabPath(readingTabs[k])+(detail?'/'+detail:''));
      }
      if(k==='test'||k==='result')bottomTab=k==='test'?'input':'result';
      render();save();
    }
    if(!n.active||folded.has(n.active))n.active=n.tabs.find(k=>!folded.has(k));
    for(const k of n.tabs.filter(k=>!folded.has(k))){
      const tab=button(names[k],'拖动'+names[k]+'标签以调整布局',()=>select(k));
      tab.innerHTML=icon(paneIcons[k])+'<span>'+names[k]+'</span>';tab.dataset.pane=k;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(n.active===k));
      enableTabDrag(tab,k);
      bar.append(tab);
    }
    const zoom=button('',solo?'还原布局':'最大化面板',()=>{solo=solo?null:n.active;if(solo)n.compact=false;render();});
    zoom.innerHTML=icon(solo?'panel':'expand');zoom.classList.add('dock-zoom');
    const hide=button('',(n.compact?'展开':'折叠')+names[n.active]+'面板',()=>{n.compact=!n.compact;solo=null;render();save();});
    const towardFirst=first!==!!n.compact;
    hide.innerHTML=icon(axis==='x'?(towardFirst?'left':'right'):'down');
    if(axis==='y' && towardFirst)hide.firstChild.style.transform='rotate(180deg)';
    hide.setAttribute('aria-expanded',String(!n.compact));hide.classList.add('dock-fold');
    bar.append(zoom,hide);
    box.classList.toggle('compact',!!n.compact&&!solo);box.append(bar,panels[n.active]);box.dataset.current=n.active;
    return box;
  }
  function branch(n,axis,first){
    if(n.tabs)return leaf(n,axis,first);
    if(!visible(n.a))return branch(n.b,axis,first);if(!visible(n.b))return branch(n.a,axis,first);
    const node=el('div','dock-branch '+n.axis),divider=el('div','dock-divider');
    const horizontal=n.axis==='x';
    divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label',horizontal?'调整左右宽度':'调整上下高度');divider.setAttribute('aria-orientation',horizontal?'vertical':'horizontal');
    const sizing=()=>{node.style.setProperty('--first',n.ratio+'fr');node.style.setProperty('--second',(1-n.ratio)+'fr');divider.setAttribute('aria-valuenow',Math.round(n.ratio*100));};
    if(n.a.compact||n.b.compact){node.dataset.compact=n.a.compact?'first':'second';divider.ondblclick=()=>{n.a.compact=n.b.compact=false;render();save();};}
    const adjust=r=>{if(node.dataset.compact){n.a.compact=n.b.compact=false;delete node.dataset.compact;node.querySelectorAll(':scope > .compact').forEach(box=>box.classList.remove('compact'));}n.ratio=Math.min(.85,Math.max(.15,r));sizing();};
    divider.onpointerdown=e=>{e.preventDefault();divider.setPointerCapture(e.pointerId);const rect=node.getBoundingClientRect();
      divider.onpointermove=p=>adjust(horizontal?(p.clientX-rect.left)/rect.width:(p.clientY-rect.top)/rect.height);
      divider.onpointerup=divider.onpointercancel=()=>{divider.onpointermove=null;render();save();};
    };
    divider.onkeydown=e=>{const keys=horizontal?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(keys.includes(e.key)){e.preventDefault();adjust(n.ratio+(e.key===keys[0]?-.03:.03));save();}};
    sizing();node.append(branch(n.a,n.axis,true),divider,branch(n.b,n.axis,false));return node;
  }
  const parking=el('div','dock-parking');parking.hidden=true;document.body.append(parking);
  function render(){
    // Keep every editor and content node mounted, including inactive tabs.
    for(const panel of Object.values(panels))parking.append(panel);
    strip.replaceChildren(...[...folded].filter(id=>!['leet','notes'].includes(id)).map(id=>button('▸ '+names[id],'展开'+names[id]+'面板',()=>reveal(id))));
    strip.hidden=!strip.childElementCount;
    dock.replaceChildren(solo?leaf(find(tree,solo)):branch(tree));
    requestAnimationFrame(()=>editor.refresh());
  }
  function reveal(id){
    const n=find(tree,id);const wasFolded=folded.delete(id);const compact=n.compact;n.compact=false;if(!compact&&!wasFolded&&n.active===id&&(!solo||solo===id))return;
    n.active=id;if(solo)solo=null;render();save();
  }
  function arrange(){
    const options=Object.entries(names).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
    modal('工作区布局','<p>拖动面板标签到另一块面板。放在边缘可分栏，放在中央可合并为标签。</p><div class="dock-form"><label>移动面板<select id="move-pane">'+options+'</select></label><label>目标面板<select id="target-pane">'+options+'</select></label><label>放置位置<select id="dock-side"><option value="center">合并为标签</option><option value="left">左侧</option><option value="right">右侧</option><option value="top">上方</option><option value="bottom">下方</option></select></label></div><div class="solution-actions"><button class="button submit" id="dock-apply">应用</button><button class="button" id="dock-classic">题目和题解合并</button><button class="button" id="dock-reset">恢复默认布局</button></div>');
    $('#target-pane').value='reading';
    $('#dock-apply').onclick=()=>{const a=$('#move-pane').value,b=$('#target-pane').value;if(a===b){notify('请选择不同的目标面板');return;}move(a,b,$('#dock-side').value);closeModal();};
    function preset(n){tree=n;if(!find(tree,'leet'))find(tree,'reading').tabs.push('leet');if(!find(tree,'notes'))find(tree,'reading').tabs.push('notes');folded.clear();folded.add('notes');solo=null;render();save();closeModal();}
    $('#dock-classic').onclick=()=>preset(standard());
    $('#dock-reset').onclick=()=>preset(standard());
  }
  const tests=()=>Object.assign(group('test','result'),{compact:true});
  const presets=[
    ['预设','题目与代码左右分栏',standard],
    ['Leet','题目、代码、Leet 三栏',()=>split('x',group('problem','reading','history','notes'),split('x',split('y',group('code'),tests(),.67),group('leet')),.333)],
    ['笔记','同时查看题目、笔记和代码',()=>split('x',group('problem','reading','history','leet'),split('x',group('notes'),split('y',group('code'),group('test','result'),.7)),.333)],
    ['调试','题目、代码、运行结果三栏',()=>split('x',group('problem','reading','history','notes','leet'),split('x',group('code'),split('y',group('result'),group('test'),.7)),.333)],
  ];
  const pop=el('section','layout-pop');pop.hidden=true;pop.id='layout-pop';pop.setAttribute('aria-label','布局');document.body.append(pop);
  function close(){pop.hidden=true;layoutButton.setAttribute('aria-expanded','false');}
  function preview(n){
    const box=el('span','mini-layout');
    if(n.tabs){box.classList.add('mini-pane');box.title=names[n.active];}
    else{box.classList.add('mini-'+n.axis);if(n.b.compact)box.classList.add('mini-folded');box.style.setProperty('--mini-a',n.ratio+'fr');box.style.setProperty('--mini-b',(1-n.ratio)+'fr');box.append(preview(n.a),preview(n.b));}
    return box;
  }
  function preset(n,hidden=[],keepOpen=false){tree=migrate(n);folded.clear();hidden.forEach(id=>folded.add(id));solo=null;render();save();if(!keepOpen)close();}
  function show(){
    if(!pop.hidden){close();return;}
    pop.replaceChildren();const head=el('header','layout-head');const title=el('strong','');title.textContent='布局';
    const help=button('帮助','如何调整布局',()=>{close();modal('布局帮助','<p>点击缩略图可应用布局。拖动标签到面板边缘可以分栏，拖到中央可以合并标签。拖动分隔线调整比例。</p><p>将指针移到面板标题栏，点击箭头折叠，点击标签重新展开。点击方框放大面板，再次点击还原。</p>');});head.append(title,help);pop.append(head);
    const shape=n=>n.tabs?n.tabs.join('+'):[n.axis,shape(n.a),shape(n.b)].join('/');
    const list=el('div','preset-list');
    for(const [label,desc,build] of presets){
      const n=build(),btn=button('',desc,()=>{
        preset(build(),label==='Leet'?['notes']:label==='笔记'?['leet']:['notes','leet'],true);
        list.querySelectorAll('[data-preset]').forEach(tile=>tile.setAttribute('aria-pressed',String(tile===btn)));
      });
      btn.dataset.preset=label;btn.setAttribute('aria-pressed',String(shape(n)===shape(tree)&&Math.abs(n.ratio-tree.ratio)<.01));btn.className='preset-tile';btn.setAttribute('aria-label',label+'布局：'+desc);
      const caption=el('span','');caption.textContent=label;const thumb=preview(n);const apply=el('span','apply-overlay');apply.textContent='应用';const pill=el('b','');pill.textContent=apply.textContent;apply.replaceChildren(pill);thumb.append(apply);btn.append(thumb,caption);list.append(btn);
    }
    const custom=button('自定义布局','管理本地布局',()=>{close();manage();});custom.classList.add('custom-tile');list.append(custom);pop.append(list);
    pop.hidden=false;layoutButton.setAttribute('aria-expanded','true');positionMenu();
  }
  function positionMenu(){
    if(pop.hidden)return;
    const r=layoutButton.getBoundingClientRect();pop.style.top=r.bottom+5+'px';pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,r.left+r.width/2-pop.offsetWidth/2))+'px';pop.style.right='auto';
  }
  window.addEventListener('resize',positionMenu);
  function manage(){
    modal('自定义布局','<div class="solution-actions"><button class="button" id="custom-move">移动面板</button><button class="button" id="custom-store">保存当前布局</button><button class="button" id="custom-load">应用已保存布局</button><button class="button" id="custom-reset">恢复预设</button></div>');
    $('#custom-move').onclick=arrange;
    $('#custom-store').onclick=()=>{state.savedWorkspace={tree:structuredClone(tree),folded:[...folded]};persist();closeModal();notify('布局已保存');};
    const saved=state.savedWorkspace;$('#custom-load').disabled=!saved||!valid(saved.tree);
    $('#custom-load').onclick=()=>{const n=structuredClone(saved.tree);if(!find(n,'leet'))find(n,'reading').tabs.push('leet');preset(n,saved.folded||[]);closeModal();};
    $('#custom-reset').onclick=()=>{preset(standard(),['notes','leet']);closeModal();};
  }
  const layoutButton=button('','布局',show);layoutButton.id='workspace-layout';layoutButton.setAttribute('aria-controls',pop.id);layoutButton.setAttribute('aria-expanded','false');
  layoutButton.innerHTML='<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="5" height="6" rx="1"/><rect x="12" y="3" width="5" height="3" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="9" width="5" height="8" rx="1"/></svg>';
  $('.top-right').prepend(layoutButton);
  document.addEventListener('pointerdown',e=>{if(!pop.contains(e.target)&&!layoutButton.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){close();layoutButton.focus();}});
  window.addEventListener('hashchange',close);
  const oldRun=runCode;runCode=function(submit){if(!submit){try{visibleTests();}catch(error){reveal('test');notify(error.message);return;}}reveal('result');return oldRun(submit);};
  document.addEventListener('show-reading-pane',e=>{
    const id={description:'problem',solution:'reading',history:'history'}[e.detail];
    if(id)reveal(id);
  });
  document.addEventListener('click',e=>{if(e.target.closest('[data-use-case]'))reveal('test');});
  if(route.kind==='solutions'||route.kind==='submissions')reveal(route.kind==='solutions'?'reading':'history');
  state.readAlong=true;
  // Initialize the reading pane even if an older layout had it collapsed.
  renderContent();render();
}




