const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('practiceDesktop',{
  chooseFolder:()=>ipcRenderer.invoke('practice:folder'),
  exit:()=>ipcRenderer.send('practice:exit')
});
