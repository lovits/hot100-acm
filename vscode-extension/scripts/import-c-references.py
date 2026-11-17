import re,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];up=root.parent/'c-reference-upstream';out=root/'vscode-extension/test/c';out.mkdir(exist_ok=True)
ps=json.loads((root/'vscode-extension/data/problems.json').read_text())
for p in ps:
 files=[f for d in up.glob(f'{p["id"]:04d}_*') for f in d.glob('*.c')]
 if not files:continue
 s=files[0].read_text();s=re.split(r'\nint main\s*\(',s)[0]
 s=re.sub(r'struct (ListNode|TreeNode|Node)\s*\{[^}]*\}\s*;', '',s,flags=re.S)
 if p['id']==1:s=re.sub(r'\btwosum\b','twoSum',s)
 (out/f'{p["id"]}.c').write_text(s)
(root/'vscode-extension/test/C-REFERENCE-LICENSE').write_text((up/'LICENSE').read_text())
(root/'vscode-extension/test/c-source.json').write_text(json.dumps({'repository':'https://github.com/begeekmyfriend/leetcode','commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=up,text=True).strip(),'license':'MIT','note':'测试参考解经接口适配，不随 VSIX 分发。'},ensure_ascii=False,indent=2))
