# PromptX 项目级资源引用Bug报告

## 📋 Bug概述

**问题标题**: 新增角色可被发现但角色内部引用的项目级资源无法解析  
**严重程度**: 中等 - 影响项目级资源的模块化设计  
**影响范围**: 用户创建的角色中的@!引用机制  
**发现时间**: 测试角色 `test-simple` 激活过程中  

## 🐛 问题描述

### 现象表现
在PromptX系统中，当用户创建新角色时：
1. ✅ **角色发现正常** - 新角色可以被 `SimplifiedRoleDiscovery` 正确发现
2. ✅ **角色激活正常** - 可以通过 `action` 命令成功激活角色
3. ✅ **系统级资源引用正常** - 如 `@!thought://remember`, `@!thought://recall` 可正常解析
4. ❌ **项目级资源引用失败** - 角色内部引用的项目级thought/execution资源无法解析

### 具体错误信息
```
<!-- 引用解析失败: @!thought://test-verification - Resource not found: thought:test-verification -->
<!-- 引用解析失败: @!execution://test-process - Resource not found: execution:test-process -->
```

## 📁 复现步骤

### 测试环境
- **项目路径**: `/Users/sean/WorkSpaces/DeepracticeProjects/PromptXDemo`
- **角色路径**: `.promptx/resource/domain/test-simple/`
- **系统**: PromptX锦囊串联系统

### 文件结构
```
.promptx/resource/domain/test-simple/
├── test-simple.role.md                    # 主角色文件
├── thought/
│   └── test-verification.thought.md       # 项目级thought资源
└── execution/
    └── test-process.execution.md          # 项目级execution资源
```

### 角色定义 (test-simple.role.md)
```xml
<role>
  <personality>
    @!thought://remember                   # ✅ 系统级 - 正常解析
    @!thought://recall                     # ✅ 系统级 - 正常解析  
    @!thought://test-verification          # ❌ 项目级 - 解析失败
  </personality>

  <principle>
    @!execution://test-process              # ❌ 项目级 - 解析失败
  </principle>

  <knowledge>
    # 直接内容定义 - 正常工作
  </knowledge>
</role>
```

### 复现步骤
1. 创建项目级角色及相关资源文件
2. 执行 `npx dpml-prompt@snapshot action test-simple`
3. 观察激活结果中的资源引用解析状态

## 🔍 技术分析

### 根本原因分析

#### 🎯 **核心问题：PromptX内部资源管理缓存机制**

**重要澄清**: 这不是MCP协议的缓存问题，而是PromptX内部的资源管理问题。

- **MCP角色**: MCP只是传输层，负责将tool call传递给PromptX
- **PromptX责任**: 资源发现、解析、缓存都在PromptX内部完成
- **问题所在**: PromptX的ResourceManager存在进程级缓存或资源发现缺陷

#### 1. **PromptX进程级资源缓存**
- **初始化阶段**: PromptX启动时扫描并缓存可用资源
- **缓存机制**: 资源注册表可能存储在内存中，不会动态更新
- **新文件盲区**: 运行时创建的新资源文件无法被已启动的PromptX实例感知

#### 2. **资源发现机制的不一致性**
```
✅ 角色发现: SimplifiedRoleDiscovery 实时扫描 .promptx/resource/domain/
❌ 资源引用: ResourceManager 可能依赖静态注册表或初始化扫描
```

关键差异：
- **角色发现**: 每次调用时实时扫描文件系统
- **资源解析**: 可能从预建立的缓存/注册表中查找

#### 3. **协议处理器的路径解析限制**
```javascript
// 当前状态（推测）
ResourceManager.resolveResource("thought://test-verification")
├── 查找系统级: prompt/thought/test-verification.thought.md ✅
├── 查找项目级: 缓存中无记录 ❌
└── 返回: Resource not found

// 重启后状态
ResourceManager.initialize() // 重新扫描所有资源
├── 发现系统级资源 ✅
├── 发现项目级资源 ✅ (包括新创建的)
└── 更新资源注册表 ✅
```

