import * as vscode from 'vscode';
// Import is prepared locally beside the user's extension data, never packaged or uploaded.
export async function migrateLocalData(context:vscode.ExtensionContext):Promise<void>{
    const previous=context.globalState.get<Record<string,boolean>>('passed');
    if(previous&&!context.globalState.get('enhancedLocalPassed'))await context.globalState.update('enhancedLocalPassed',previous);
    const uri=vscode.Uri.joinPath(context.globalStorageUri,'import-pro-state.json');
    let raw:Uint8Array;
    try{raw=await vscode.workspace.fs.readFile(uri);}catch(e){if(e instanceof vscode.FileSystemError&&e.code==='FileNotFound')return;throw e;}
    if(context.globalState.get('enhancedMigrationDone'))return;
    const data=JSON.parse(Buffer.from(raw).toString('utf8'));
    for(const [key,value]of Object.entries(data)){
        if(key.startsWith('hot100')&&context.globalState.get(key)===undefined)await context.globalState.update(key,value);
    }
    if(data.passed&&typeof data.passed==='object')await context.globalState.update('enhancedLocalPassed',data.passed);
    await context.globalState.update('enhancedMigrationDone',true);
}
