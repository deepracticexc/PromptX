const fs = require('fs-extra')
const path = require('path')
const { getDirectoryService } = require('./DirectoryService')

/**
 * PromptX配置文件管理工具
 * 统一管理.promptx目录下的所有配置文件
 */
class PromptXConfig {
  constructor(baseDir = null) {
    this.baseDir = baseDir
    this.directoryService = getDirectoryService()
    this.promptxDir = null // 将在需要时动态计算
  }

  /**
   * 获取.promptx目录路径
   */
  async getPromptXDir() {
    if (!this.promptxDir) {
      if (this.baseDir) {
        this.promptxDir = path.join(this.baseDir, '.promptx')
      } else {
        const context = {
          startDir: process.cwd(),
          platform: process.platform,
          avoidUserHome: true
        }
        this.promptxDir = await this.directoryService.getPromptXDirectory(context)
      }
    }
    return this.promptxDir
  }

  /**
   * 确保.promptx目录存在
   */
  async ensureDir() {
    const promptxDir = await this.getPromptXDir()
    await fs.ensureDir(promptxDir)
  }

  /**
   * 读取JSON配置文件
   * @param {string} filename - 文件名（不含路径）
   * @param {*} defaultValue - 文件不存在时的默认值
   * @returns {Promise<*>} 配置对象
   */
  async readJson(filename, defaultValue = {}) {
    const promptxDir = await this.getPromptXDir()
    const filePath = path.join(promptxDir, filename)
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath)
      }
      return defaultValue
    } catch (error) {
      console.warn(`读取配置文件失败 ${filename}:`, error.message)
      return defaultValue
    }
  }

  /**
   * 写入JSON配置文件
   * @param {string} filename - 文件名（不含路径）
   * @param {*} data - 要写入的数据
   * @param {Object} options - 选项
   */
  async writeJson(filename, data, options = { spaces: 2 }) {
    await this.ensureDir()
    const promptxDir = await this.getPromptXDir()
    const filePath = path.join(promptxDir, filename)
    await fs.writeJson(filePath, data, options)
  }

  /**
   * 读取文本配置文件
   * @param {string} filename - 文件名（不含路径）
   * @param {string} defaultValue - 文件不存在时的默认值
   * @returns {Promise<string>} 文件内容
   */
  async readText(filename, defaultValue = '') {
    const filePath = path.join(this.promptxDir, filename)
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readFile(filePath, 'utf8')
      }
      return defaultValue
    } catch (error) {
      console.warn(`读取配置文件失败 ${filename}:`, error.message)
      return defaultValue
    }
  }

  /**
   * 写入文本配置文件
   * @param {string} filename - 文件名（不含路径）
   * @param {string} content - 要写入的内容
   */
  async writeText(filename, content) {
    await this.ensureDir()
    const filePath = path.join(this.promptxDir, filename)
    await fs.writeFile(filePath, content, 'utf8')
  }

  /**
   * 检查配置文件是否存在
   * @param {string} filename - 文件名（不含路径）
   * @returns {Promise<boolean>}
   */
  async exists(filename) {
    const filePath = path.join(this.promptxDir, filename)
    return await fs.pathExists(filePath)
  }

  /**
   * 删除配置文件
   * @param {string} filename - 文件名（不含路径）
   */
  async remove(filename) {
    const filePath = path.join(this.promptxDir, filename)
    try {
      await fs.remove(filePath)
    } catch (error) {
      console.warn(`删除配置文件失败 ${filename}:`, error.message)
    }
  }

  /**
   * 获取配置文件路径
   * @param {string} filename - 文件名（不含路径）
   * @returns {string} 完整路径
   */
  getPath(filename) {
    return path.join(this.promptxDir, filename)
  }

  /**
   * 原子性更新JSON配置文件
   * 读取 -> 修改 -> 写入，避免并发问题
   * @param {string} filename - 文件名
   * @param {Function} updater - 更新函数 (oldData) => newData
   * @param {*} defaultValue - 文件不存在时的默认值
   */
  async updateJson(filename, updater, defaultValue = {}) {
    const oldData = await this.readJson(filename, defaultValue)
    const newData = await updater(oldData)
    await this.writeJson(filename, newData)
    return newData
  }
}

module.exports = PromptXConfig 