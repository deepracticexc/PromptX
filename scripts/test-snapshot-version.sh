#!/bin/bash

# 测试snapshot版本生成逻辑

echo "🔍 测试Snapshot版本号生成逻辑"
echo "================================"

# 获取当前时间戳和短commit hash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
SHORT_COMMIT=$(git rev-parse --short HEAD)

# 读取当前版本，移除任何现有的snapshot标识
CURRENT_VERSION=$(node -p "require('./package.json').version.split('-')[0]")

# 生成唯一的snapshot版本号：base-snapshot.timestamp.commit
SNAPSHOT_VERSION="${CURRENT_VERSION}-snapshot.${TIMESTAMP}.${SHORT_COMMIT}"

echo "📦 当前基础版本: $CURRENT_VERSION"
echo "⏰ 时间戳: $TIMESTAMP"
echo "🔗 短commit hash: $SHORT_COMMIT"
echo "🚀 生成的snapshot版本: $SNAPSHOT_VERSION"

# 验证版本号格式
if [[ $SNAPSHOT_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+-snapshot\.[0-9]{14}\.[a-f0-9]{7}$ ]]; then
    echo "✅ 版本号格式正确"
else
    echo "❌ 版本号格式不正确"
    exit 1
fi

# 模拟设置版本号
echo ""
echo "🔧 模拟设置版本号..."
npm version $SNAPSHOT_VERSION --no-git-tag-version

echo "📋 更新后的package.json版本:"
node -p "require('./package.json').version"

# 恢复原始版本
echo ""
echo "🔄 恢复原始版本..."
npm version $CURRENT_VERSION --no-git-tag-version

echo "✅ 测试完成！snapshot版本生成逻辑工作正常" 