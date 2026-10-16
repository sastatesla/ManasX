import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { detectNamingStyle, isCamelCase, isPascalCase, isSnakeCase, isKebabCase, isUpperCase } from '../utils/namingUtils.js';

export default class PatternLearner {
  constructor() {
    this.patterns = {
      naming: {
        variables: { camelCase: 0, snake_case: 0, PascalCase: 0 },
        functions: { camelCase: 0, snake_case: 0, PascalCase: 0 },
        constants: { UPPER_CASE: 0, camelCase: 0, PascalCase: 0 },
        files: { camelCase: 0, kebab_case: 0, snake_case: 0, PascalCase: 0 },
        prefixes: new Map(),
        suffixes: new Map()
      },
      imports: {
        style: { relative: 0, absolute: 0 },
        extensions: { explicit: 0, implicit: 0 },
        grouping: { separated: 0, mixed: 0 },
        libraries: new Map(),
        internalPaths: new Set()
      },
      architecture: {
        folderStructure: new Map(),
        folderPatterns: new Map(),
        fileRoles: new Map(),
        patternsDetected: { isEventDriven: false, isRCSR: false, isModular: false },
        fileTypes: new Map(),
        componentPatterns: new Map(),
        exportStyles: { named: 0, default: 0, mixed: 0 }
      },
      testing: {
        fileNaming: { spec: 0, test: 0 },
        location: { colocated: 0, separate: 0 },
        framework: new Map(),
        assertionStyles: new Map()
      },
      comments: {
        style: { single: 0, multi: 0, jsdoc: 0 },
        density: { high: 0, medium: 0, low: 0, none: 0 }
      }
    };
  }

  async learnFromDirectory(directory, options = {}) {
    const {
      extensions = ['.js', '.ts', '.jsx', '.tsx'],
      ignorePatterns = ['node_modules', '.git', 'dist', 'build'],
      maxFiles = 1000
    } = options;

    logger.info(`Learning patterns from ${directory}...`);
    
    try {
      const files = await this.findCodeFiles(directory, extensions, ignorePatterns, maxFiles);
      logger.info(`Found ${files.length} files to analyze`);

      let processed = 0;
      for (const filePath of files) {
        await this.analyzeFile(filePath, directory);
        processed++;
        
        if (processed % 50 === 0) {
          logger.info(`Processed ${processed}/${files.length} files...`);
        }
      }

      const learnedPatterns = this.consolidatePatterns();
      logger.info('Pattern learning completed successfully');
      
      return learnedPatterns;
    } catch (error) {
      logger.error('Error learning patterns:', error.message);
      throw error;
    }
  }

