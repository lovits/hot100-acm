"""Local-only integration checks, using isolated ports and disposable test data."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from importlib.machinery import SourceFileLoader
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import json
import tempfile
import threading
from unittest.mock import patch
import local_server

ROOT=Path(__file__).parent
checks=[]
def checked(name,condition):
    assert condition,name
    checks.append(name)

with tempfile.TemporaryDirectory(prefix='hot100-check-',dir=ROOT.parent) as temporary:
    server=local_server.make_server(23865,temporary);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin='http://127.0.0.1:23865'
    def request(path,method='GET',data=None,headers=None):
        req=Request(origin+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers=headers or {})
        try:
            with urlopen(req,timeout=3) as response:return response.status,response.read(),response.headers
        except HTTPError as error:return error.code,error.read(),error.headers
    status,raw,_=request('/api/health');checked('Service identity',status==200 and json.loads(raw)['app']==local_server.APP_ID)
    status,_,_=request('/api/progress');checked('No cross-origin data reads',status==403)
    status,_,_=request('/api/session',headers={'Origin':'https://example.com'});checked('Reject external Origin',status==403)
    status,_,_=request('/api/health',headers={'Host':'attacker.test:23865'});checked('Reject unapproved Host',status==403)
    status,raw,_=request('/api/session',headers={'Referer':origin+'/'});session=json.loads(raw);checked('Same-origin session',status==200 and bool(session['token']))
    headers={'Origin':origin,'Content-Type':'application/json','X-Hot100-Token':session['token']}
    status,_,_=request('/api/progress','POST',[],headers);checked('Malformed JSON structure rejected',status==400)
    status,_,_=request('/api/progress','POST',{'revision':0,'state':{'codes':{'1':'print(1)'}}},headers={'Origin':origin});checked('Reject writes without token',status==403)
    status,raw,_=request('/api/progress','POST',{'revision':0,'state':{'codes':{'1':'print(1)'}}},headers);checked('Atomic first write',status==200 and json.loads(raw)['revision']==1)
    status,_,_=request('/api/progress','POST',{'revision':0,'state':{}},headers);checked('Reject stale revision instead of overwriting',status==409)
    status,raw,_=request('/api/progress','POST',{'revision':1,'state':{'codes':{'1':'print(2)'},'notes':{'3':'边界不能倒退'}}},headers);checked('Atomic update',status==200 and json.loads(raw)['revision']==2)
    directory=Path(temporary)
    checked('Previous version backup retained',json.loads((directory/'learning.backup.json').read_text(encoding='utf-8'))['state']['codes']['1']=='print(1)')
    checked('No temporary files after commit',not list(directory.glob('*.tmp')))
    checked('Static Python wasm served offline',request('/vendor/pyodide/pyodide.asm.wasm')[0]==200)
    checked('Static Monaco served offline',request('/vendor/monaco/vs/editor/editor.main.js')[0]==200)
    checked('Data not exposed as static file',request('/learning.json')[0]==404)
    status,_,hdr=request('/');checked('Browser runtime connections restricted to same origin',"connect-src 'self'" in hdr.get('Content-Security-Policy',''))
    launcher=SourceFileLoader('hot100_launcher',str(ROOT/'launch.pyw')).load_module()
    launcher.PORT=23865;launcher.URL=origin
    with patch.object(launcher.webbrowser,'open') as browser_open,patch.object(launcher.subprocess,'Popen') as spawn:
        launcher.main();launcher.main()
        checked('Repeated launches reuse identity-checked service',browser_open.call_count==2 and spawn.call_count==0)
    status,_,_=request('/api/shutdown','POST',headers=headers);thread.join(3);server.server_close()
    checked('Explicit service shutdown',status==200 and not thread.is_alive())
    restored=local_server.Store(directory);checked('Progress survives server restart',restored.read()['state']['codes']['1']=='print(2)')
    (directory/'learning.json').write_text('{broken',encoding='utf-8')
    restored=local_server.Store(directory)
    checked('Corrupt main data restores valid backup',restored.recovered and restored.read()['state']['codes']['1']=='print(1)')
    checked('Corrupt file preserved for recovery',bool(list(directory.glob('learning.corrupt.*.json'))))
    restored.write({'revision':1,'state':{'codes':{'1':'print(3)'}}})
    checked('Recovered data can be saved again',json.loads((directory/'learning.json').read_text(encoding='utf-8'))['state']['codes']['1']=='print(3)')
    (directory/'learning.json').write_text('{broken-again',encoding='utf-8')
    (directory/'learning.backup.json').write_text('[]',encoding='utf-8')
    restored=local_server.Store(directory)
    checked('Both damaged files are preserved and reported',bool(restored.read()['recoveryWarning']) and len(restored.invalid_files)==2)
    restored.write({'revision':0,'state':{'notes':{'1':'new note'}}})
    checked('New save does not replace damaged backup', (directory/'learning.backup.json').read_text(encoding='utf-8')=='[]')

class OtherService(BaseHTTPRequestHandler):
    def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'{"app":"another-site"}')
    def log_message(self,*args):pass
other=ThreadingHTTPServer(('127.0.0.1',23865),OtherService);thread=threading.Thread(target=other.serve_forever,daemon=True);thread.start()
try:
    with patch.object(launcher.webbrowser,'open') as browser_open,patch.object(launcher.subprocess,'Popen') as spawn:
        try:launcher.main();raised=False
        except RuntimeError as error:raised='其他程序' in str(error)
        checked('Port conflict never opens unrelated service',raised and not browser_open.called and not spawn.called)
finally:other.shutdown();other.server_close();thread.join()
report={'passed':len(checks),'checks':checks}
(ROOT/'reference/local-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
