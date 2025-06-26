#!/bin/bash

# 测试npm认证配置

echo "🔍 测试NPM认证配置"
echo "=================="

# 检查npm配置
echo "📋 当前npm配置:"
npm config list

echo ""
echo "🔑 检查认证配置:"
npm whoami 2>/dev/null && echo "✅ NPM认证成功" || echo "❌ NPM认证失败"

echo ""
echo "📦 测试包信息查看:"
npm view dpml-prompt versions --json 2>/dev/null | tail -5 || echo "❌ 无法查看包信息"

echo ""
echo "🔍 检查registry配置:"
npm config get registry

echo ""
echo "💡 如果认证失败，请确保："
echo "1. GitHub Secrets中设置了正确的NPM_TOKEN"
echo "2. NPM_TOKEN具有发布权限"
echo "3. 包名dpml-prompt可用或者您有权限发布" 