const vscode=require('vscode'),fs=require('fs'),assert=require('assert/strict'),path=require('path');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('lovits.hot100-practice'),api=await extension.activate();const ss=require('../../dist/training/data/solutions.json');const report=[];
 for(const language of ['python3','cpp','c'])for(const mode of ['core','acm']){
  await api.setState(1,language,mode);const doc=vscode.window.activeTextEditor.document;
  const code=language==='c'?(mode==='core'?fs.readFileSync(path.join(__dirname,'c/1.c'),'utf8'):'#include <stdio.h>\n#include <stdlib.h>\nint main(){int n,t;scanf("%d",&n);int*a=malloc(n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",a+i);scanf("%d",&t);for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==t){printf("%d %d\\n",i,j);return 0;}}'):ss[1][language][mode];
  const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),code);assert.ok(await vscode.workspace.applyEdit(edit));
  const r=await api.run(true);assert.ok(r&&!r.error,JSON.stringify(r));assert.ok(r.results.every(x=>x.ok),JSON.stringify(r));
  report.push({language,mode,tests:r.results.length,passed:true});
 }
 await api.setState(1,'c','core');const doc=vscode.window.activeTextEditor.document;assert.match(doc.getText(),/twoSum/);const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),'invalid C code');await vscode.workspace.applyEdit(edit);const bad=await api.run(false);assert.ok(bad.error);
 fs.writeFileSync(path.join(__dirname,'results-host.json'),JSON.stringify({checks:report,compileErrorVerified:true},null,2));
};
