'use strict';
function installCodeToolbar(){
  $('#code-format').onclick=async()=>{
    const instance=editor.instance,model=instance.getModel(),version=model.getVersionId(),lang=language();
    const button=$('#code-format');button.disabled=true;
    try{
      const module=lang==='python3'?await import('./vendor/format/ruff/ruff_fmt_web.js'):await import('./vendor/format/clang/clang-format-web.js');
      await module.default();
      if(instance.getModel()!==model||model.getVersionId()!==version)return;
      const input=model.getValue();
      const formatted=lang==='python3'?module.format(input,'main.py'):module.format(input,'main.'+extensions[lang],JSON.stringify({BasedOnStyle:'LLVM',IndentWidth:4,ColumnLimit:100}));
      if(formatted!==input){
        instance.pushUndoStop();instance.executeEdits('format',[{range:model.getFullModelRange(),text:formatted}]);instance.pushUndoStop();
      }
      instance.focus();
    }catch(error){notify('无法格式化：'+error.message);}
    finally{button.disabled=false;}
  };
  $('#code-bookmark').onclick=()=>{
    const key=draftKey(current.id),saved=state.codeBookmarks[key];
    modal('代码版本','<div class="snapshot-actions"><button class="button" id="snapshot-save">保存当前版本</button>'+
      (saved?'<button class="button" id="snapshot-restore">恢复此版本</button>':'')+'</div>'+
      (saved?'<p class="small muted">'+esc(new Date(saved.time).toLocaleString('zh-CN'))+'</p><pre class="result-detail">'+esc(saved.code)+'</pre>':'<p class="small muted">这道题的当前语言和模式尚未保存版本。</p>'));
    $('#snapshot-save').onclick=()=>{
      state.codeBookmarks[key]={time:Date.now(),code:editor.getValue()};persist();closeModal();notify('已保存代码版本');
    };
    if(saved)$('#snapshot-restore').onclick=()=>{closeModal();replaceCode(saved.code,'恢复代码版本','当前草稿会保留在本机备份中。');};
  };
}
