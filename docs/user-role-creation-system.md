# 用户资源发现系统设计

## 📋 概述

基于ResourceManager的用户资源发现机制，支持用户创建自定义角色、执行流程、思维模式等资源，实现即创即用的体验。

## 🎯 核心问题

**现状分析**：
- 系统资源已在 `src/resource.registry.json` 静态注册
- 当前 `HelloCommand.discoverLocalRoles()` 错误扫描系统路径，造成重复处理
- 用户需要在项目级别创建和管理自定义资源

**解决目标**：
- 仅发现用户资源，不重复处理系统资源
- 支持多种资源类型：角色、执行流程、思维模式
- 实现用户资源覆盖系统资源的能力

## 🏗️ 架构设计

### 资源分层

```
系统资源 (静态注册)
├── src/resource.registry.json     # 系统资源注册表
└── prompt/domain/{role}/          # 系统资源文件

用户资源 (动态发现)
└── .promptx/resource/domain/{role}/   # 用户资源文件
```

### 目录结构规范

#### 用户资源目录
```
.promptx/
├── resource/
│   └── domain/
│       └── {role-id}/
│           ├── {role-id}.role.md
│           ├── thought/
│           │   └── {name}.thought.md
│           └── execution/
│               └── {name}.execution.md
└── memory/                        # 现有目录
```

**设计原则**：
- **镜像结构**：用户目录结构镜像系统结构，降低认知负载
- **资源聚合**：角色相关资源统一管理在角色目录下
- **类型支持**：支持 role、thought、execution 等多种资源类型

### 发现机制重构

#### ResourceManager 扩展
```javascript
// src/lib/core/resource/resourceManager.js
class ResourceManager {
  async discoverUserResources() {
    const userResourcePath = path.join(packageRoot, '.promptx', 'resource', 'domain')
    return await this.scanResourceDirectory(userResourcePath)
  }
  
  async scanResourceDirectory(basePath) {
    // 使用 Node.js 原生 API，移除 glob 依赖
    // 支持 role、thought、execution 等多种资源类型
  }
  
  async loadUnifiedRegistry() {
    const systemResources = await this.loadSystemRegistry()
    const userResources = await this.discoverUserResources()
    
    // 用户资源覆盖系统资源
    return { ...systemResources, ...userResources }
  }
}
```

#### HelloCommand 简化
```javascript
// src/lib/core/pouch/commands/HelloCommand.js
class HelloCommand {
  async loadRoleRegistry() {
    // 移除错误的本地发现逻辑
    // 直接从 ResourceManager 获取统一注册表
    return await this.resourceManager.loadUnifiedRegistry()
  }
}
```

## 🤖 nuwa 角色设计

### 核心职责
- **需求理解**：通过自然对话收集用户场景需求
- **资源生成**：基于 DPML 协议生成角色文件
- **文件管理**：将生成内容保存到正确的用户资源路径

### 对话策略
```
收集目标信息：
├── scenario: 用户工作场景
├── painPoint: 主要痛点
└── expectation: 期望结果

生成时机：三项信息齐全即可生成
```

### 生成模板
```xml
<role>
  <personality>
    [基于场景的思维模式]
  </personality>
  
  <principle>
    [基于痛点的行为原则]
  </principle>
  
  <knowledge>
    [基于期望的知识体系]
  </knowledge>
</role>
```

## 🔧 技术实现

### 实现优先级

#### Phase 1: 核心功能
1. **ResourceManager 扩展**
   - 实现 `discoverUserResources()` 方法
   - 使用 Node.js 原生 API 替代 glob
   - 支持多种资源类型扫描

2. **HelloCommand 重构**  
   - 移除错误的系统路径扫描
   - 集成 ResourceManager 统一注册表

3. **nuwa 角色实现**
   - DPML 协议掌握和文件生成
   - 用户资源路径文件保存

#### Phase 2: 完善功能
1. **错误处理**：跨平台兼容性和容错机制
2. **性能优化**：资源发现缓存机制
3. **用户体验**：更智能的对话策略

### 关键技术要点

