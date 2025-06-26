# Snapshot 发布系统

## 概述

PromptX 使用自动化的 snapshot 发布系统，为每次 develop 分支的推送自动生成和发布 snapshot 版本，让开发者能够快速测试最新功能。

## 版本号生成规则

### 格式
```
{base-version}-snapshot.{timestamp}.{commit-hash}
```

### 示例
```
0.0.2-snapshot.20250602095731.a1f704f
```

### 组成部分
- **base-version**: 基础版本号（从 package.json 中提取）
- **snapshot**: 标识这是一个 snapshot 版本
- **timestamp**: 14位时间戳 (YYYYMMDDHHMMSS)
- **commit-hash**: 7位短 commit hash

## 自动发布流程

### 触发条件
- 推送到 `develop` 分支
- 所有测试通过

### 发布步骤
1. **环境准备**: 配置 Node.js 和 pnpm
2. **测试验证**: 运行完整测试套件
3. **版本生成**: 使用时间戳和 commit hash 生成唯一版本号
4. **NPM 发布**: 发布到 NPM registry，标签为 `snapshot`
5. **PR 通知**: 自动在相关 PR 中添加评论

### CI 配置文件
`.github/workflows/snapshot.yml`

## 使用方法

### 安装和使用 Snapshot 版本

#### 方式1：使用具体版本号
```bash
npx dpml-prompt@0.0.2-snapshot.20250602095731.a1f704f hello
npx dpml-prompt@0.0.2-snapshot.20250602095731.a1f704f init
```

#### 方式2：使用 snapshot 标签（最新 snapshot）
```bash
npx dpml-prompt@snapshot hello
npx dpml-prompt@snapshot init
```

### 查看当前 snapshot 版本
```bash
npm view dpml-prompt@snapshot version
```

### 查看所有 snapshot 版本
```bash
npm view dpml-prompt versions --json | grep snapshot
```

## 开发流程

### 开发者工作流
1. **开发功能**: 在 feature 分支开发
2. **合并到 develop**: 创建 PR 合并到 develop
3. **自动发布**: 推送到 develop 后自动触发 snapshot 发布
4. **测试验证**: 使用 snapshot 版本测试功能
5. **反馈修复**: 根据测试结果进行调整

### 测试新功能
```bash
# 获取最新 snapshot 版本
npx dpml-prompt@snapshot hello

# 测试修复的功能
npx dpml-prompt@snapshot init
npx dpml-prompt@snapshot learn assistant
```

## 版本管理

### Snapshot vs Release
- **Snapshot**: 开发中的预览版本，频繁更新
- **Release**: 稳定的正式版本，经过充分测试

### 版本生命周期
```
feature branch → develop (snapshot) → main (release)
```

### 清理旧版本
NPM 会保留所有发布的版本，但可以通过以下方式管理：

```bash
# 查看所有版本
npm view dpml-prompt versions --json

# 删除特定版本（需要维护者权限）
npm unpublish dpml-prompt@0.0.2-snapshot.xxx
```

## 优势

### 1. 零冲突发布
- 每次发布使用唯一版本号
- 避免版本冲突导致的发布失败
- 支持并行开发和测试

### 2. 可追溯性
- 版本号包含时间戳和 commit hash
- 容易追溯到具体的代码变更
- 便于问题定位和调试

### 3. 快速反馈
- 推送后立即可用
- 无需手动发布流程
- 支持快速迭代

## 故障排除

### 常见问题

#### 1. 发布失败
检查 CI 日志中的错误信息：
- NPM 认证问题
- 测试失败
- 网络连接问题

#### 2. 版本号重复
新的系统避免了这个问题，但如果遇到：
- 检查时间戳生成逻辑
- 确认 commit hash 正确

#### 3. 安装失败
```bash
# 清除 npm 缓存
npm cache clean --force

# 尝试最新 snapshot
npx dpml-prompt@snapshot hello
```

### 调试工具

#### 本地测试版本生成
```bash
./scripts/test-snapshot-version.sh
```

#### 检查发布状态
```bash
# 查看 NPM 上的最新版本
npm view dpml-prompt@snapshot

# 查看发布历史
npm view dpml-prompt versions --json
```

## 最新改进

### v2024.12 更新
- ✅ 修复了 Windows 平台 platform-folders 兼容性问题
- ✅ 解决了协议路径警告问题
- ✅ 使用 env-paths 替代 platform-folders，提升跨平台兼容性
- ✅ 完善的 e2e 测试覆盖

### 测试验证
所有改进都通过了完整的测试套件验证：
- Platform-folders 兼容性测试：19/19 ✅
- 协议路径警告测试：全部通过 ✅
- 跨平台兼容性测试：Windows/macOS/Linux ✅

## 相关文档

- [CI/CD 配置](.github/workflows/snapshot.yml)
- [测试套件](../src/tests/issues/)
- [版本测试脚本](../scripts/test-snapshot-version.sh)
- [项目主文档](../README.md) 