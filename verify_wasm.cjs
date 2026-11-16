// Same vendored Python runtime and same harness as the browser worker, with external fetch denied.
const fs=require('fs'),path=require('path');
const {loadPyodide}=require('./dist/vendor/pyodide/pyodide.js');
const network=[];global.fetch=async(...args)=>{network.push(String(args[0]));throw new Error('Offline verification forbids network');};
(async()=>{
 const py=await loadPyodide({indexURL:path.join(__dirname,'dist/vendor/pyodide/')});
 const source=fs.readFileSync('dist/runner.js','utf8');
 const harness=source.match(/const harness = `([\s\S]*?)`;/)[1];py.runPython(harness);
 const problems=JSON.parse(fs.readFileSync('dist/problems.json','utf8'));let passed=0;const failures=[];
 for(const p of problems)for(let i=0;i<p.tests.length;i++){
  const test=p.tests[i];py.globals.set('_acm_source',p.solution);py.globals.set('_acm_input',test.input+'\n');
  const result=JSON.parse(py.runPython('_acm_run(_acm_source, _acm_input)'));
  const a=result.output.trim().split(/\s+/).filter(Boolean),b=test.output.trim().split(/\s+/).filter(Boolean);
  const ok=!result.error&&a.length===b.length&&a.every((v,k)=>p.judge==='float'?Math.abs(Number(v)-Number(b[k]))<=1e-6:v===b[k]);
  if(ok)passed++;else failures.push({id:p.id,index:i,result});
 }
 const report={runtime:'Pyodide 0.27.7 / Python 3.12',passed,failures,externalNetworkRequests:network};
 fs.writeFileSync('reference/wasm-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(failures.length||network.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
