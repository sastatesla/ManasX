import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export default class RuleEngine {
  constructor() {
    this.rules = new Map();
    this.exceptions = new Map();
    this.ruleHistory = [];
  }

  async loadRules(configPath = 'manasx-rules.json') {
    try {
      const resolvedPath = await this.findConfigFile(configPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const config = JSON.parse(content);
      
      this.validateConfiguration(config);
      await this.processConfiguration(config);
      
      logger.info(`Rules loaded from ${resolvedPath}`);
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`No rule configuration found at ${configPath}. Using default rules.`);
        return this.getDefaultConfiguration();
      }
      logger.error(`Error loading rules: ${error.message}`);
      throw error;
    }
  }

  async findConfigFile(fileName) {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, fileName);
      
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    throw new Error(`Configuration file ${fileName} not found`);
  }

  validateConfiguration(config) {
    const requiredSections = ['metadata', 'rules'];
    const requiredMetadata = ['version', 'name'];
    
    for (const section of requiredSections) {
      if (!config[section]) {
        throw new Error(`Missing required section: ${section}`);
      }
    }
    
    for (const field of requiredMetadata) {
      if (!config.metadata[field]) {
        throw new Error(`Missing required metadata field: ${field}`);
      }
    }
    
    const validCategories = ['security', 'performance', 'architecture', 'naming', 'imports', 'testing', 'comments'];
    const ruleCategories = Object.keys(config.rules);
    
    for (const category of ruleCategories) {
      if (!validCategories.includes(category)) {
        logger.warn(`Unknown rule category: ${category}`);
      }
    }
  }

  async processConfiguration(config) {
    this.metadata = config.metadata;
    this.globalSettings = config.global || {};
    
    for (const [category, categoryRules] of Object.entries(config.rules)) {
      this.processRuleCategory(category, categoryRules);
    }
    
    if (config.exceptions) {
      this.processExceptions(config.exceptions);
    }
    
    this.ruleHistory.push({
      timestamp: new Date().toISOString(),
      version: config.metadata.version,
      rulesCount: this.rules.size
    });
  }

  processRuleCategory(category, categoryRules) {
    if (!categoryRules.enabled) {
      logger.info(`Category ${category} is disabled`);
      return;
    }
    
    for (const [ruleId, ruleConfig] of Object.entries(categoryRules.rules || {})) {
      const fullRuleId = `${category}/${ruleId}`;
      
      const rule = {
        id: fullRuleId,
        category,
        name: ruleConfig.name || ruleId,
        description: ruleConfig.description || '',
        severity: ruleConfig.severity || 'medium',
        enabled: ruleConfig.enabled !== false,
        parameters: ruleConfig.parameters || {},
  }

  detectNamingStyle(name) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
    if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake_case';
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'UPPER_CASE';
    return 'unknown';
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  followsFeatureFolderStructure(relativePath) {
    const pathParts = relativePath.split('/');
    return pathParts.length >= 2; // At least feature/file.js
  }

  getExpectedTestFileName(filePath) {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    return path.join(dir, `${base}.test${ext}`);
  }

  getDefaultConfiguration() {
    return {
      metadata: {
        version: '1.0.0',
        name: 'Default ManasX Rules',
        description: 'Default organizational rules for code governance',
        author: 'ManasX',
        created: new Date().toISOString()
      },
      global: {
        severity: 'medium',
        autofix: false
      },
      rules: {
        security: {
          enabled: true,
          rules: {
            'no-eval': {
              name: 'No eval() usage',
              description: 'Prohibits the use of eval() function',
              severity: 'critical',
              enabled: true
            }
          }
        },
        performance: {
          enabled: true,
          rules: {
            'no-sync-fs': {
              name: 'No synchronous file operations',
              description: 'Prohibits synchronous file system operations',
              severity: 'high',
              enabled: true
            }
          }
        }
      },
      exceptions: []
    };
  }

  async createInitialConfig(filePath = 'manasx-rules.json') {
    const config = {
      metadata: {
        version: '1.0.0',
        name: 'Project Code Governance Rules',
        description: 'Organizational rules for maintaining code quality and consistency',
        author: process.env.USER || 'Team',
        created: new Date().toISOString()
      },
      global: {
        severity: 'medium',
        autofix: false,
        reportUnusedRules: true
      },
      rules: {
        security: {
          enabled: true,
          description: 'Security-related rules to prevent vulnerabilities',
          rules: {
            'no-eval': {
              name: 'Prohibit eval() usage',
              description: 'The eval() function poses security risks and should not be used',
              severity: 'critical',
              enabled: true,
              message: 'eval() usage is prohibited for security reasons'
            },
            'no-dangerous-html': {
              name: 'Avoid dangerous HTML manipulation',
              description: 'Direct innerHTML/outerHTML manipulation can lead to XSS vulnerabilities',
              severity: 'high',
              enabled: true
            },
            'require-company-fetch': {
              name: 'Use company fetch wrapper',
              description: 'All API calls must use the company fetch wrapper instead of raw fetch',
              severity: 'medium',
              enabled: true,
              parameters: {
                wrapperName: 'companyFetch'
              }
            }
          }
        },
        performance: {
          enabled: true,
          description: 'Performance-related rules for optimal code execution',
          rules: {
            'no-sync-fs': {
              name: 'Avoid synchronous file operations',
              description: 'Synchronous file operations block the event loop',
              severity: 'high',
              enabled: true,
