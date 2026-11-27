import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {randomUUID} from 'crypto';
import {Hot100Provider} from '../views/hot100Provider';
import {catalogById} from './catalog';
import {intervalsOf,emptyPlan,PlanState} from './studyPlan';
import {getExtension,langSlugOfExtension} from '../utils/languageUtils';
import {collectReplica,LiveReplica,SyncModel} from './syncReplica';
import {PrivateSyncServer,syncRequest,validPrivateServer,desktopSyncConfig} from './syncNetwork';

interface SyncCloud {deviceId:string;epoch:number;planEpoch:number;revision:number;known:any;outbox:null|{body:any;sent:any}}
interface FileScan {codes:Record<string,string>;notes:Record<string,string>;paths:Record<string,string>}
const REPLICA='hot100PrivateSyncReplica', SERVER='hot100PrivateSyncServer', SECRET='hot100PrivateSyncToken';

export class PrivateSync {
    private model?:SyncModel;
    private running?:Promise<void>;
    private status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,20);
    private core:any;
    constructor(private context:vscode.ExtensionContext,private provider:Hot100Provider,private refreshPlan:()=>void){
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.core=require(path.join(context.extensionPath,'vendor/hot100-sync/sync-core.js'));
        this.model=context.globalState.get<SyncModel>(REPLICA);
        this.status.command='hot100Pro.syncPrivate';this.status.text='$(cloud) Hot100';this.status.tooltip='个人私网同步';this.status.show();
        context.subscriptions.push(this.status,vscode.commands.registerCommand('hot100Pro.configurePrivateSync',()=>this.configure()),vscode.commands.registerCommand('hot100Pro.syncPrivate',()=>this.manual()),vscode.commands.registerCommand('hot100Pro.syncConflicts',()=>this.showConflicts()));
        const timer=setInterval(()=>{void this.sync().catch(()=>{});},30000);
        context.subscriptions.push({dispose:()=>clearInterval(timer)},vscode.workspace.onDidSaveTextDocument(()=>{void this.sync().catch(()=>{});}));
        void this.sync().catch(()=>{});
    }
    private async configure():Promise<void>{
        const previous=this.context.globalState.get<PrivateSyncServer>(SERVER),desktop=await desktopSyncConfig();
        const host=await vscode.window.showInputBox({title:'Tailscale 私网设备名',value:previous?.host||desktop?.host||'',ignoreFocusOut:true});if(host===undefined)return;
        const address=await vscode.window.showInputBox({title:'Tailscale 私网地址',value:previous?.address||desktop?.address||'',ignoreFocusOut:true});if(address===undefined)return;
        const server={host:host.trim(),address:address.trim()};if(!validPrivateServer(server))throw Error('请输入有效的 Tailscale 设备名和私网地址。');
        const compatible=desktop?.host===server.host&&desktop.address===server.address;
        const token=await vscode.window.showInputBox({title:'个人同步令牌',password:true,ignoreFocusOut:true,prompt:compatible?'留空使用本机桌面端同步配置':previous?'留空保留现有令牌':'令牌保存在 VS Code Secret Storage'});if(token===undefined)return;
        if(token && !/^[A-Za-z0-9_-]{32,256}$/.test(token))throw Error('同步令牌格式不正确。');
        const chosen=token||await this.context.secrets.get(SECRET)||(compatible?desktop?.token:undefined);
        if(!chosen)throw Error('请输入个人同步令牌。');
        if(previous && previous.host!==server.host && this.model?.cloudSync)throw Error('当前设备已绑定另一同步服务；请先导出备份，再处理原同步配置。');
        await this.context.secrets.store(SECRET,chosen);
        await this.context.globalState.update(SERVER,server);
        await this.manual();
    }
    private async manual():Promise<void>{
        try{await this.sync(true);vscode.window.showInformationMessage('Hot100 个人同步完成。');}
        catch(error){vscode.window.showErrorMessage(`Hot100 同步失败：${error instanceof Error?error.message:String(error)}`);}
    }
    private async request(method:'GET'|'POST',route:string,body?:unknown):Promise<any>{
        const server=this.context.globalState.get<PrivateSyncServer>(SERVER),token=await this.context.secrets.get(SECRET);
        if(!server||!token)throw Error('请先运行“Hot100: 配置个人私网同步”。');
        return syncRequest(server,token,method,route,body);
    }
    sync(manual=false):Promise<void>{
        if(this.running)return this.running;
        this.running=this.run(manual).finally(()=>{this.running=undefined;});return this.running;
    }
    private async save():Promise<void>{await this.context.globalState.update(REPLICA,this.model);}
    private async scan():Promise<FileScan>{
        const result:FileScan={codes:{},notes:{},paths:{}},root=vscode.workspace.workspaceFolders?.[0];
        if(!root)return result;
        const files=await vscode.workspace.findFiles(new vscode.RelativePattern(root,'leetcode/**/*'),null,10000);
        const duplicates=new Set<string>();
        for(const uri of files){
            const rel=path.relative(root.uri.fsPath,uri.fsPath).replace(/\\/g,'/');
            const match=rel.match(/^leetcode\/(?:(acm|notes)\/)?(\d+)_[^/]+\.([A-Za-z0-9]+)$/);if(!match||!catalogById.has(match[2]))continue;
            const id=match[2],note=match[1]==='notes',lang=note?'text':langSlugOfExtension(match[3]);
            if(note&&match[3].toLowerCase()!=='md'||!note&&!lang)continue;
            const mode=note?'note':match[1]==='acm'?'acm':'core',key=`${id}:${lang}:${mode}`;
            if(result.paths[key]){duplicates.add(key);continue;}
            const doc=vscode.workspace.textDocuments.find(d=>d.uri.toString()===uri.toString());
            const text=doc?.isDirty?doc.getText():Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
            if(Buffer.byteLength(text)>1024*1024)continue;
            result.paths[key]=uri.fsPath;
            if(note)result.notes[id]=text;else result.codes[lang==='python3'&&mode==='acm'?id:key]=text;
        }
        for(const key of duplicates){const [id,lang,mode]=key.split(':');delete result.paths[key];if(mode==='note')delete result.notes[id];else delete result.codes[lang==='python3'&&mode==='acm'?id:key];}
        return result;
    }
    private settings():LiveReplica['settings']{
        const config=vscode.workspace.getConfiguration('hot100Pro');
        return {dailyGoal:config.get<number>('dailyGoal',5),reviewLimit:config.get<number>('reviewLimit',20),intervals:intervalsOf(config.get('reviewIntervals'))};
    }
    private async collect():Promise<FileScan>{
        const files=await this.scan(),passed=this.context.globalState.get<Record<string,boolean>>('enhancedLocalPassed',{}),favorites=this.context.globalState.get<string[]>('hot100Favorites',[]);
        let plan=this.context.globalState.get<PlanState & {resetAt?:number}>('enhancedPlan',emptyPlan());
        const pending=this.model?.pendingCloudReset, resetAt=this.model?.studyPlan.resetAt||0;
        if(pending && (plan.resetAt||0)<resetAt)plan=this.model!.studyPlan;
        this.model=collectReplica({passed,favorites,plan,settings:this.settings(),codes:files.codes,notes:files.notes},this.model,Date.now());
        return files;
    }
    private async applySettings(model:SyncModel):Promise<void>{
        const config=vscode.workspace.getConfiguration('hot100Pro'),current=this.settings();
        for(const [key,value] of [['dailyGoal',model.studySettings.dailyGoal],['reviewLimit',model.studySettings.reviewLimit],['reviewIntervals',model.studySettings.intervals]] as const){
            const old=key==='reviewIntervals'?current.intervals:current[key];
            if(JSON.stringify(old)!==JSON.stringify(value))await config.update(key,value,vscode.ConfigurationTarget.Global);
        }
    }
    private conflict(key:string,id:string,value:string):void{
        if(!this.model!.conflicts.some(c=>c.key===key&&c.id===id&&c.value===value))this.model!.conflicts.push({key,id,value,time:Date.now()});
    }
    private async applyFiles(before:SyncModel,files:FileScan):Promise<void>{
        const root=vscode.workspace.workspaceFolders?.[0];if(!root)return;
        const all=[...Object.entries(this.model!.codes).map(([key,value])=>({key,value,note:false})),...Object.entries(this.model!.notes).map(([id,value])=>({key:`${id}:text:note`,value,note:true}))];
        for(const item of all){
            const parts=item.key.split(':'),id=parts[0],lang=parts[1]||'python3',mode=parts[2]||'acm',p=catalogById.get(id);
            if(!p||typeof item.value!=='string')continue;
            const canonical=`${id}:${lang}:${mode}`,old=item.note?before.notes[id]:before.codes[item.key];
            const slug=p.url.split('/').filter(Boolean).at(-1),ext=item.note?'md':getExtension(lang);
            if(!slug||ext==='txt')continue;
            const dir=path.join(root.uri.fsPath,'leetcode',...(item.note?['notes']:mode==='acm'?['acm']:[]));
            const target=files.paths[canonical]||path.join(dir,`${id}_${slug}.${ext}`);
            const doc=vscode.workspace.textDocuments.find(d=>d.uri.fsPath===target);
            if(doc?.isDirty){if(doc.getText()!==item.value){this.conflict(item.note?'notes':'codes',item.key,item.value);if(item.note)this.model!.notes[id]=doc.getText();else this.model!.codes[item.key]=doc.getText();}continue;}
            await fs.mkdir(path.dirname(target),{recursive:true});
            try{
                const stat=await fs.lstat(target);if(!stat.isFile()||stat.isSymbolicLink())continue;
                const current=await fs.readFile(target,'utf8');if(current===item.value)continue;
                if(current!==old){this.conflict(item.note?'notes':'codes',item.key,item.value);if(item.note)this.model!.notes[id]=current;else this.model!.codes[item.key]=current;continue;}
                const recovery=path.join(this.context.globalStorageUri.fsPath,'sync-recovery');await fs.mkdir(recovery,{recursive:true});
                await fs.writeFile(path.join(recovery,`${Date.now()}-${randomUUID()}.txt`),current,{flag:'wx',mode:0o600});
                const tmp=target+'.hot100-'+randomUUID()+'.tmp';
                try{
                    await fs.writeFile(tmp,item.value,{flag:'wx',mode:stat.mode});
                    const latest=await fs.lstat(target),open=vscode.workspace.textDocuments.find(d=>d.uri.fsPath===target);
                    if(latest.mtimeMs!==stat.mtimeMs||latest.size!==stat.size||open?.isDirty){this.conflict(item.note?'notes':'codes',item.key,item.value);continue;}
                    await fs.rename(tmp,target);
                }finally{await fs.unlink(tmp).catch(()=>{});}
            }catch(error){
                if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
                await fs.writeFile(target,item.value,{flag:'wx'}).catch((failure:NodeJS.ErrnoException)=>{if(failure.code!=='EEXIST')throw failure;});
            }
        }
    }
    private async apply(result:any,sent:any):Promise<void>{
        const files=await this.collect(),before=structuredClone(this.model!),cloud=this.model!.cloudSync as SyncCloud;
        this.core.apply(this.model,cloud.known,result.changes,sent);cloud.revision=result.revision;cloud.planEpoch=result.planEpoch;
        await this.provider.applyPersonalSync(this.model!.accepted,this.model!.favorites,this.model!.progressMeta);
        await this.context.globalState.update('enhancedPlan',this.model!.studyPlan);
        await this.applySettings(this.model!);await this.applyFiles(before,files);this.refreshPlan();
    }
    private chunk(ops:any[]):any[]{
        const result:any[]=[];let size=0;
        for(const op of ops){const n=Buffer.byteLength(JSON.stringify(op));if(n>3*1024*1024)throw Error('单条同步数据过大');if(result.length>=256||size+n>3*1024*1024)break;result.push(op);size+=n;}
        return result;
    }
    async resetPlan():Promise<boolean>{
        if(!this.context.globalState.get(SERVER))return false;
        while(this.running)await this.running.catch(()=>{});
        this.running=this.resetPlanLocal().finally(()=>{this.running=undefined;});
        await this.running;
        void this.sync().catch(()=>{});
        return true;
    }
    private async resetPlanLocal():Promise<void>{
        await this.collect();
        if(this.model!.pendingCloudReset)throw Error('上一次学习计划重置尚未同步。');
        const now=Math.max(Date.now(),...Object.values(this.model!.studyPlan.learnedMeta).map(meta=>meta.at+1));
        this.model!.studyPlan={learned:{},learnedMeta:{},events:[],resetAt:now};
        this.model!.pendingCloudReset={kind:'plan',localApplied:false,request:null};
        await this.save();
        await this.context.globalState.update('enhancedPlan',this.model!.studyPlan);
        this.model!.pendingCloudReset.localApplied=true;await this.save();
        this.refreshPlan();
    }
    private async processPlanReset():Promise<void>{
        for(let attempt=0;this.model!.pendingCloudReset&&attempt<5;attempt++){
            const cloud=this.model!.cloudSync as SyncCloud,pending=this.model!.pendingCloudReset;
            if(cloud.outbox){
                try{
                    const result=await this.request('POST','/v1/sync',cloud.outbox.body);
                    result.changes=result.changes.filter((c:any)=>!['learned','event','plan-reset'].includes(c.kind));
                    await this.apply(result,cloud.outbox.sent);(this.model!.cloudSync as SyncCloud).outbox=null;await this.save();continue;
                }catch(error){
                    if(!(error instanceof Error)||error.message!=='PLAN_EPOCH_MISMATCH')throw error;
                    const meta=await this.request('GET','/v1/meta');if(meta.epoch!==cloud.epoch)throw Error('DATA_EPOCH_MISMATCH');
                    const ops=cloud.outbox.body.operations.filter((op:any)=>!['learned','event'].includes(op.kind));
                    cloud.planEpoch=meta.planEpoch;
                    cloud.outbox=ops.length?{...cloud.outbox,body:{...cloud.outbox.body,planEpoch:meta.planEpoch,requestId:randomUUID(),operations:ops}}:null;
                    await this.save();continue;
                }
            }
            if(!pending.request){
                const meta=await this.request('GET','/v1/meta');if(meta.epoch!==cloud.epoch)throw Error('DATA_EPOCH_MISMATCH');
                pending.request={epoch:cloud.epoch,planEpoch:meta.planEpoch,revision:meta.revision,deviceId:cloud.deviceId,requestId:randomUUID()};await this.save();
            }
            let result:any;
            try{result=await this.request('POST','/v1/reset-plan',pending.request);}
            catch(error){
                if(!(error instanceof Error)||!['REVISION_MISMATCH','PLAN_EPOCH_MISMATCH'].includes(error.message))throw error;
                this.model!.pendingCloudReset!.request=null;await this.save();continue;
            }
            const changes=await this.request('GET',`/v1/changes?epoch=${cloud.epoch}&after=${cloud.revision}`);
            cloud.known.learned={};cloud.known.events={};
            changes.changes=changes.changes.filter((c:any)=>c.revision>result.revision||!['learned','event','plan-reset'].includes(c.kind));
            await this.apply(changes,{drafts:{}});this.model!.pendingCloudReset=undefined;await this.save();
        }
        if(this.model!.pendingCloudReset)throw Error('云端数据持续变化，请稍后重试重置。');
    }
    private async run(manual:boolean):Promise<void>{
        if(!this.context.globalState.get(SERVER)||!await this.context.secrets.get(SECRET)){if(manual)throw Error('请先配置个人私网同步。');return;}
        this.status.text='$(sync~spin) Hot100';
        try{
            if(this.model?.pendingCloudReset&&!this.model.pendingCloudReset.localApplied){
                await this.context.globalState.update('enhancedPlan',this.model.studyPlan);
                this.model.pendingCloudReset.localApplied=true;await this.save();
            }
            await this.collect();
            if(!this.model!.cloudSync){const meta=await this.request('GET','/v1/meta');if((meta.epoch||meta.planEpoch)&&!this.model!.pendingCloudReset)throw Error('云端曾重置数据，请先备份并检查恢复方式。');this.model!.cloudSync={deviceId:randomUUID(),epoch:meta.epoch,planEpoch:meta.planEpoch,revision:0,known:this.core.empty(),outbox:null};await this.save();}
            if(this.model!.pendingCloudReset)await this.processPlanReset();
            let rounds=0;
            while(++rounds<=30){
                let cloud=this.model!.cloudSync as SyncCloud;
                if(!cloud.outbox){
                    const snapshot=this.core.capture(this.model),ops=this.chunk(this.core.operations(snapshot,cloud.known));
                    if(!ops.length){const result=await this.request('GET',`/v1/changes?epoch=${cloud.epoch}&after=${cloud.revision}`);await this.apply(result,{drafts:{}});await this.save();if(!this.core.operations(this.core.capture(this.model), (this.model!.cloudSync as SyncCloud).known).length)break;continue;}
                    const keys=new Set(ops.filter((op:any)=>op.kind==='draft').map((op:any)=>`${op.id}:${op.lang}:${op.mode}`));
                    const sent={drafts:Object.fromEntries(Object.entries(snapshot.drafts).filter(([key])=>keys.has(key)))};
                    cloud.outbox={body:{epoch:cloud.epoch,planEpoch:cloud.planEpoch,baseRevision:cloud.revision,deviceId:cloud.deviceId,requestId:randomUUID(),operations:ops},sent};
                    await this.save();cloud=this.model!.cloudSync as SyncCloud;
                }
                const outbox=cloud.outbox!;
                try{const result=await this.request('POST','/v1/sync',outbox.body);await this.apply(result,outbox.sent);(this.model!.cloudSync as SyncCloud).outbox=null;await this.save();}
                catch(error){if(!(error instanceof Error)||error.message!=='PLAN_EPOCH_MISMATCH')throw error;const result=await this.request('GET',`/v1/changes?epoch=${cloud.epoch}&after=${cloud.revision}`);await this.apply(result,outbox.sent);(this.model!.cloudSync as SyncCloud).outbox=null;await this.save();}
            }
            if(rounds>30)throw Error('待同步数据较多，稍后继续。');
            this.status.text=this.model!.conflicts.length?'$(warning) Hot100':'$(cloud) Hot100';
            this.status.tooltip=this.model!.conflicts.length?'存在同步恢复副本，请运行 Hot100: 查看同步冲突':'个人私网同步已完成';
        }catch(error){this.status.text='$(cloud-offline) Hot100';this.status.tooltip='同步离线，本地修改会保留';throw error;}
    }
    private async showConflicts():Promise<void>{
        const conflicts=this.model?.conflicts||[];
        if(!conflicts.length){vscode.window.showInformationMessage('没有同步恢复副本。');return;}
        const selected=await vscode.window.showQuickPick(conflicts.map((entry,index)=>({label:`${entry.id} · ${entry.key}`,description:new Date(entry.time).toLocaleString(),index})),{title:'选择恢复副本查看'});
        if(!selected)return;
        const entry=conflicts[selected.index],document=await vscode.workspace.openTextDocument({content:entry.value});
        await vscode.window.showTextDocument(document,{preview:false});
    }
}