#### 1. 跨平台路径处理
```javascript
// 使用 Node.js 原生 API，避免 glob 兼容性问题
  const fs = require('fs-extra')
  const path = require('path')
  
async function discoverUserResources() {
  const userResourcePath = path.join(
    await packageProtocol.getPackageRoot(),
    '.promptx', 'resource', 'domain'
  )
  
  if (!await fs.pathExists(userResourcePath)) {
    return {}
  }
  
  // 使用原生 readdir 和 stat 扫描
}
```

#### 2. 资源覆盖机制
```javascript
// 用户资源优先级高于系统资源
const unifiedRegistry = {
  ...systemResources,  // 系统资源作为基础
  ...userResources     // 用户资源覆盖同名项
}
```

#### 3. DPML 元数据提取
```javascript
function extractRoleMetadata(content, roleId) {
  // 从 DPML 标签中提取角色元信息
  // 用于角色发现和展示
}
```

## 🧪 测试策略与设计

### 测试架构分层

```
单元测试层 (Unit Tests)
├── ResourceManager.unit.test.js          # 资源管理器核心逻辑测试
├── HelloCommand.unit.test.js             # 命令行接口测试
├── UserResourceDiscovery.unit.test.js    # 用户资源发现测试
└── DPMLParser.unit.test.js               # DPML格式解析测试

集成测试层 (Integration Tests)
├── ResourceDiscovery.integration.test.js  # 资源发现完整流程测试
├── NuwaRoleGeneration.integration.test.js # nuwa角色生成端到端测试
└── CrossPlatform.integration.test.js      # 跨平台兼容性测试

端到端测试层 (E2E Tests)
└── UserWorkflow.e2e.test.js              # 完整用户工作流程测试
```

### 核心测试组件

#### 1. ResourceManager 单元测试
```javascript
// src/tests/core/resource/ResourceManager.unit.test.js
describe('ResourceManager', () => {
  describe('discoverUserResources', () => {
    it('应该正确扫描用户资源目录', async () => {
      // 模拟用户资源文件结构
      // 验证发现结果的正确性
    })
    
    it('应该支持多种资源类型', async () => {
      // 测试 role、thought、execution 类型
    })
    
    it('应该处理不存在的目录', async () => {
      // 测试容错机制
    })
  })
  
  describe('loadUnifiedRegistry', () => {
    it('应该正确合并系统和用户资源', async () => {
      // 验证用户资源覆盖系统资源
    })
  })
})
```

#### 2. HelloCommand 重构测试
```javascript
// src/tests/commands/HelloCommand.unit.test.js  
describe('HelloCommand - 重构后', () => {
  it('应该移除错误的系统路径扫描', async () => {
    // 验证不再扫描 prompt/domain/ 路径
  })
  
  it('应该集成ResourceManager统一注册表', async () => {
    // 验证使用ResourceManager.loadUnifiedRegistry()
  })
  
  it('应该正确显示用户自定义角色', async () => {
    // 验证用户角色在hello命令中的展示
  })
})
```

#### 3. 用户资源发现集成测试
```javascript
// src/tests/integration/UserResourceDiscovery.integration.test.js
describe('用户资源发现机制', () => {
  beforeEach(async () => {
    // 创建测试用的用户资源结构
    await createTestUserResourceStructure()
  })
  
  it('应该发现用户创建的角色', async () => {
    // 创建测试角色文件
    // 验证ResourceManager能正确发现
  })
  
  it('应该支持资源类型扩展', async () => {
    // 测试thought、execution文件的发现
  })
  
  it('应该处理DPML格式验证', async () => {
    // 测试格式错误的文件处理
  })
})
```

#### 4. nuwa 角色生成端到端测试
```javascript
// src/tests/integration/NuwaRoleGeneration.integration.test.js
describe('nuwa 角色生成完整流程', () => {
  it('应该根据用户需求生成角色文件', async () => {
    // 模拟用户输入
    // 验证生成的文件内容和位置
  })
  
  it('应该生成符合DPML规范的角色', async () => {
    // 验证生成文件的DPML格式正确性
  })
  
  it('应该创建正确的目录结构', async () => {
    // 验证镜像系统结构的目录创建
  })
})
```

#### 5. 跨平台兼容性测试
```javascript
// src/tests/integration/CrossPlatform.integration.test.js
describe('跨平台兼容性', () => {
  it('应该在Windows上正确处理路径', () => {
    // 模拟Windows路径分隔符
    // 验证路径处理的正确性
  })
  
  it('应该在macOS/Linux上正确处理路径', () => {
    // 验证Unix风格路径处理
  })
  
  it('应该使用Node.js原生API替代glob', () => {
    // 验证不使用glob库的实现
  })
})
```

