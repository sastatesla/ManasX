import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { detectNamingStyle } from '../utils/namingUtils.js';

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
        parameters: ruleConfig.parameters || {}
      };
      
      this.rules.set(fullRuleId, rule);
    }
  }

  processExceptions(exceptions) {
    for (const exception of exceptions) {
      const key = `${exception.file || '*'}:${exception.rule || '*'}`;
      this.exceptions.set(key, exception);
    }
  }

  detectNamingStyle(name) {
    return detectNamingStyle(name);
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  followsFeatureFolderStructure(relativePath, learnedPatterns = null) {
    const normalized = relativePath.split(path.sep).join('/');
    const parts = normalized.split('/');

    // Top-level root entry points (e.g., server.js, app.js, index.js) are permitted
    if (parts.length === 1 || (parts[0] === 'src' && parts.length === 2)) {
      const fileName = parts[parts.length - 1];
      if (/^(index|app|server|main|config)\.[a-zA-Z0-9]+$/.test(fileName)) {
        return true;
      }
    }

    // Check learned folder patterns (e.g. "modules/*", "system/*", "utils/*")
    const folderPatterns = learnedPatterns?.recommendations?.architecture?.folderPatterns || [];
    const topFolder = parts[0] === 'src' && parts.length > 2 ? parts[1] : parts[0];

    if (folderPatterns.length > 0) {
      const matches = folderPatterns.some(p => {
        const prefix = p.replace('/*', '');
        return topFolder === prefix || normalized.includes(prefix + '/');
      });
      if (matches) return true;
    }

    // Standard modular, RCSR, event-driven, or feature folder conventions
    const standardFolders = [
      'modules', 'components', 'features', 'system', 'utils', 'jobs', 
      'mailers', 'workers', 'queues', 'events', 'services', 'controllers', 
      'routes', 'models', 'repositories', 'config', 'middleware'
    ];
    if (standardFolders.includes(topFolder)) {
      return true;
    }

    return parts.length >= 2; // At least feature/file.js
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

  async createInitialConfig(filePath = 'manasx-rules.json', patterns = null) {
    if (!patterns) {
      try {
        const pPath = path.join(process.cwd(), 'patterns.json');
        patterns = JSON.parse(await fs.readFile(pPath, 'utf-8'));
      } catch (e) {
        // patterns not available
      }
    }

    const archRec = patterns?.recommendations?.architecture;
    const isCompanyFetchUsed = patterns?.recommendations?.imports?.popularLibraries?.includes('companyFetch');

    const config = {
      metadata: {
        version: '1.0.0',
        name: 'Project Code Governance Rules',
        description: archRec?.style 
          ? `Organizational rules tuned for ${archRec.style} architecture`
          : 'Organizational rules for maintaining code quality and consistency',
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
              enabled: isCompanyFetchUsed ? true : false,
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
              enabled: true
            }
          }
        },
        architecture: {
          enabled: true,
          description: 'Architectural rules for code organization',
          rules: {
            'feature-folder-structure': {
              name: archRec?.style ? `Follow ${archRec.style} folder structure` : 'Use feature folder structure',
              description: archRec?.conventions?.length 
                ? archRec.conventions.join('; ')
                : 'Code should be organized by features or modular roles, not placed flat at root',
              severity: 'medium',
              enabled: true
            }
          }
        },
        naming: {
          enabled: true,
          description: 'Naming convention rules',
          rules: {
            'camelcase-variables': {
              name: 'Use camelCase for variables',
              description: 'Variables should follow camelCase naming convention (UPPER_CASE permitted for constants)',
              severity: 'low',
              enabled: patterns?.recommendations?.naming?.variables === 'camelCase' || true
            }
          }
        }
      },
      exceptions: []
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
      logger.info(`Initial configuration created at ${filePath}`);
      return config;
    } catch (error) {
      logger.error(`Error creating configuration: ${error.message}`);
      throw error;
    }
  }

  async validateRules() {
    const errors = [];
    const warnings = [];

    for (const [ruleId, rule] of this.rules) {
      if (!rule.name || !rule.description) {
        warnings.push(`Rule ${ruleId} is missing name or description`);
      }

      if (!['low', 'medium', 'high', 'critical'].includes(rule.severity)) {
        errors.push(`Rule ${ruleId} has invalid severity: ${rule.severity}`);
      }
    }

    return { errors, warnings };
  }

  getRuleById(ruleId) {
    return this.rules.get(ruleId);
  }

  getRulesByCategory(category) {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  isRuleEnabled(ruleId) {
    const rule = this.rules.get(ruleId);
    return rule && rule.enabled;
  }

  hasException(filePath, ruleId) {
    const keys = [
      `${filePath}:${ruleId}`,
      `${filePath}:*`,
      `*:${ruleId}`,
      '*:*'
    ];

    return keys.some(key => this.exceptions.has(key));
  }

  async applyRules(filePath, content, learnedPatterns = null) {
    const violations = [];
    const relativePath = path.relative(process.cwd(), filePath);

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled || this.hasException(relativePath, ruleId)) {
        continue;
      }

      try {
        const ruleViolations = await this.executeRule(rule, filePath, content, learnedPatterns);
        violations.push(...ruleViolations);
      } catch (error) {
        logger.warn(`Error executing rule ${ruleId}: ${error.message}`);
      }
    }

    return violations;
  }

  async executeRule(rule, filePath, content, learnedPatterns) {
    const violations = [];
    const relativePath = path.relative(process.cwd(), filePath);

    switch (rule.id) {
      case 'security/no-eval':
        if (content.includes('eval(')) {
          violations.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.parameters?.message || 'eval() usage is prohibited for security reasons',
            file: relativePath,
            line: this.getLineNumber(content, content.indexOf('eval(')),
            category: rule.category
          });
        }
        break;

      case 'security/no-dangerous-html':
        const dangerousPatterns = ['innerHTML', 'outerHTML'];
        for (const pattern of dangerousPatterns) {
          if (content.includes(pattern)) {
            violations.push({
              ruleId: rule.id,
              severity: rule.severity,
              message: `Direct ${pattern} manipulation can lead to XSS vulnerabilities`,
              file: relativePath,
              line: this.getLineNumber(content, content.indexOf(pattern)),
              category: rule.category
            });
          }
        }
        break;

      case 'security/require-company-fetch':
        if (content.includes('fetch(') && !content.includes(rule.parameters?.wrapperName || 'companyFetch')) {
          violations.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Use ${rule.parameters?.wrapperName || 'companyFetch'} instead of raw fetch()`,
            file: relativePath,
            line: this.getLineNumber(content, content.indexOf('fetch(')),
            category: rule.category
          });
        }
        break;

      case 'performance/no-sync-fs':
        const syncFsPatterns = ['readFileSync', 'writeFileSync', 'statSync'];
        for (const pattern of syncFsPatterns) {
          if (content.includes(pattern)) {
            violations.push({
              ruleId: rule.id,
              severity: rule.severity,
              message: `Avoid synchronous file operation: ${pattern}`,
              file: relativePath,
              line: this.getLineNumber(content, content.indexOf(pattern)),
              category: rule.category
            });
          }
        }
        break;

      case 'architecture/feature-folder-structure':
        if (!this.followsFeatureFolderStructure(relativePath, learnedPatterns)) {
          violations.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: 'File should be organized within a feature module or established folder structure',
            file: relativePath,
            line: 1,
            category: rule.category
          });
        }
        break;

      case 'naming/camelcase-variables':
        if (learnedPatterns?.recommendations?.naming?.variables === 'camelCase' || !learnedPatterns) {
          const varRegex = /\b(let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
          let m;
          const reported = new Set();
          while ((m = varRegex.exec(content)) !== null) {
            const keyword = m[1];
            const varName = m[2];
            const style = this.detectNamingStyle(varName);

            // Permit UPPER_CASE constants for 'const' declarations (e.g. const ETSY = ..., const PORT = 3000)
            if (keyword === 'const' && style === 'UPPER_CASE') {
              continue;
            }

            if (style !== 'camelCase') {
              const line = this.getLineNumber(content, m.index);
              const key = `${line}:${varName}`;
              if (!reported.has(key)) {
                reported.add(key);
                violations.push({
                  ruleId: rule.id,
                  severity: rule.severity,
                  message: `Variable '${varName}' should use camelCase naming`,
                  file: relativePath,
                  line: line,
                  category: rule.category
                });
              }
            }
          }
        }
        break;
    }

    return violations;
  }
}
