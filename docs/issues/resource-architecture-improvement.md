# PromptX 资源管理架构改进方案

## 背景

**Issue #31** 的修复虽然解决了 Windows 路径解析兼容性问题，但暴露了 PromptX 资源管理架构的深层次问题。本文档提出了一个基于**注册表缓存 + @reference protocol 体系**的全新架构改进方案。

## 当前架构问题分析

### 1. 架构复杂度过高

当前系统存在多个重叠的组件和注册表：

```
ResourceRegistry.js (248行) + resource.registry.json (167行) + 内存协议注册表
                    ↓
            ResourceManager.js (482行)
                    ↓
        SimplifiedRoleDiscovery.js (284行)
                    ↓
            PackageProtocol.js (581行)
```

**问题**：
- 职责重叠，维护成本高
- 数据流路径不清晰
- 调试困难

### 2. 协议系统不一致

**当前协议处理问题**：
```javascript
// 问题1：协议前缀不统一
"@package://prompt/core/role.md"      // 正确
"@packages://promptx/prompt/core/"    // 错误变换

// 问题2：循环依赖
ResourceManager → PackageProtocol → ResourceManager

// 问题3：硬编码协议处理
if (filePath.startsWith('@package://')) {
  // 每次都创建新实例，无复用
  const PackageProtocol = require('../../resource/protocols/PackageProtocol')
  const packageProtocol = new PackageProtocol()
}
```

### 3. 缓存机制缺失

**性能问题**：
- 每次资源解析都触发文件系统操作
- 资源发现结果未缓存，重复扫描
- 协议实例未复用

**具体数据**：
- 首次角色激活：~200ms（包含文件系统扫描）
- 后续角色激活：~150ms（仍需重复解析）
- 期望性能：<10ms（缓存命中）

### 4. 发现与注册强耦合

```javascript
// 当前实现问题
class SimplifiedRoleDiscovery {
  async discoverRoles() {
    // 直接操作文件系统
    const files = await this.scanFileSystem()
    // 直接写入注册表
    this.registry.register(roles)
  }
}
```

**问题**：
- 无法独立测试发现逻辑
- 扩展新资源类型需要修改多处代码
- 资源变更无法实时响应

## 新架构设计（奥卡姆剃刀原则）

### 核心问题聚焦

**Issue #31 暴露的根本问题**：
1. **注册表与协议不一致**：注册表存储直接路径，绕过了 @reference 体系
2. **发现与注册耦合**：SimplifiedRoleDiscovery 直接操作注册表
3. **协议解析分散**：每个地方都在解析协议，没有统一入口

### 简化架构设计

**核心原则**：
```
用户请求 → ResourceRegistry(查找@reference) → ProtocolResolver(统一解析) → 文件系统
```

**3个核心组件，解决核心问题**：
- `ResourceRegistry`：纯索引，存储 id → @reference 映射
- `ProtocolResolver`：统一协议解析入口
- `ResourceDiscovery`：独立发现服务，与注册表解耦

**完全兼容现有格式**：
- ✅ 100% 兼容现有 `resource.registry.json`
- ✅ 现有代码无需修改
- ✅ 保持 @reference 体系一致性

### 详细组件设计

#### 1. 简化的资源注册表 (ResourceRegistry)

**职责**：纯索引，存储 id → @reference 映射，兼容现有格式

```javascript
class ResourceRegistry {
  constructor() {
    this.index = new Map() // 纯粹的 id → @reference 映射
  }

  // 加载 resource.registry.json（兼容现有格式）
  loadFromFile(registryPath = 'src/resource.registry.json') {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    
    for (const [protocol, info] of Object.entries(data.protocols)) {
      if (info.registry) {
        for (const [id, resourceInfo] of Object.entries(info.registry)) {
          const reference = typeof resourceInfo === 'string' 
            ? resourceInfo 
            : resourceInfo.file
          
          this.index.set(`${protocol}:${id}`, reference)
        }
      }
    }
  }

  // 注册新发现的资源
  register(id, reference) {
    this.index.set(id, reference)
  }

  // 解析资源ID到@reference
  resolve(resourceId) {
    // 1. 直接查找
    if (this.index.has(resourceId)) {
      return this.index.get(resourceId)
    }

    // 2. 兼容性：尝试添加协议前缀
    for (const protocol of ['role', 'thought', 'execution', 'memory']) {
      const fullId = `${protocol}:${resourceId}`
      if (this.index.has(fullId)) {
        return this.index.get(fullId)
      }
    }

    throw new Error(`Resource '${resourceId}' not found`)
  }
}
```

#### 2. 解耦的资源发现服务 (ResourceDiscovery)

**职责**：纯粹的发现功能，不操作注册表