  async findCodeFiles(directory, extensions, ignorePatterns, maxFiles) {
    const files = [];
    const stack = [directory];

    while (stack.length > 0 && files.length < maxFiles) {
      const currentDir = stack.pop();
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            const shouldIgnore = ignorePatterns.some(pattern => 
              entry.name.includes(pattern) || fullPath.includes(pattern)
            );
            
            if (!shouldIgnore) {
              stack.push(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn(`Skipping directory ${currentDir}: ${error.message}`);
      }
    }

    return files;
  }

  async analyzeFile(filePath, rootDirectory) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(rootDirectory, filePath);
      
      this.analyzeNamingPatterns(content, filePath);
      this.analyzeImportPatterns(content, relativePath);
      this.analyzeArchitecturePatterns(filePath, relativePath);
      this.analyzeTestingPatterns(content, filePath);
      this.analyzeCommentPatterns(content);
      
    } catch (error) {
      logger.warn(`Error analyzing ${filePath}: ${error.message}`);
    }
  }

  analyzeNamingPatterns(content, filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    if (this.isCamelCase(fileName)) this.patterns.naming.files.camelCase++;
    else if (this.isKebabCase(fileName)) this.patterns.naming.files.kebab_case++;
    else if (this.isSnakeCase(fileName)) this.patterns.naming.files.snake_case++;
    else if (this.isPascalCase(fileName)) this.patterns.naming.files.PascalCase++;

    const variableMatches = content.match(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    const functionMatches = content.match(/(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\()/g) || [];

    variableMatches.forEach(match => {
      const parts = match.split(/\s+/);
      const keyword = parts[0];
      const varName = parts[1];
      if (!varName) return;

      // Handle UPPER_CASE constants
      if (keyword === 'const' && this.isUpperCase(varName)) {
        this.patterns.naming.constants.UPPER_CASE++;
        return;
      }

      if (this.isCamelCase(varName)) this.patterns.naming.variables.camelCase++;
      else if (this.isSnakeCase(varName)) this.patterns.naming.variables.snake_case++;
      else if (this.isPascalCase(varName)) this.patterns.naming.variables.PascalCase++;
      else if (this.isUpperCase(varName)) this.patterns.naming.constants.UPPER_CASE++;
    });

    functionMatches.forEach(match => {
      const funcName = match.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.[1];
      if (funcName) {
        if (this.isCamelCase(funcName)) this.patterns.naming.functions.camelCase++;
        else if (this.isSnakeCase(funcName)) this.patterns.naming.functions.snake_case++;
        else if (this.isPascalCase(funcName)) this.patterns.naming.functions.PascalCase++;
      }
    });

    const constantMatches = content.match(/const\s+([A-Z][A-Z0-9_]*)\s*=/g) || [];
    constantMatches.forEach(() => this.patterns.naming.constants.UPPER_CASE++);
  }

  analyzeImportPatterns(content, relativePath) {
    const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g) || [];
    
    importMatches.forEach(importStatement => {
      const pathMatch = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/);
      if (pathMatch) {
        const importPath = pathMatch[1];
        
        if (importPath.startsWith('.')) {
          this.patterns.imports.style.relative++;
        } else {
          this.patterns.imports.style.absolute++;
          
          const libName = importPath.split('/')[0];
          this.patterns.imports.libraries.set(
            libName, 
            (this.patterns.imports.libraries.get(libName) || 0) + 1
          );

          if (['bullmq', 'bull', 'kafkajs', 'amqplib', 'rabbitmq', 'redis', 'ioredis'].includes(libName)) {
            this.patterns.architecture.patternsDetected.isEventDriven = true;
          }
        }

        if (path.extname(importPath)) {
          this.patterns.imports.extensions.explicit++;
        } else {
          this.patterns.imports.extensions.implicit++;
        }
      }
    });

    const namedExports = (content.match(/export\s+(?:const|let|var|function|class)/g) || []).length;
    const defaultExports = (content.match(/export\s+default/g) || []).length;
    
    if (namedExports > 0 && defaultExports > 0) this.patterns.architecture.exportStyles.mixed++;
    else if (namedExports > 0) this.patterns.architecture.exportStyles.named++;
    else if (defaultExports > 0) this.patterns.architecture.exportStyles.default++;
  }

  analyzeArchitecturePatterns(filePath, relativePath) {
    const normalized = relativePath.split(path.sep).join('/');
    const pathParts = normalized.split('/');
    const fileExt = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    if (pathParts.length > 1) {
      const folderPath = pathParts.slice(0, -1).join('/');
      this.patterns.architecture.folderStructure.set(
        folderPath,
        (this.patterns.architecture.folderStructure.get(folderPath) || 0) + 1
      );

      const topFolder = pathParts[0] === 'src' && pathParts.length > 2 ? pathParts[1] : pathParts[0];
      const patternKey = `${topFolder}/*`;
      this.patterns.architecture.folderPatterns.set(
        patternKey,
        (this.patterns.architecture.folderPatterns.get(patternKey) || 0) + 1
      );

      if (topFolder === 'modules') {
        this.patterns.architecture.patternsDetected.isModular = true;
      }
      if (topFolder === 'system' || folderPath.includes('jobs') || folderPath.includes('mailers') || folderPath.includes('queues') || folderPath.includes('events')) {
        this.patterns.architecture.patternsDetected.isEventDriven = true;
      }
    }

    // Detect RCSR / Component Roles (e.g. .service.js, .controller.js, .routes.js, .model.js, .repository.js, .job.js)
    const roleMatch = fileName.match(/\.([a-zA-Z0-9_-]+)\.(?:js|ts|jsx|tsx)$/);
    if (roleMatch) {
      const role = roleMatch[1].toLowerCase();
      this.patterns.architecture.fileRoles.set(
        role,
        (this.patterns.architecture.fileRoles.get(role) || 0) + 1
      );

      if (['service', 'controller', 'routes', 'route', 'repository', 'repo', 'model', 'schema'].includes(role)) {
        this.patterns.architecture.patternsDetected.isRCSR = true;
      }
      if (['job', 'worker', 'queue', 'listener', 'event', 'mailer'].includes(role)) {
        this.patterns.architecture.patternsDetected.isEventDriven = true;
      }
    }

    this.patterns.architecture.fileTypes.set(
      fileExt,
      (this.patterns.architecture.fileTypes.get(fileExt) || 0) + 1
    );
  }

  analyzeTestingPatterns(content, filePath) {
    const fileName = path.basename(filePath);
    const isTestFile = fileName.includes('.test.') || fileName.includes('.spec.') || 
                      fileName.endsWith('Test.js') || fileName.endsWith('Spec.js');

    if (isTestFile) {
      if (fileName.includes('.spec.')) this.patterns.testing.fileNaming.spec++;
      if (fileName.includes('.test.')) this.patterns.testing.fileNaming.test++;

      if (content.includes('describe(') || content.includes('it(')) {
        this.patterns.testing.framework.set('jest/mocha', 
          (this.patterns.testing.framework.get('jest/mocha') || 0) + 1);
      }
      if (content.includes('test(')) {
        this.patterns.testing.framework.set('jest', 
          (this.patterns.testing.framework.get('jest') || 0) + 1);
      }
    }
  }

  analyzeCommentPatterns(content) {
    const singleLineComments = (content.match(/\/\/.*$/gm) || []).length;
    const multiLineComments = (content.match(/\/\*[\s\S]*?\*\//g) || []).length;
    const jsdocComments = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;

    this.patterns.comments.style.single += singleLineComments;
    this.patterns.comments.style.multi += multiLineComments;
    this.patterns.comments.style.jsdoc += jsdocComments;

    const lines = content.split('\n').length;
    const totalComments = singleLineComments + multiLineComments + jsdocComments;
    const density = totalComments / lines;

    if (density > 0.2) this.patterns.comments.density.high++;
    else if (density > 0.1) this.patterns.comments.density.medium++;
    else if (density > 0.05) this.patterns.comments.density.low++;
    else this.patterns.comments.density.none++;
  }

  serializePatterns(patterns) {
    return {
      naming: {
        variables: patterns.naming.variables,
        functions: patterns.naming.functions,
        constants: patterns.naming.constants,
        files: patterns.naming.files,
        prefixes: Object.fromEntries(patterns.naming.prefixes.entries()),
        suffixes: Object.fromEntries(patterns.naming.suffixes.entries())
      },
      imports: {
        style: patterns.imports.style,
        extensions: patterns.imports.extensions,
        grouping: patterns.imports.grouping,
        libraries: Object.fromEntries(patterns.imports.libraries.entries()),
        internalPaths: Array.from(patterns.imports.internalPaths)
      },
      architecture: {
        folderStructure: Object.fromEntries(patterns.architecture.folderStructure.entries()),
        folderPatterns: Object.fromEntries(patterns.architecture.folderPatterns.entries()),
        fileRoles: Object.fromEntries(patterns.architecture.fileRoles.entries()),
        patternsDetected: patterns.architecture.patternsDetected,
        fileTypes: Object.fromEntries(patterns.architecture.fileTypes.entries()),
        componentPatterns: Object.fromEntries(patterns.architecture.componentPatterns.entries()),
        exportStyles: patterns.architecture.exportStyles
      },
      testing: {
        fileNaming: patterns.testing.fileNaming,
        location: patterns.testing.location,
        framework: Object.fromEntries(patterns.testing.framework.entries()),
        assertionStyles: Object.fromEntries(patterns.testing.assertionStyles.entries())
      },
      comments: patterns.comments
    };
  }

  consolidatePatterns() {
    return {
      timestamp: new Date().toISOString(),
      confidence: this.calculateConfidence(),
      recommendations: {
        naming: this.getNamingRecommendations(),
        imports: this.getImportRecommendations(),
        architecture: this.getArchitectureRecommendations(),
        testing: this.getTestingRecommendations(),
        comments: this.getCommentRecommendations()
      },
      rawPatterns: this.serializePatterns(this.patterns)
    };
  }

  calculateConfidence() {
    const totalFiles = Array.from(this.patterns.architecture.fileTypes.values())
      .reduce((sum, count) => sum + count, 0);
    
    if (totalFiles < 10) return 'low';
    if (totalFiles < 50) return 'medium';
    return 'high';
  }

  getNamingRecommendations() {
    return {
      variables: this.getMostCommon(this.patterns.naming.variables),
      functions: this.getMostCommon(this.patterns.naming.functions),
      constants: this.getMostCommon(this.patterns.naming.constants),
      files: this.getMostCommon(this.patterns.naming.files)
    };
  }

  getImportRecommendations() {
    return {
      style: this.getMostCommon(this.patterns.imports.style),
      extensions: this.getMostCommon(this.patterns.imports.extensions),
      popularLibraries: Array.from(this.patterns.imports.libraries.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([lib]) => lib)
    };
  }

  getArchitectureRecommendations() {
    const isModular = this.patterns.architecture.patternsDetected.isModular;
    const isRCSR = this.patterns.architecture.patternsDetected.isRCSR;
    const isEventDriven = this.patterns.architecture.patternsDetected.isEventDriven;

    let style = 'standard';
    if (isModular && isRCSR && isEventDriven) {
      style = 'event-driven-modular-rcsr';
    } else if (isModular && isRCSR) {
      style = 'modular-rcsr';
    } else if (isRCSR) {
      style = 'layered-rcsr';
    } else if (isEventDriven) {
      style = 'event-driven';
    } else if (isModular) {
      style = 'modular';
    }

    const detectedRoles = Array.from(this.patterns.architecture.fileRoles.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([role]) => role);

    const conventions = [];
    if (isModular) {
      conventions.push('Modular Feature Folders: modules/<feature>/');
    }
    if (isRCSR) {
      conventions.push(`RCSR Components: <feature>.{${detectedRoles.slice(0, 4).join(',')}}.js`);
    }
    if (isEventDriven) {
      conventions.push('Event-Driven Background Processing: system/jobs/ or workers/ (BullMQ/Queues)');
    }

    const folderPatterns = Array.from(this.patterns.architecture.folderPatterns.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([pattern]) => pattern);

    return {
      style,
      isEventDriven,
      hasRCSR: isRCSR,
      isModular,
      roleSuffixes: detectedRoles,
      conventions,
      folderPatterns,
      exportStyle: this.getMostCommon(this.patterns.architecture.exportStyles),
      commonFolders: Array.from(this.patterns.architecture.folderStructure.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([folder]) => folder)
    };
  }

  getTestingRecommendations() {
    return {
      fileNaming: this.getMostCommon(this.patterns.testing.fileNaming),
      framework: this.getMostCommonFromMap(this.patterns.testing.framework)
    };
  }

  getCommentRecommendations() {
    return {
      style: this.getMostCommon(this.patterns.comments.style),
      density: this.getMostCommon(this.patterns.comments.density)
    };
  }

  getMostCommon(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    return entries.reduce((max, current) => current[1] > max[1] ? current : max)[0];
  }

  getMostCommonFromMap(map) {
    if (map.size === 0) return null;
    return Array.from(map.entries()).reduce((max, current) => current[1] > max[1] ? current : max)[0];
  }

  isCamelCase(str) {
    return isCamelCase(str);
  }

  isSnakeCase(str) {
    return isSnakeCase(str);
  }

  isPascalCase(str) {
    return isPascalCase(str);
  }

  isKebabCase(str) {
    return isKebabCase(str);
  }

  isUpperCase(str) {
    return isUpperCase(str);
  }

  async savePatterns(patterns, filePath) {
    try {
      await fs.writeFile(filePath, JSON.stringify(patterns, null, 2));
      logger.info(`Patterns saved to ${filePath}`);
    } catch (error) {
      logger.error(`Error saving patterns: ${error.message}`);
      throw error;
    }
  }

  async loadPatterns(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`Could not load patterns from ${filePath}: ${error.message}`);
      return null;
    }
  }
}