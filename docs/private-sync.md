# 自建远程同步：服务器和两台电脑

本文适用于本仓库包含同步功能的源码构建版本。已有 GitHub Release 或扩展市场版本可能尚未包含这些功能；下载后请先确认桌面顶栏有云图标，插件命令面板有“Hot100: 配置个人私网同步”。同步服务是单用户设计：同一个服务和令牌对应同一份学习数据，请勿多人共用。

任何能够运行 Docker 和 Tailscale 的 Linux 服务器均可使用，包括不同云厂商的云主机或自己的 Linux 机器。下面以 Ubuntu Linux、MySQL 8 和 Tailscale 私网 HTTPS 为例。当前客户端只支持 Tailscale 的 `*.ts.net` 设备名、Tailscale IP 和 HTTPS 443；尚不支持普通域名、自定义端口或其他 VPN。无需购买域名，也无需对公网开放数据库或 API 端口。服务器仍需能联网安装软件并与 Tailscale 建立连接。

## 获取支持同步的桌面包和插件

当前源码可使用已有的同平台 Hot100 运行时制作测试包；旧版 Release 本身不含本次新功能。构建机需要 Node.js、Python 3、扩展依赖，以及已有的桌面运行时包。以仓库根目录为当前目录：

```sh
cd vscode-extension
npm ci
npm run compile
cd ..
# macOS：使用本机已有的同架构 Hot100.app 作为运行时
python3 scripts/stage_private_macos.py --source-app /path/to/Hot100.app --output-app /path/to/Hot100-sync.app
# Windows：使用已有的 Windows x64 Release ZIP 作为运行时
python3 scripts/stage_private_windows.py --source-zip /path/to/Hot100-Windows-x64-release.zip --output-zip /path/to/Hot100-Windows-sync.zip
```

把 macOS 成品复制到“应用程序”；Windows 完整解压后运行 `Hot100/Start-Hot100.vbs`。VS Code 插件可在 `vscode-extension` 目录执行 `HOT100_PRIVATE_SYNC_BUILD=1 npm run package` 生成本地 VSIX（PowerShell 使用 `$env:HOT100_PRIVATE_SYNC_BUILD="1"; npm run package`），再从 VSIX 安装。上述测试包不是新的官方 Release；构建不应包含个人 `.env`、`sync-auth.json` 或学习数据。

## 1. 准备服务器

1. 准备 Linux 服务器，并通过 SSH 登录。安装 [Docker Engine](https://docs.docker.com/engine/install/ubuntu/) 和 [Docker Compose 插件](https://docs.docker.com/compose/install/linux/)，检查 `docker --version` 和 `docker compose version`。下面假设当前用户能执行 Docker；若需 sudo，请在 Docker 命令前加 `sudo`。
2. 安装 [Tailscale](https://tailscale.com/download)，执行 `sudo tailscale up`，按提示登录并授权该设备。Mac 和 Windows 稍后也要登录同一个 tailnet。
3. 在 Tailscale 管理后台启用 MagicDNS 与 HTTPS Certificates；按 [官方说明](https://tailscale.com/docs/how-to/set-up-https-certificates)完成。Tailscale 的证书名称会出现在公开证书透明日志，但服务访问仍受私网权限控制。
4. 克隆本仓库，并进入服务目录：

   ```sh
   git clone https://github.com/lovits/hot100-acm.git
   cd hot100-acm/sync-server
   ```

## 2. 创建凭据并启动服务

在 `sync-server` 目录执行下列命令，为这台服务器生成随机密码和令牌：

```sh
umask 077
printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_PASSWORD=%s\nSYNC_TOKEN=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose up -d --build
docker compose ps
```

`.env` 是私密文件，仅供此服务器使用，不要提交、发送或放入公开安装包。第一次执行后妥善备份它；**不要在已有服务上重新运行生成命令**，否则会改变连接凭据。MySQL 数据保存在 `sync-server/data/`，自动备份保存在 `sync-server/backups/`（每天一次、保留约 30 天），应另存一份到服务器以外。重新部署不要删除这两个目录，也不要对现有数据库重复初始化。

检查 MySQL 状态为 `healthy`、API 为 `running`。API 只监听服务器 `127.0.0.1:18766`，MySQL 不映射到公网。查看错误可运行 `docker compose logs --tail=100 api mysql`。

## 3. 开通私网 HTTPS

在服务器运行：

```sh
sudo tailscale serve --bg --https=443 http://127.0.0.1:18766
tailscale serve status
tailscale ip -4
tailscale status
```

如果提示授权 HTTPS，按提示完成后重试。记下此服务器在 `tailscale status` / 管理后台显示的**完整设备域名**（形如 `machine.tailnet.ts.net`），以及 `tailscale ip -4` 输出的 **100.x.x.x 地址**。不要使用 Funnel；Serve 仅供允许访问的 tailnet 设备使用。更多信息见 [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve)。

要在服务器上查看自己的同步令牌，可在安全的终端中执行 `sed -n 's/^SYNC_TOKEN=//p' .env`。不要截图、提交或公开分享令牌；通过安全方式输入自己的设备。

## 4. 配置 Mac 和 Windows

1. 两台电脑安装并登录 Tailscale，同意加入服务器所在的同一个 tailnet，并确认服务器在线、设备权限允许连接。
2. 两台电脑安装包含本功能的 Hot100 桌面版，分别打开顶栏的云图标。
3. 两台都填写第 3 步获得的**同一个完整设备域名**、**同一个 Tailscale IP** 和第 2 步生成的**同一个同步令牌**，点击“保存并同步”。地址是服务器的 Tailscale 地址，不是 MySQL 地址或公网 IP。
4. 在第一台确认同步成功，再在第二台操作；保留各设备原有数据并先导出备份。同步状态和冲突副本可在界面中查看。离线时数据保存在本地，重新联网后自动尝试同步。
5. 试用：在第一台做一项可识别的收藏或笔记，等待同步，再到第二台点击“立即同步”检查；确认后可自行撤销测试修改并同步。

桌面令牌保存在该机用户数据目录的 `Hot100ACM/sync-auth.json`；不要分享这个文件。macOS 位于 `~/Library/Application Support/Hot100ACM/`，Windows 位于 `%LOCALAPPDATA%\\Hot100ACM\\`。

## 5. VS Code 插件（可选）

安装包含同步功能的插件构建，并打开一个用于保存题解的工作区。同机桌面端已配置时插件会尝试读取其配置；否则在命令面板执行“Hot100: 配置个人私网同步”，依次输入相同的设备名、地址和令牌。令牌存入 VS Code Secret Storage。命令“Hot100: 立即同步个人数据”和“Hot100: 查看同步冲突”可手动检查。当前插件包构建保护需要显式设置 `HOT100_PRIVATE_SYNC_BUILD=1`；不要将个人配置或令牌打包发布。

## 6. 常见问题

- **连接失败**：检查三个设备的 Tailscale 登录、访问权限、服务器在线状态、Serve 状态、完整设备域名、IP、HTTPS 证书与 API 容器日志。
- **认证失败**：检查两台电脑输入的令牌是否与服务器 `.env` 中一致。更换令牌需要同时更新服务器和所有客户端。
- **显示待处理内容**：这可能是保留的代码冲突恢复副本，先检查再决定如何处理，不要直接删除本地文件。
- **重置后不同步**：其他设备的旧数据不会自动覆盖全局重置，先导出本机备份并核对后再处理。
- **不同的服务器 / 多人**：每个用户应独立部署、生成独立令牌；本服务不提供多账号隔离。切换已有设备的服务器前先导出备份，不要把现有版本号直接用于另一套数据库。
