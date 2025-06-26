const BaseDiscovery = require('./BaseDiscovery')
const logger = require('../../../utils/logger')
const fs = require('fs-extra')
const path = require('path')
const CrossPlatformFileScanner = require('./CrossPlatformFileScanner')
const RegistryData = require('../RegistryData')
const ResourceData = require('../ResourceData')

/**
 * ProjectDiscovery - 项目级资源发现器
 * 
 * 负责发现项目本地的资源：
 * 1. 优先从 project.registry.json 读取（构建时优化）
 * 2. Fallback: 扫描 .promptx/resource/ 目录（动态发现）
 * 3. 发现用户自定义的角色、执行模式、思维模式等
 * 
 * 优先级：2
 */
class ProjectDiscovery extends BaseDiscovery {
  constructor() {
    super('PROJECT', 2)
    this.fileScanner = new CrossPlatformFileScanner()
    this.registryData = null
  }

  /**
   * 发现项目级资源注册表 (新架构方法)
   * @returns {Promise<Map>} 发现的资源注册表 Map<resourceId, reference>
   */
  async discoverRegistry() {
    try {
      // 1. 查找项目根目录
      const projectRoot = await this._findProjectRoot()
      
      // 2. 检查.promptx目录是否存在
      const hasPrompxDir = await this._checkPrompxDirectory(projectRoot)
      if (!hasPrompxDir) {
        return new Map()
      }

      // 3. 优先尝试从注册表加载
      const registryMap = await this._loadFromRegistry(projectRoot)
      if (registryMap.size > 0) {
        logger.debug(`ProjectDiscovery 从注册表加载 ${registryMap.size} 个资源`)
        return registryMap
      }

      // 4. Fallback: 动态扫描
      logger.debug('ProjectDiscovery 注册表不存在，使用动态扫描')
      const resources = await this._scanProjectResources(projectRoot)
      return this._buildRegistryFromResources(resources)

    } catch (error) {
      logger.warn(`[ProjectDiscovery] Registry discovery failed: ${error.message}`)
      return new Map()
    }
  }

  /**
   * 从注册表文件加载资源
   * @param {string} projectRoot - 项目根目录
   * @returns {Promise<Map>} 资源注册表
   */
  async _loadFromRegistry(projectRoot) {
    try {
      const registryPath = path.join(projectRoot, '.promptx', 'resource', 'project.registry.json')
      
      // 检查注册表文件是否存在
      if (!await this._fsExists(registryPath)) {
        return new Map()
      }

      // 读取并解析注册表
      this.registryData = await RegistryData.fromFile('project', registryPath)
      
      // 获取分层级资源映射
      return this.registryData.getResourceMap(true) // 带前缀
      
    } catch (error) {
      logger.warn(`[ProjectDiscovery] Failed to load registry: ${error.message}`)
      return new Map()
    }
  }

  /**
   * 发现项目级资源 (旧版本兼容方法)
   * @returns {Promise<Array>} 发现的资源列表
   */
  async discover() {
    try {
      // 使用新的注册表方法
      const registryMap = await this.discoverRegistry()
      
      // 转换为旧格式
      const resources = []
      for (const [id, reference] of registryMap.entries()) {
        resources.push({
          id: id.replace(/^project:/, ''), // 移除前缀以保持兼容性
          reference: reference
        })
      }

      // 规范化所有资源
      return resources.map(resource => this.normalizeResource(resource))

    } catch (error) {
      logger.warn(`[ProjectDiscovery] Discovery failed: ${error.message}`)
      return []
    }
  }

  /**
   * 从资源列表构建注册表
   * @param {Array} resources - 资源列表
   * @returns {Map} 资源注册表 Map<resourceId, reference>
   */
  _buildRegistryFromResources(resources) {
    const registry = new Map()

    for (const resource of resources) {
      if (resource.id && resource.reference) {
        registry.set(resource.id, resource.reference)
      }
    }

    return registry
  }

