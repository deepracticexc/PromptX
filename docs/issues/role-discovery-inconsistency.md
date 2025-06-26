# 角色发现一致性问题

## 🔥 问题等级
**中等优先级 (Medium Priority)**

## 📋 问题描述

用户自定义角色在创建后出现间歇性的"角色不存在"错误，表现为hello命令能发现角色，但action命令无法激活同一角色。重启MCP Server后问题消失。

## 🔍 问题详情

### 问题表现
1. **创建新角色后** - `internet-empathy-master`角色文件已正确创建在`.promptx/resource/domain/`
2. **hello命令正常** - `promptx_hello`能正确发现并显示新角色
3. **action命令失败** - `promptx_action internet-empathy-master`提示"角色不存在"
4. **重启后恢复** - 重启MCP Server后action命令立即可用

### 错误信息
```
❌ 角色 "internet-empathy-master" 不存在！

🔍 请使用以下命令查看可用角色：
```bash
pnpm start hello
```

### 用户反馈
> "我刚刚配置了一下，然后重启了 mcp 就可以了"

## 🔍 技术分析

### 当前架构分析

**MCP Server启动流程：**
1. MCP Server启动时**不执行角色发现**（延迟初始化设计）
2. 只有调用`promptx_hello`时才触发`SimplifiedRoleDiscovery.discoverAllRoles()`
3. HelloCommand使用实例级缓存`this.roleRegistry`避免重复扫描
4. ActionCommand通过懒加载HelloCommand实例复用缓存

**角色发现流程：**
```javascript
// HelloCommand.loadRoleRegistry()
if (this.roleRegistry) {
  return this.roleRegistry  // 实例级缓存
}
const allRoles = await this.discovery.discoverAllRoles()
this.roleRegistry = {}  // 缓存结果
```

**ActionCommand角色查询：**
```javascript
// ActionCommand.getRoleInfo()
if (!this.helloCommand) {
  this.helloCommand = new HelloCommand()  // 懒加载新实例
}
return await this.helloCommand.getRoleInfo(roleId)
```

### 问题假设分析

#### 假设1：实例级缓存不一致 ❌
- **假设**：不同HelloCommand实例缓存状态不同
- **反驳**：ActionCommand懒加载HelloCommand，应该使用相同的发现逻辑

#### 假设2：SimplifiedRoleDiscovery不稳定 ❓
- **假设**：`Promise.allSettled`并行文件操作存在竞态条件
- **可能性**：文件系统I/O操作的时序不确定性

#### 假设3：MCP Server状态管理问题 ❓
- **假设**：MCP Server在处理多个请求时状态混乱
- **可能性**：不同MCP工具调用之间存在状态污染

## 🧪 问题复现

### 复现步骤
1. 启动MCP Server
2. 创建新的用户角色文件（如`test-role.role.md`）
3. 立即调用`promptx_hello` - 预期能看到新角色
4. 立即调用`promptx_action test-role` - 可能失败
5. 重启MCP Server
6. 再次调用`promptx_action test-role` - 预期成功

### 复现条件
- 角色文件在MCP Server运行期间创建
- 立即尝试激活新创建的角色
- 系统：macOS (用户报告环境)

## 🔍 调试数据需求

### 需要收集的日志
使用`DEBUG=1`环境变量启用调试日志：

1. **HelloCommand调用日志**
   ```
   [HelloCommand] getRoleInfo调用，角色ID: internet-empathy-master
   [HelloCommand] 注册表加载完成，包含角色: [...]
   [HelloCommand] 查找角色internet-empathy-master结果: 找到/未找到
   ```

2. **SimplifiedRoleDiscovery日志**
   ```
   [SimplifiedRoleDiscovery] 开始发现所有角色...
   [SimplifiedRoleDiscovery] 用户角色扫描完成，发现角色: [...]
   [SimplifiedRoleDiscovery] 检查角色目录: internet-empathy-master
   [SimplifiedRoleDiscovery] 角色文件是否存在: true/false
   ```

3. **ActionCommand调用日志**
   ```
   [ActionCommand] 开始激活角色: internet-empathy-master
   [ActionCommand] 创建新的HelloCommand实例 / 复用现有HelloCommand实例
   [ActionCommand] getRoleInfo结果: {...} / null
   ```

## 💡 可能解决方案

### 方案1：添加缓存失效机制
```javascript
class HelloCommand {
  invalidateCache() {
    this.roleRegistry = null
  }
}
```

### 方案2：实时角色发现
移除HelloCommand的实例级缓存，每次都重新扫描：
```javascript
async getRoleInfo(roleId) {
  // 移除缓存检查，直接执行发现
  const registry = await this.loadRoleRegistry(true) // 强制重新加载
}
```

### 方案3：文件系统监听
监听`.promptx/resource/domain`目录变化，自动刷新缓存：
```javascript
const chokidar = require('chokidar')
const watcher = chokidar.watch('.promptx/resource/domain')
watcher.on('add', () => this.invalidateCache())
```

### 方案4：全局角色注册表
使用单例模式管理角色注册表，确保所有实例共享状态：
```javascript
class GlobalRoleRegistry {
  static instance = null
  static getInstance() {
    if (!this.instance) {
      this.instance = new GlobalRoleRegistry()
    }
    return this.instance
  }
}
```

## 📊 影响评估

### 影响范围
- **用户体验**：新角色创建后无法立即使用，需要重启MCP Server
- **开发效率**：角色开发和测试流程被中断
- **系统可靠性**：间歇性错误难以预测和重现

### 影响程度
- **频率**：新角色创建时100%触发
- **严重性**：中等（有解决方案：重启MCP Server）
- **用户反馈**：已有用户报告此问题

## 🔧 技术实现建议

### 推荐方案：方案1 + 方案2组合
1. **短期**：移除HelloCommand缓存，改为每次实时发现（方案2）
2. **长期**：实现智能缓存失效机制（方案1）

### 实现优先级
1. **高优先级**：添加详细调试日志，收集实际出错的调试数据
2. **中优先级**：实现缓存失效或实时发现机制
3. **低优先级**：文件系统监听（增加系统复杂性）

## 📅 建议时间线
- **阶段1**：问题确认和调试数据收集（1天）
- **阶段2**：实现临时解决方案（移除缓存）（1天）
- **阶段3**：设计长期解决方案（智能缓存）（2-3天）
- **阶段4**：测试和验证（1天）

## 🔗 相关文件
- `src/lib/core/pouch/commands/HelloCommand.js` - 角色注册表缓存逻辑
- `src/lib/core/pouch/commands/ActionCommand.js` - 角色信息获取逻辑
- `src/lib/core/resource/SimplifiedRoleDiscovery.js` - 角色发现算法
- `docs/issues/role-content-parsing-incomplete.md` - 相关的角色解析问题

## ⚠️ 注意事项
1. **性能平衡**：移除缓存可能影响性能，需要测试文件系统操作耗时
2. **并发安全**：多个MCP请求并发时的角色发现一致性
3. **错误处理**：文件系统操作失败时的优雅降级
4. **跨平台兼容**：确保解决方案在不同操作系统上稳定工作

---

**报告人**：Claude Code  
**发现时间**：2025-06-11  
**优先级**：Medium  
**标签**：role-discovery, mcp-server, caching, user-experience, file-system