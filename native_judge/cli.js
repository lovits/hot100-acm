'use strict';
const path = require('path');
const { checkCode, runCode } = require('./runner');
const { judgeACM, judgeCore, summarize } = require('./judge');
function loadData(name) { return require(path.join(__dirname, '../dist/training/data', name + '.json')); }
function sendJson(res, status, value) { process.stdout.write(JSON.stringify({status, value})); }
async function handleApi(req, res, body) {
  const { url } = req;
  if (url === '/api/check') {
    const payload = JSON.parse(body || '{}');
    if (typeof payload.code !== 'string') return sendJson(res, 400, { ok: false, error: '参数错误' });
    if(payload.mode==='core' && payload.language==='cpp'){
      const problem=loadData('problems').find(p=>p.id===Number(payload.problemId));
      if(problem) payload.code=require('./core-driver').buildCppDriver({core:problem.core,code:'#line 1 "answer.cpp"\n'+payload.code+'\n#line 1 "driver.cpp"',cases:[]});
    }
    const result = await checkCode({ language: payload.language, code: payload.code, mode: payload.mode || 'acm' });
    return sendJson(res, 200, result);
  }

  if (url === '/api/run') {
    const payload = JSON.parse(body || '{}');
    if (typeof payload.code !== 'string' || typeof payload.input !== 'string') {
      return sendJson(res, 400, { ok: false, error: '参数错误' });
    }
    const result = await runCode({ language: payload.language, code: payload.code, input: payload.input });
    return sendJson(res, 200, result);
  }

  if (url === '/api/judge') {
    const payload = JSON.parse(body || '{}');
    const { problemId, mode, language, code } = payload;
    if (typeof code !== 'string' || !problemId || !mode) return sendJson(res, 400, { ok: false, error: '参数错误' });

    const problems = loadData('problems');
    const tests = loadData('tests');
    const problem = (Array.isArray(problems) ? problems : []).find((p) => p && p.id === Number(problemId));
    if (!problem) return sendJson(res, 404, { ok: false, error: '题目不存在' });

    if (mode === 'core') {
      const core = problem.core;
      if (!core || !core.kind) return sendJson(res, 400, { ok: false, error: '该题目暂无核心代码模式数据' });
      if (language !== 'python3' && language !== 'cpp') {
        return sendJson(res, 400, { ok: false, error: '核心代码模式仅支持 Python3 与 C++' });
      }
      const caseList = payload.samples || (payload.sample ? [payload.sample] : tests[problemId].core);
      if (!caseList.length) return sendJson(res, 400, { ok: false, error: '该题目暂无核心代码测试用例' });
      const outcome = await judgeCore({ language, code, core, tests: caseList });
      if (outcome.error) {
        return sendJson(res, 200, { ok: false, phase: outcome.phase || 'run', error: outcome.error, compileError: outcome.compileError });
      }
      const summary = summarize(outcome.results, mode);
      return sendJson(res, 200, { ok: true, ...summary, elapsed:outcome.elapsed, results: outcome.results });
    }

    // acm
    const caseList = payload.samples || (tests[problemId] && tests[problemId].acm) || [];
    if (!caseList.length) return sendJson(res, 400, { ok: false, error: '该题目暂无 ACM 测试用例' });
    const outcome = await judgeACM({ language, code, tests: caseList });
    if (outcome.error) {
      return sendJson(res, 200, { ok: false, phase: outcome.phase || 'run', error: outcome.error });
    }
    const summary = summarize(outcome.results, mode);
    return sendJson(res, 200, { ok: true, ...summary, elapsed:outcome.elapsed, results: outcome.results });
  }

  throw Error('Unknown action');
}
let body = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { body += chunk; });
process.stdin.on('end', () => handleApi({url: '/api/' + process.argv[2]}, null, body)
  .catch(error => sendJson(null, 500, {ok: false, error: error.message})));
