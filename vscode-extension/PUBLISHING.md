# 发布 VS Code 扩展

## 当前市场信息

- Publisher：`lovits`，已创建，当前账号拥有 Owner 权限。
- 扩展标识：`lovits.hot100-practice`。
- 当前公开版本：`0.2.82`，2026-11-18 已核对 Marketplace 公开页面，版本号正确且 Install 按钮可用。
- [市场页面](https://marketplace.visualstudio.com/items?itemName=lovits.hot100-practice)：已上架，可直接安装。
- [管理入口](https://marketplace.visualstudio.com/manage/publishers/lovits)。
- [GitHub Release](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.82)。

## 后续发布

可在 Marketplace 管理页上传新版 VSIX。扩展 Logo 需不超过 1024×1024；当前使用 512×512 透明 PNG。

仓库已有 `publish-vscode.yml` 工作流，使用 VS Code 官方 GitHub OIDC 可信发布。使用前，需在 Publisher 的 Trusted Publishing 中建立与以下信息匹配的策略：

- Repository owner：`lovits`
- Repository：`hot100-acm`
- Workflow：`publish-vscode.yml`
- Environment：留空

当前手动上传成功，不代表可信发布策略已配置；未配置时不要直接触发自动发布工作流。

[官方发布说明](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
