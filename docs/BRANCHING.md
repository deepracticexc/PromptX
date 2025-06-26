# PromptX 分支管理策略

## 分支模型

PromptX采用**简化版Git Flow**分支策略，包含三种类型分支：

```
main          ──●──●──●──●──●──●  (正式版本: v0.1.0, v0.2.0)
                ↑     ↑     ↑
develop      ──●──●──●──●──●──●──●  (snapshot: 0.1.0-snapshot.1)
               ↑  ↑  ↑  ↑  ↑
feature/xxx     ●──●──●
feature/yyy        ●──●──●
```

## 分支说明

### 🚀 main分支
- **用途**: 生产就绪的稳定代码
- **保护**: 只能通过PR合并，需要代码审查
- **发布**: 自动发布正式版本到npm
- **版本**: `v0.1.0`, `v0.2.0`, `v1.0.0`

### 🔄 develop分支  
- **用途**: 日常开发集成分支
- **保护**: 可直接推送，但建议通过PR
- **发布**: 自动发布snapshot版本到npm
- **版本**: `0.1.0-snapshot.1`, `0.1.0-snapshot.2`

### 🌟 feature分支
- **用途**: 功能开发和Bug修复
- **命名**: `feature/功能名` 或 `fix/bug名`
- **合并**: 合并到develop分支
- **生命周期**: 功能完成后删除

## 工作流程

### 1. 功能开发

```bash
# 从develop创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-awesome-feature

# 开发功能
# ... 编码 ...

# 提交代码
git add .
git commit -m "feat: add awesome feature"

# 推送分支
git push origin feature/new-awesome-feature
```

### 2. 创建PR到develop

- 在GitHub上创建PR: `feature/new-awesome-feature` → `develop`
- 填写PR模板，添加changeset
- 等待代码审查和CI通过
- 合并后自动发布snapshot版本

### 3. 发布正式版本

```bash
# 从develop创建PR到main
git checkout develop
git pull origin develop

# 在GitHub上创建PR: develop → main
# 合并后自动发布正式版本
```

## 版本发布策略

### Snapshot版本（develop分支）

- **触发条件**: 推送到develop分支
- **版本格式**: `0.1.0-snapshot.1`
- **npm标签**: `@snapshot`
- **用途**: 测试和验证新功能

```bash
# 安装snapshot版本
npm install -g dpml-prompt@snapshot
```

### 正式版本（main分支）

- **触发条件**: 推送到main分支
- **版本格式**: `0.1.0`, `0.2.0`, `1.0.0`
- **npm标签**: `@latest`
- **用途**: 生产环境使用

```bash
# 安装正式版本
npm install -g dpml-prompt@latest
```

## 分支保护规则

### main分支
- ✅ 需要PR审查
- ✅ 需要CI通过
- ✅ 需要最新代码
- ❌ 禁止直接推送
- ❌ 禁止强制推送

### develop分支
- ✅ 需要CI通过
- ⚠️ 建议通过PR（可直接推送）
- ❌ 禁止强制推送

## Changeset管理

### 添加Changeset

```bash
# 功能开发时添加changeset
pnpm changeset

# 选择变更类型
# - patch: Bug修复
# - minor: 新功能
# - major: 破坏性变更
```

### Changeset类型对应

| 变更类型 | Changeset | 版本影响 | 示例 |
|---------|-----------|----------|------|
| 🐛 Bug修复 | patch | 0.1.0 → 0.1.1 | 修复CLI参数解析错误 |
| ✨ 新功能 | minor | 0.1.0 → 0.2.0 | 添加新的remember命令 |
| 💥 破坏性变更 | major | 0.1.0 → 1.0.0 | 改变CLI命令结构 |

## 实际操作示例

### 开发新功能

```bash
# 1. 创建功能分支
git checkout develop
git checkout -b feature/memory-search

# 2. 开发功能
# ... 编码 ...

# 3. 添加changeset
pnpm changeset
# 选择: minor
# 描述: "添加记忆搜索功能"

# 4. 提交并推送
git add .
git commit -m "feat: add memory search functionality"
git push origin feature/memory-search

# 5. 创建PR到develop
# 合并后自动发布snapshot版本
```

### 发布正式版本

```bash
# 1. 确保develop分支稳定
git checkout develop
git pull origin develop

# 2. 运行完整测试
pnpm test:ci

# 3. 创建PR: develop → main
# 在GitHub UI中操作

# 4. 合并PR后自动发布正式版本
```

## 紧急修复流程

对于需要紧急修复的bug：

```bash
# 1. 从main创建hotfix分支
git checkout main
git checkout -b hotfix/critical-bug

# 2. 修复bug
# ... 编码 ...

# 3. 添加changeset
pnpm changeset
# 选择: patch

# 4. 同时合并到main和develop
# 创建PR到main: hotfix → main
# 创建PR到develop: hotfix → develop
```

## 最佳实践

### ✅ 推荐做法
- 功能开发从develop分支创建
- 每个功能分支专注单一功能
- 提交前运行测试和lint
- 写清晰的提交信息
- 及时添加changeset

### ❌ 避免做法
- 直接在main分支开发
- 长期存在的功能分支
- 跳过changeset添加
- 强制推送到保护分支
- 合并未经测试的代码

## 工具和自动化

### GitHub Actions

- **CI**: 每次PR都运行测试
- **Snapshot发布**: develop分支自动发布
- **正式发布**: main分支自动发布
- **PR检查**: 自动检查changeset

### 本地工具

```bash
# 安装git hooks
pnpm prepare

# 运行完整验证
pnpm validate

# 查看changeset状态
pnpm changeset:status
```

## 参考资料

- [Git Flow工作流](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Changesets文档](https://github.com/changesets/changesets)
- [语义化版本控制](https://semver.org/lang/zh-CN/) 