#### 4. **文件系统监控缺失**
- **缺少热重载**: PromptX可能没有实现文件系统监控（inotify/fswatch）
- **依赖重启**: 新资源只能通过重启PromptX进程来发现
- **开发体验**: 影响实时开发和测试效率

### 推测的实现问题

#### 🔍 **重启修复的实际机制**
```
重启MCP → 重启PromptX进程 → 重新初始化ResourceManager → 重新扫描资源 → 发现新文件
```

**关键发现**: 重启不是刷新MCP缓存，而是重启PromptX进程，强制重新执行资源发现逻辑。

#### 可能的代码位置
1. **ResourceManager.ts** - 核心资源管理和缓存逻辑
2. **ResourceDiscovery.ts** - 资源发现和扫描机制
3. **ProtocolHandlers** - thought://, execution://等协议处理器
4. **资源注册表** - 内存或文件中的资源索引

#### 可能的实现缺陷
```javascript
// 推测当前实现（有问题）
class ResourceManager {
  constructor() {
    this.resourceCache = new Map(); // 进程级缓存
    this.initialize(); // 仅在启动时执行一次
  }
  
  initialize() {
    // 扫描系统级资源
    this.scanSystemResources();
    // 扫描项目级资源
    this.scanProjectResources();
    // 缓存结果，后续不再扫描
  }
  
  resolveResource(protocol, resourceId) {
    // 直接从缓存查找，无法发现新文件
    return this.resourceCache.get(`${protocol}:${resourceId}`);
  }
}

// 期望的实现（修复后）
class ResourceManager {
  resolveResource(protocol, resourceId) {
    // 方案1: 实时扫描（性能较低但准确）
    const resource = this.scanForResource(protocol, resourceId);
    if (resource) return resource;
    
    // 方案2: 智能缓存失效
    if (!this.resourceCache.has(key)) {
      this.refreshCache();
      return this.resourceCache.get(key);
    }
    
    // 方案3: 文件监控 + 热重载
    // 使用fs.watch监控文件变化，自动更新缓存
  }
}
```

#### 具体表现分析
```
场景1: PromptX首次启动
├── ResourceManager.initialize()
├── 扫描到系统级: remember.thought.md, recall.thought.md ✅
├── 项目级资源尚不存在 ❌
└── 缓存构建完成

场景2: 用户创建新文件
├── 创建 test-verification.thought.md
├── 创建 test-process.execution.md  
├── PromptX进程仍在运行，缓存未更新 ❌
└── 资源解析失败

场景3: 重启MCP/PromptX
├── ResourceManager.initialize() // 重新执行
├── 重新扫描所有目录
├── 发现新创建的项目级资源 ✅
└── 更新缓存，解析成功 ✅
```

## 💡 解决方案建议

### 🚀 **立即可行方案**

#### 1. **开发环境解决方案**
```bash
# 开发时的临时解决方案
# 创建新资源后，重启MCP以刷新资源缓存
# 这会强制PromptX重新扫描所有资源
```

#### 2. **智能缓存失效机制**
```javascript
// 在ResourceManager中添加缓存失效逻辑
class ResourceManager {
  resolveResource(protocol, resourceId) {
    const cacheKey = `${protocol}:${resourceId}`;
    
    // 如果缓存中没有，尝试实时扫描一次
    if (!this.resourceCache.has(cacheKey)) {
      const found = this.scanForNewResource(protocol, resourceId);
      if (found) {
        this.resourceCache.set(cacheKey, found);
        return found;
      }
    }
    
    return this.resourceCache.get(cacheKey);
  }
}
```

### 🎯 **根本性解决方案**

#### 1. **文件系统监控机制**
```javascript
// 实现热重载功能
class ResourceManager {
  constructor() {
    this.setupFileWatcher();
  }
  
  setupFileWatcher() {
    // 监控 .promptx/resource/ 目录变化
    fs.watch('.promptx/resource', { recursive: true }, (eventType, filename) => {
      if (this.isResourceFile(filename)) {
        this.invalidateCache(filename);
        this.rescanResource(filename);
      }
    });
  }
}
```

