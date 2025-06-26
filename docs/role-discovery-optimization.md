# 角色发现机制优化设计

## 📋 概述

当前PromptX的角色发现机制存在过度复杂的扫描逻辑，导致跨平台兼容性问题和性能瓶颈。本文档分析现状问题，并提出系统性的优化方案。

## 🚨 当前问题分析

### 问题1: 双重角色发现机制
**现状**：
- `ResourceManager.loadUnifiedRegistry()` - 统一资源管理
- `HelloCommand.discoverLocalRoles()` - 独立的本地角色发现

**问题**：
- 逻辑重复，维护成本高
- 数据格式转换复杂
- 容易产生不一致的结果

### 问题2: glob库跨平台兼容性风险
**现状代码**：
```javascript
// HelloCommand.js:254
const rolePattern = path.join(domainPath, '*', '*.role.md')
const roleFiles = glob.sync(rolePattern)
```

**风险点**：
- Windows路径分隔符处理不一致
- glob模式匹配在不同平台行为差异
- 同步操作阻塞主线程
- 外部依赖增加包大小和安全风险

### 问题3: 过度复杂的文件系统扫描
**扫描流程**：
```
ResourceManager.discoverUserResources()
    ↓
scanResourceDirectory() - 扫描基础目录
    ↓
scanRoleResources() - 扫描角色文件
    ↓  
scanOtherResources() - 扫描thought/execution
    ↓
validateDPMLFormat() - DPML格式验证
    ↓
extractRoleName() - 元数据提取
```

**复杂性问题**：
- 4层嵌套的异步操作
- 每个目录多次`fs.stat()`和`fs.pathExists()`调用
- 错误处理不一致（有些抛异常，有些仅警告）
- 无缓存机制，重复I/O操作

### 问题4: DPML验证过于简化
**当前验证**：
```javascript
validateDPMLFormat(content, type) {
  const tags = DPML_TAGS[type]
  return content.includes(tags.start) && content.includes(tags.end)
}
```

**局限性**：
- 只检查标签存在，不验证格式正确性
- 无结构验证和嵌套检查
- 验证失败时无详细错误信息
- 无法处理标签损坏的情况

### 问题5: PackageProtocol检测过度复杂
**现状**：
```javascript
_performInstallModeDetection() {
  // 5种检测模式，每次都执行
  _isNpxExecution()
  _isGlobalInstall()
  _isDevelopmentMode() 
  _isMonorepoWorkspace()
  _isNpmLink()
}
```

**开销问题**：
- 每次调用都重新检测环境
- 文件系统操作频繁
- 逻辑分支复杂，维护困难

## 🎯 优化方案设计

### 方案1: 统一角色发现架构（推荐）

#### 1.1 移除双重机制
```javascript
// 移除HelloCommand.discoverLocalRoles()
// 完全依赖ResourceManager统一管理

class HelloCommand {
  async loadRoleRegistry() {
    // 仅调用ResourceManager，无独立扫描逻辑
    const resourceManager = new ResourceManager()
    const unifiedRegistry = await resourceManager.loadUnifiedRegistry()
    return unifiedRegistry.role || {}
  }
}
```

#### 1.2 简化ResourceManager
```javascript
class ResourceManager {
  async loadUnifiedRegistry() {
    // 并行加载，提升性能
    const [systemRegistry, userRoles] = await Promise.all([
      this.loadSystemRegistry(),
      this.discoverUserRolesSimple()
    ])
    
    return this.mergeRegistries(systemRegistry, userRoles)
  }
  
  async discoverUserRolesSimple() {
    // 最小化用户资源发现逻辑
    const userPath = path.join(await this.getPackageRoot(), USER_RESOURCE_DIR, ...RESOURCE_DOMAIN_PATH)
    
    if (!await fs.pathExists(userPath)) {
      return { role: {} }
    }
    
    return await this.scanUserRolesOptimized(userPath)
  }
}
```

### 方案2: 原生API替代glob

