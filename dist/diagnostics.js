'use strict';
function enableDiagnostics(){
  const instance=editor.instance, status=document.getElementById('syntax-status');
  let timer, generation=0, checking=false, ready=false;
  const show=(message,detail='')=>{
    status.textContent=message;status.title=detail||message;
    status.classList.toggle('has-error',message.startsWith('语法错误'));
  };
  function invalidate(){
    generation++;ready=false;clearTimeout(timer);
    const model=instance.getModel();
    if(model)monaco.editor.setModelMarkers(model,'practice-syntax',[]);
    if(!model||!model.getValue().trim()||document.body.classList.contains('catalog-mode')){show('');return;}
    show('待检查');
    timer=setTimeout(()=>{ready=true;check();},850);
  }
  async function check(){
    if(checking||!ready||!current||serviceStopped)return;
    checking=true;ready=false;
    const version=generation,model=instance.getModel();
    show('检查中…');
    try{
      const response=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json','X-Hot100-Token':session.token},
        body:JSON.stringify({problemId:current.id,mode:coreMode()?'core':'acm',language:language(),code:model.getValue()})});
      const result=await response.json();
      if(version!==generation||model!==instance.getModel())return;
      if(!response.ok||result.error&&!result.stderr){show('检查暂不可用',result.error||'服务连接失败');return;}
      if(result.ok){show('语法通过');return;}
      const log=result.stderr||result.error||'请检查代码语法';
      const native=[...log.matchAll(/(?:answer|main)\.(?:cpp|c):(\d+):(\d+):\s*(?:fatal )?error:\s*([^\r\n]+)/g)];
      const marks=result.diagnostics||native.slice(0,8).map(m=>({line:+m[1],column:+m[2],message:m[3]}));
      const markers=[];
      for(const m of marks){
        if(m.line<1||m.line>model.getLineCount())continue;
        const line=model.getLineContent(m.line);
        const columnAt=n=>Array.from(line).slice(0,Math.max(0,n-1)).join('').length+1;
        let start=Math.min(columnAt(m.column),line.length+1);
        if(start>line.length&&line.length)start=line.length;
        const word=model.getWordAtPosition({lineNumber:m.line,column:start});
        const lastLine=Math.min(model.getLineCount(),Math.max(m.line,m.endLine||m.line));
        const end=m.endColumn>0 ? Array.from(model.getLineContent(lastLine)).slice(0,m.endColumn-1).join('').length+1 : word?.endColumn||start+1;
        markers.push({startLineNumber:m.line,startColumn:start,endLineNumber:lastLine,
          endColumn:Math.min(model.getLineMaxColumn(lastLine),Math.max(lastLine===m.line?start+1:1,end)),
          message:m.message,severity:monaco.MarkerSeverity.Error});
      }
      monaco.editor.setModelMarkers(model,'practice-syntax',markers);
      show('语法错误'+(marks.length?' · 第 '+marks[0].line+' 行':''),marks[0]?.message||log);
    }catch(error){if(version===generation)show('检查暂不可用',error.message);}
    finally{checking=false;if(ready)check();}
  }
  instance.onDidChangeModelContent(invalidate);
  instance.onDidChangeModel(invalidate);
  window.addEventListener('hashchange',invalidate);
  invalidate();
}
