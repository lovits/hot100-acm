// Warm and verify the CI compiler environment before timed per-question tests.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hot100-toolchain-'));
try{for(const [compiler,extension,source]of [['gcc','c','#include <stdio.h>\nint main(void){puts("hot100");}'],['g++','cpp','#include <cstdio>\nint main(){puts("hot100");}']]){
 const file=path.join(dir,'main.'+extension),bin=path.join(dir,compiler==='gcc'?'c-check':'cpp-check')+(process.platform==='win32'?'.exe':'');
 fs.writeFileSync(file,source);execFileSync(compiler,[file,'-o',bin],{timeout:90000,stdio:'pipe'});
 if(execFileSync(bin,{encoding:'utf8',timeout:10000}).trim()!=='hot100')throw Error('Compiler smoke check failed: '+compiler);
 console.log(compiler+' compile/run verified');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}
