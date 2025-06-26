# MCP Streamable HTTP 传输实现规划

## 概述

本文档规划在 PromptX 项目中实现 MCP (Model Context Protocol) Streamable HTTP 传输的技术方案，同时提供 SSE 向后兼容支持。

## 背景分析

### 当前状态
- PromptX 目前仅支持 stdio 传输方式 (`MCPServerCommand.js`)
- 使用 `@modelcontextprotocol/sdk@1.12.1`，已包含 SSE 传输支持
- 启动方式：`pnpm start mcp-server` (默认 stdio)

### 需求驱动
- 需要支持基于 HTTP 的 MCP 服务器实例
- 为 Web 客户端和远程访问提供现代化支持
- 采用最新 MCP 协议标准，确保长期兼容性
- 提供更灵活的部署选项

## 技术方案

### 传输协议选择

#### Streamable HTTP 传输（主要方案）
- **状态**: MCP 协议当前推荐的标准传输方式
- **特点**: 
  - 统一 HTTP POST 端点
  - 无状态连接，支持 SSE 可选升级
  - 支持会话管理和连接恢复
- **优势**: 
  - 现代化架构，更好的可扩展性
  - 简化客户端实现
  - 更好的负载均衡支持
  - 符合 REST 架构原则

#### SSE 传输（兼容方案）
- **状态**: 在协议版本 2024-11-05 中被标记为弃用
- **特点**: 双端点架构（GET 建立 SSE 流，POST 接收消息）
- **适用**: 向后兼容现有客户端，过渡期使用

### 实现架构

#### 方案一：扩展现有 MCPServerCommand

**优势**:
- 保持代码统一性
- 复用现有逻辑
- 最小化改动

**实现路径**:
```javascript
// MCPServerCommand.js 修改
async execute(options = {}) {
  const { transport = 'stdio', port = 3000 } = options;
  
  switch (transport) {
    case 'stdio':
      return this.startStdioServer();
    case 'http':
      return this.startStreamableHttpServer(port);
    case 'sse':
      return this.startSSEServer(port);  // 兼容支持
    default:
      throw new Error(`Unsupported transport: ${transport}`);
  }
}
```

#### 方案二：创建专用 HTTP 服务器命令

**优势**:
- 职责分离，代码清晰
- 便于独立测试和维护
- 避免原有功能的副作用

**实现路径**:
```
src/lib/commands/
├── MCPServerCommand.js          # stdio 传输
├── MCPStreamableHttpCommand.js  # Streamable HTTP 传输（主要）
└── index.js                     # 命令导出
```

### 详细设计

#### Streamable HTTP 服务器实现

```javascript
// 基础架构
class MCPStreamableHttpCommand {
  constructor() {
    this.name = 'promptx-mcp-streamable-http-server';
    this.version = '1.0.0';
  }

  async execute(options = {}) {
    const { 
      transport = 'http',  // 'http' | 'sse'
      port = 3000,
      host = 'localhost'
    } = options;

    if (transport === 'http') {
      return this.startStreamableHttpServer(port, host);
    } else if (transport === 'sse') {
      return this.startSSEServer(port, host);  // 兼容支持
    }
  }

  async startStreamableHttpServer(port, host) {
    // 使用 StreamableHttpServerTransport
    // 实现现代化统一端点架构
  }

  async startSSEServer(port, host) {
    // 使用 Express + SSEServerTransport
    // 向后兼容双端点架构
  }
}
```

#### 端点设计

**Streamable HTTP 端点**（主要）:
- `POST /mcp` - 统一入口端点
  - 接收所有 JSON-RPC 消息
  - 支持可选 SSE 流式响应
  - 支持会话管理（sessionId）
  - 无状态设计，便于负载均衡

**SSE 传输端点**（兼容）:
- `GET /mcp` - 建立 SSE 连接
- `POST /messages` - 接收客户端消息

#### 配置选项

```javascript
// 命令行参数
{
  transport: 'stdio' | 'http' | 'sse',  // 'http' 为推荐默认值
  port: number,           // HTTP 端口 (默认: 3000)
  host: string,          // 绑定地址 (默认: localhost)
  cors: boolean,         // CORS 支持 (默认: false)
  auth: boolean,         // 认证开关 (默认: false)
  streaming: boolean,    // SSE 流式响应 (默认: true)
  maxConnections: number // 最大连接数 (默认: 100)
}
```

