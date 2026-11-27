"""Private Tailscale HTTPS transport for the desktop application."""
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import socket
import ssl
from urllib.parse import urlencode

MAX_RESPONSE = 32 * 1024 * 1024
ALLOWED_REQUESTS = {
    ('GET', '/v1/meta'), ('GET', '/v1/changes'), ('POST', '/v1/sync'),
    ('POST', '/v1/reset-plan'), ('POST', '/v1/reset-all'),
}


def validate_config(config):
    if not isinstance(config, dict):
        raise ValueError('同步配置格式不正确')
    host, address, token = (config.get(key) for key in ('host', 'address', 'token'))
    if not isinstance(host, str) or not re.fullmatch(r'[a-z0-9-]+\.[a-z0-9-]+\.ts\.net', host):
        raise ValueError('请输入有效的 Tailscale 设备名称')
    try:
        ip = ipaddress.ip_address(address)
    except ValueError as exc:
        raise ValueError('请输入有效的 Tailscale 私网地址') from exc
    if ip not in ipaddress.ip_network('100.64.0.0/10') and ip not in ipaddress.ip_network('fd7a:115c:a1e0::/48'):
        raise ValueError('同步地址必须是 Tailscale 私网地址')
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token):
        raise ValueError('同步令牌格式不正确')
    return {'host': host, 'address': str(ip), 'token': token}


class PrivateHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(host, timeout=20, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise


class SyncTransport:
    def __init__(self, directory):
        self.path = Path(directory) / 'sync-auth.json'

    def configure(self, config):
        config = validate_config(config)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_name('sync-auth.' + secrets.token_hex(8) + '.tmp')
        try:
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(config, stream)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, self.path)
            os.chmod(self.path, 0o600)
        finally:
            temp.unlink(missing_ok=True)

    def status(self):
        if not self.path.is_file():
            return {'configured': False}
        config = self.load()
        return {'configured': True, 'host': config['host'], 'address': config['address']}

    def load(self):
        if not self.path.is_file():
            raise ValueError('尚未配置同步')
        return validate_config(json.loads(self.path.read_text(encoding='utf-8')))

    def request(self, method, path, payload=None, query=None):
        if (method, path) not in ALLOWED_REQUESTS:
            raise ValueError('不支持的同步请求')
        if path == '/v1/changes':
            if not isinstance(query, dict) or set(query) != {'epoch', 'after'} or any(type(v) is not int or v < 0 for v in query.values()):
                raise ValueError('同步版本格式不正确')
            path += '?' + urlencode(query)
        elif query:
            raise ValueError('不支持的同步参数')
        config = self.load()
        connection = PrivateHTTPSConnection(config['host'], config['address'])
        try:
            body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode('utf-8')
            connection.request(method, path, body=body, headers={'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'})
            response = connection.getresponse()
            raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE:
                raise ValueError('同步响应过大')
            return response.status, json.loads(raw)
        finally:
            connection.close()