#### 2. **统一资源发现机制**
- **问题**: SimplifiedRoleDiscovery 和 ResourceManager 使用不同的发现逻辑
- **解决**: 抽象出统一的 `UnifiedResourceDiscovery` 类
- **收益**: 保证角色发现和资源解析的一致性

#### 3. **延迟初始化 + 实时扫描**
```javascript
// 改进的ResourceManager架构
class ResourceManager {
  resolveResource(protocol, resourceId) {
    // 优先从缓存查找
    let resource = this.cache.get(key);
    
    // 缓存未命中时，实时扫描
    if (!resource) {
      resource = this.realTimeScan(protocol, resourceId);
      if (resource) {
        this.cache.set(key, resource);
      }
    }
    
    return resource;
  }
  
  realTimeScan(protocol, resourceId) {
    // 1. 扫描项目级路径 (优先级高)
    const projectPath = this.scanProjectLevel(protocol, resourceId);
    if (projectPath) return projectPath;
    
    // 2. 扫描系统级路径 (兜底)
    return this.scanSystemLevel(protocol, resourceId);
  }
}
```

### ⚡ **性能优化考虑**

#### 1. **分层缓存策略**
- **L1缓存**: 内存中的热点资源 (最近使用)
- **L2缓存**: 文件系统扫描结果 (带TTL)
- **实时扫描**: 缓存未命中时的兜底机制

#### 2. **增量更新机制**
- 监控文件变化，仅更新相关的缓存项
- 避免全量重新扫描的性能开销

#### 3. **并发安全**
- 资源扫描和缓存更新的线程安全
- 防止并发访问导致的状态不一致

## 🧪 验证方案

### 测试用例
1. **基础功能测试**
   - 创建包含项目级资源引用的角色
   - 验证激活后所有引用都能正确解析

2. **边界情况测试**
   - 同名资源在系统级和项目级都存在
   - 验证优先级和覆盖机制

3. **错误处理测试**
   - 引用不存在的资源
   - 验证错误信息的准确性和有用性

### 成功标准
```
✅ 项目级thought资源引用正常解析
✅ 项目级execution资源引用正常解析  
✅ 系统级资源引用继续正常工作
✅ 资源查找优先级符合预期
✅ 错误信息准确且有助于调试
```

## 📊 影响评估

### 当前影响
- **开发体验**: **高影响** - 开发时每次创建新资源都需要重启MCP
- **功能完整性**: **高影响** - 核心的模块化架构设计无法完全实现  
- **用户体验**: **中等影响** - 最终用户使用时相对影响较小（因为资源通常预先创建）
- **系统可靠性**: **低影响** - 功能可用，但需要手动干预

### 关键洞察
- **不是真正的Bug**: 这是PromptX资源管理设计的限制，不是错误
- **重启确实有效**: 重启MCP会重启PromptX进程，触发完整的资源重新扫描
- **影响开发效率**: 主要影响PromptX角色开发者的迭代速度

### 修复后收益
- **开发效率提升**: 支持热重载，无需重启即可测试新资源
- **架构一致性**: 角色发现和资源解析逻辑统一
- **系统健壮性**: 资源变化能够自动感知和适应
- **扩展性增强**: 为未来更复杂的资源管理功能奠定基础

### 🎯 **优先级建议**
1. **P0 - 立即**: 文档化当前的重启解决方案，让开发者知道这是预期行为
2. **P1 - 短期**: 实现智能缓存失效机制，减少重启频率  
3. **P2 - 中期**: 添加文件系统监控，实现真正的热重载
4. **P3 - 长期**: 重构资源管理架构，统一发现机制

## 🏷️ 标签
`resource-management` `caching` `hot-reload` `development-experience` `promptx-core` `performance-optimization`

---

## 🔄 **更新记录**

**2025-01-27**: 重新分析问题根因
- **澄清**: 这不是MCP缓存问题，而是PromptX内部资源管理的进程级缓存问题
- **核心发现**: 重启MCP实际上是重启PromptX进程，触发ResourceManager重新初始化
- **解决方向**: 需要在PromptX内部实现热重载或智能缓存失效机制
- **影响评估**: 主要影响开发效率，对最终用户影响相对较小 