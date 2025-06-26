# PromptX MCP 快速上手

## 启动服务器

### 本地模式（推荐）
```bash
npx -f -y dpml-prompt@snapshot mcp-server
```

### HTTP 模式（远程访问）
```bash
npx -f -y dpml-prompt@snapshot mcp-server --transport http --port 3000
```

检查服务器状态：
```bash
curl http://localhost:3000/health
```

## 客户端配置

### Claude Desktop（仅本地模式）

**配置文件位置：**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "promptx": {
      "command": "npx",
      "args": ["-f", "-y", "dpml-prompt@snapshot", "mcp-server"]
    }
  }
}
```

### VS Code

创建 `.vscode/mcp.json`：

**本地模式：**
```json
{
  "servers": {
    "promptx": {
      "command": "npx",
      "args": ["-f", "-y", "dpml-prompt@snapshot", "mcp-server"]
    }
  }
}
```

**HTTP 模式：**
```json
{
  "servers": {
    "promptx": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Cursor

**本地模式：**
```json
{
  "mcpServers": {
    "promptx": {
      "command": "npx",
      "args": ["-f", "-y", "dpml-prompt@snapshot", "mcp-server"]
    }
  }
}
```

**HTTP 模式：**
```json
{
  "mcpServers": {
    "promptx": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### LibreChat

编辑 `librechat.yaml`：

**本地模式：**
```yaml
mcpServers:
  promptx:
    command: npx
    args:
      - -f
      - -y
      - dpml-prompt@snapshot
      - mcp-server
```

**HTTP 模式：**
```yaml
mcpServers:
  promptx:
    type: streamable-http
    url: http://localhost:3000/mcp
```

## 测试工具

重启客户端后，尝试使用以下工具：

- `promptx_hello` - 查看可用角色
- `promptx_action` - 激活角色（需要参数：role）
- `promptx_learn` - 学习资源（需要参数：resource）
- `promptx_recall` - 查看记忆
- `promptx_remember` - 保存记忆（需要参数：content）

## 故障排除

**服务器启动失败：**
- 检查 Node.js 版本：`node --version`（需要 >= 14）
- 确认网络连接正常（npx 需要下载包）

**客户端连接失败：**
- 检查配置文件 JSON/YAML 语法
- 重启客户端应用
- 确认 npx 可以运行：`npx -f -y dpml-prompt@snapshot --help`

**HTTP 模式报错：**
- 确认服务器正在运行
- 检查防火墙设置
- 使用 `curl` 测试连接