import * as vscode from 'vscode';
import { catalogById, frequency, defaultFilters } from './catalog';
import { escapeHtml } from '../utils/htmlUtil';
export function enhancedView(q:any,context:vscode.ExtensionContext) {
    const id=String(q.questionFrontendId),p=catalogById.get(id);if(!p)return{controls:'',tags:'',acm:''};
    const mode=context.globalState?.get<Record<string,string>>('enhancedModes',{})[id]==='core'?'core':'acm';
    const company=context.globalState?.get('enhancedFilters',defaultFilters).company||'';
    const language=context.globalState?.get<string>('enhancedLanguage','python3')||'python3';
    const languageLabel=({python3:'Python',cpp:'C++',c:'C'} as Record<string,string>)[language]||language;
    return {
        controls:`<span class="enhanced-modes"><button class="tab" data-local-language="1" title="选择本机评测语言">${escapeHtml(languageLabel)}</button><button class="tab ${mode==='acm'?'active':''}" data-mode="acm" aria-pressed="${mode==='acm'}">ACM 模式</button><button class="tab ${mode==='core'?'active':''}" data-mode="core" aria-pressed="${mode==='core'}">核心代码</button></span>`,
        tags:`<span class="tag-chip">${escapeHtml(company?company+'考察':'考察')} ${frequency(p,company)} 次</span>`,
        acm:mode==='acm'?`<hr/><h2>输入格式</h2><pre>${escapeHtml(p.acm.input)}</pre><h2>输出格式</h2><pre>${escapeHtml(p.acm.output)}</pre>${p.acm.examples.map((e,i)=>`<h3>ACM 示例 ${i+1}</h3><pre>输入：\n${escapeHtml(e.input)}\n输出：\n${escapeHtml(e.output)}</pre>`).join('')}`:''
    };
}
