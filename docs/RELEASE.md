# PromptX 发布流程

本文档描述了PromptX项目的版本管理和发布流程。

## 版本管理策略

我们采用[Changesets](https://github.com/changesets/changesets)进行版本管理，遵循[语义化版本控制](https://semver.org/lang/zh-CN/)。

### 版本类型

- **Patch (0.0.X)**: Bug修复，向后兼容
- **Minor (0.X.0)**: 新功能，向后兼容
- **Major (X.0.0)**: 破坏性变更，不向后兼容

## 开发流程

### 1. 功能开发

```bash
# 创建功能分支
git checkout -b feature/new-feature
# 开发功能
# 提交代码
git commit -m "feat: add new feature"
```

### 2. 添加Changeset

在提交PR之前，为需要发布的变更添加changeset：

```bash
# 添加changeset
pnpm changeset

# 或者使用快捷命令
pnpm run version:patch   # Bug修复
pnpm run version:minor   # 新功能
pnpm run version:major   # 破坏性变更
```

这会创建一个`.changeset/*.md`文件，描述变更内容。

### 3. 提交PR

创建Pull Request，确保：
- [ ] 所有测试通过
- [ ] 代码通过lint检查
- [ ] 已添加changeset（如需要发布）
- [ ] 更新了相关文档

## 发布流程

### 自动发布（推荐）

我们的CI/CD会自动处理发布：

1. **合并到main分支**后，GitHub Actions会：
   - 运行所有测试
   - 检查是否有pending changesets
   - 如果有，创建发布PR
   - 如果没有，发布snapshot版本

2. **合并发布PR**后：
   - 自动更新版本号
   - 生成CHANGELOG.md
   - 发布到npm
   - 创建GitHub Release

### 手动发布

如需手动发布：

```bash
# 1. 确保在main分支且代码最新
git checkout main
git pull origin main

# 2. 运行测试
pnpm test:ci

# 3. 构建项目
pnpm build

# 4. 更新版本并发布
pnpm changeset version  # 更新版本号
pnpm changeset publish  # 发布到npm
```

### Snapshot发布

对于测试版本，可以发布snapshot：

```bash
# 发布snapshot版本
pnpm run release:snapshot
```

这会创建类似`0.0.2-snapshot.1`的版本号。

## 发布检查清单

发布前请确认：

- [ ] 所有测试通过
- [ ] 代码已通过review
- [ ] 文档已更新
- [ ] CHANGELOG.md准确反映变更
- [ ] 版本号符合语义化版本控制
- [ ] 重要变更已在README中标注

## NPM包管理

### 配置NPM Token

在GitHub仓库设置中添加secrets：

1. `NPM_TOKEN`: NPM发布token
2. `GITHUB_TOKEN`: GitHub Actions自动提供

### 包信息

- **包名**: `dpml-prompt`
- **作用域**: 公开包
- **注册表**: `https://registry.npmjs.org/`

### 安装方式

```bash
# 稳定版本
npm install -g dpml-prompt

# 测试版本
npm install -g dpml-prompt@snapshot

# 指定版本
npm install -g dpml-prompt@0.0.2
```

## 故障排除

### 常见问题

1. **发布失败**
   ```bash
   # 检查changeset状态
   pnpm changeset status
   
   # 检查npm token
   npm whoami
   ```

2. **版本冲突**
   ```bash
   # 重置changeset
   rm -rf .changeset/*.md
   pnpm changeset
   ```

3. **构建失败**
   ```bash
   # 清理并重新安装
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   pnpm build
   ```

### 联系支持

如遇到发布问题，请：
1. 检查GitHub Actions日志
2. 查看[Issues](https://github.com/Deepractice/PromptX/issues)
3. 联系维护者：sean@deepracticex.com

## 参考资料

- [Changesets文档](https://github.com/changesets/changesets)
- [语义化版本控制](https://semver.org/lang/zh-CN/)
- [NPM发布指南](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages) 