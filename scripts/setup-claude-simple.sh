#!/bin/bash
# PromptX Claude Desktop 简单配置脚本（官方标准方式）

set -e

echo "🔧 设置 Claude Desktop 配置（官方标准方式）..."

# 获取当前项目路径
PROJECT_PATH=$(pwd)

# Claude Desktop 配置路径
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

# 生成简单配置文件（stdio传输）
cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "promptx": {
      "command": "node",
      "args": [
        "$PROJECT_PATH/src/bin/promptx.js",
        "mcp-server"
      ]
    }
  }
}
EOF

echo "✅ Claude Desktop 配置已生成（stdio 传输方式）"
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
fi

echo ""
echo "🚀 下一步操作："
echo "1. 重启 Claude Desktop 应用"
echo "2. 在 Claude Desktop 中应该能看到 PromptX 工具"
echo ""
echo "💡 提示："
echo "- 使用 stdio 传输，无需单独启动 HTTP 服务器"
echo "- 这是官方推荐的最简单配置方式"
echo "- 如需 HTTP 传输，请参考文档中的高级配置"