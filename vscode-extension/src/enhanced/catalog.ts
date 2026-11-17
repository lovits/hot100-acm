import * as fs from 'fs';
import * as path from 'path';
import { HOT_100_LIST, categoryLabel } from '../data/hot100Data';
export interface CatalogProblem {
    id: number; title: string; difficulty: string; topic: string; topicTags: string[]; url: string;
    explain?: string; officialHtml: string; officialTemplates: Record<string, string>;
    acm: { input: string; output: string; examples: Array<{input: string; output: string}>; template: Record<string, string> };
    core: unknown;
    freq: { value: number; updatedAt: string; companies: Array<{name: string; value: number}> };
}
export const catalog: CatalogProblem[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/problems.json'), 'utf8'));
for(const p of catalog){const base=HOT_100_LIST.find(q=>q.frontendQuestionId===String(p.id));if(base)p.topic=categoryLabel(base.category);}
export const catalogById = new Map(catalog.map(p => [String(p.id), p]));
export interface Filters { difficulty: string; topic: string; tag: string; company: string; search: string; due: boolean; sort: 'topic'|'frequency' }
export const defaultFilters: Filters = {difficulty:'',topic:'',tag:'',company:'',search:'',due:false,sort:'topic'};
export function frequency(p: CatalogProblem, company = ''): number {
    return company ? p.freq.companies.find(c => c.name === company)?.value ?? 0 : p.freq.value;
}
export function matches(p: CatalogProblem, f: Filters, due = false): boolean {
    return (!f.difficulty || p.difficulty === f.difficulty) && (!f.topic || p.topic === f.topic)
        && (!f.tag || p.topicTags.includes(f.tag)) && (!f.company || p.freq.companies.some(c => c.name === f.company))
        && (!f.due || due) && (!f.search || `${p.id} ${p.title} ${p.url} ${p.topicTags.join(' ')}`.toLowerCase().includes(f.search.toLowerCase()));
}

export function topCompanyNames(p:CatalogProblem):string[] {
    return [...p.freq.companies].sort((a,b)=>b.value-a.value).slice(0,7).map(c=>c.name);
}
