# DPML三层协议体系设计文档

## 📋 概述

DPML (Deepractice Prompt Markup Language) 采用三层协议架构，从底层到上层逐步抽象，为不同使用场景提供合适的语义级别。

## 🏗️ 协议分层架构

```
┌─────────────────────────────────────┐
│     上层协议 (Application Layer)      │  
│     @prompt:// @memory://            │  ← 应用语义协议
├─────────────────────────────────────┤
│      中层协议 (Semantic Layer)       │
│   @user:// @project:// @package://   │  ← 语义路径定位协议  
├─────────────────────────────────────┤
│     底层协议 (Transport Layer)       │
│   @file:// @http:// @https://        │  ← 通用传输协议
└─────────────────────────────────────┘
```

## 📦 底层协议 (Transport Layer)

### 🎯 设计目标
- 提供最基础的资源传输能力
- 兼容标准协议规范
- 支持各种数据源接入

### 📋 协议列表

#### 1. `@file://` - 文件系统协议
```bash
# 绝对路径
@file:///Users/sean/Documents/notes.md

# 相对路径（相对当前工作目录）
@file://./src/main.js
@file://docs/readme.md

# 用户目录路径
@file://~/Documents/project/file.md

# 通配符支持
@file://src/**/*.js
@file://docs/*.md
```

**路径解析规则：**
- 绝对路径：直接使用
- 相对路径：相对于 `process.cwd()`
- `~` 路径：相对于用户家目录
- 通配符：使用 glob 模式展开

#### 2. `@http://` / `@https://` - 网络协议
```bash
# 标准HTTP请求
@http://example.com/api/resource.json

# HTTPS安全请求  
@https://api.github.com/repos/owner/repo/contents/file.md

# 带查询参数
@https://api.example.com/data?format=json&limit=100
```

**特性支持：**
- 标准HTTP/HTTPS请求
- 自动处理重定向
- 支持常见认证方式
- 缓存机制集成

## 🎯 中层协议 (Semantic Layer)

### 🎯 设计目标
- 提供语义化的路径定位
- 屏蔽不同环境的路径差异
- 支持智能路径解析

### 📋 协议列表

#### 1. `@user://` - 用户目录协议 ✅
```bash
# 用户文档目录
@user://documents/my-project/notes.md

# 用户桌面  
@user://desktop/todo.txt

# 用户下载目录
@user://downloads/data.csv

# 用户配置目录
@user://home/.config/app/settings.json
```

**路径映射：**
- `@user://documents/` → 用户文档目录（跨平台）
- `@user://desktop/` → 用户桌面目录（跨平台）
- `@user://downloads/` → 用户下载目录（跨平台）
- `@user://home/` → 用户家目录

**实现特性：**
- ✅ **跨平台支持**：Windows、macOS、Linux
- ✅ **智能检测**：使用 platform-folders 库或回退方案
- ✅ **安全验证**：路径安全检查，防止遍历攻击
- ✅ **缓存机制**：提高重复访问性能

#### 2. `@project://` - 项目根目录协议 ✅
```bash
# 项目配置文件
@project://package.json
@project://.gitignore

# 项目源码
@project://src/main.js
@project://lib/utils.js

# 项目文档
@project://docs/readme.md
@project://CHANGELOG.md

# 项目资源
@project://assets/images/logo.png
```

**项目根目录检测规则：**
1. 向上查找 `.promptx` 目录（优先级最高）
2. 查找 `package.json` 文件
3. 查找 `.git` 目录
4. 默认使用当前工作目录

**实现特性：**
- ✅ **智能检测**：自实现向上查找算法
- ✅ **多标识符支持**：.promptx、package.json、.git
- ✅ **安全边界**：防止越过文件系统根目录
- ✅ **直接路径访问**：支持包内任意路径

#### 3. `@package://` - NPM包目录协议 ✅
```bash
# 包根目录
@package://package.json
@package://README.md

# 包源代码
@package://src/index.js
@package://lib/commands/hello.js

# 包提示词资源
@package://prompt/core/execution/think.md
@package://prompt/domain/scrum/role/product-owner.md

# 包配置和模板
@package://jest.config.js
@package://templates/basic/template.md

# 任意包内路径
@package://docs/api/README.md
@package://assets/images/logo.png
@package://examples/demo.js
```

