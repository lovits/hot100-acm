/* Python executes off the UI thread. The main page enforces a per-case timeout. */
importScripts('./vendor/pyodide/pyodide.js');
let ready = loadPyodide({indexURL: './vendor/pyodide/'});
const harness = `
import sys as _sys, io as _io, json as _json, traceback as _traceback, time as _time
def _acm_run(source, data):
    class LimitedOutput(_io.StringIO):
        def write(self, text):
            if self.tell() + len(text) > 2097152:
                raise RuntimeError('输出超过 2 MB，请检查循环或减少调试输出。')
            return super().write(text)
    old = _sys.stdin, _sys.stdout, _sys.stderr
    _sys.stdin = _io.TextIOWrapper(_io.BytesIO(data.encode('utf-8')))
    _sys.stdout = LimitedOutput()
    _sys.stderr = LimitedOutput()
    error = ''
    start = _time.perf_counter()
    try:
        exec(compile(source, 'main.py', 'exec'), {'__name__': '__main__'})
    except SystemExit as e:
        if e.code not in (None, 0): error = 'SystemExit: ' + str(e.code)
    except BaseException:
        error = _traceback.format_exc()
    finally:
        result = {'output': _sys.stdout.getvalue(), 'error': error, 'stderr': _sys.stderr.getvalue(), 'ms': round((_time.perf_counter()-start)*1000, 2)}
        _sys.stdin, _sys.stdout, _sys.stderr = old
    return _json.dumps(result)
`;
self.onmessage = async ({data}) => {
  try {
    self.postMessage({type:'loading'});
    const py = await ready;
    py.runPython(harness);
    self.postMessage({type:'ready'});
    for(let i=0;i<data.inputs.length;i++) {
      self.postMessage({type:'case-start',index:i});
      py.globals.set('_acm_source',data.code);
      py.globals.set('_acm_input',data.inputs[i]+'\n');
      const result=JSON.parse(py.runPython('_acm_run(_acm_source, _acm_input)'));
      self.postMessage({type:'case-result',index:i,...result});
      if(result.error) break;
    }
    self.postMessage({type:'done'});
  } catch(error) {
    self.postMessage({type:'failure',message:String(error)});
  }
};
