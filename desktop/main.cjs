'use strict';
const {app,BrowserWindow,dialog,shell,Menu,ipcMain}=require('electron');
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const base='http://127.0.0.1:18765';
const root=__dirname;
let child,win,closing=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function instanceId(){
  const resolved=fs.realpathSync(root), location=process.platform==='win32'?path.normalize(resolved).toLowerCase():resolved;
  const h=crypto.createHash('sha256').update(location);
  for(const name of ['local_server.py','sync_transport.py','leetcode_session.py','leetcode_browser.cjs','dist/index.html','dist/app.js','dist/local.js','dist/practice.js','dist/test-workspace.js','dist/study-ui.js','dist/study-plan.js','dist/sync-core.js','dist/sync-controller.js','dist/training/index.html','dist/training/app.js','native_judge/judge.js','native_judge/runner.js'])h.update(fs.readFileSync(path.join(root,name)));
  return h.digest('hex');
}
async function live(expected){
  try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(900)}),data=await r.json();return r.ok&&data.app==='hot100-acm-local-v2'&&data.instance===expected;}catch{return false;}
}
function occupied(){
  return new Promise(resolve=>{
    const sock=net.createConnection({host:'127.0.0.1',port:18765});
    sock.setTimeout(900);sock.once('connect',()=>{sock.destroy();resolve(true);});
    sock.once('timeout',()=>{sock.destroy();resolve(true);});
    sock.once('error',error=>resolve(error.code!=='ECONNREFUSED'));
  });
}
async function launch(){
  const expected=instanceId();
  if(!await live(expected)){
    if(await occupied())throw Error('本地端口 18765 已被旧版 Hot100 或其他程序使用。请先保存未保存的内容，关闭旧程序及其本地服务后重试。');
    const mac=process.platform==='darwin', runtime=path.join(root,'runtime');
    const python=mac?'/usr/bin/python3':path.join(runtime,'python','python.exe');
    if(mac && spawnSync('/usr/bin/xcode-select',['-p'],{encoding:'utf8'}).status!==0)
      throw Error('请先安装 Apple 命令行工具。在终端运行 xcode-select --install，安装完成后再打开刷题台。');
    const env={...process.env,HOT100_NODE:process.execPath,ELECTRON_RUN_AS_NODE:'1',PYTHONDONTWRITEBYTECODE:'1'};
    if(!mac)env.HOT100_COMPILER_DIR=path.join(runtime,'mingw64','bin');
    child=spawn(python,[path.join(root,'local_server.py')],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
    let error='',spawnError='';
    child.on('error',e=>{spawnError=e.message});
    child.stderr.on('data',b=>{error=(error+b).slice(-1500)});
    for(let i=0;i<50&&!await live(expected);i++){
      if(child.exitCode!==null||spawnError)throw Error(spawnError||error||'本地服务未启动，请检查 18765 端口。');
      await delay(120);
    }
    if(!await live(expected))throw Error('连接本地服务超时或服务版本不匹配。');
  }
  win=new BrowserWindow({width:1320,height:860,minWidth:760,minHeight:540,show:false,backgroundColor:'#f3f3f4',
    title:'Hot100 刷题台',icon:path.join(root,'dist/assets/app-hot100oj.ico'),
    webPreferences:{preload:path.join(root,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{
    if(/^https:\/\//.test(url))shell.openExternal(url);
    return {action:'deny'};
  });
  win.webContents.on('will-navigate',(event,url)=>{
    if(new URL(url).origin!==base){event.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url);}
  });
  win.on('close',async e=>{
    if(closing)return;
    e.preventDefault();
    closing=true;
    try{await win.webContents.executeJavaScript("typeof flushDisk==='function' && !serviceStopped ? flushDisk() : true");}catch{}
    win.destroy();
  });
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'}]):null);
  await win.loadURL(base+'/');
  win.show();
}
ipcMain.handle('practice:folder',async event=>{
  if(event.sender!==win?.webContents||event.senderFrame?.url.split('/').slice(0,3).join('/')!==base)return '';
  const picked=await dialog.showOpenDialog(win,{title:'选择进度保存目录',properties:['openDirectory','createDirectory']});
  return picked.canceled?'':picked.filePaths[0];
});
ipcMain.on('practice:exit',event=>{if(event.sender===win?.webContents)win.close();});
app.setName('Hot100 刷题台');
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(launch).catch(e=>{dialog.showErrorBox('无法打开 Hot100 刷题台',e.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{if(child && (!win||win.isDestroyed())) child.kill();});
  app.on('will-quit',()=>{if(child)child.kill();});
}
