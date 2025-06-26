# NPM 发布认证设置指南

## 问题诊断

当前CI发布失败的错误信息：
```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
npm error need auth You need to authorize this machine using `npm adduser`
```

## 解决方案

### 1. 获取NPM Access Token

#### 步骤1：登录NPM
访问 [https://www.npmjs.com/](https://www.npmjs.com/) 并登录您的账户

#### 步骤2：生成Access Token
1. 点击右上角头像 → "Access Tokens"
2. 点击 "Generate New Token"
3. 选择 "Automation" 类型（用于CI/CD）
4. 复制生成的token（格式类似：`npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### 2. 配置GitHub Secrets

#### 步骤1：访问仓库设置
访问：https://github.com/Deepractice/PromptX/settings/secrets/actions

#### 步骤2：添加ORG_NPM_TOKEN（组织级）
1. 访问组织设置：https://github.com/organizations/Deepractice/settings/secrets/actions
2. 点击 "New organization secret"
3. Name: `ORG_NPM_TOKEN`
4. Secret: 粘贴上一步获取的npm token
5. Repository access: 选择适当的访问权限
6. 点击 "Add secret"

或者添加仓库级的NPM_TOKEN：
1. 点击 "New repository secret"
2. Name: `NPM_TOKEN`
3. Secret: 粘贴上一步获取的npm token
4. 点击 "Add secret"

### 3. 验证配置

#### 本地测试（可选）
```bash
# 设置临时环境变量
export NPM_TOKEN=npm_your_token_here

# 测试认证
./scripts/test-npm-auth.sh
```

#### CI测试
推送代码到develop分支，观察CI日志中的发布结果

### 4. 包权限检查

#### 确保包名可用
```bash
npm view dpml-prompt
```

如果包不存在或您没有发布权限，可能需要：
1. 更改包名
2. 请求包的发布权限
3. 或者发布为scoped包（如：`@deepractice/dpml-prompt`）

### 5. 常见问题排查

#### 问题1：Token无效
- 确保token类型是 "Automation"
- 确保token没有过期
- 重新生成token并更新GitHub Secret

#### 问题2：权限不足
- 确保您的npm账户有发布权限
- 如果是组织包，确保您是组织成员并有发布权限

#### 问题3：包名冲突
- 检查包名是否已存在：`npm view dpml-prompt`
- 考虑使用scoped包名：`@deepractice/dpml-prompt`

#### 问题4：2FA认证
如果启用了2FA，需要：
1. 使用Automation token（不需要2FA）
2. 或在token设置中配置适当的权限

### 6. 最佳实践

#### Token安全
- 永远不要在代码中硬编码token
- 定期轮换token
- 使用最小权限原则

#### CI配置
- 使用`NODE_AUTH_TOKEN`环境变量
- 配置正确的registry URL
- 使用`--no-git-checks`标志避免git相关检查

#### 监控
- 监控发布日志
- 设置发布成功/失败通知
- 定期检查已发布的版本

### 7. 参考DPML项目

DPML项目（https://github.com/Deepractice/dpml）也使用类似的发布流程，可以参考其配置：
- 使用pnpm发布
- 配置NODE_AUTH_TOKEN
- 使用actions/setup-node的registry-url配置

### 8. 当前修复状态

已修复的配置：
- ✅ 添加了NODE_AUTH_TOKEN环境变量
- ✅ 配置了registry-url
- ✅ 使用pnpm发布（与DPML项目一致）
- ✅ 移除了手动.npmrc配置（使用actions/setup-node自动配置）

已更新配置：
- ✅ 使用组织级ORG_NPM_TOKEN
- ✅ CI配置已更新为使用组织token

待验证：
- 🔍 组织token的访问权限设置
- 🔍 npm账户的包发布权限
