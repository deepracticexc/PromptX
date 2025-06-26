const ResourceProtocol = require('./ResourceProtocol')
const path = require('path')
const fs = require('fs').promises
const { getDirectoryService } = require('../../../utils/DirectoryService')

/**
 * 项目协议实现
 * 实现@project://协议，通过查找.promptx目录确定项目根目录
 */
class ProjectProtocol extends ResourceProtocol {
  constructor (options = {}) {
    super('project', options)

    // 支持的项目结构目录映射
    this.projectDirs = {
      root: '', // 项目根目录
      src: 'src', // 源代码目录
      lib: 'lib', // 库目录
      build: 'build', // 构建输出目录
      dist: 'dist', // 分发目录
      docs: 'docs', // 文档目录
      test: 'test', // 测试目录
      tests: 'tests', // 测试目录（复数）
      spec: 'spec', // 规范测试目录
      config: 'config', // 配置目录
      scripts: 'scripts', // 脚本目录
      assets: 'assets', // 资源目录
      public: 'public', // 公共资源目录
      static: 'static', // 静态资源目录
      templates: 'templates', // 模板目录
      examples: 'examples', // 示例目录
      tools: 'tools' // 工具目录
    }

    // 获取全局DirectoryService实例
    this.directoryService = getDirectoryService()
  }

  /**
   * 设置注册表（保持与其他协议的一致性）
   */
  setRegistry (registry) {
    // Project协议不使用注册表，但为了一致性提供此方法
    this.registry = registry || {}
  }

  /**
   * 获取协议信息
   * @returns {object} 协议信息
   */
  getProtocolInfo () {
    return {
      name: 'project',
      description: '项目协议，通过.promptx目录标识提供项目结构访问',
      location: 'project://{directory}/{path}',
      examples: [
        'project://src/index.js',
        'project://lib/utils.js',
        'project://docs/README.md',
        'project://root/package.json',
        'project://test/unit/'
      ],
      supportedDirectories: Object.keys(this.projectDirs),
      projectMarker: '.promptx',
      params: this.getSupportedParams()
    }
  }

  /**
   * 支持的查询参数
   * @returns {object} 参数说明
   */
  getSupportedParams () {
    return {
      ...super.getSupportedParams(),
      from: 'string - 指定搜索起始目录',
      create: 'boolean - 如果目录不存在是否创建',
      exists: 'boolean - 仅返回存在的文件/目录',
      type: 'string - 过滤类型 (file|dir|both)'
    }
  }

  /**
   * 验证项目协议路径
   * @param {string} resourcePath - 资源路径
   * @returns {boolean} 是否有效
   */
  validatePath (resourcePath) {
    if (!super.validatePath(resourcePath)) {
      return false
    }

    // 特殊处理：允许.promptx开头的路径（项目配置目录）
    if (resourcePath.startsWith('.promptx/')) {
      return true
    }

    // 解析路径的第一部分（目录类型）
    const parts = resourcePath.split('/')
    const dirType = parts[0]

    return this.projectDirs.hasOwnProperty(dirType)
  }

  /**
   * 向上查找指定目录的同步版本
   * @param {string} targetDir - 要查找的目录名（如 '.promptx'）
   * @param {string} startDir - 开始搜索的目录
   * @returns {string|null} 找到的目录路径或null
   */
  findUpDirectorySync (targetDir, startDir = process.cwd()) {
    let currentDir = path.resolve(startDir)
    const rootDir = path.parse(currentDir).root

    while (currentDir !== rootDir) {
      const targetPath = path.join(currentDir, targetDir)

      try {
        const stats = require('fs').statSync(targetPath)
        if (stats.isDirectory()) {
          return targetPath
        }
      } catch (error) {
        // 目录不存在，继续向上查找
      }

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        // 已到达根目录
        break
      }
      currentDir = parentDir
    }