**包安装模式智能检测：**
- `development` - 开发模式（源码开发）
- `local` - 本地安装（npm install）
- `global` - 全局安装（npm install -g）
- `npx` - NPX执行模式
- `monorepo` - Monorepo工作空间
- `link` - NPM链接模式（npm link）

**实现特性：**
- ✅ **多安装模式支持**：覆盖所有NPM使用场景
- ✅ **环境变量检测**：npm_execpath、npm_config_cache等
- ✅ **符号链接处理**：正确解析npm link场景
- ✅ **Monorepo支持**：检测workspaces配置
- ✅ **路径安全**：防止目录遍历攻击
- ✅ **直接路径访问**：无需预定义目录，支持包内任意路径
- ✅ **多级缓存**：安装模式缓存 + 路径解析缓存

**核心价值：**
- **智能包根检测**：自动检测不同安装环境下的包根目录
- **统一路径接口**：无论开发、测试、生产环境，使用相同路径语法
- **安全路径访问**：确保所有访问都在包根目录范围内

## 🚀 上层协议 (Application Layer)

### 🎯 设计目标
- 提供应用级语义抽象
- 隐藏底层实现细节
- 支持业务逻辑映射

### 📋 协议列表

#### 1. `@prompt://` - 提示词资源协议
```bash
# 核心协议文档
@prompt://protocols
# → @package://prompt/protocol/**/*.md

# 核心提示词模块
@prompt://core
# → @package://prompt/core/**/*.md

# 领域提示词
@prompt://domain/scrum
# → @package://prompt/domain/scrum/**/*.md

# 特定角色提示词
@prompt://domain/scrum/role/product-owner
# → @package://prompt/domain/scrum/role/product-owner.role.md
```

**注册表映射：**
- `protocols` → `@package://prompt/protocol/**/*.md`
- `core` → `@package://prompt/core/**/*.md`
- `domain` → `@package://prompt/domain/**/*.md`
- `bootstrap` → `@package://bootstrap.md`

#### 2. `@memory://` - 记忆系统协议
```bash
# 声明式记忆
@memory://declarative
# → @project://.memory/declarative.md

# 情景记忆
@memory://episodic
# → @project://.memory/episodic/**/*.md

# 语义记忆
@memory://semantic
# → @project://.memory/semantic.json

# 程序记忆
@memory://procedural
# → @project://.memory/procedural/**/*.md
```

**记忆类型映射：**
- `declarative` → `.memory/declarative.md`
- `episodic` → `.memory/episodic/`
- `semantic` → `.memory/semantic.json`
- `procedural` → `.memory/procedural/`

## 🔧 实现架构

### 📦 协议解析流程

```javascript
// 1. 协议分层解析
@prompt://core
    ↓ 上层协议解析
@package://prompt/core/**/*.md  
    ↓ 中层协议解析
@file://[NPM包路径]/prompt/core/**/*.md
    ↓ 底层协议执行
读取文件系统资源
```

### 🎯 注册表设计

```javascript
class LayeredProtocolRegistry {
  constructor() {
    this.transportLayer = new Map();  // 底层协议
    this.semanticLayer = new Map();   // 中层协议  
    this.applicationLayer = new Map(); // 上层协议
  }
  
  resolve(protocol, path) {
    // 递归解析直到底层协议
    if (this.applicationLayer.has(protocol)) {
      const mapping = this.applicationLayer.get(protocol);
      return this.resolve(mapping.protocol, mapping.path + path);
    }
    
    if (this.semanticLayer.has(protocol)) {
      const mapping = this.semanticLayer.get(protocol);
      return this.resolve(mapping.protocol, mapping.path + path);
    }
    
    // 底层协议直接执行
    return this.transportLayer.get(protocol).resolve(path);
  }
}
```

### 🔍 路径检测机制

