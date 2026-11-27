'use strict';

async function leetcodeRequest(action, body = {}) {
  const response = await fetch(`/api/leetcode/${action}`, {method:'POST',headers:{'Content-Type':'application/json','X-Hot100-Token':session.token},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || '力扣请求失败');
  return result;
}
function leetcodeIndicator(signedIn) {
  const button = $('#nav-leetcode'); let dot = button.querySelector('.leetcode-dot');
  if (signedIn && !dot) { dot = document.createElement('span'); dot.className = 'leetcode-dot'; button.append(dot); }
  if (!signedIn && dot) dot.remove();
}
async function leetcodeDialog() {
  const response = await fetch('/api/leetcode/status');
  if (!response.ok) throw Error('无法读取登录状态');
  const status = await response.json(); leetcodeIndicator(status.signedIn);
  if (!status.signedIn) {
    modal('力扣登录', `<p>在隔离的 Chrome / Edge 窗口中登录，支持力扣 App 扫码。</p><p><button class="button submit" id="lc-browser">浏览器一键登录</button></p><p>也可以手动粘贴 Cookie：</p><p><label>LEETCODE_SESSION <input id="lc-session" type="password" autocomplete="off"></label></p><p><label>csrftoken <input id="lc-csrf" type="password" autocomplete="off"></label></p><button class="button" id="lc-manual">Cookie 登录</button><p class="small muted">登录仅用于当前运行的本地服务，不会同步到远程服务器。</p>`);
    const login = async (action, payload) => {
      $('#lc-browser').disabled = $('#lc-manual').disabled = true;
      try { await leetcodeRequest(action, payload); leetcodeIndicator(true); await leetcodeDialog(); }
      catch (error) { notify(error.message); if ($('#lc-browser')) $('#lc-browser').disabled = $('#lc-manual').disabled = false; }
    };
    $('#lc-browser').onclick = () => { notify('请在新打开的浏览器中登录力扣'); login('browser', {}); };
    $('#lc-manual').onclick = () => login('manual', {session:$('#lc-session').value,csrf:$('#lc-csrf').value});
    return;
  }
  modal('力扣账号', `<p>已登录 ${esc(status.username)}</p><div class="solution-actions"><button class="button" id="lc-solved">同步官网通过记录</button><button class="button" id="lc-submissions">查看本题官网提交</button><button class="button" id="lc-submit">提交当前核心代码</button><button class="button" id="lc-logout">退出登录</button></div><div id="lc-results"></div>`);
  $('#lc-logout').onclick = async () => { await leetcodeRequest('logout'); leetcodeIndicator(false); await leetcodeDialog(); };
  $('#lc-solved').onclick = async () => {
    const button=$('#lc-solved');button.disabled=true;
    try {
      const data=await leetcodeRequest('solved'),now=Date.now();let count=0;
      for(const id of data.ids){
        if(!problems.some(p=>p.id===id)||state.accepted.includes(id))continue;
        const prior=state.progressMeta[id]||{};
        if(prior.resetAt)continue;
        state.accepted.push(id);state.progressMeta[id]={...prior,solvedAt:now};count++;
      }
      persist();renderList();renderContent();notify(`已同步 ${count} 道官网通过题目`);
    }catch(error){notify(error.message);}finally{if(button.isConnected)button.disabled=false;}
  };
  $('#lc-submissions').onclick = async () => {
    const id=current.id, button=$('#lc-submissions');button.disabled=true;
    try {
      const data=await leetcodeRequest('submissions',{id});
      $('#lc-results').innerHTML=data.submissions.length?data.submissions.map(row=>`<p>${esc(row.statusDisplay)} · ${esc(row.lang)} · ${esc(new Date(Number(row.timestamp)*1000).toLocaleString('zh-CN'))} <button class="text-btn" data-lc-submission="${esc(row.id)}">载入代码</button></p>`).join(''):'<p>本题暂无官网提交记录。</p>';
      $('#lc-results').querySelectorAll('[data-lc-submission]').forEach(item=>item.onclick=async()=>{
        try{const detail=await leetcodeRequest('detail',{id,submissionId:item.dataset.lcSubmission});if(current.id!==id)throw Error('题目已切换，请重新选择提交记录');if(!detail?.code)throw Error('未找到提交代码');replaceCode(detail.code,'载入力扣代码','将保留当前代码的恢复副本，再载入官网提交代码。');}catch(error){notify(error.message);}
      });
    }catch(error){notify(error.message);}finally{if(button.isConnected)button.disabled=false;}
  };
  $('#lc-submit').onclick=async()=>{
    if(!coreMode())return notify('请先切换到核心代码模式');
    const id=current.id,lang=language(),code=editor.getValue(),button=$('#lc-submit');button.disabled=true;
    try{
      const result=await leetcodeRequest('submit',{id,language:lang,code});
      if(!result.submission_id)throw Error('力扣未返回提交编号');
      notify('已提交力扣，正在等待判题');
      let final;
      for(let i=0;i<45;i++){
        await new Promise(resolve=>setTimeout(resolve,2000));
        final=await leetcodeRequest('check',{submissionId:String(result.submission_id)});
        if(final.state==='SUCCESS')break;
      }
      if(final?.state!=='SUCCESS')throw Error('判题仍在进行，请稍后查看官网提交记录');
      if(final.status_msg==='Accepted'){
        const alreadySolved=state.accepted.includes(id),meta=state.progressMeta[id]||{};
        if(!alreadySolved){state.accepted.push(id);state.progressMeta[id]={...meta,solvedAt:Math.max(Date.now(),(meta.resetAt||0)+1)};}
        state.studyPlan=StudyPlan.record(state.studyPlan,id,StudyPlan.localDate(),state.studySettings.intervals,'test',alreadySolved);
        persist();renderList();renderContent();updateStudyBadge();
      }
      notify(`力扣判题：${final.status_msg || '已完成'}`);
    }catch(error){notify(error.message);}finally{if(button.isConnected)button.disabled=false;}
  };
}
function installLeetCode() {
  $('#nav-leetcode').onclick=()=>leetcodeDialog().catch(error=>notify(error.message));
  fetch('/api/leetcode/status').then(response=>response.json()).then(status=>leetcodeIndicator(status.signedIn)).catch(()=>{});
}
