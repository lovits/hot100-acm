import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
function expand(value: string, uri: vscode.Uri): string {
    const root = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || '';
    return value.replace(/\$\{workspaceFolder\}/g,root).replace(/\$\{env:([^}]+)\}/g,(_,name)=>process.env[name]||'').replace(/^~(?=[/\\])/,process.env.HOME||process.env.USERPROFILE||'');
}
export async function resolveToolchain(language: string, uri: vscode.Uri): Promise<Record<string,string>> {
    const own=vscode.workspace.getConfiguration('hot100Pro',uri);
    if(language==='python3') {
        let executable=own.get<string>('pythonPath','');
        const python=vscode.extensions.getExtension('ms-python.python');
        if(!executable && python) {
            const api=await python.activate();
            const selected=api.environments?.getActiveEnvironmentPath(uri);
            if(selected) { const env=await api.environments.resolveEnvironment(selected); executable=env?.executable?.uri?.fsPath || selected.path; }
        }
        executable ||= vscode.workspace.getConfiguration('python',uri).get<string>('defaultInterpreterPath','');
        return executable ? {python3:expand(executable,uri)} : {};
    }
    let compiler=own.get<string>(language==='c'?'cCompilerPath':'cppCompilerPath','');
    if(!compiler) {
        const tasks=await vscode.tasks.fetchTasks();
        const candidates=tasks.filter(t=>t.group?.id===vscode.TaskGroup.Build.id && (t.execution instanceof vscode.ShellExecution || t.execution instanceof vscode.ProcessExecution));
        candidates.sort((a,b)=>Number((b.group as any)?.isDefault||false)-Number((a.group as any)?.isDefault||false));
        for(const task of candidates) {
            const execution=task.execution as vscode.ShellExecution|vscode.ProcessExecution;
            const raw=execution instanceof vscode.ProcessExecution ? execution.process : execution.command;
            const command=typeof raw==='string'?raw:raw?.value;
            if(command && /(?:^|[/\\])(?:gcc|g\+\+|clang(?:\+\+)?|cl|clang-cl)(?:[\d.-]*|\.exe)?$/i.test(command)) {compiler=command;break;}
        }
    }
    compiler ||= vscode.workspace.getConfiguration('C_Cpp',uri).get<string>('default.compilerPath','');
    if(!compiler) {
        const root=vscode.workspace.getWorkspaceFolder(uri)?.uri;
        if(root) {
            const configUri=vscode.Uri.joinPath(root,'.vscode','c_cpp_properties.json');
            try {
                const raw=Buffer.from(await vscode.workspace.fs.readFile(configUri)).toString('utf8');
                // JSONC is VS Code's native configuration format.
                const withoutComments=raw.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,m=>m.startsWith('"')?m:'').replace(/"(?:\\.|[^"\\])*"|,(?=\s*[}\]])/g,m=>m.startsWith('"')?m:'');
                const configs=JSON.parse(withoutComments).configurations||[];
                const platformName=process.platform==='darwin'?'Mac':process.platform==='win32'?'Win32':'Linux';
                compiler=(configs.find((c:any)=>c.name===platformName)||configs[0])?.compilerPath||'';
            } catch(e) { if(!(e instanceof vscode.FileSystemError && e.code==='FileNotFound')) { vscode.window.showWarningMessage('无法读取 C/C++ 配置，请在 Hot100 Pro 设置中指定编译器路径。'); } }
        }
    }
    if(!compiler) { return {}; }
    compiler=expand(compiler,uri);
    if(language==='cpp' && /(?:^|[/\\])(gcc|clang)(\.exe)?$/i.test(compiler)) {
        const sibling=compiler.replace(/(gcc|clang)(\.exe)?$/i,(_m,c,e)=>`${c.toLowerCase()==='gcc'?'g++':'clang++'}${e||''}`);
        if(fs.existsSync(sibling) || !path.isAbsolute(sibling)) { compiler=sibling; }
    }
    return {[language==='c'?'gcc':'g++']:compiler};
}
