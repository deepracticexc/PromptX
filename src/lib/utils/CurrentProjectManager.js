const fs = require('fs-extra')
const path = require('path')
const os = require('os')

/**
 * 当前项目管理器
 * 负责管理 ~/.promptx/current-project 文件，持久化当前项目路径
 */
class CurrentProjectManager {
  constructor() {
    this.promptxHomeDir = path.join(os.homedir(), '.promptx')
    this.currentProjectFile = path.join(this.promptxHomeDir, 'current-project')
  }

  /**
   * 获取当前保存的项目路径
   * @returns {Promise<string|null>} 项目路径或null
   */
  async getCurrentProject() {
    try {
      if (await fs.pathExists(this.currentProjectFile)) {
        const content = await fs.readFile(this.currentProjectFile, 'utf-8')
        return content.trim()
      }
    } catch (error) {
      // 文件不存在或读取失败，返回null
    }
    return null
  }

  /**
   * 设置当前项目路径
   * @param {string} projectPath - 项目绝对路径
   */
  async setCurrentProject(projectPath) {
    // 确保目录存在
    await fs.ensureDir(this.promptxHomeDir)
    
    // 保存项目路径
    await fs.writeFile(this.currentProjectFile, projectPath)
  }

  /**
   * 检查项目一致性，生成AI提示信息
   * @returns {Promise<Object>} 项目状态和AI提示信息
   */
  async checkProjectConsistency() {
    const savedProject = await this.getCurrentProject()
    
    if (savedProject) {
      return {
        hasSaved: true,
        savedPath: savedProject,
        aiMessage: `📍 PromptX当前设置的项目路径: ${savedProject}`,
        aiInstruction: '如果这不是你当前工作的项目路径，请调用 promptx_init 工具并提供正确的 workingDirectory 参数来更新。'
      }
    } else {
      return {
        hasSaved: false,
        savedPath: null,
        aiMessage: '🎯 PromptX尚未设置项目路径',
        aiInstruction: '请先调用 promptx_init 工具并提供 workingDirectory 参数来设置当前项目路径。'
      }
    }
  }

  /**
   * 生成顶层项目状态提示信息（用于分隔线后的独立层级显示）
   * @param {string} contextType - 上下文类型：'list'(角色列表), 'action'(角色激活), 'learn'(学习资源)
   * @returns {string} 格式化的顶层项目状态提示
   */
  async generateTopLevelProjectPrompt(contextType = 'list') {
    const projectCheck = await this.checkProjectConsistency()
    
    if (projectCheck.hasSaved) {
      // 已设置项目路径的提示
      switch (contextType) {
        case 'action':
          return `🛑 **项目环境强制验证** 🛑
${projectCheck.aiMessage}

⚠️ **执行前必须确认**：
1. 上述路径是否为你当前工作的项目？
2. 如不一致，立即停止所有操作
3. 使用 \`promptx_init\` 更新正确路径
4. 验证通过后才能继续角色激活

💥 **严重警告**：在错误项目路径下操作将导致不可预知的错误！`
        
        case 'learn':
          return `🛑 **学习环境强制验证** 🛑
${projectCheck.aiMessage}

⚠️ **学习前必须确认**：
1. 确保在正确的项目环境中学习
2. 错误环境将导致知识关联失效
3. 如需切换项目，立即停止并更新

💥 **严重警告**：项目环境不匹配将影响学习效果！`
        
        case 'list':
        default:
          return `🛑 **项目环境强制验证** 🛑
${projectCheck.aiMessage}

⚠️ **使用前必须确认**：
1. 立即确认上述路径是否为当前工作项目
2. 如不一致，禁止继续任何操作
3. 必须使用 \`promptx_init\` 更新正确路径
4. 验证通过后才能使用角色服务

💥 **严重警告**：错误的项目环境将导致服务异常！`
      }
    } else {
      // 未设置项目路径的提示
      return `🛑 **致命错误：项目环境未初始化** 🛑
${projectCheck.aiMessage}

💢 **立即执行**：
1. 停止当前操作
2. 调用 \`promptx_init\` 工具初始化环境
3. 提供正确的 workingDirectory 参数
4. 初始化完成后重新开始

⛔ **严禁继续**：未初始化环境中的任何操作都可能失败！`
    }
  }

