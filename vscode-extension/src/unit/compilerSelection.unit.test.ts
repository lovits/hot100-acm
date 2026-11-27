import {test} from 'node:test';
import * as assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {compilerArgs}=require('../../runtime/native_judge/compiler-command');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {withToolchain,configuredCommand}=require('../../runtime/native_judge/toolchain');
test('selected compiler flags support GNU and MSVC command conventions',()=>{
 const args=['C:/space folder/main.cpp','-O2','-std=c++17','-o','C:/space folder/main.exe'];
 assert.deepEqual(compilerArgs('g++',args),process.platform==='win32'?[...args,'-static']:args);
 assert.deepEqual(compilerArgs('g++',['main.cpp','-fsyntax-only']),['main.cpp','-fsyntax-only']);
 const cl=compilerArgs('cl.exe',args);assert.ok(cl.includes('/std:c++17'));assert.ok(cl.includes('/Fe:C:/space folder/main.exe'));assert.ok(!cl.includes('-o'));
 assert.ok(compilerArgs('cl.exe',['main.c','-std=c11','-o','main.exe']).includes('/std:c11'));
});
test('VS Code selected executables are isolated across concurrent evaluations',async()=>{
 await Promise.all(['a','b'].map(async name=>withToolchain({python3:name},async()=>{await new Promise(r=>setTimeout(r,1));assert.equal(configuredCommand('python3'),name);})));assert.equal(configuredCommand('python3'),undefined);
});
