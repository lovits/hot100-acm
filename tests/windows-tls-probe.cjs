'use strict';
const https = require('node:https');
const [host, servername] = process.argv.slice(2);
if (!host || !servername) throw Error('用法: node windows-tls-probe.cjs <Tailscale IP> <设备完整域名>');
const request = https.request({host, port:443, servername, path:'/v1/meta', method:'GET', rejectUnauthorized:true, timeout:10000, headers:{Host:servername}}, response => {
  console.log('TLS probe HTTP:', response.statusCode, 'remote:', response.socket.remoteAddress);
  response.resume();
});
request.on('socket', socket => socket.once('connect', () => console.log('TLS probe connected:', socket.remoteAddress, socket.remotePort)));
request.on('error', error => { console.log('TLS probe error:', error.code, error.message); process.exitCode = 1; });
request.on('timeout', () => request.destroy(Error('timeout')));
request.end();
