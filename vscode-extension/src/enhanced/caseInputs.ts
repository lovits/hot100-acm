export interface InputCase { values:string[]; expected:string; custom:boolean }
export function officialInput(values:string[]):string {
    if(!values.length)throw Error('请填写测试参数。');
    return values.map(value=>{try{JSON.parse(value);}catch{throw Error('参数格式错误：数组请使用 [1,2]，字符串请加双引号。');}return value.trim();}).join('\n');
}
export function caseFields(q:any,p:any):string[] {
    let meta:any={};try{meta=JSON.parse(q?.metaData||'{}');}catch{/* offline metadata */}
    return meta.systemdesign||p.core.kind==='ops'?['操作名称数组','每次操作的参数数组']:(meta.params||p.core.params||[]).map((v:any)=>v.name);
}
export function seedCases(q:any,p:any,tests:any[],acm:boolean):InputCase[] {
    if(acm)return tests.slice(0,p.acm.examples.length||1).map(t=>({values:[t.input],expected:t.output||'',custom:false}));
    const count=caseFields(q,p).length,lines=(q?.exampleTestcases||q?.sampleTestCase||'').trim().split('\n').filter((s:string)=>s.trim());
    if(count&&lines.length>=count&&lines.length%count===0)return Array.from({length:lines.length/count},(_,i)=>({values:lines.slice(i*count,(i+1)*count),expected:'',custom:false}));
    const literal=(v:any)=>typeof v==='string'&&/^(list|tree|grid|randomList):/.test(v)?v.slice(v.indexOf(':')+1):JSON.stringify(v);
    return tests.slice(0,p.acm.examples.length||1).map(t=>({values:t.ops?[JSON.stringify(t.ops),JSON.stringify(t.args)]:t.args.map(literal),expected:'',custom:false}));
}
