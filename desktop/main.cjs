'use strict';
const {app,BrowserWindow,dialog,shell,Menu,ipcMain}=require('electron');
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:18765';
const root=__dirname;
let child,win,closing=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function live(){
  try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(900)});return (await r.json()).app==='hot100-acm-local-v2';}catch{return false;}
}
async function launch(){
  if(!await live()){
    const mac=process.platform==='darwin', runtime=path.join(root,'runtime');
    const python=mac?'/usr/bin/python3':path.join(runtime,'python','python.exe');
    if(mac && spawnSync('/usr/bin/xcode-select',['-p'],{encoding:'utf8'}).status!==0)
      throw Error('请先安装 Apple 命令行工具。在终端运行 xcode-select --install，安装完成后再打开刷题台。');
    const env={...process.env,HOT100_NODE:process.execPath,ELECTRON_RUN_AS_NODE:'1',PYTHONDONTWRITEBYTECODE:'1'};
    if(!mac)env.HOT100_COMPILER_DIR=path.join(runtime,'mingw64','bin');
    child=spawn(python,[path.join(root,'local_server.py')],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
    let error='';
    child.on('error',e=>{error=e.message});
    child.stderr.on('data',b=>{error=(error+b).slice(-1500)});
    for(let i=0;i<50&&!await live();i++){
      if(child.exitCode!==null||error)throw Error(error||'本地服务未启动，请检查 18765 端口。');
      await delay(120);
    }
    if(!await live())throw Error('连接本地服务超时。');
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
  await win.loadURL(base+'/#/studyplan');
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
