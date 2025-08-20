import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

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
      const varName = match.split(/\s+/)[1];
      if (this.isCamelCase(varName)) this.patterns.naming.variables.camelCase++;
      else if (this.isSnakeCase(varName)) this.patterns.naming.variables.snake_case++;
      else if (this.isPascalCase(varName)) this.patterns.naming.variables.PascalCase++;
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
    const pathParts = relativePath.split(path.sep);
    const fileExt = path.extname(filePath);
    
    if (pathParts.length > 1) {
      const folderPath = pathParts.slice(0, -1).join('/');
      this.patterns.architecture.folderStructure.set(
        folderPath,
        (this.patterns.architecture.folderStructure.get(folderPath) || 0) + 1
      );
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
      rawPatterns: this.patterns
    };
  }

  calculateConfidence() {
    const totalFiles = Object.values(this.patterns.architecture.fileTypes)
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
    return {
      exportStyle: this.getMostCommon(this.patterns.architecture.exportStyles),
      commonFolders: Array.from(this.patterns.architecture.folderStructure.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
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
    return /^[a-z][a-zA-Z0-9]*$/.test(str) && /[A-Z]/.test(str);
  }

  isSnakeCase(str) {
    return /^[a-z][a-z0-9_]*$/.test(str) && str.includes('_');
  }

  isPascalCase(str) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
  }

  isKebabCase(str) {
    return /^[a-z][a-z0-9-]*$/.test(str) && str.includes('-');
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