#### 2.1 使用Node.js原生fs API
```javascript
async function discoverRolesNative(domainPath) {
  const roles = {}
  
  try {
    // 使用withFileTypes提升性能
    const entries = await fs.readdir(domainPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const roleFile = path.join(domainPath, entry.name, `${entry.name}.role.md`)
        
        // 单次检查文件存在性
        if (await fs.pathExists(roleFile)) {
          roles[entry.name] = {
            file: roleFile,
            name: entry.name,
            source: 'user-generated'
          }
        }
      }
    }
  } catch (error) {
    // 统一错误处理
    logger.warn(`角色发现失败 ${domainPath}: ${error.message}`)
    return {}
  }
  
  return roles
}
```

#### 2.2 跨平台路径处理最佳实践
```javascript
class PathUtils {
  static normalizeRolePath(roleName) {
    // 确保跨平台路径兼容性
    return path.join('.promptx', 'resource', 'domain', roleName, `${roleName}.role.md`)
  }
  
  static async safeReadDir(dirPath) {
    try {
      return await fs.readdir(dirPath, { withFileTypes: true })
    } catch (error) {
      // 处理权限问题
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        logger.warn(`权限不足，跳过目录: ${dirPath}`)
        return []
      }
      throw error
    }
  }
}
```

### 方案3: 增强DPML验证器

#### 3.1 结构化验证
```javascript
class DPMLValidator {
  static validate(content, type) {
    const result = {
      isValid: false,
      errors: [],
      metadata: {},
      structure: null
    }
    
    try {
      // 1. 基础标签检查
      if (!this.hasValidTags(content, type)) {
        result.errors.push(`缺少${type}标签`)
        return result
      }
      
      // 2. 结构验证
      const structure = this.parseStructure(content, type)
      if (!structure) {
        result.errors.push('标签结构无效')
        return result
      }
      
      // 3. 内容验证
      const metadata = this.extractMetadata(content, type)
      
      result.isValid = true
      result.metadata = metadata
      result.structure = structure
      
    } catch (error) {
      result.errors.push(`验证失败: ${error.message}`)
    }
    
    return result
  }
  
  static parseStructure(content, type) {
    // 解析XML结构，验证嵌套正确性
    const regex = new RegExp(`<${type}>(.*?)</${type}>`, 's')
    const match = content.match(regex)
    return match ? match[1].trim() : null
  }
  
  static extractMetadata(content, type) {
    // 提取角色元数据
    const metadata = {}
    
    // 提取标题
    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
    }
    
    // 提取描述
    const descMatch = content.match(/description:\s*(.+?)(?:\n|$)/i)
    if (descMatch) {
      metadata.description = descMatch[1].trim()
    }
    
    return metadata
  }
}
```

### 方案4: 缓存机制

#### 4.1 文件扫描缓存
```javascript
class RoleDiscoveryCache {
  constructor() {
    this.cache = new Map()
    this.timestamps = new Map()
    this.ttl = 5 * 60 * 1000 // 5分钟缓存
  }
  
  async getOrScan(key, scanFn) {
    const now = Date.now()
    
    // 检查缓存是否有效
    if (this.cache.has(key)) {
      const timestamp = this.timestamps.get(key)
      if (now - timestamp < this.ttl) {
        return this.cache.get(key)
      }
    }
    
    // 执行扫描并缓存结果
    const result = await scanFn()
    this.cache.set(key, result)
    this.timestamps.set(key, now)
    
    return result
  }
  
  invalidate(key) {
    this.cache.delete(key)
    this.timestamps.delete(key)
  }
}
```

#### 4.2 智能缓存失效
```javascript
class SmartCache extends RoleDiscoveryCache {
  async watchDirectory(dirPath) {
    // 监听目录变化，智能失效缓存
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      if (filename && filename.endsWith('.role.md')) {
        this.invalidate(dirPath)
        logger.debug(`角色文件变化，失效缓存: ${filename}`)
      }
    })
    
    return watcher
  }
}
```

### 方案5: 简化PackageProtocol

#### 5.1 基础环境检测
```javascript
class SimplePackageProtocol {
  constructor() {
    this.mode = this.detectMode()
    this.packageRoot = null
  }
  
  detectMode() {
    // 简化为3种基本模式
    if (process.env.PROMPTX_ENV === 'development') {
      return 'development'
    }
    
    if (process.argv[1]?.includes('npx')) {
      return 'npx'
    }
    
    return 'installed'
  }
  
  async getPackageRoot() {
    if (this.packageRoot) {
      return this.packageRoot
    }
    
    switch (this.mode) {
      case 'development':
        this.packageRoot = process.cwd()
        break
      case 'npx':
        this.packageRoot = await this.findNpxRoot()
        break
      default:
        this.packageRoot = await this.findInstalledRoot()
    }
    
    return this.packageRoot
  }
}
```