    return null
  }

  /**
   * 查找项目根目录
   * @param {string} startDir - 开始搜索的目录
   * @returns {Promise<string|null>} 项目根目录路径
   */
  async findProjectRoot (startDir = process.cwd()) {
    try {
      // 使用DirectoryService获取项目根目录
      const context = {
        startDir: path.resolve(startDir),
        platform: process.platform,
        avoidUserHome: true
      }
      
      const projectRoot = await this.directoryService.getProjectRoot(context)
      return projectRoot
    } catch (error) {
      throw new Error(`查找项目根目录失败: ${error.message}`)
    }
  }

  /**
   * 解析项目路径
   * @param {string} resourcePath - 原始资源路径，如 "src/index.js" 或 ".promptx/resource/..."
   * @param {QueryParams} queryParams - 查询参数
   * @returns {Promise<string>} 解析后的绝对路径
   */
  async resolvePath (resourcePath, queryParams) {
    // 特殊处理：.promptx开头的路径直接相对于项目根目录
    if (resourcePath.startsWith('.promptx/')) {
      // 确定搜索起始点
      const startDir = queryParams?.get('from') || process.cwd()

      // 查找项目根目录
      const projectRoot = await this.findProjectRoot(startDir)
      if (!projectRoot) {
        throw new Error('未找到项目根目录（.promptx标识）。请确保在项目目录内或使用 \'from\' 参数指定项目路径')
      }

      // 直接拼接完整路径
      const fullPath = path.join(projectRoot, resourcePath)

      // 安全检查：确保路径在项目目录内
      const resolvedPath = path.resolve(fullPath)
      const resolvedProjectRoot = path.resolve(projectRoot)

      if (!resolvedPath.startsWith(resolvedProjectRoot)) {
        throw new Error(`安全错误：路径超出项目目录范围: ${resolvedPath}`)
      }

      return resolvedPath
    }

    // 标准路径处理逻辑
    const parts = resourcePath.split('/')
    const dirType = parts[0]
    const relativePath = parts.slice(1).join('/')

    // 验证目录类型
    if (!this.projectDirs.hasOwnProperty(dirType)) {
      throw new Error(`不支持的项目目录类型: ${dirType}。支持的类型: ${Object.keys(this.projectDirs).join(', ')}`)
    }

    // 确定搜索起始点
    const startDir = queryParams?.get('from') || process.cwd()

    // 查找项目根目录
    const projectRoot = await this.findProjectRoot(startDir)
    if (!projectRoot) {
      throw new Error('未找到项目根目录（.promptx标识）。请确保在项目目录内或使用 \'from\' 参数指定项目路径')
    }

    // 构建目标目录路径
    const projectDirPath = this.projectDirs[dirType]
    const targetDir = projectDirPath ? path.join(projectRoot, projectDirPath) : projectRoot

    // 如果没有相对路径，返回目录本身
    if (!relativePath) {
      return targetDir
    }

    // 拼接完整路径
    const fullPath = path.join(targetDir, relativePath)

    // 安全检查：确保路径在项目目录内
    const resolvedPath = path.resolve(fullPath)
    const resolvedProjectRoot = path.resolve(projectRoot)

    if (!resolvedPath.startsWith(resolvedProjectRoot)) {
      throw new Error(`安全错误：路径超出项目目录范围: ${resolvedPath}`)
    }

    return resolvedPath
  }

  /**
   * 加载资源内容
   * @param {string} resolvedPath - 解析后的路径
   * @param {QueryParams} queryParams - 查询参数
   * @returns {Promise<string>} 资源内容
   */
  async loadContent (resolvedPath, queryParams) {
    try {
      // 检查路径是否存在
      const stats = await fs.stat(resolvedPath)

      if (stats.isDirectory()) {
        return await this.loadDirectoryContent(resolvedPath, queryParams)
      } else if (stats.isFile()) {
        return await this.loadFileContent(resolvedPath, queryParams)
      } else {
        throw new Error(`不支持的文件类型: ${resolvedPath}`)
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 检查是否需要创建目录
        if (queryParams?.get('create') === 'true') {
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
          return '' // 返回空内容
        }

        // 如果设置了exists参数为false，返回空内容而不是错误
        if (queryParams?.get('exists') === 'false') {
          return ''
        }
        throw new Error(`文件或目录不存在: ${resolvedPath}`)
      }
      throw error
    }
  }

  /**
   * 加载文件内容
   * @param {string} filePath - 文件路径
   * @param {QueryParams} queryParams - 查询参数
   * @returns {Promise<string>} 文件内容
   */
  async loadFileContent (filePath, queryParams) {
    const encoding = queryParams?.get('encoding') || 'utf8'
    return await fs.readFile(filePath, encoding)
  }

  /**
   * 加载目录内容
   * @param {string} dirPath - 目录路径
   * @param {QueryParams} queryParams - 查询参数
   * @returns {Promise<string>} 目录内容列表
   */
  async loadDirectoryContent (dirPath, queryParams) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    // 应用类型过滤
    const typeFilter = queryParams?.get('type')
    let filteredEntries = entries

    if (typeFilter) {
      filteredEntries = entries.filter(entry => {
        switch (typeFilter) {
          case 'file': return entry.isFile()
          case 'dir': return entry.isDirectory()
          case 'both': return true
          default: return true
        }
      })
    }

    // 格式化输出
    const format = queryParams?.get('format') || 'list'

    switch (format) {
      case 'json':
        return JSON.stringify(
          filteredEntries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            path: path.join(dirPath, entry.name)
          })),
          null,
          2
        )

      case 'paths':
        return filteredEntries
          .map(entry => path.join(dirPath, entry.name))
          .join('\n')

      case 'list':
      default:
        return filteredEntries
          .map(entry => {
            const type = entry.isDirectory() ? '[DIR]' : '[FILE]'
            return `${type} ${entry.name}`
          })
          .join('\n')
    }
  }

  /**
   * 列出项目结构信息
   * @param {string} startDir - 开始搜索的目录
   * @returns {Promise<object>} 项目信息
   */
  async getProjectInfo (startDir = process.cwd()) {
    const projectRoot = await this.findProjectRoot(startDir)
    if (!projectRoot) {
      return { error: '未找到项目根目录' }
    }

    const result = {
      projectRoot,
      promptxPath: path.join(projectRoot, '.promptx'),
      directories: {}
    }

    for (const [dirType, dirPath] of Object.entries(this.projectDirs)) {
      const fullPath = dirPath ? path.join(projectRoot, dirPath) : projectRoot
      try {
        const stats = await fs.stat(fullPath)
        result.directories[dirType] = {
          path: fullPath,
          exists: true,
          type: stats.isDirectory() ? 'directory' : 'file'
        }
      } catch (error) {
        result.directories[dirType] = {
          path: fullPath,
          exists: false
        }
      }
    }

    return result
  }

  /**
   * 清除缓存
   */
  clearCache () {
    super.clearCache()
    // 清除DirectoryService缓存
    this.directoryService.clearCache()
  }
}

module.exports = ProjectProtocol