```javascript
class PathDetector {
  // 检测NPM包目录
  static detectPackageRoot() {
    // NPM包模式检测
    try {
      const packagePath = require.resolve('promptx/package.json');
      return path.dirname(packagePath);
    } catch {}
    
    // 开发模式检测
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
      const packageJson = path.join(dir, 'package.json');
      if (fs.existsSync(packageJson)) {
        const pkg = require(packageJson);
        if (pkg.name === 'promptx') return dir;
      }
      dir = path.dirname(dir);
    }
    
    throw new Error('Package not found');
  }
  
  // 检测项目根目录
  static detectProjectRoot() {
    const indicators = ['.promptx', 'package.json', '.git'];
    let dir = process.cwd();
    
    while (dir !== path.dirname(dir)) {
      if (indicators.some(indicator => 
        fs.existsSync(path.join(dir, indicator))
      )) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    
    return process.cwd(); // 默认当前目录
  }
}
```

## 📊 协议使用示例

### 🎯 典型使用场景

```bash
# AI助手启动：加载角色提示词
promptx learn @prompt://domain/scrum/role/product-owner

# 等价于底层路径：
promptx learn @file://[NPM包]/prompt/domain/scrum/role/product-owner.role.md

# 记忆保存：保存到项目记忆
promptx remember "重要决策" @memory://declarative

# 等价于底层路径：  
promptx remember "重要决策" @file://[项目根]/.memory/declarative.md
```

### 🔄 协议转换示例

```bash
# 上层 → 中层 → 底层
@prompt://core
  ↓
@package://prompt/core/**/*.md
  ↓  
@file:///usr/local/lib/node_modules/promptx/prompt/core/**/*.md
```

## 🎯 设计优势

### ✅ 分层优势

1. **底层协议**：标准化、可复用、易测试
2. **中层协议**：语义化、环境无关、智能解析  
3. **上层协议**：业务导向、用户友好、功能聚焦

### 🔧 扩展性

- **向下兼容**：上层协议变更不影响底层
- **灵活映射**：可动态调整协议映射关系
- **插件化**：支持自定义协议扩展

### 🎯 用户体验

- **简洁语法**：`@prompt://core` vs `@file://./node_modules/promptx/prompt/core/**/*.md`
- **语义清晰**：协议名称直接表达意图
- **智能解析**：自动处理环境差异

## 🚀 实施计划

### Phase 1: 底层协议完善 ✅
- [x] file:// 协议优化
- [x] http/https:// 协议实现
- [x] 通配符支持增强
- [x] 查询参数系统
- [x] 缓存机制集成

### Phase 2: 中层协议实现 ✅  
- [x] **user:// 协议实现** (1.3.1.1)
  - [x] 跨平台用户目录检测
  - [x] platform-folders集成
  - [x] 安全路径验证
  - [x] 完整测试覆盖
- [x] **project:// 协议实现** (1.3.1.2)
  - [x] .promptx目录检测
  - [x] 向上查找算法
  - [x] 多指示符支持
  - [x] 边界安全检查
- [x] **package:// 协议实现** (1.3.1.3)
  - [x] 多安装模式检测
  - [x] NPM环境智能识别
  - [x] Monorepo支持
  - [x] 符号链接处理
  - [x] 直接路径访问（无预定义目录限制）

### Phase 3: 上层协议优化
- [x] prompt:// 协议重构
- [ ] memory:// 协议增强

### Phase 4: 集成测试
- [x] 中层协议单元测试
- [ ] 分层协议集成测试
- [ ] 性能基准测试
- [ ] 用户体验测试

## 📈 当前实施状态

### ✅ 已完成功能
- **底层协议系统**：完整实现，支持file、http、https
- **中层协议核心**：三个协议全部实现并通过测试
  - UserProtocol: 22/22 测试通过
  - ProjectProtocol: 30/30 测试通过  
  - PackageProtocol: 41/41 测试通过（无目录映射限制）
- **ResourceProtocol基类**：统一接口抽象
- **查询参数系统**：支持缓存键生成
- **安全机制**：路径遍历防护
- **直接路径访问**：package协议支持任意包内路径

### 🔄 进行中
- 上层协议优化
- 协议注册表重构
- 性能优化调整

### 📋 待实施
- memory:// 协议增强
- 协议映射配置化
- 插件系统支持

---

*本文档将随着协议体系的演进持续更新* 

**最后更新：** 简化了@package://协议，去掉预定义目录映射，支持直接访问包内任意路径，更符合file协议的使用习惯。 