const path=require('path'),fs=require('fs'),os=require('os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hot100-pro-host-'));
const workspace=path.join(temp,'workspace');fs.mkdirSync(workspace);
const executable=process.env.HOT100_VSCODE_PATH||(process.platform==='darwin'?'/Applications/Visual Studio Code.app/Contents/MacOS/Code':undefined);
require('@vscode/test-electron').runTests({vscodeExecutablePath:executable,extensionDevelopmentPath:process.env.HOT100_TEST_INSTALLED||path.resolve(__dirname,'..'),extensionTestsPath:path.resolve(__dirname,'host-suite'),launchArgs:[workspace,'--user-data-dir',path.join(temp,'user'),'--extensions-dir',path.join(temp,'extensions'),'--skip-welcome','--skip-release-notes','--disable-workspace-trust','--disable-extensions']}).catch(e=>{console.error(e);process.exitCode=1;});
