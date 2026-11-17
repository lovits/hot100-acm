# 发布 VS Code 扩展

当前交付物为可直接安装的 VSIX，GitHub Release 标签为 `vscode-v0.2.1`。桌面应用 v1.0.11 的 Release 保留，插件独立编号。

## 上传扩展市场前

1. 使用 Microsoft 账号登录 https://marketplace.visualstudio.com/manage ，创建或选择你实际拥有的 Publisher。
2. package.json 中的 `publisher: lovits` 是与 GitHub 用户名一致的拟用标识，**不表示该 Marketplace Publisher 已注册或验证**。如实际 Publisher 不同，先修改并重新打包；扩展的完整标识将随之变化。
3. 在 Publisher 的 Trusted Publishing 中配置仓库 `lovits/hot100-acm` 和工作流 `publish-vscode.yml`。
4. 检查发布账号权限和题目内容分发许可，再从 GitHub Actions 手动触发 Publish VS Code Marketplace 工作流。

工作流采用 VS Code 官方的 GitHub OIDC 可信发布方式，不要求把长期密钥写进仓库。说明：https://code.visualstudio.com/api/working-with-extensions/publishing-extension 。若账号尚未配置可信发布，也可以在 Marketplace 管理页手动上传 VSIX。

图标、简介、分类、关键词、隐私说明、运行环境、更新日志、源码和问题反馈链接均已备齐。GitHub 发布不代表已经上架扩展市场；需要真实 Publisher 账号及发布权限。
