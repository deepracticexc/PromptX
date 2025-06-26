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

### 依赖管理

基于官方示例和稳定性考虑，本实现使用 Express.js 框架：

```bash
# MCP SDK（已安装）
@modelcontextprotocol/sdk@1.12.1

# Express 框架（新增）
express@^5.1.0
```

**选择 Express.js 的原因：**
1. **官方示例一致性** - MCP SDK 官方示例均使用 Express.js
2. **测试稳定性** - Express 提供更完善的中间件和错误处理机制
3. **开发效率** - 简化 CORS、JSON 解析等常见 HTTP 处理需求
4. **社区支持** - 成熟的生态系统和丰富的文档资源

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
    // 使用 Express + StreamableHttpServerTransport
    // 实现现代化统一端点架构
    const app = express();
    app.use(express.json());
    app.use(corsMiddleware);
    app.post('/mcp', handleMCPPostRequest);
    // 健康检查和其他端点
  }

  async startSSEServer(port, host) {
    // 使用 Express + SSEServerTransport
    // 向后兼容双端点架构
    const app = express();
    app.get('/mcp', handleSSEConnection);
    app.post('/messages', handleSSEMessage);
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

### 配置文件支持
```json
// package.json scripts 扩展
{
  "scripts": {
    "mcp:stdio": "node src/bin/promptx.js mcp-server",
    "mcp:http": "node src/bin/promptx.js mcp-server --transport http",
    "mcp:sse": "node src/bin/promptx.js mcp-server --transport sse",
    "mcp:dev": "MCP_DEBUG=true node src/bin/promptx.js mcp-server --transport http --port 3001"
  }
}
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

### 性能测试
- 并发连接压力测试
- 消息吞吐量测试
- 内存和 CPU 使用率监控

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

## 客户端配置指南

### Claude Desktop 配置

#### 推荐配置（官方标准方式）

**配置文件路径**：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

##### 方式一：Stdio 传输（推荐，最简单）

```json
{
  "mcpServers": {
    "promptx": {
      "command": "node",
      "args": [
        "/absolute/path/to/PromptX/src/bin/promptx.js",
        "mcp-server"
      ]
    }
  }
}
```

**Windows 示例**：
```json
{
  "mcpServers": {
    "promptx": {
      "command": "node",
      "args": [
        "C:\\Users\\你的用户名\\WorkSpaces\\DeepracticeProjects\\PromptX\\src\\bin\\promptx.js",
        "mcp-server"
      ]
    }
  }
}
```

##### 方式二：使用 npx 运行（如果发布到 npm）

```json
{
  "mcpServers": {
    "promptx": {
      "command": "npx",
      "args": [
        "-y",
        "dpml-prompt",
        "mcp-server"
      ]
    }
  }
}
```

#### HTTP 传输配置（高级用法）

⚠️ **注意**: HTTP 传输配置比较复杂，仅在有特殊需求时使用。

##### 跨平台 HTTP 配置

**macOS/Linux** (有 curl):
```json
{
  "mcpServers": {
    "promptx-http": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "--data-binary", "@-",
        "http://localhost:3000/mcp"
      ]
    }
  }
}
```

**Windows** (使用 Node.js 脚本):
```json
{
  "mcpServers": {
    "promptx-http": {
      "command": "node",
      "args": [
        "C:\\path\\to\\PromptX\\scripts\\mcp-http-client.js"
      ]
    }
  }
}
```

#### 生产环境配置

对于生产环境，建议使用以下配置：

```json
{
  "mcpServers": {
    "promptx-prod": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "-H", "User-Agent: Claude-Desktop/1.0",
        "--timeout", "30",
        "--retry", "3",
        "--data-binary", "@-",
        "https://your-domain.com/mcp"
      ],
      "env": {
        "MCP_DEBUG": "false",
        "HTTP_TIMEOUT": "30000"
      }
    }
  }
}
```

#### SSE 传输配置（兼容模式）

```json
{
  "mcpServers": {
    "promptx-sse": {
      "command": "curl",
      "args": [
        "-X", "GET",
        "-H", "Accept: text/event-stream",
        "-H", "Cache-Control: no-cache",
        "http://localhost:3000/mcp"
      ],
      "env": {
        "MCP_DEBUG": "true"
      }
    }
  }
}
```

### 配置文件管理

#### 配置文件创建步骤

1. **查找配置文件位置**
   ```bash
   # macOS
   ls -la ~/Library/Application\ Support/Claude/
   
   # Windows (PowerShell)
   ls $env:APPDATA\Claude\
   ```

2. **创建配置文件**（如果不存在）
   ```bash
   # macOS
   mkdir -p ~/Library/Application\ Support/Claude/
   touch ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows (PowerShell)
   New-Item -ItemType Directory -Force -Path $env:APPDATA\Claude\
   New-Item -ItemType File -Force -Path $env:APPDATA\Claude\claude_desktop_config.json
   ```

3. **验证配置**
   ```bash
   # 测试配置文件语法
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
   ```

#### 配置文件模板

我们提供了一个完整的配置文件模板：`docs/claude-desktop-config-example.json`

你可以直接复制这个文件到你的 Claude Desktop 配置目录：

```bash
# macOS
cp docs/claude-desktop-config-example.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows (PowerShell)  
Copy-Item docs/claude-desktop-config-example.json $env:APPDATA\Claude\claude_desktop_config.json
```

**重要**: 记得将配置文件中的 `/Users/YOUR_USERNAME/` 替换为你的实际用户路径。

#### 快速配置脚本

```bash
#!/bin/bash
# 文件名: setup-claude-config.sh