  /**
   * 生成统一的项目状态提示信息
   * @param {string} contextType - 上下文类型：'list'(角色列表), 'action'(角色激活), 'learn'(学习资源)
   * @returns {string} 格式化的项目状态提示
   */
  async generateProjectStatusPrompt(contextType = 'list') {
    const projectCheck = await this.checkProjectConsistency()
    
    if (projectCheck.hasSaved) {
      // 已设置项目路径的提示
      switch (contextType) {
        case 'action':
          return `\n🛑 **执行前置检查**
---
## 📍 项目环境验证
✅ ${projectCheck.aiMessage}

⚠️ **强制验证**：
1. 请确认这是你当前工作的项目路径
2. 如不一致，必须立即停止操作
3. 使用 \`promptx_init\` 更新正确路径
4. 仅当路径正确才能继续操作

💢 **违规警告**：
- 在错误的项目路径下执行操作将导致不可预知的错误
- 可能影响项目配置和资源完整性
---\n`
        
        case 'learn':
          return `\n🛑 **执行前置检查**
---
## 📍 学习环境验证
✅ ${projectCheck.aiMessage}

⚠️ **强制验证**：
1. 确保在正确的项目环境中学习
2. 错误的项目环境将导致知识关联失效
3. 如需切换项目，请立即停止并更新

💢 **违规警告**：
- 项目环境不匹配将影响学习效果
- 可能造成知识体系混乱
---\n`
        
        case 'list':
        default:
          return `🛑 **执行前置检查**

## 📍 项目环境强制验证
✅ ${projectCheck.aiMessage}

⚠️ **检查步骤**：
1. 立即确认上述路径是否为当前工作项目
2. 如不一致，禁止继续任何操作
3. 必须使用 \`promptx_init\` 更新正确路径
4. 验证通过后才能使用角色服务

💢 **违规警告**：
- 错误的项目环境将导致角色服务异常
- 可能影响项目资源和配置完整性
- 禁止在未经验证的环境中继续操作

💡 **操作指南**：
1. 一致 → 继续使用角色服务
2. 不一致 → 立即停止并更新路径
3. 不确定 → 先确认再操作`
      }
    } else {
      // 未设置项目路径的提示
      return `🛑 **执行终止**

## ⚠️ 致命错误：项目环境未初始化
${projectCheck.aiMessage}

💢 **强制要求**：
1. 立即停止当前操作
2. 调用 \`promptx_init\` 工具初始化环境：
\`\`\`
workingDirectory: "你当前工作的项目完整路径"
\`\`\`
3. 初始化完成后重新开始操作

⛔ **禁止事项**：
- 禁止在未初始化环境中执行任何操作
- 禁止跳过环境初始化步骤
- 禁止使用可能不正确的项目路径

💥 **违规后果**：
- 操作将失败或产生不可预知的错误
- 可能破坏项目配置和资源完整性
- 导致角色服务异常或失效`
    }
  }

  /**
   * 验证路径是否为有效的项目目录
   * @param {string} projectPath - 要验证的路径
   * @returns {Promise<boolean>} 是否为有效项目目录
   */
  async validateProjectPath(projectPath) {
    try {
      // 基础检查：路径存在且为目录
      const stat = await fs.stat(projectPath)
      if (!stat.isDirectory()) {
        return false
      }

      // 简单检查：避免明显错误的路径
      const resolved = path.resolve(projectPath)
      const homeDir = os.homedir()
      
      // 不允许是用户主目录
      if (resolved === homeDir) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = CurrentProjectManager