import * as vscode from 'vscode';
import { catalogById, frequency, defaultFilters, topCompanyNames } from './catalog';
import { escapeHtml } from '../utils/htmlUtil';
export function enhancedView(q:any,context:vscode.ExtensionContext) {
    const id=String(q.questionFrontendId),p=catalogById.get(id);
    const topics=(q.topicTags||[]).map((t:any)=>t.translatedName||t.name).filter((name:any)=>typeof name==='string'&&name.trim());
    const chips=(names:string[])=>names.map(name=>`<span class="tag-chip">${escapeHtml(name)}</span>`).join('');
    const hints=Array.isArray(q.hints)?q.hints.filter((hint:any)=>typeof hint==='string'&&hint.trim()):[];
    if(!hints.length&&p?.explain)hints.push(escapeHtml(p.explain.split('\n')[0]));
    const metadata=`<div class="problem-meta-controls"><button class="tag-chip meta-toggle" data-problem-meta="problem-topics" aria-expanded="false" aria-controls="problem-topics">相关标签</button><button class="tag-chip meta-toggle companies-toggle" data-problem-meta="problem-companies" aria-expanded="false" aria-controls="problem-companies">相关企业</button><button class="tag-chip meta-toggle" data-problem-meta="problem-hints" aria-expanded="false" aria-controls="problem-hints">提示</button></div>`;
    const metadataPanels=`<div id="problem-topics" class="metadata-panel" hidden>${chips(topics)||'暂无标签'}</div><div id="problem-companies" class="metadata-panel" hidden>${chips(p?topCompanyNames(p):[])||'暂无企业记录'}</div>`;
    if(!p)return{controls:'',tags:'',acm:'',metadata,metadataPanels,hints};
    const mode=context.globalState?.get<Record<string,string>>('enhancedModes',{})[id]==='core'?'core':'acm';
    const company=context.globalState?.get('enhancedFilters',defaultFilters).company||'';
    const language=context.globalState?.get<Record<string,string>>('enhancedLanguages',{})[id]||context.globalState?.get<string>('enhancedLanguage','python3')||'python3';
    const languageLabel=({python3:'Python',cpp:'C++',c:'C'} as Record<string,string>)[language]||language;
    return {
        hints,
        metadata,
        metadataPanels,
        controls:`<span class="enhanced-modes"><button class="tab" data-local-language="1" title="选择编程语言">${escapeHtml(languageLabel)}</button><button class="tab ${mode==='acm'?'active':''}" data-mode="acm" aria-pressed="${mode==='acm'}">ACM 模式</button><button class="tab ${mode==='core'?'active':''}" data-mode="core" aria-pressed="${mode==='core'}">核心代码</button></span>`,
        tags:`<span class="tag-chip">${escapeHtml(company?company+'考察':'考察')} ${frequency(p,company)} 次</span>`,
        acm:mode==='acm'?`<hr/><h2>输入格式</h2><pre>${escapeHtml(p.acm.input)}</pre><h2>输出格式</h2><pre>${escapeHtml(p.acm.output)}</pre>${p.acm.examples.map((e,i)=>`<h3>ACM 示例 ${i+1}</h3><pre>输入：\n${escapeHtml(e.input)}\n输出：\n${escapeHtml(e.output)}</pre>`).join('')}`:''
    };
}