  /**
   * 查找项目根目录
   * @deprecated 使用 DirectoryService.getProjectRoot() 替代
   * @returns {Promise<string>} 项目根目录路径
   */
  async _findProjectRoot() {
    // 使用新的统一目录服务
    const { getDirectoryService } = require('../../../utils/DirectoryService')
    const directoryService = getDirectoryService()
    
    return await directoryService.getProjectRoot()
  }

  /**
   * 检查.promptx目录是否存在
   * @param {string} projectRoot - 项目根目录
   * @returns {Promise<boolean>} 是否存在.promptx/resource目录
   */
  async _checkPrompxDirectory(projectRoot) {
    const promptxResourcePath = path.join(projectRoot, '.promptx', 'resource')
    return await this._fsExists(promptxResourcePath)
  }

  /**
   * 扫描项目资源
   * @param {string} projectRoot - 项目根目录
   * @returns {Promise<Array>} 扫描发现的资源列表
   */
  async _scanProjectResources(projectRoot) {
    try {
      const resourcesDir = path.join(projectRoot, '.promptx', 'resource')
      const resources = []

      // 定义要扫描的资源类型
      const resourceTypes = ['role', 'execution', 'thought', 'knowledge']

      // 并行扫描所有资源类型
      for (const resourceType of resourceTypes) {
        try {
          const files = await this.fileScanner.scanResourceFiles(resourcesDir, resourceType)
          
          for (const filePath of files) {
            // 验证文件内容
            const isValid = await this._validateResourceFile(filePath, resourceType)
            if (!isValid) {
              continue
            }

            const suffix = `.${resourceType}.md`
            const id = this._extractResourceId(filePath, resourceType, suffix)
            const reference = this._generateProjectReference(filePath, projectRoot)

            resources.push({
              id: id,
              reference: reference
            })
          }
        } catch (error) {
          logger.warn(`[ProjectDiscovery] Failed to scan ${resourceType} resources: ${error.message}`)
        }
      }

      return resources
    } catch (error) {
      logger.warn(`[ProjectDiscovery] Failed to scan project resources: ${error.message}`)
      return []
    }
  }

  /**
   * 文件扫描（可以被测试mock）
   * @param {string} baseDir - 基础目录
   * @param {string} resourceType - 资源类型
   * @returns {Promise<Array>} 匹配的文件路径列表
   */
  async _scanFiles(baseDir, resourceType) {
    return await this.fileScanner.scanResourceFiles(baseDir, resourceType)
  }

  /**
   * 文件系统存在性检查（可以被测试mock）
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 文件是否存在
   */
  async _fsExists(filePath) {
    return await fs.pathExists(filePath)
  }

  /**
   * 读取文件内容（可以被测试mock）
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件内容
   */
  async _readFile(filePath) {
    return await fs.readFile(filePath, 'utf8')
  }

  /**
   * 验证资源文件格式
   * @param {string} filePath - 文件路径
   * @param {string} protocol - 协议类型
   * @returns {Promise<boolean>} 是否是有效的资源文件
   */
  async _validateResourceFile(filePath, protocol) {
    try {
      const content = await this._readFile(filePath)

      if (!content || typeof content !== 'string') {
        return false
      }

      const trimmedContent = content.trim()
      if (trimmedContent.length === 0) {
        return false
      }

      // 根据协议类型验证DPML标签
      switch (protocol) {
        case 'role':
          return trimmedContent.includes('<role>') && trimmedContent.includes('</role>')
        case 'execution':
          return trimmedContent.includes('<execution>') && trimmedContent.includes('</execution>')
        case 'thought':
          return trimmedContent.includes('<thought>') && trimmedContent.includes('</thought>')
        case 'knowledge':
          // knowledge类型比较灵活，只要文件有内容就认为是有效的
          // 可以是纯文本、链接、图片等任何形式的知识内容
          return true
        default:
          return false
      }
    } catch (error) {
      logger.warn(`[ProjectDiscovery] Failed to validate ${filePath}: ${error.message}`)
      return false
    }
  }

