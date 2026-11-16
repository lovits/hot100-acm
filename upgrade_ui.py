from pathlib import Path
import re
from build_icon import build_icon
ROOT=Path(__file__).parent
for file in ['app.js','index.html']:
    backup=ROOT/'reference'/('v1-'+file)
    if not backup.exists():backup.write_bytes((ROOT/'dist'/file).read_bytes())
s=(ROOT/'reference/v1-app.js').read_text(encoding='utf-8')
start=s.index('  editor=CodeMirror.fromTextArea')
end=s.index("  $('#search').oninput",start)
s=s[:start]+'''  editor=await createEditor();
  editor.on('change',()=>{if(loadingCode||!current)return;state.codes[current.id]=editor.getValue();persist();});
  editor.on('cursorActivity',()=>{const c=editor.getCursor();$('#cursor-position').textContent=`行 ${c.line+1}，列 ${c.ch+1}`;saveView();});
  window.addEventListener('hashchange',routePage);
  routePage();
''' +s[end:]
s=s.replace("const t=e.target.closest('[data-tab]');if(t){mainTab=t.dataset.tab;renderContent();$('#problem-content').scrollTop=0;}","const t=e.target.closest('[data-tab]');if(t)navigate(tabPath(t.dataset.tab));")
s=s.replace("editor.getWrapperElement().style.fontSize=state.fontSize+'px';editor.refresh();persist();","editor.instance.updateOptions({fontSize:state.fontSize});persist();")
s=s[:s.index("init().catch")]
s=s.replace("history.unshift({time:Date.now(),verdict,passed,total:job.tests.length,code:job.code});state.history[job.problem.id]=history.slice(0,20);","history.unshift({id:crypto.randomUUID(),time:Date.now(),verdict,passed,total:job.tests.length,code:job.code,items:job.items});state.history[job.problem.id]=history;")
s=s.replace("persist();renderList();renderContent();\n  }","persist();renderList();if(!job.silent&&current?.id===job.problem.id)navigate(`#/problems/${current.id}/submissions/${history[0].id}`);\n  }")
s=s.replace("'Python 环境加载超时，请检查网络并重新运行。'","'本地 Python 环境加载超时，请重新运行或检查本地程序文件。'")
s=s.replace("首次加载约 14 MB，之后由浏览器缓存。","从本地文件加载 Python，首次初始化需要几秒。")
s=s.replace('<span class="tag ${difficultyClass(current.difficulty)}">${current.difficulty}</span>', '${difficultyBadge(current)}')
(ROOT/'dist/app.js').write_text(s,encoding='utf-8')
h=(ROOT/'reference/v1-index.html').read_text(encoding='utf-8')
h=re.sub(r'<link rel="icon"[^>]+>', '<link rel="icon" href="assets/app-hot100oj.ico">',h)
h=h.replace('<link rel="stylesheet" href="vendor/codemirror.css">','')
h=h.replace('<link rel="stylesheet" href="leetcode.css">','<link rel="stylesheet" href="leetcode.css"><link rel="stylesheet" href="local.css"><link rel="stylesheet" href="workspace.css"><link rel="stylesheet" href="vendor/katex/katex.min.css"><link rel="stylesheet" href="authors.css">')
h=h.replace('id="run" title="Ctrl + Enter"','id="run" aria-label="运行" title="Ctrl + Enter"')
h=re.sub(r'<a class="brand" href="#problem/1".*?</a><span class="top-divider"></span>', '',h)
h=h.replace('<strong>题库</strong>', '<strong>LeetCode 热题 100</strong>')
h=h.replace('<span data-icon="panel"></span><strong>LeetCode 热题 100</strong>', '<span class="studyplan-mark"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 15a8 8 0 1 0-3 2l4 1-1-3Z"/><path d="M10 13C3 9 6 5 8 7l2 1 2-1c3-2 5 2-2 6Z" fill="currentColor" stroke="none"/></svg></span><strong>LeetCode 热题 100</strong>')
h=h.replace('<span class="menu-collection">Hot 100</span>', '')
h=h.replace('data-icon="fold"></button></div></div>', 'data-icon="fold" hidden></button></div><label class="tag-toggle drawer-tag-toggle"><input id="drawer-show-tags" type="checkbox" role="switch" checked>显示标签</label></div>')
h=h.replace('<textarea id="editor" aria-label="Python 代码编辑器" spellcheck="false"></textarea>','<div id="editor" aria-label="Python 代码编辑器"></div>')
h=h.replace('<span class="avatar">P</span>','<button class="icon-btn" id="shutdown" title="退出本地服务" aria-label="退出本地服务" data-icon="stop"></button><span class="avatar">P</span>')
h=h.replace('<span class="runtime-state" id="runtime-state">','<button class="icon-btn tiny" id="collapse-tests" title="收起或展开测试面板" aria-label="收起或展开测试面板" data-icon="down"></button><span class="runtime-state" id="runtime-state">')
h=re.sub(r'<script src="vendor/codemirror.js">.*?</script>\s*</body>', '<script src="vendor/katex/katex.min.js"></script><script src="vendor/monaco/vs/loader.js"></script><script src="app.js"></script><script src="authors.js"></script><script src="local.js"></script>\n</body>',h,flags=re.S)
(ROOT/'dist/index.html').write_text(h,encoding='utf-8')
build_icon()
print('UI bootstrap updated; original Hot100 OJ icon applied.')
