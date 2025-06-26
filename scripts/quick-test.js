#!/usr/bin/env node

/**
 * 快速测试脚本
 * 用于验证全局单例ResourceManager优化效果
 * 
 * 使用方法:
 * node scripts/quick-test.js [role-name]
 * 
 * 示例:
 * node scripts/quick-test.js frontend-dev
 * node scripts/quick-test.js backend-dev
 */

const { execSync } = require('child_process')
const path = require('path')

// 预定义的测试角色配置
const TEST_ROLES = {
  'frontend-dev': {
    title: '前端开发工程师',
    domain: '前端开发'
  },
  'backend-dev': {
    title: '后端开发工程师', 
    domain: '后端开发'
  },
  'ui-designer': {
    title: 'UI设计师',
    domain: '用户界面设计'
  },
  'product-manager': {
    title: '产品经理',
    domain: '产品设计'
  },
  'data-analyst': {
    title: '数据分析师',
    domain: '数据分析'
  },
  'devops-engineer': {
    title: 'DevOps工程师',
    domain: 'DevOps运维'
  }
}

function getRandomRole() {
  const roles = Object.keys(TEST_ROLES)
  return roles[Math.floor(Math.random() * roles.length)]
}

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`)
  console.log(`💻 执行命令: ${command}`)
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: 'pipe'
    })
    console.log(`✅ 成功完成`)
    if (output.trim()) {
      console.log(`📄 输出:\n${output}`)
    }
    return true
  } catch (error) {
    console.log(`❌ 执行失败: ${error.message}`)
    if (error.stdout) {
      console.log(`📄 标准输出:\n${error.stdout}`)
    }
    if (error.stderr) {
      console.log(`📄 错误输出:\n${error.stderr}`)
    }
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  let roleId = args[0]
  
  // 如果没有指定角色，随机选择一个
  if (!roleId) {
    roleId = getRandomRole()
    console.log(`🎲 随机选择测试角色: ${roleId}`)
  }
  
  // 检查角色是否在预定义列表中
  if (!TEST_ROLES[roleId]) {
    console.log(`❌ 未知角色: ${roleId}`)
    console.log(`📋 可用角色: ${Object.keys(TEST_ROLES).join(', ')}`)
    process.exit(1)
  }
  
  const config = TEST_ROLES[roleId]
  console.log(`\n🚀 开始快速测试流程`)
  console.log(`📋 测试角色: ${roleId} (${config.title})`)
  console.log(`🎯 专业领域: ${config.domain}`)
  
  // 步骤1: 生成测试角色
  console.log(`\n=== 步骤 1: 生成测试角色 ===`)
  const generateSuccess = runCommand(
    `node scripts/generate-test-role.js ${roleId} "${config.title}" "${config.domain}"`,
    `生成角色 ${roleId}`
  )
  
  if (!generateSuccess) {
    console.log(`❌ 角色生成失败，终止测试`)
    process.exit(1)
  }
  
  // 步骤2: 刷新资源注册表
  console.log(`\n=== 步骤 2: 刷新资源注册表 ===`)
  const initSuccess = runCommand(
    `node src/bin/promptx.js init`,
    `刷新资源注册表`
  )
  
  if (!initSuccess) {
    console.log(`❌ 资源注册表刷新失败，终止测试`)
    process.exit(1)
  }
  
  // 步骤3: 激活角色测试
  console.log(`\n=== 步骤 3: 激活角色测试 ===`)
  const actionSuccess = runCommand(
    `node src/bin/promptx.js action ${roleId}`,
    `激活角色 ${roleId}`
  )
  
  if (!actionSuccess) {
    console.log(`❌ 角色激活失败`)
  }
  
  // 测试总结
  console.log(`\n=== 测试总结 ===`)
  console.log(`🎯 测试角色: ${roleId} (${config.title})`)
  console.log(`📊 测试结果:`)
  console.log(`   ✅ 角色生成: ${generateSuccess ? '成功' : '失败'}`)
  console.log(`   ✅ 资源注册: ${initSuccess ? '成功' : '失败'}`)
  console.log(`   ✅ 角色激活: ${actionSuccess ? '成功' : '失败'}`)
  
  if (generateSuccess && initSuccess && actionSuccess) {
    console.log(`\n🎉 全部测试通过！ResourceManager优化生效`)
    console.log(`💡 现在可以在MCP环境中测试角色激活，无需重启服务器`)
  } else {
    console.log(`\n⚠️  部分测试失败，请检查错误信息`)
  }
  
  console.log(`\n📍 后续操作建议:`)
  console.log(`   1. 在MCP环境中测试: mcp_promptx-dev_promptx_action ${roleId}`)
  console.log(`   2. 验证项目级资源引用是否正常解析`)
  console.log(`   3. 测试其他角色的创建和激活`)
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行出错:', error.message)
    process.exit(1)
  })
} 