### 测试数据和环境

#### 测试数据结构
```
src/tests/fixtures/
├── user-resources/
│   └── domain/
│       ├── test-role/
│       │   ├── test-role.role.md          # 标准DPML格式
│       │   ├── thought/
│       │   │   └── test.thought.md
│       │   └── execution/
│       │       └── test.execution.md
│       ├── invalid-role/
│       │   └── invalid.role.md            # 格式错误的文件
│       └── sales-analyst/
│           └── sales-analyst.role.md      # nuwa生成测试样例
├── system-resources/
│   └── mock-registry.json                # 模拟系统注册表
└── dpml-samples/
    ├── valid-role.md                      # 有效DPML样例
    └── invalid-role.md                    # 无效DPML样例
```

#### 测试环境配置
```javascript
// src/tests/setup/testEnvironment.js
export class TestEnvironment {
  async setup() {
    // 创建临时测试目录
    this.testDir = await createTempTestDirectory()
    
    // 模拟 .promptx 结构
    await this.createMockUserResourceStructure()
    
    // 设置环境变量
    process.env.PROMPTX_TEST_MODE = 'true'
  }
  
  async teardown() {
    // 清理测试文件
    await fs.remove(this.testDir)
  }
}
```

### 测试覆盖率要求

#### 覆盖率目标
- **整体代码覆盖率**: ≥ 85%
- **ResourceManager核心逻辑**: ≥ 95%
- **HelloCommand重构部分**: ≥ 90%
- **DPML解析逻辑**: ≥ 95%
- **跨平台路径处理**: 100%

#### 关键测试场景
```
✅ 用户资源发现功能
✅ 系统资源静态加载
✅ 资源覆盖机制
✅ DPML格式验证
✅ 跨平台路径处理
✅ 错误处理和容错
✅ nuwa角色生成流程
✅ 文件系统操作安全性
✅ 缓存机制有效性
✅ CLI集成正确性
```

### 测试执行策略

#### 测试运行配置
```json
// package.json scripts
{
  "test": "jest",
  "test:unit": "jest --testPathPattern=unit",
  "test:integration": "jest --testPathPattern=integration", 
  "test:e2e": "jest --testPathPattern=e2e",
  "test:coverage": "jest --coverage",
  "test:watch": "jest --watch"
}
```

#### CI/CD 集成
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [16, 18, 20]
    steps:
      - name: Run Unit Tests
        run: npm run test:unit
      - name: Run Integration Tests  
        run: npm run test:integration
      - name: Check Coverage
        run: npm run test:coverage
```

## 📊 用户体验流程

```bash
# 1. 创建角色
npx promptx action nuwa
# 对话生成: .promptx/resource/domain/sales-analyst/sales-analyst.role.md

# 2. 立即可用（自动发现）
npx promptx hello
# 显示新角色: sales-analyst

# 3. 直接使用
npx promptx action sales-analyst
```

## 🔄 设计决策

### 为什么选择 .promptx/resource/domain 结构？
- **镜像一致性**：与系统 `prompt/domain` 结构保持一致
- **类型扩展性**：未来可支持 thought、execution 等资源类型
- **认知简单性**：用户理解成本最低

### 为什么移除 HelloCommand 的发现逻辑？
- **职责单一**：ResourceManager 专门负责资源管理
- **避免重复**：系统资源已静态注册，无需重复发现
- **架构清晰**：分层明确，便于维护

### 为什么使用 Node.js 原生 API？
- **兼容性**：完全跨平台，无第三方库依赖问题
- **性能**：原生 API 性能更优
- **维护性**：减少依赖复杂度

## 📚 相关文档

- [DPML协议](../prompt/protocol/dpml.protocol.md)
- [ResourceManager 架构](../src/lib/core/resource/)
- [角色标签规范](../prompt/protocol/tag/role.tag.md)

---

**实现要点**：
1. ResourceManager 统一资源发现
2. 用户资源镜像系统结构  
3. nuwa 基于 DPML 生成角色
4. 即创即用的无缝体验
5. 完整测试覆盖和质量保证 