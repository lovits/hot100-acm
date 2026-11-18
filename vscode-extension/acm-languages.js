'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {commandExists,runProcess}=require('./runtime/native_judge/runner');
const {compareACMOutput}=require('./runtime/dist/judge-rules');
const {outputsEqual}=require('./runtime/native_judge/judge');
// Invoke installed tools directly; no shell interpolation of source or user input.
async function evaluateACM(p,language,code,tests){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hot100-acm-'));
 try{
  const binary=path.join(dir,process.platform==='win32'?'app.exe':'app');
  const name=code.match(/public\s+class\s+(\w+)/)?.[1]||'Main';
  const plans={
   javascript:['main.js',null,[], 'node',[path.join(dir,'main.js')]],
   typescript:['main.ts','tsc',['main.ts','--target','es2020','--module','commonjs','--skipLibCheck'],'node',[path.join(dir,'main.js')]],
   java:[name+'.java','javac',[name+'.java'],'java',['-cp',dir,name]],
   go:['main.go','go',['build','-o',binary,'main.go'],binary,[]],
   rust:['main.rs','rustc',['main.rs','-O','-o',binary],binary,[]],
   swift:['main.swift','swiftc',['main.swift','-o',binary],binary,[]],
   ruby:['main.rb',null,[],'ruby',[path.join(dir,'main.rb')]],
   php:['main.php',null,[],'php',[path.join(dir,'main.php')]],
   kotlin:['Main.kt','kotlinc',['Main.kt','-include-runtime','-d','app.jar'],'java',['-jar',path.join(dir,'app.jar')]],
   scala:['Main.scala','scalac',['Main.scala'],'scala',['-cp',dir,'Main']],
   csharp:['Program.cs','dotnet',['build','-o',path.join(dir,'out'),'--ignore-failed-sources'],'dotnet',[path.join(dir,'out','Practice.dll')]]
  };
  const plan=plans[language];if(!plan)return{error:'该语言尚无本机 ACM 执行适配。'};
  if(language==='typescript'){
   const node=await commandExists('node');
   if(node){const version=await runProcess(node,['--version'],{cwd:dir});if(Number(version.stdout.trim().replace(/^v/,'').split('.')[0])>=22){plan[1]=null;plan[4]=['--experimental-strip-types',path.join(dir,'main.ts')];}}
  }
  let [file,compiler,args,runner,runArgs]=plan;
  if(compiler){compiler=await commandExists(compiler);if(!compiler)return{error:'未找到 '+plan[1]+'，请安装对应工具链并加入 VS Code 的 PATH。'};}
  if(runner!==binary){runner=await commandExists(runner);if(!runner)return{error:'未找到 '+plan[3]+' 运行环境。'};}
  fs.writeFileSync(path.join(dir,file),code);
  if(language==='csharp'){
   const sdk=await runProcess(compiler,['--version'],{cwd:dir,phase:'compile',limits:false}),major=Number(sdk.stdout.trim().split('.')[0]);
   if(!major)return{error:'无法读取 .NET SDK 版本。'};
   fs.writeFileSync(path.join(dir,'Practice.csproj'),`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${major}.0</TargetFramework></PropertyGroup></Project>`);
  }
  if(compiler){const c=await runProcess(compiler,args,{cwd:dir,phase:'compile',limits:false});if(c.code!==0||c.timedOut)return{error:c.stderr||c.stdout||c.error||'编译失败',phase:'compile'};}
  // V8 reserves large virtual ranges; keep timeout and output limits without an address-space cap.
  const results=[];
  for(const t of tests){const r=await runProcess(runner,runArgs,{cwd:dir,input:t.input,limits:!['javascript','typescript','java','go','kotlin','scala','csharp'].includes(language)});
   if(r.code!==0||r.timedOut){results.push({ok:false,error:r.stderr||r.error||'运行失败或超时'});continue;}
   results.push({ok:t.output==null||(p.acm?.judge?compareACMOutput(p.acm.judge,r.stdout,t.output,t.input):outputsEqual(t.output,r.stdout)),got:r.stdout,expected:t.output,ms:r.ms});
  }
  return{results};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={evaluateACM};
