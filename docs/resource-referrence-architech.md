# PromptX 统一资源协议架构设计文档

## 目录
- [1. 概述](#1-概述)
- [2. 核心设计理念](#2-核心设计理念)
- [3. DPML协议体系设计](#3-dpml协议体系设计)
- [4. 多层级资源发现架构](#4-多层级资源发现架构)
- [5. 统一注册表设计](#5-统一注册表设计)
- [6. 协议解析执行流程](#6-协议解析执行流程)
- [7. 资源生命周期管理](#7-资源生命周期管理)
- [8. 扩展性设计](#8-扩展性设计)
- [9. 错误处理与容错机制](#9-错误处理与容错机制)
- [10. 性能优化策略](#10-性能优化策略)

## 1. 概述

PromptX采用统一资源协议架构，支持多层级资源发现与动态注册机制。该架构通过DPML（Domain-Specific Prompt Markup Language）协议实现资源的统一标识、发现、注册和解析。

## 2. 核心设计理念

### 2.1 分层架构原则

- **协议层**: 统一的@协议标识体系
- **发现层**: 多源资源发现机制
- **注册层**: 统一的资源注册表
- **解析层**: 协议到文件系统的映射

### 2.2 职责分离原则

- **Registry**: 专注资源映射存储和查询
- **Discovery**: 专注特定来源的资源发现
- **Protocol**: 专注协议解析和路径转换
- **Manager**: 专注流程编排和生命周期管理

## 3. DPML协议体系设计

### 3.1 协议语法结构

```mermaid
graph LR
    A["@[semantic][protocol]://[resource_path]"] --> B[加载语义]
    A --> C[协议类型]
    A --> D[资源路径]

    B --> B1["@ - 默认加载"]
    B --> B2["@! - 热加载"]
    B --> B3["@? - 懒加载"]

    C --> C1["package - NPM包资源"]
    C --> C2["project - 项目本地资源"]
    C --> C3["user - 用户全局资源"]
    C --> C4["internet - 网络资源"]
    C --> C5["file - 文件系统"]
    C --> C6["thought - 思维模式"]
    C --> C7["execution - 执行模式"]
    C --> C8["role - AI角色"]
    C --> C9["knowledge - 知识库"]
```

### 3.2 协议层级设计

```mermaid
classDiagram
    class ProtocolSystem {
        <<interface>>
        +parseReference(ref: string)
        +resolve(ref: string)
    }

    class BasicProtocol {
        +package
        +project
        +user
        +internet
        +file
    }

    class LogicalProtocol {
        +thought
        +execution
        +role
        +knowledge
        +memory
    }

    ProtocolSystem <|-- BasicProtocol
    ProtocolSystem <|-- LogicalProtocol

    BasicProtocol : +直接文件映射
    BasicProtocol : +路径解析
    LogicalProtocol : +注册表查询
    LogicalProtocol : +逻辑资源映射
```

## 4. 多层级资源发现架构

### 4.1 发现层级结构

```mermaid
graph TD
    A[资源发现生态系统] --> B[包级发现 PackageDiscovery]
    A --> C[项目级发现 ProjectDiscovery]
    A --> D[用户级发现 UserDiscovery]
    A --> E[网络级发现 InternetDiscovery]

    B --> B1[NPM包内置资源]
    B --> B2[src/resource.registry.json]
    B --> B3[prompt/ 目录结构]

    C --> C1[项目本地资源]
    C --> C2[.promptx/resource/]
    C --> C3[动态角色发现]

    D --> D1[用户全局资源]
    D --> D2[~/promptx/resource/]
    D --> D3[用户自定义角色]

    E --> E1[远程资源库]
    E --> E2[Git仓库资源]
    E --> E3[在线角色市场]
```

### 4.2 发现优先级机制

```mermaid
sequenceDiagram
    participant RM as ResourceManager
    participant PD as PackageDiscovery
    participant PRD as ProjectDiscovery
    participant UD as UserDiscovery
    participant ID as InternetDiscovery
    participant RR as ResourceRegistry

    RM->>+PD: discover() [优先级: 1]
    PD->>-RM: 系统内置资源列表

    RM->>+PRD: discover() [优先级: 2]
    PRD->>-RM: 项目本地资源列表

    RM->>+UD: discover() [优先级: 3]
    UD->>-RM: 用户全局资源列表

    RM->>+ID: discover() [优先级: 4]
    ID->>-RM: 网络资源列表

    Note over RM: 按优先级合并，后发现的覆盖先发现的

    RM->>RR: 批量注册所有发现的资源
```

## 5. 统一注册表设计

### 5.1 注册表核心结构

```mermaid
classDiagram
    class ResourceRegistry {
        -Map~string,string~ index
        -Map~string,ResourceMeta~ metadata
        +register(id: string, reference: string)
        +resolve(id: string): string
        +merge(other: ResourceRegistry)
        +has(id: string): boolean
        +list(protocol?: string): string[]
    }

    class ResourceMeta {
        +source: DiscoverySource
        +priority: number
        +timestamp: Date
        +metadata: object
    }

    class DiscoverySource {
        <<enumeration>>
        PACKAGE
        PROJECT
        USER
        INTERNET
    }

    ResourceRegistry --> ResourceMeta
    ResourceMeta --> DiscoverySource
```

### 5.2 注册表合并策略

```mermaid
flowchart TD
    A[多源资源发现] --> B{资源ID冲突检测}

    B -->|无冲突| C[直接注册]
    B -->|有冲突| D[优先级比较]

    D --> E{优先级策略}
    E -->|用户 > 项目 > 包 > 网络| F[高优先级覆盖]
    E -->|同优先级| G[时间戳比较]

    F --> H[更新注册表]
    G --> H
    C --> H

    H --> I[生成统一资源索引]
```

## 6. 协议解析执行流程

### 6.1 完整解析序列

```mermaid
sequenceDiagram
    participant U as User
    participant RM as ResourceManager
    participant RR as ResourceRegistry
    participant PR as ProtocolResolver
    participant PP as PackageProtocol
    participant PRP as ProjectProtocol
    participant FS as FileSystem

    U->>RM: loadResource("role:xiaohongshu-copywriter")

    Note over RM: 1. 资源ID解析阶段
    RM->>RR: resolve("role:xiaohongshu-copywriter")
    RR->>RM: "@project://.promptx/resource/domain/xiaohongshu-copywriter/xiaohongshu-copywriter.role.md"

    Note over RM: 2. 协议解析阶段
    RM->>PR: parseReference("@project://...")
    PR->>RM: {semantic: "@", protocol: "project", path: "..."}

    Note over RM: 3. 路径解析阶段
    RM->>PRP: resolve(".promptx/resource/domain/...")
    PRP->>FS: 定位项目根目录
    FS->>PRP: "/user/project/"
    PRP->>RM: "/user/project/.promptx/resource/domain/xiaohongshu-copywriter/xiaohongshu-copywriter.role.md"

    Note over RM: 4. 文件加载阶段
    RM->>FS: readFile(absolutePath)
    FS->>RM: 文件内容

    RM->>U: {success: true, content: "...", path: "..."}
```

### 6.2 嵌套引用解析

```mermaid
sequenceDiagram
    participant SR as SemanticRenderer
    participant RM as ResourceManager
    participant RR as ResourceRegistry

    Note over SR: 发现嵌套引用 @!thought://remember

    SR->>RM: resolve("@!thought://remember")

    Note over RM: 1. 解析加载语义 @!
    RM->>RM: 识别热加载模式

    Note over RM: 2. 解析逻辑协议 thought
    RM->>RR: resolve("thought:remember")
    RR->>RM: "@package://prompt/core/thought/remember.thought.md"

    Note over RM: 3. 解析基础协议 @package
    RM->>RM: 委托给PackageProtocol

    Note over RM: 4. 返回解析结果
    RM->>SR: 思维模式内容

    Note over SR: 5. 渲染到最终输出
```

## 7. 资源生命周期管理

### 7.1 初始化流程

```mermaid
stateDiagram-v2
    [*] --> Uninitialized

    Uninitialized --> Discovering: initialize()

    Discovering --> PackageDiscovery: 发现包资源
    PackageDiscovery --> ProjectDiscovery: 发现项目资源
    ProjectDiscovery --> UserDiscovery: 发现用户资源
    UserDiscovery --> InternetDiscovery: 发现网络资源

    InternetDiscovery --> Registering: 开始注册

    Registering --> Merging: 合并资源
    Merging --> Indexing: 建立索引
    Indexing --> Ready: 完成初始化

    Ready --> Resolving: resolve()
    Resolving --> Ready: 返回结果

    Ready --> Refreshing: refresh()
    Refreshing --> Discovering: 重新发现

    Ready --> [*]: destroy()
```

### 7.2 缓存与更新策略

```mermaid
flowchart TD
    A[资源访问请求] --> B{缓存检查}

    B -->|命中| C[检查加载语义]
    B -->|未命中| D[触发发现流程]

    C --> E{加载语义判断}
    E -->|at 默认| F[返回缓存内容]
    E -->|a! 热加载| G[强制重新加载]
    E -->|a? 懒加载| H[延迟加载策略]

    D --> I[执行Discovery]
    G --> I
    H --> I

    I --> J[更新注册表]
    J --> K[更新缓存]
    K --> L[返回最新内容]

    F --> M[返回给用户]
    L --> M
```

## 8. 扩展性设计

### 8.1 新协议扩展机制

```mermaid
classDiagram
    class ProtocolExtension {
        <<interface>>
        +name: string
        +resolve(path: string): string
        +validate(path: string): boolean
    }

    class DatabaseProtocol {
        +name: "database"
        +resolve(path): string
        +validate(path): boolean
    }

    class GitProtocol {
        +name: "git"
        +resolve(path): string
        +validate(path): boolean
    }

    class S3Protocol {
        +name: "s3"
        +resolve(path): string
        +validate(path): boolean
    }

    ProtocolExtension <|-- DatabaseProtocol
    ProtocolExtension <|-- GitProtocol
    ProtocolExtension <|-- S3Protocol
```

### 8.2 新发现源扩展

```mermaid
classDiagram
    class DiscoveryExtension {
        <<interface>>
        +source: DiscoverySource
        +priority: number
        +discover(): Promise~Resource[]~
    }

    class GitDiscovery {
        +source: GIT
        +priority: 5
        +discover(): Promise~Resource[]~
    }

    class DatabaseDiscovery {
        +source: DATABASE
        +priority: 6
        +discover(): Promise~Resource[]~
    }

    class MarketplaceDiscovery {
        +source: MARKETPLACE
        +priority: 7
        +discover(): Promise~Resource[]~
    }

    DiscoveryExtension <|-- GitDiscovery
    DiscoveryExtension <|-- DatabaseDiscovery
    DiscoveryExtension <|-- MarketplaceDiscovery
```

## 9. 错误处理与容错机制

### 9.1 分层错误处理

```mermaid
flowchart TD
    A[用户请求] --> B[ResourceManager]

    B --> C{Discovery阶段}
    C -->|发现失败| D[降级到缓存]
    C -->|部分失败| E[记录错误，继续处理]
    C -->|完全失败| F[返回空注册表]

    B --> G{Registry阶段}
    G -->|注册失败| H[跳过失败项]
    G -->|冲突解决失败| I[使用默认策略]

    B --> J{Protocol阶段}
    J -->|协议不支持| K[尝试文件协议]
    J -->|路径解析失败| L[返回详细错误]

    B --> M{FileSystem阶段}
    M -->|文件不存在| N[返回空内容标记]
    M -->|权限错误| O[尝试替代路径]

    D --> P[用户获得部分功能]
    E --> P
    H --> P
    I --> P
    K --> P

    F --> Q[用户获得错误信息]
    L --> Q
    N --> Q
    O --> Q
```

## 10. 性能优化策略

### 10.1 并行发现优化

| 模式 | PackageDiscovery | ProjectDiscovery | UserDiscovery | InternetDiscovery | 合并注册 |
|------|-----------------|------------------|---------------|-------------------|---------|
| 串行模式 | 0-200ms | 200-400ms | 400-600ms | 600-1000ms | - |
| 并行模式 | 0-200ms | 0-250ms | 0-180ms | 0-800ms | 800-850ms |

### 10.2 缓存分层策略

```mermaid
graph TD
    A[L1: 内存缓存] --> B[L2: 文件缓存]
    B --> C[L3: 远程缓存]

    A --> A1[热点资源]
    A --> A2[最近访问]

    B --> B1[用户资源]
    B --> B2[项目资源]

    C --> C1[网络资源]
    C --> C2[共享资源]

    D[缓存失效策略] --> D1[TTL过期]
    D --> D2[版本变更]
    D --> D3[手动刷新]
```

## 总结

这个架构设计确保了PromptX资源系统的高度可扩展性、跨平台兼容性和优秀的性能表现，同时保持了清晰的职责分离和统一的访问接口。

### 核心优势

1. **统一协议体系**: 通过DPML协议实现资源的标准化访问
2. **多层级发现**: 支持包、项目、用户、网络多个层级的资源发现
3. **智能注册表**: 自动处理资源冲突和优先级管理
4. **高性能设计**: 并行发现和多层缓存策略
5. **强容错性**: 完善的错误处理和降级机制
6. **易扩展性**: 支持新协议和新发现源的动态扩展