# 获取当前项目路径
PROJECT_PATH=$(pwd)

# 获取用户名
USERNAME=$(whoami)

# Claude Desktop 配置路径
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# 创建配置目录
mkdir -p "$CLAUDE_CONFIG_DIR"

# 生成配置文件
cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "promptx-http": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "--data-binary", "@-",
        "http://localhost:3000/mcp"
      ],
      "env": {
        "MCP_DEBUG": "false"
      }
    },
    "promptx-stdio": {
      "command": "node",
      "args": [
        "$PROJECT_PATH/src/bin/promptx.js",
        "mcp-server"
      ],
      "env": {
        "MCP_DEBUG": "false"
      }
    }
  },
  "globalShortcut": "Cmd+Shift+.",
  "theme": "auto"
}
EOF

echo "✅ Claude Desktop 配置已生成: $CLAUDE_CONFIG_FILE"
echo "🔄 请重启 Claude Desktop 以加载新配置"
```

使用方法：
```bash
chmod +x setup-claude-config.sh
./setup-claude-config.sh
```

#### 多环境配置

```json
{
  "mcpServers": {
    "promptx-dev": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "--data-binary", "@-",
        "http://localhost:3000/mcp"
      ],
      "env": {
        "MCP_DEBUG": "true",
        "NODE_ENV": "development"
      }
    },
    "promptx-staging": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "--data-binary", "@-",
        "https://staging.your-domain.com/mcp"
      ],
      "env": {
        "MCP_DEBUG": "false",
        "NODE_ENV": "staging"
      }
    },
    "promptx-prod": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "-H", "Authorization: Bearer YOUR_API_TOKEN",
        "--timeout", "30",
        "--retry", "3",
        "--data-binary", "@-",
        "https://api.your-domain.com/mcp"
      ],
      "env": {
        "MCP_DEBUG": "false",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 自定义客户端实现

#### JavaScript/TypeScript 客户端

```javascript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { HttpTransport } from '@modelcontextprotocol/sdk/client/http.js';

// Streamable HTTP 客户端
const transport = new HttpTransport({
  baseUrl: 'http://localhost:3000/mcp',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

const client = new McpClient({
  name: 'promptx-client',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

await client.connect(transport);

// 调用工具示例
const result = await client.callTool('promptx_hello', {});
console.log(result);
```

#### Python 客户端

```python
import asyncio
import aiohttp
import json

class PromptXClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.session_id = None
    
    async def initialize(self):
        """初始化 MCP 连接"""
        async with aiohttp.ClientSession() as session:
            payload = {
                "jsonrpc": "2.0",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "clientInfo": {
                        "name": "promptx-python-client",
                        "version": "1.0.0"
                    }
                },
                "id": 1
            }
            
            async with session.post(
                f"{self.base_url}/mcp",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                result = await response.json()
                self.session_id = response.headers.get('mcp-session-id')
                return result
    
    async def call_tool(self, tool_name, arguments=None):
        """调用 PromptX 工具"""
        if not self.session_id:
            await self.initialize()
        
        async with aiohttp.ClientSession() as session:
            payload = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments or {}
                },
                "id": 2
            }
            
            headers = {
                "Content-Type": "application/json",
                "mcp-session-id": self.session_id
            }
            
            async with session.post(
                f"{self.base_url}/mcp",
                json=payload,
                headers=headers
            ) as response:
                return await response.json()

# 使用示例
async def main():
    client = PromptXClient()
    
    # 调用角色发现工具
    result = await client.call_tool('promptx_hello')
    print(result)
    
    # 激活产品经理角色
    result = await client.call_tool('promptx_action', {'role': 'product-manager'})
    print(result)

asyncio.run(main())
```

### MCP Inspector 配置

使用 MCP Inspector 进行调试和测试：

```bash
# 安装 MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 连接到 PromptX HTTP 服务器
mcp-inspector http://localhost:3000/mcp
```

### 服务器启动命令

在配置客户端之前，确保 PromptX 服务器已启动：

```bash
# 启动 Streamable HTTP 服务器（推荐）
pnpm start mcp-server --transport http --port 3000

# 启动 SSE 服务器（兼容模式）
pnpm start mcp-server --transport sse --port 3000

# 启动时启用调试日志
MCP_DEBUG=true pnpm start mcp-server --transport http --port 3000
```

### 连接测试

#### 健康检查

```bash
# 测试服务器是否运行
curl http://localhost:3000/health

# 预期响应
{
  "status": "ok",
  "name": "promptx-mcp-streamable-http-server",
  "version": "1.0.0",
  "transport": "http"
}
```

#### 工具列表获取

```bash
# 获取可用工具列表（无需会话ID）
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**注意**: 必须包含 `Accept: application/json, text/event-stream` 头，否则会收到406错误。

#### 工具调用测试

```bash
# 调用角色发现工具
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "promptx_hello",
      "arguments": {}
    },
    "id": 2
  }'
```

### 故障排除

#### 常见问题

1. **连接被拒绝**
   ```bash
   # 检查服务器是否运行
   curl http://localhost:3000/health
   # 检查端口是否被占用
   lsof -i :3000
   ```

2. **CORS 错误**
   ```bash
   # 启动时启用 CORS（如果需要）
   pnpm start mcp-server --transport http --port 3000 --cors
   ```

3. **会话 ID 错误**
   - 确保在工具调用时包含正确的 `mcp-session-id` 头
   - 对于新连接，先发送 `initialize` 请求

4. **工具调用失败**
   ```bash
   # 启用调试模式查看详细日志
   MCP_DEBUG=true pnpm start mcp-server --transport http --port 3000
   ```

## 兼容性

### MCP 客户端兼容性
- Claude Desktop (通过 HTTP 配置)
- MCP Inspector
- 自定义 JavaScript/TypeScript 客户端
- 自定义 Python 客户端
- 任何支持 HTTP JSON-RPC 的客户端

### 协议版本兼容性
- 支持当前协议版本 (2024-11-05)
- 向后兼容弃用特性 (SSE 传输)
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