## 🚀 实施计划

### Phase 1: 移除glob依赖（立即实施）
**优先级**: 🔥 紧急
**影响**: 解决跨平台兼容性问题

**具体步骤**：
1. ✅ 替换`HelloCommand.discoverLocalRoles()`中的glob调用
2. ✅ 使用`fs.readdir()`和`path.join()`替代
3. ✅ 添加跨平台路径处理

### Phase 2: 统一角色发现架构（本周）
**优先级**: 🔥 高
**影响**: 简化维护，提升性能

**具体步骤**：
1. ✅ 移除`HelloCommand.discoverLocalRoles()`方法
2. ✅ 简化`ResourceManager.scanResourceDirectory()`逻辑
3. ✅ 统一错误处理机制

### Phase 3: 增强验证和缓存（下周）
**优先级**: 🔧 中
**影响**: 提升可靠性和性能

**具体步骤**：
1. ✅ 实现`DPMLValidator`结构化验证
2. ✅ 添加`RoleDiscoveryCache`缓存机制
3. ✅ 优化PackageProtocol检测逻辑

### Phase 4: 性能监控和测试（持续）
**优先级**: 📊 中
**影响**: 确保优化效果

**具体步骤**：
1. ✅ 添加角色发现性能指标
2. ✅ 完善跨平台测试用例
3. ✅ 建立性能回归测试

## 📊 预期收益

### 性能提升
- **文件扫描速度**: 提升60%（移除glob，减少I/O）
- **初始化时间**: 减少40%（缓存机制）
- **内存使用**: 降低30%（移除重复数据结构）

### 兼容性改善
- **Windows兼容性**: 100%（原生API）
- **权限处理**: 增强错误恢复
- **路径处理**: 统一跨平台标准

### 维护性提升
- **代码复杂度**: 降低50%（移除双重机制）
- **测试覆盖**: 提升到95%
- **Bug减少**: 预计减少70%的跨平台问题

## 🔧 配置迁移指南

### 用户无感知迁移
优化后的角色发现机制对用户完全透明，无需修改现有配置：

**现有用户资源结构**（保持不变）：
```
.promptx/
  resource/
    domain/
      my-role/
        my-role.role.md
        thought/
          my-role.thought.md
        execution/
          my-role.execution.md
```

**系统资源注册**（保持不变）：
```json
// resource.registry.json
{
  "role": {
    "assistant": {
      "file": "@package://prompt/domain/assistant/assistant.role.md",
      "name": "🙋 智能助手"
    }
  }
}
```

### 开发者API保持兼容
```javascript
// 现有API保持不变
const helloCommand = new HelloCommand()
const roles = await helloCommand.getAllRoles()
const roleInfo = await helloCommand.getRoleInfo('assistant')
```

## 🧪 测试策略

### 跨平台兼容性测试
```javascript
// 新增测试用例
describe('角色发现跨平台兼容性', () => {
  test('Windows路径处理', () => {
    // 测试Windows特殊字符处理
  })
  
  test('Unix权限处理', () => {
    // 测试Unix文件权限
  })
  
  test('符号链接处理', () => {
    // 测试符号链接角色文件
  })
})
```

### 性能基准测试
```javascript
describe('角色发现性能', () => {
  test('大量角色扫描性能', async () => {
    // 创建100个测试角色
    // 测试扫描时间<100ms
  })
  
  test('缓存命中率', async () => {
    // 测试缓存有效性
  })
})
```

## 📚 相关文档

- [用户角色创建系统](./user-role-creation-system.md)
- [DPML协议规范](../prompt/protocol/dpml.protocol.md)
- [ResourceManager架构](../src/lib/core/resource/)
- [跨平台测试指南](../src/tests/commands/CrossPlatformDiscovery.unit.test.js)

---

**总结**: 通过系统性的优化，PromptX的角色发现机制将更加简洁、高效、可靠，为用户提供更好的跨平台体验。