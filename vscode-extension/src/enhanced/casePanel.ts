import * as vscode from 'vscode';
import {randomBytes} from 'crypto';
import {escapeHtml} from '../utils/htmlUtil';
import {InputCase} from './caseInputs';
export class CasePanel implements vscode.WebviewViewProvider {
    private view?:vscode.WebviewView;
    private key='';private busy=false;private ready='';private pending?:boolean;
    constructor(private context:vscode.ExtensionContext,private current:()=>Promise<any>,private execute:(data:any,cases:InputCase[])=>Promise<any>){}
    resolveWebviewView(view:vscode.WebviewView) {
        this.view=view;view.webview.options={enableScripts:true,localResourceRoots:[]};
        view.webview.onDidReceiveMessage(async m=>{
            if(m?.type==='ready'&&m.key===this.key){this.ready=this.key;if(this.pending!==undefined){const all=this.pending;this.pending=undefined;await view.webview.postMessage({type:'run',key:this.key,all});}return;}
            if(this.busy)return;
            try {
                if(!['save','run'].includes(m?.type))return;
                const data=await this.current();if(!data||m.key!==data.key)return;
                if(!Array.isArray(m.cases)||!m.cases.length||m.cases.length>100||m.cases.some((c:any)=>!Array.isArray(c.values)||c.values.length!==data.fields.length||c.values.some((v:any)=>typeof v!=='string')||typeof c.expected!=='string'||typeof c.custom!=='boolean'))throw Error('测试用例格式无效。');
                await this.context.workspaceState.update('casePanel:'+data.key,m.cases);
                if(m.type==='run') {
                    if(!Number.isInteger(m.index)||m.index<0||m.index>=m.cases.length)throw Error('请选择测试用例。');
                    this.busy=true;await view.webview.postMessage({type:'busy',key:data.key});
                    const result=await this.execute(data,m.all?m.cases:[m.cases[m.index]]);
                    await view.webview.postMessage({type:'result',key:data.key,result});
                }
            }catch(e){await view.webview.postMessage({type:'result',key:m?.key,result:{error:String(e)}});}finally{if(m?.type==='run')this.busy=false;}
        });
        view.onDidDispose(()=>{this.view=undefined;this.key='';this.ready='';});
        void this.refresh();
    }
    async open(){await vscode.commands.executeCommand('workbench.view.extension.hot100-tests');await this.refresh();}
    async run(all=false){this.pending=all;await this.open();if(this.ready===this.key&&this.key){this.pending=undefined;await this.view?.webview.postMessage({type:'run',key:this.key,all});}}
    async refresh(){
        if(!this.view)return;const d=await this.current();if(!d){this.key='';this.ready='';this.view.webview.html='<p>请先打开一道题目的代码。</p>';return;}
        if(this.key===d.key)return;this.key=d.key;this.ready='';
        const cases=this.context.workspaceState.get<InputCase[]>('casePanel:'+d.key,d.cases),nonce=randomBytes(18).toString('base64');
        const data=JSON.stringify({key:d.key,fields:d.fields,cases}).replace(/</g,'\\u003c');
        this.view.webview.html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'nonce-${nonce}';script-src 'nonce-${nonce}'"><style nonce="${nonce}">
*{box-sizing:border-box}body{font:13px/1.6 var(--vscode-font-family);color:var(--vscode-foreground);padding:8px 16px;margin:0;background:var(--vscode-editor-background)}header,nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}header small{margin-right:auto;color:var(--vscode-descriptionForeground)}button{font:inherit;color:inherit;background:var(--vscode-button-secondaryBackground);border:1px solid transparent;border-radius:5px;padding:5px 12px;cursor:pointer}button[aria-selected=true]{border-color:var(--vscode-focusBorder)}button:focus-visible,textarea:focus-visible{outline:1px solid var(--vscode-focusBorder)}button:disabled{opacity:.5;cursor:wait}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}label{display:block;margin-bottom:5px}textarea{display:block;resize:vertical;width:100%;min-height:92px;padding:9px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);border-radius:5px;font:13px/1.6 var(--vscode-editor-font-family)}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}#results[hidden],#inputs[hidden]{display:none}
</style><header><button id="inputTab">测试用例</button><button id="resultTab">测试结果</button><small>${escapeHtml(d.title)} · ${d.acm?'ACM · 本机执行':'核心代码 · 力扣官方'}</small><button id="run">测试</button><button id="all">运行全部用例</button></header><nav id="cases" aria-label="测试用例"></nav><section id="inputs"><div class="fields" id="fields"></div><button id="remove">删除当前自定义用例</button></section><section id="results" hidden aria-live="polite"></section><script nonce="${nonce}">
const api=acquireVsCodeApi(),data=${data};let cases=data.cases,index=0,busy=false,timer;
const el=id=>document.getElementById(id),save=()=>api.postMessage({type:'save',key:data.key,cases});
function render(){el('cases').replaceChildren();cases.forEach((c,i)=>{const b=document.createElement('button');b.textContent='Case '+(i+1);b.setAttribute('aria-selected',String(i===index));b.disabled=busy;b.onclick=()=>{index=i;render();};el('cases').append(b);});const add=document.createElement('button');add.textContent='＋';add.setAttribute('aria-label','新建测试用例');add.disabled=busy;add.onclick=()=>{if(cases.length>=100)return;cases.push({values:data.fields.map(()=>''),expected:'',custom:true});index=cases.length-1;save();render();};el('cases').append(add);el('fields').replaceChildren();const c=cases[index];if(!c)return;[...data.fields,'期望输出（选填，本机测试使用）'].forEach((name,i)=>{if(i===data.fields.length&&data.fields[0]!=='标准输入')return;const box=document.createElement('div'),label=document.createElement('label'),input=document.createElement('textarea');input.id='field'+i;label.htmlFor=input.id;label.textContent=name;input.value=i<data.fields.length?c.values[i]:c.expected;input.disabled=busy;input.oninput=()=>{if(i<data.fields.length)c.values[i]=input.value;else c.expected=input.value;clearTimeout(timer);timer=setTimeout(save,200);};box.append(label,input);el('fields').append(box);});el('remove').hidden=!c.custom;el('remove').disabled=busy;}
function showResults(result){el('results').replaceChildren();const rows=result.results||[result];rows.forEach((r,i)=>{const h=document.createElement('strong'),p=document.createElement('pre');h.textContent=rows.length>1?'用例 '+(i+1):'结果';p.textContent=r.error||r.compileError||['状态：'+(r.status_msg||(r.ok===false?'未通过':r.ok===true?'通过':'运行完成')),'实际输出：'+JSON.stringify(r.got??r.code_answer??r.coded_answer??''),'期望输出：'+JSON.stringify(r.expected??r.expected_code_answer??''),r.full_compile_error||r.compile_error||r.full_runtime_error||r.runtime_error||''].join('\\n');el('results').append(h,p);});el('inputs').hidden=true;el('results').hidden=false;}
function run(all){if(busy)return;busy=true;clearTimeout(timer);el('run').disabled=el('all').disabled=true;api.postMessage({type:'run',key:data.key,cases,index,all});render();}
el('run').onclick=()=>run(false);el('all').onclick=()=>run(true);el('inputTab').onclick=()=>{el('inputs').hidden=false;el('results').hidden=true;};el('resultTab').onclick=()=>{el('inputs').hidden=true;el('results').hidden=false;};el('remove').onclick=()=>{if(!cases[index]?.custom)return;cases.splice(index,1);index=Math.max(0,index-1);save();render();};window.addEventListener('message',e=>{const m=e.data;if(m.key!==data.key)return;if(m.type==='run')run(m.all);if(m.type==='result'){busy=false;el('run').disabled=el('all').disabled=false;render();showResults(m.result);}});render();api.postMessage({type:'ready',key:data.key});
</script></html>`;
    }
}
