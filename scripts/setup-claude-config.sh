#!/bin/bash
# PromptX Claude Desktop 配置生成脚本
# 使用方法: ./scripts/setup-claude-config.sh

set -e

echo "🔧 设置 Claude Desktop 配置..."

# 获取当前项目路径
PROJECT_PATH=$(pwd)

# 获取用户名
USERNAME=$(whoami)

# Claude Desktop 配置路径
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# 检查操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
else
    echo "❌ 不支持的操作系统: $OSTYPE"
    exit 1
fi

CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

echo "📁 配置目录: $CLAUDE_CONFIG_DIR"
echo "📄 配置文件: $CLAUDE_CONFIG_FILE"

# 创建配置目录
mkdir -p "$CLAUDE_CONFIG_DIR"

# 备份现有配置
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    BACKUP_FILE="${CLAUDE_CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG_FILE" "$BACKUP_FILE"
    echo "💾 已备份现有配置到: $BACKUP_FILE"
fi

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

echo "✅ Claude Desktop 配置已生成"
echo "📝 配置文件内容:"
echo "----------------------------------------"
cat "$CLAUDE_CONFIG_FILE"
echo "----------------------------------------"

# 验证JSON格式
if command -v jq &> /dev/null; then
    if jq . "$CLAUDE_CONFIG_FILE" > /dev/null 2>&1; then
        echo "✅ JSON 格式验证通过"
    else
        echo "❌ JSON 格式验证失败"
        exit 1
    fi
else
    echo "⚠️  建议安装 jq 来验证 JSON 格式: brew install jq"
fi

echo ""
echo "🚀 下一步操作："
echo "1. 启动 PromptX HTTP 服务器:"
echo "   pnpm start mcp-server --transport http --port 3000"
echo ""
echo "2. 重启 Claude Desktop 应用"
echo ""
echo "3. 在 Claude Desktop 中应该能看到 PromptX 工具"

# 检查服务器是否运行
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ PromptX HTTP 服务器正在运行"
else
    echo "⚠️  PromptX HTTP 服务器未运行，请先启动服务器"
fi