  /**
   * 生成项目引用路径
   * @param {string} filePath - 文件绝对路径
   * @param {string} projectRoot - 项目根目录
   * @returns {string} @project://相对路径
   */
  _generateProjectReference(filePath, projectRoot) {
    const relativePath = this.fileScanner.getRelativePath(projectRoot, filePath)
    return `@project://${relativePath}`
  }

  /**
   * 提取资源ID
   * @param {string} filePath - 文件路径
   * @param {string} protocol - 协议类型
   * @param {string} suffix - 文件后缀
   * @returns {string} 资源ID (对于role类型返回resourceName，对于其他类型返回protocol:resourceName)
   */
  _extractResourceId(filePath, protocol, suffix) {
    const fileName = path.basename(filePath, suffix)
    
    // role类型不需要前缀，其他类型需要前缀
    if (protocol === 'role') {
      return fileName
    } else {
      return `${protocol}:${fileName}`
    }
  }

  /**
   * 生成项目级注册表文件
   * @param {string} projectRoot - 项目根目录
   * @returns {Promise<RegistryData>} 生成的注册表数据
   */
  async generateRegistry(projectRoot) {
    const registryPath = path.join(projectRoot, '.promptx', 'resource', 'project.registry.json')
    const registryData = RegistryData.createEmpty('project', registryPath)
    
    // 扫描.promptx/resource目录
    const resourcesDir = path.join(projectRoot, '.promptx', 'resource')
    
    if (await this._fsExists(resourcesDir)) {
      await this._scanDirectory(resourcesDir, registryData)
    }
    
    // 保存注册表文件
    await registryData.save()
    
    logger.info(`[ProjectDiscovery] ✅ 项目注册表生成完成，发现 ${registryData.size} 个资源`)
    return registryData
  }

  /**
   * 扫描目录并添加资源到注册表
   * @param {string} resourcesDir - 资源目录
   * @param {RegistryData} registryData - 注册表数据
   * @private
   */
  async _scanDirectory(resourcesDir, registryData) {
    // 扫描domain目录
    const domainDir = path.join(resourcesDir, 'domain')
    if (await this._fsExists(domainDir)) {
      await this._scanDomainDirectory(domainDir, registryData)
    }
  }

