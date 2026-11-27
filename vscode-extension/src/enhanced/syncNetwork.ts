import * as https from 'https';
import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface PrivateSyncServer {host:string;address:string}
export async function desktopSyncConfig():Promise<(PrivateSyncServer & {token:string})|undefined> {
    const base=process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support'):process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local');
    const file=path.join(base,'Hot100ACM','sync-auth.json');
    try{
        const stat=await fs.lstat(file);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16384)return undefined;
        const config=JSON.parse(await fs.readFile(file,'utf8'));
        if(!validPrivateServer(config)||typeof config.token!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(config.token))return undefined;
        return {host:config.host,address:config.address,token:config.token};
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
}
export function validPrivateServer(server:PrivateSyncServer):boolean {
    if(!server||typeof server.host!=='string'||typeof server.address!=='string'||!/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(server.host))return false;
    const family=net.isIP(server.address);
    if(family===4){const parts=server.address.split('.').map(Number);return parts[0]===100 && parts[1]>=64 && parts[1]<=127;}
    return family===6 && server.address.toLowerCase().startsWith('fd7a:115c:a1e0:');
}
export class SyncHttpError extends Error {constructor(message:string,readonly status:number){super(message);}}
export async function syncRequest(server:PrivateSyncServer, token:string, method:'GET'|'POST', route:string, body?:unknown):Promise<any> {
    try{return await syncRequestOnce(server,token,method,route,body);}
    catch(error){
        if(method!=='GET'||!['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ECONNABORTED','EHOSTUNREACH','ENETUNREACH'].includes((error as NodeJS.ErrnoException).code||''))throw error;
        await new Promise(resolve=>setTimeout(resolve,250));
        return syncRequestOnce(server,token,method,route,body);
    }
}
function syncRequestOnce(server:PrivateSyncServer, token:string, method:'GET'|'POST', route:string, body?:unknown):Promise<any> {
    if(!validPrivateServer(server)||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return Promise.reject(Error('私网同步配置无效'));
    if(!/^\/v1\/(meta|changes\?epoch=\d+&after=\d+|sync|reset-plan|reset-all)$/.test(route))return Promise.reject(Error('不支持的同步请求'));
    return new Promise((resolve,reject)=>{
        const data=body===undefined?undefined:Buffer.from(JSON.stringify(body));
        const options:https.RequestOptions={protocol:'https:',agent:new https.Agent(),host:server.address,servername:server.host,port:443,path:route,method,rejectUnauthorized:true,timeout:20000,headers:{Host:server.host,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(data?{'Content-Length':data.length}:{})}};
        const request=new http.ClientRequest(options,response=>{
            const chunks:Buffer[]=[];let size=0;
            response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>32*1024*1024){request.destroy(Error('同步响应过大'));return;}chunks.push(chunk);});
            response.on('end',()=>{try{
                const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if((response.statusCode||500)>=400)return reject(new SyncHttpError(value.error||'同步失败',response.statusCode||500));
                if((response.statusCode||500)>=300)return reject(new SyncHttpError('不支持重定向',response.statusCode||500));
                resolve(value);
            }catch(error){reject(error);}});
        });
        request.on('timeout',()=>request.destroy(Object.assign(Error('同步连接超时'),{code:'ETIMEDOUT'})));
        request.on('error',reject);
        request.end(data);
    });
}