```javascript
class ResourceDiscovery {
  // 纯粹的发现功能，不操作注册表
  async discoverResources(scanPaths) {
    const discovered = []
    
    for (const basePath of scanPaths) {
      // 发现角色文件
      const roleFiles = await glob(`${basePath}/**/*.role.md`)
      for (const file of roleFiles) {
        discovered.push({
          id: `role:${this.extractId(file, '.role.md')}`,
          reference: this.generateReference(file)
        })
      }

      // 发现执行模式文件
      const execFiles = await glob(`${basePath}/**/execution/*.execution.md`)
      for (const file of execFiles) {
        discovered.push({
          id: `execution:${this.extractId(file, '.execution.md')}`,
          reference: this.generateReference(file)
        })
      }

      // 发现思维模式文件
      const thoughtFiles = await glob(`${basePath}/**/thought/*.thought.md`)
      for (const file of thoughtFiles) {
        discovered.push({
          id: `thought:${this.extractId(file, '.thought.md')}`,
          reference: this.generateReference(file)
        })
      }
    }

    return discovered
  }

  extractId(filePath, suffix) {
    return path.basename(filePath, suffix)
  }

  generateReference(filePath) {
    // 简单的规则：根据路径判断协议
    if (filePath.includes('node_modules/promptx')) {
      const relativePath = path.relative(this.findPackageRoot(), filePath)
      return `@package://${relativePath}`
    } else if (filePath.includes('.promptx')) {
      const relativePath = path.relative(process.cwd(), filePath)
      return `@project://${relativePath}`
    } else {
      return `@file://${filePath}`
    }
  }
}
```

#### 3. 统一协议解析器 (ProtocolResolver)

**职责**：统一协议解析入口，移除分散的解析逻辑

```javascript
class ProtocolResolver {
  constructor() {
    this.packageRoot = null // 延迟加载
  }

  // 统一解析 @reference 到文件路径
  async resolve(reference) {
    const [protocol, path] = this.parseReference(reference)
    
    switch (protocol) {
      case 'package':
        return this.resolvePackage(path)
      case 'project':
        return this.resolveProject(path)
      case 'file':
        return this.resolveFile(path)
      default:
        throw new Error(`Unsupported protocol: ${protocol}`)
    }
  }

  parseReference(reference) {
    const match = reference.match(/^@(\w+):\/\/(.+)$/)
    if (!match) {
      throw new Error(`Invalid reference format: ${reference}`)
    }
    return [match[1], match[2]]
  }

  async resolvePackage(relativePath) {
    if (!this.packageRoot) {
      this.packageRoot = await this.findPackageRoot()
    }
    return path.resolve(this.packageRoot, relativePath)
  }

  resolveProject(relativePath) {
    return path.resolve(process.cwd(), relativePath)
  }

  resolveFile(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  }

  // 简化的包根目录查找
  async findPackageRoot() {
    let dir = __dirname
    while (dir !== path.parse(dir).root) {
      const packageJson = path.join(dir, 'package.json')
      if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
        if (pkg.name === 'promptx') {
          return dir
        }
      }
      dir = path.dirname(dir)
    }
    throw new Error('PromptX package root not found')
  }
}
```

#### 4. 简化的资源管理器 (ResourceManager)

**职责**：协调三个核心组件，提供统一接口

```javascript
class ResourceManager {
  constructor() {
    this.registry = new ResourceRegistry()
    this.resolver = new ProtocolResolver()
    this.discovery = new ResourceDiscovery()
  }

  // 初始化：加载静态注册表 + 发现动态资源
  async initialize() {
    // 1. 加载静态注册表
    this.registry.loadFromFile('src/resource.registry.json')

    // 2. 发现动态资源
    const discovered = await this.discovery.discoverResources([
      'prompt/', // 包内资源
      '.promptx/', // 项目资源
      process.env.PROMPTX_USER_DIR // 用户资源
    ].filter(Boolean))

    // 3. 注册发现的资源（不覆盖静态注册表）
    for (const resource of discovered) {
      if (!this.registry.index.has(resource.id)) {
        this.registry.register(resource.id, resource.reference)
      }
    }
  }

  // 核心方法：加载资源
  async loadResource(resourceId) {
    // 1. 从注册表获取 @reference
    const reference = this.registry.resolve(resourceId)
    
    // 2. 通过协议解析器解析到文件路径
    const filePath = await this.resolver.resolve(reference)
    
    // 3. 加载文件内容
    return {
      content: fs.readFileSync(filePath, 'utf8'),
      path: filePath,
      reference
    }
  }
}
```

## 解决的核心问题

### 1. 统一 @reference 体系
```javascript
// 之前：绕过协议，直接路径映射
registry['role:java'] = '/path/to/file'

// 现在：保持协议一致性
registry['role:java'] = '@package://prompt/domain/java/java.role.md'
resolver.resolve('@package://...') // 统一解析
```

### 2. 解耦发现与注册
```javascript
// 之前：发现服务直接操作注册表
discovery.scan() // 内部调用 registry.register()

// 现在：发现服务只返回结果
const resources = discovery.discoverResources()
resources.forEach(r => registry.register(r.id, r.reference))
```

### 3. 统一协议解析
```javascript
// 之前：每处都自己解析
if (path.startsWith('@package://')) {
  const pkg = new PackageProtocol()
  return pkg.resolve(path)
}

// 现在：统一入口
const filePath = await resolver.resolve(reference) // 所有协议
```

### 4. 完全兼容现有格式
```javascript
// resource.registry.json 继续工作
"java-backend-developer": "@package://prompt/domain/java/java.role.md"

// 代码继续工作
await resourceManager.loadResource('java-backend-developer')
```

## 奥卡姆剃刀原则体现

**移除的复杂性**：
- ❌ 多级缓存机制
- ❌ 复杂的性能监控
- ❌ 过度的抽象层
- ❌ 文件监视器
- ❌ 复杂的元数据管理
- ❌ 多个重叠的注册表

**保留的核心功能**：
- ✅ 统一的 @reference 体系
- ✅ 发现与注册解耦
- ✅ 协议解析统一化
- ✅ 100% 向后兼容

**简化后的架构**：
```
3个核心类，4个核心方法，解决核心问题
ResourceRegistry.resolve() → ProtocolResolver.resolve() → fs.readFileSync()
```

## 迁移计划

### 阶段1：核心重构 (1周)

**严格遵循：发现 → 注册 → 解析 → 读取，无缓存**

**1.1 统一协议解析器**
```bash
# 创建统一协议解析器
src/lib/core/resource/ProtocolResolver.js

# 移除分散的协议解析逻辑
# 统一所有 @reference 解析到此处
```

**1.2 简化资源注册表**
```bash
# 重构 ResourceRegistry 为纯索引
src/lib/core/resource/ResourceRegistry.js

# 移除：缓存、元数据管理、复杂逻辑
# 保留：id → @reference 映射
# 兼容：现有 resource.registry.json 格式
```

**1.3 解耦资源发现**
```bash
# 创建独立的资源发现服务
src/lib/core/resource/ResourceDiscovery.js

# 移除：与注册表的直接耦合
# 保留：纯粹的发现功能，返回结果
# 实现：生成标准化 @reference
```

**1.4 重构资源管理器**
```bash
# 简化 ResourceManager 为协调器
src/lib/core/resource/ResourceManager.js

# 移除：复杂的初始化逻辑、性能监控
# 保留：协调三个核心组件
# 实现：发现 → 注册 → 解析 → 读取
```

### 阶段2：集成测试 (2-3天)

**2.1 兼容性验证**
```bash
# 验证现有代码继续工作
src/tests/compatibility/existing-api.test.js

# 验证 resource.registry.json 加载正确
src/tests/integration/registry-loading.test.js
```

**2.2 功能测试**
```bash
# 测试资源发现功能
src/tests/integration/resource-discovery.test.js

# 测试协议解析功能
src/tests/integration/protocol-resolution.test.js
```

### 阶段3：部署验证 (1-2天)

**3.1 向后兼容验证**
```bash
# 确保现有 ActionCommand 继续工作
# 确保角色激活流程正常
# 确保跨平台兼容性
```

**3.2 文档更新**
```bash
# 更新架构文档
docs/architecture/resource-management.md

# 更新开发者指南
docs/development/adding-resources.md
```

## 实施原则

**严格的简化原则**：
- ❌ 不引入任何缓存机制
- ❌ 不添加性能监控
- ❌ 不实现文件监视
- ❌ 不添加复杂的元数据管理

**专注核心问题**：
- ✅ 统一 @reference 体系
- ✅ 解耦发现与注册
- ✅ 统一协议解析
- ✅ 保持向后兼容

## 风险评估

### 技术风险

**1. 向后兼容性**
- **风险**：现有代码依赖旧API
- **缓解**：严格保持 API 兼容性，现有调用方式继续有效

**2. 功能回归**  
- **风险**：重构可能影响现有功能
- **缓解**：充分测试，确保功能对等

### 业务风险

**1. 开发时间**
- **风险**：重构时间超出预期  
- **缓解**：专注核心问题，避免过度设计

**2. 稳定性影响**
- **风险**：重构影响现有功能
- **缓解**：分阶段实施，充分验证

## 成功指标

### 功能指标
- ✅ 现有代码 100% 兼容
- ✅ resource.registry.json 继续有效
- ✅ 角色激活功能正常
- ✅ 跨平台兼容性保持

### 架构指标  
- ✅ 统一 @reference 体系
- ✅ 发现与注册解耦
- ✅ 协议解析统一化
- ✅ 代码复杂度降低

## 总结

本架构改进方案严格遵循**奥卡姆剃刀原则**，专注解决 Issue #31 暴露的核心架构问题：

**核心改进**：
1. **统一 @reference 体系**：注册表存储 @reference 而非直接路径
2. **解耦发现与注册**：独立的发现服务，纯粹返回结果
3. **统一协议解析**：单一解析入口，移除分散逻辑
4. **完全向后兼容**：现有代码和配置无需修改

**实施原则**：
- 发现 → 注册 → 解析 → 读取，每步都不缓存
- 3个核心类，4个核心方法
- 移除所有不必要的复杂性

这个方案解决了当前的架构问题，为未来扩展奠定了简洁、清晰的基础。