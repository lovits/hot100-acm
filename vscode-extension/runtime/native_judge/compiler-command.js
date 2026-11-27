'use strict';
const path=require('node:path');
function compilerArgs(command,args){
 if(!/^(?:cl|clang-cl)(?:\.exe)?$/i.test(path.basename(command))){
  if(process.platform==='win32' && /^(?:gcc|g\+\+)(?:[-.\d]*)(?:\.exe)?$/i.test(path.basename(command)) && args.includes('-o'))return [...args,'-static'];
  return args;
 }
 const source=args.find(a=>/\.(c|cpp)$/i.test(a));if(!source)return args;
 const cpp=/\.cpp$/i.test(source),output=args.indexOf('-o');
 const converted=['/nologo',...(cpp?['/EHsc','/std:c++17','/I'+path.join(__dirname,'include')]:['/std:c11']),'/O2',source];
 if(output>=0)converted.push('/Fe:'+args[output+1]);
 if(args.includes('-fsyntax-only'))converted.push('/Zs');
 return converted;
}
module.exports={compilerArgs};