  /**
   * 扫描domain目录（项目角色资源）
   * @param {string} domainDir - domain目录路径
   * @param {RegistryData} registryData - 注册表数据
   * @private
   */
  async _scanDomainDirectory(domainDir, registryData) {
    const items = await fs.readdir(domainDir)
    
    for (const item of items) {
      const itemPath = path.join(domainDir, item)
      const stat = await fs.stat(itemPath)
      
      if (stat.isDirectory()) {
        // 查找role文件
        const roleFile = path.join(itemPath, `${item}.role.md`)
        if (await this._fsExists(roleFile)) {
          const reference = `@project://.promptx/resource/domain/${item}/${item}.role.md`
          
          const resourceData = new ResourceData({
            id: item,
            source: 'project',
            protocol: 'role',
            name: ResourceData._generateDefaultName(item, 'role'),
            description: ResourceData._generateDefaultDescription(item, 'role'),
            reference: reference,
            metadata: {
              scannedAt: new Date().toISOString()
            }
          })
          
          registryData.addResource(resourceData)
        }
        
        // 查找thought文件
        const thoughtDir = path.join(itemPath, 'thought')
        if (await this._fsExists(thoughtDir)) {
          const thoughtFiles = await fs.readdir(thoughtDir)
          for (const thoughtFile of thoughtFiles) {
            if (thoughtFile.endsWith('.thought.md')) {
              const thoughtId = path.basename(thoughtFile, '.thought.md')
              const reference = `@project://.promptx/resource/domain/${item}/thought/${thoughtFile}`
              
              const resourceData = new ResourceData({
                id: thoughtId,
                source: 'project',
                protocol: 'thought',
                name: ResourceData._generateDefaultName(thoughtId, 'thought'),
                description: ResourceData._generateDefaultDescription(thoughtId, 'thought'),
                reference: reference,
                metadata: {
                  scannedAt: new Date().toISOString()
                }
              })
              
              registryData.addResource(resourceData)
            }
          }
        }
        
        // 查找execution文件
        const executionDir = path.join(itemPath, 'execution')
        if (await this._fsExists(executionDir)) {
          const executionFiles = await fs.readdir(executionDir)
          for (const execFile of executionFiles) {
            if (execFile.endsWith('.execution.md')) {
              const execId = path.basename(execFile, '.execution.md')
              const reference = `@project://.promptx/resource/domain/${item}/execution/${execFile}`
              
              const resourceData = new ResourceData({
                id: execId,
                source: 'project',
                protocol: 'execution',
                name: ResourceData._generateDefaultName(execId, 'execution'),
                description: ResourceData._generateDefaultDescription(execId, 'execution'),
                reference: reference,
                metadata: {
                  scannedAt: new Date().toISOString()
                }
              })
              
              registryData.addResource(resourceData)
            }
          }
        }
        
        // 查找knowledge文件
        const knowledgeDir = path.join(itemPath, 'knowledge')
        if (await this._fsExists(knowledgeDir)) {
          const knowledgeFiles = await fs.readdir(knowledgeDir)
          for (const knowledgeFile of knowledgeFiles) {
            if (knowledgeFile.endsWith('.knowledge.md')) {
              const knowledgeId = path.basename(knowledgeFile, '.knowledge.md')
              const reference = `@project://.promptx/resource/domain/${item}/knowledge/${knowledgeFile}`
              
              const resourceData = new ResourceData({
                id: knowledgeId,
                source: 'project',
                protocol: 'knowledge',
                name: ResourceData._generateDefaultName(knowledgeId, 'knowledge'),
                description: ResourceData._generateDefaultDescription(knowledgeId, 'knowledge'),
                reference: reference,
                metadata: {
                  scannedAt: new Date().toISOString()
                }
              })
              
              registryData.addResource(resourceData)
            }
          }
        }
      }
    }
  }

  /**
   * 获取RegistryData对象（新架构方法）
   * @returns {Promise<RegistryData>} 项目级RegistryData对象
   */
  async getRegistryData() {
    try {
      const projectRoot = await this._findProjectRoot()
      const registryPath = path.join(projectRoot, '.promptx', 'resource', 'project.registry.json')
      
      // 尝试加载现有的注册表文件
      if (await this._fsExists(registryPath)) {
        const registryData = await RegistryData.fromFile('project', registryPath)
        
        // 检查注册表是否有效（有完整的资源数据）
        if (registryData.size > 0 && registryData.resources.length > 0) {
          const firstResource = registryData.resources[0]
          if (firstResource.id && firstResource.protocol && firstResource.reference) {
            logger.info(`[ProjectDiscovery] 📋 从注册表加载 ${registryData.size} 个资源`)
            return registryData
          }
        }
        
        // 如果注册表无效，重新生成
        logger.info(`[ProjectDiscovery] 📋 项目注册表无效，重新生成`)
        return await this.generateRegistry(projectRoot)
      } else {
        // 如果没有注册表文件，生成新的
        logger.info(`[ProjectDiscovery] 📋 项目注册表不存在，生成新注册表`)
        return await this.generateRegistry(projectRoot)
      }
    } catch (error) {
      logger.warn(`[ProjectDiscovery] Failed to load RegistryData: ${error.message}`)
      // 返回空的RegistryData
      return RegistryData.createEmpty('project', null)
    }
  }
}

module.exports = ProjectDiscovery