## 实现计划

### 阶段 1: Streamable HTTP 传输支持（主要目标）

**目标**: 实现 MCP 推荐的 Streamable HTTP 传输

**任务**:
1. 创建 `MCPStreamableHttpCommand.js`
2. 实现 StreamableHttpServerTransport 集成
3. 支持统一端点架构和可选 SSE 升级
4. 集成现有 MCP 工具处理逻辑
5. 添加命令行参数支持
6. 编写单元测试

**预期成果**:
```bash
# 启动 Streamable HTTP 服务器
pnpm start mcp-server --transport http --port 3000
```

### 阶段 2: SSE 传输兼容支持

**目标**: 实现 SSE 传输的向后兼容

**任务**:
1. 在同一命令中添加 SSE 传输支持
2. 实现 SSE 双端点架构
3. 添加传输类型切换逻辑
4. 性能优化和错误处理
5. 兼容性测试

**预期成果**:
```bash
# 启动 SSE 服务器（兼容模式）
pnpm start mcp-server --transport sse --port 3000
```

### 阶段 3: 生产化增强

**目标**: 完善生产环境特性

**任务**:
1. CORS 跨域支持
2. 认证机制集成
3. 连接池和限流
4. 监控和日志增强
5. Docker 部署支持

**预期成果**:
- 生产就绪的 Streamable HTTP MCP 服务器
- 完整的部署文档
- 性能基准测试报告

## 配置管理

### 环境变量支持
```bash
MCP_TRANSPORT=http        # 传输类型（推荐默认值）
MCP_PORT=3000            # 服务端口
MCP_HOST=localhost       # 绑定地址
MCP_CORS_ENABLED=false   # CORS 开关
MCP_STREAMING=true       # SSE 流式响应
MCP_MAX_CONNECTIONS=100  # 最大连接数
```


## 测试策略

### 单元测试
- 传输类型选择逻辑
- HTTP 端点处理
- 错误处理机制
- 参数验证

### 集成测试
- 完整 MCP 会话流程
- 多客户端并发连接
- 传输协议兼容性
- 工具调用端到端测试


## 部署考虑

### 开发环境
- 本地调试支持
- 热重载机制
- 详细日志输出

### 生产环境
- 进程管理 (PM2)
- 反向代理 (Nginx)
- HTTPS 支持
- 监控告警

## 兼容性

### MCP 客户端兼容性
- Claude Desktop
- MCP Inspector
- 自定义 MCP 客户端

### 协议版本兼容性
- 支持当前协议版本
- 向后兼容弃用特性
- 平滑迁移路径

## 风险评估

### 技术风险
- SSE 传输弃用风险 → 优先实现 Streamable HTTP
- 并发性能瓶颈 → 连接池和限流机制
- 内存泄漏风险 → 完善资源清理

### 维护风险
- 代码复杂度增加 → 清晰的架构分层
- 测试覆盖率下降 → 完善的测试策略

## 成功指标

### 功能指标
- [ ] 支持 Streamable HTTP 传输启动
- [ ] 支持 SSE 兼容传输
- [ ] 多传输类型无缝切换
- [ ] 完整的工具调用功能

### 性能指标
- 支持 > 50 并发连接
- 消息延迟 < 100ms
- 内存使用 < 500MB

### 质量指标
- 测试覆盖率 > 80%
- 零安全漏洞
- 完整的文档覆盖

## 参考资料

- [MCP 官方文档 - Transports](https://modelcontextprotocol.io/docs/concepts/transports)
- [MCP SDK 示例 - Streamable HTTP Server](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/server/simpleStreamableHttp.js)
- [MCP SDK 示例 - SSE Server](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/server/simpleSseServer.js)
- [Streamable HTTP 实现指南](https://blog.christianposta.com/ai/understanding-mcp-recent-change-around-http-sse/)
- [MCP 协议变更说明](https://blog.christianposta.com/ai/understanding-mcp-recent-change-around-http-sse/)