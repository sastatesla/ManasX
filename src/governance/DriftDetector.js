import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export default class DriftDetector {
  constructor(learnedPatterns) {
    this.patterns = learnedPatterns;
    this.severityLevels = {
      CRITICAL: 'critical',
      HIGH: 'high', 
      MEDIUM: 'medium',
      LOW: 'low',
      INFO: 'info'
    };
  }

  async detectDrift(filePath, options = {}) {
    const {
      threshold = 0.7, // Minimum pattern match threshold
      includeInfo = false,
      contextSize = 3 // Lines of context around violations
    } = options;

    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        return await this.analyzeDriftInDirectory(filePath, options);
      } else {
        return await this.analyzeDriftInFile(filePath, threshold, contextSize, includeInfo);
      }
    } catch (error) {
      logger.error(`Error detecting drift in ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async analyzeDriftInDirectory(directory, options) {
    const results = {
      directory,
      timestamp: new Date().toISOString(),
      summary: {
        filesAnalyzed: 0,
        totalViolations: 0,
        criticalViolations: 0,
        highViolations: 0,
        mediumViolations: 0,
        lowViolations: 0,
        overallScore: 0
      },
      files: []
    };

    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    const files = await this.findFiles(directory, extensions);
    
    for (const filePath of files) {
      try {
        const fileResult = await this.analyzeDriftInFile(
          filePath, 
          options.threshold || 0.7, 
          options.contextSize || 3,
          options.includeInfo || false
        );
        
        results.files.push(fileResult);
        results.summary.filesAnalyzed++;
        results.summary.totalViolations += fileResult.violations.length;
        
        fileResult.violations.forEach(violation => {
          switch (violation.severity) {
            case this.severityLevels.CRITICAL:
              results.summary.criticalViolations++;
              break;
            case this.severityLevels.HIGH:
              results.summary.highViolations++;
              break;
            case this.severityLevels.MEDIUM:
              results.summary.mediumViolations++;
              break;
            case this.severityLevels.LOW:
              results.summary.lowViolations++;
              break;
          }
        });
        
      } catch (error) {
        logger.warn(`Skipping ${filePath}: ${error.message}`);
      }
    }

    results.summary.overallScore = this.calculateOverallScore(results.files);
    
    return results;
  }

  async analyzeDriftInFile(filePath, threshold, contextSize, includeInfo) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const result = {
      file: filePath,
      timestamp: new Date().toISOString(),
      complianceScore: 0,
      violations: [],
      patternMatches: {},
      suggestions: []
    };

    await this.analyzeNamingDrift(content, filePath, result, lines);
    await this.analyzeImportDrift(content, filePath, result, lines);
    await this.analyzeArchitectureDrift(filePath, result);
    await this.analyzeCommentDrift(content, result, lines);

    result.complianceScore = this.calculateComplianceScore(result.violations);

    if (!includeInfo) {
      result.violations = result.violations.filter(v => v.severity !== this.severityLevels.INFO);
    }

    result.violations.forEach(violation => {
      violation.context = this.getContext(lines, violation.line, contextSize);
    });

    result.suggestions = this.generateSuggestions(result.violations, result.patternMatches);

    return result;
  }

  analyzeNamingDrift(content, filePath, result, lines) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const recommendations = this.patterns.recommendations?.naming || {};
    
    if (recommendations.files) {
      const expectedStyle = recommendations.files;
      const actualStyle = this.detectNamingStyle(fileName);
      
      if (actualStyle !== expectedStyle && actualStyle !== 'unknown') {
        result.violations.push({
          type: 'naming_drift',
          category: 'file_naming',
          severity: this.severityLevels.MEDIUM,
          line: 1,
          column: 1,
          message: `File naming style '${actualStyle}' differs from project standard '${expectedStyle}'`,
          expected: expectedStyle,
          actual: actualStyle,
          rule: 'consistent_file_naming'
        });
      }
    }

    this.analyzeVariableNaming(content, result, lines, recommendations);
    this.analyzeFunctionNaming(content, result, lines, recommendations);
    this.analyzeConstantNaming(content, result, lines, recommendations);
  }

  analyzeVariableNaming(content, result, lines, recommendations) {
    const expectedStyle = recommendations.variables;
    if (!expectedStyle) return;

    const variableRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const varName = match[1];
      const actualStyle = this.detectNamingStyle(varName);
      const lineNum = this.getLineNumber(content, match.index);
      
      if (actualStyle !== expectedStyle && actualStyle !== 'unknown') {
        result.violations.push({
          type: 'naming_drift',
          category: 'variable_naming',
          severity: this.severityLevels.LOW,
          line: lineNum,
          column: match.index - content.lastIndexOf('\n', match.index),
          message: `Variable '${varName}' uses '${actualStyle}' naming but project standard is '${expectedStyle}'`,
          expected: expectedStyle,
          actual: actualStyle,
          suggestion: this.convertNamingStyle(varName, expectedStyle),
          rule: 'consistent_variable_naming'
        });
      }
    }
  }

  analyzeFunctionNaming(content, result, lines, recommendations) {
    const expectedStyle = recommendations.functions;
    if (!expectedStyle) return;

    const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)))/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      if (!funcName) continue;
      
      const actualStyle = this.detectNamingStyle(funcName);
      const lineNum = this.getLineNumber(content, match.index);
      
      if (actualStyle !== expectedStyle && actualStyle !== 'unknown') {
        result.violations.push({
          type: 'naming_drift',
          category: 'function_naming',
          severity: this.severityLevels.LOW,
          line: lineNum,
          column: match.index - content.lastIndexOf('\n', match.index),
          message: `Function '${funcName}' uses '${actualStyle}' naming but project standard is '${expectedStyle}'`,
          expected: expectedStyle,
          actual: actualStyle,
          suggestion: this.convertNamingStyle(funcName, expectedStyle),
          rule: 'consistent_function_naming'
        });
      }
    }
  }

  analyzeConstantNaming(content, result, lines, recommendations) {
    const expectedStyle = recommendations.constants;
    if (!expectedStyle) return;

    const constantRegex = /const\s+([A-Z][A-Z0-9_]*)\s*=/g;
    let match;
    
    while ((match = constantRegex.exec(content)) !== null) {
      const constName = match[1];
      const actualStyle = this.detectNamingStyle(constName);
      const lineNum = this.getLineNumber(content, match.index);
      
      if (actualStyle !== expectedStyle && expectedStyle === 'UPPER_CASE') {
        result.violations.push({
          type: 'naming_drift', 
          category: 'constant_naming',
          severity: this.severityLevels.LOW,
          line: lineNum,
          column: match.index - content.lastIndexOf('\n', match.index),
          message: `Constant '${constName}' should use ${expectedStyle} naming convention`,
          expected: expectedStyle,
          actual: actualStyle,
          rule: 'consistent_constant_naming'
        });
      }
    }
  }

  analyzeImportDrift(content, filePath, result, lines) {
    const recommendations = this.patterns.recommendations?.imports || {};
    
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      
      if (recommendations.style) {
        const isRelative = importPath.startsWith('.');
        const expectedStyle = recommendations.style;
        const actualStyle = isRelative ? 'relative' : 'absolute';
        
        if (isRelative && expectedStyle === 'absolute') {
          result.violations.push({
            type: 'import_drift',
            category: 'import_style',
            severity: this.severityLevels.LOW,
            line: lineNum,
            column: match.index - content.lastIndexOf('\n', match.index),
            message: `Relative import detected but project prefers absolute imports`,
            expected: expectedStyle,
            actual: actualStyle,
            rule: 'consistent_import_style'
          });
        } else if (!isRelative && expectedStyle === 'relative' && this.isInternalImport(importPath)) {
          result.violations.push({
            type: 'import_drift',
            category: 'import_style', 
            severity: this.severityLevels.LOW,
            line: lineNum,
            column: match.index - content.lastIndexOf('\n', match.index),
            message: `Absolute import for internal module but project prefers relative imports`,
            expected: expectedStyle,
            actual: actualStyle,
            rule: 'consistent_import_style'
          });
        }
      }

      if (recommendations.extensions) {
        const hasExtension = path.extname(importPath) !== '';
        const expectedStyle = recommendations.extensions;
        const actualStyle = hasExtension ? 'explicit' : 'implicit';
        
        if (actualStyle !== expectedStyle) {
          result.violations.push({
            type: 'import_drift',
            category: 'import_extensions',
            severity: this.severityLevels.INFO,
            line: lineNum,
            column: match.index - content.lastIndexOf('\n', match.index),
            message: `Import ${actualStyle} extensions but project standard is ${expectedStyle}`,
            expected: expectedStyle,
            actual: actualStyle,
            rule: 'consistent_import_extensions'
          });
        }
      }

      if (this.isDiscouragedLibrary(importPath)) {
        result.violations.push({
          type: 'import_drift',
          category: 'discouraged_library',
          severity: this.severityLevels.HIGH,
          line: lineNum,
          column: match.index - content.lastIndexOf('\n', match.index),
          message: `Import of discouraged library '${importPath.split('/')[0]}'`,
          rule: 'discouraged_library_usage'
        });
      }
    }
  }

  analyzeArchitectureDrift(filePath, result) {
    const recommendations = this.patterns.recommendations?.architecture || {};
    const relativePath = path.relative(process.cwd(), filePath);
    const pathParts = relativePath.split(path.sep);
    
    if (recommendations.commonFolders) {
      const fileName = path.basename(filePath);
      const expectedFolders = recommendations.commonFolders;
      
      const isInCommonFolder = expectedFolders.some(folder => 
        relativePath.includes(folder)
      );
      
      if (!isInCommonFolder && expectedFolders.length > 0) {
        result.violations.push({
          type: 'architecture_drift',
          category: 'folder_structure',
          severity: this.severityLevels.INFO,
          line: 1,
          column: 1,
          message: `File location may not follow established folder patterns`,
          expected: `One of: ${expectedFolders.join(', ')}`,
          actual: pathParts.slice(0, -1).join('/'),
          rule: 'consistent_folder_structure'
        });
      }
    }
  }

  analyzeCommentDrift(content, result, lines) {
    const recommendations = this.patterns.recommendations?.comments || {};
    
    if (recommendations.style && recommendations.density) {
      const commentAnalysis = this.analyzeComments(content);
      const expectedStyle = recommendations.style;
      const expectedDensity = recommendations.density;
      
      if (commentAnalysis.dominantStyle !== expectedStyle) {
        result.violations.push({
          type: 'comment_drift',
          category: 'comment_style',
          severity: this.severityLevels.INFO,
          line: 1,
          column: 1,
          message: `Comment style '${commentAnalysis.dominantStyle}' differs from project standard '${expectedStyle}'`,
          expected: expectedStyle,
          actual: commentAnalysis.dominantStyle,
          rule: 'consistent_comment_style'
        });
      }

      if (commentAnalysis.density !== expectedDensity) {
        const severityMap = {
          'none': this.severityLevels.HIGH,
          'low': this.severityLevels.MEDIUM,
          'medium': this.severityLevels.LOW,
          'high': this.severityLevels.INFO
        };
        
        result.violations.push({
          type: 'comment_drift',
          category: 'comment_density',
          severity: severityMap[expectedDensity] || this.severityLevels.INFO,
          line: 1,
          column: 1,
          message: `Comment density '${commentAnalysis.density}' differs from project standard '${expectedDensity}'`,
          expected: expectedDensity,
          actual: commentAnalysis.density,
          rule: 'consistent_comment_density'
        });
      }
    }
  }


  detectNamingStyle(name) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
    if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake_case';
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
    if (/^[a-z][a-z0-9-]*$/.test(name) && name.includes('-')) return 'kebab-case';
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'UPPER_CASE';
    return 'unknown';
  }

  convertNamingStyle(name, targetStyle) {
    switch (targetStyle) {
      case 'camelCase':
        return name.replace(/_(.)/g, (_, char) => char.toUpperCase())
                  .replace(/-(.)/g, (_, char) => char.toUpperCase());
      case 'snake_case':
        return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                  .replace(/-/g, '_');
      case 'PascalCase':
        return name.charAt(0).toUpperCase() + 
               name.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());
      case 'kebab-case':
        return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
                  .replace(/_/g, '-');
      default:
        return name;
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  getContext(lines, lineNum, contextSize) {
    const start = Math.max(0, lineNum - contextSize - 1);
    const end = Math.min(lines.length, lineNum + contextSize);
    
    return {
      before: lines.slice(start, lineNum - 1),
      line: lines[lineNum - 1] || '',
      after: lines.slice(lineNum, end)
    };
  }

  isInternalImport(importPath) {
    return importPath.startsWith('@') || importPath.startsWith('.');
  }

  isDiscouragedLibrary(importPath) {
    const discouraged = ['eval', 'vm', 'child_process'];
    return discouraged.some(lib => importPath.includes(lib));
  }

  analyzeComments(content) {
    const singleLineComments = (content.match(/\/\/.*$/gm) || []).length;
    const multiLineComments = (content.match(/\/\*[\s\S]*?\*\//g) || []).length;
    const jsdocComments = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    
    const total = singleLineComments + multiLineComments + jsdocComments;
    const lines = content.split('\n').length;
    const density = total / lines;
    
    let dominantStyle = 'single';
    if (jsdocComments >= singleLineComments && jsdocComments >= multiLineComments) {
      dominantStyle = 'jsdoc';
    } else if (multiLineComments >= singleLineComments) {
      dominantStyle = 'multi';
    }
    
    let densityLevel = 'none';
    if (density > 0.2) densityLevel = 'high';
    else if (density > 0.1) densityLevel = 'medium';  
    else if (density > 0.05) densityLevel = 'low';
    
    return {
      dominantStyle,
      density: densityLevel,
      counts: { single: singleLineComments, multi: multiLineComments, jsdoc: jsdocComments }
    };
  }

  calculateComplianceScore(violations) {
    const severityWeights = {
      [this.severityLevels.CRITICAL]: 10,
      [this.severityLevels.HIGH]: 5,
      [this.severityLevels.MEDIUM]: 3,
      [this.severityLevels.LOW]: 1,
      [this.severityLevels.INFO]: 0.5
    };
    
    const totalWeight = violations.reduce((sum, violation) => {
      return sum + (severityWeights[violation.severity] || 0);
    }, 0);
    
    const maxPenalty = 100;
    const penalty = Math.min(totalWeight * 2, maxPenalty);
    return Math.max(0, 100 - penalty);
  }

  calculateOverallScore(fileResults) {
    if (fileResults.length === 0) return 100;
    
    const totalScore = fileResults.reduce((sum, result) => sum + result.complianceScore, 0);
    return Math.round(totalScore / fileResults.length);
  }

  generateSuggestions(violations, patternMatches) {
    const suggestions = [];
    const violationsByCategory = violations.reduce((acc, violation) => {
      const key = `${violation.type}_${violation.category}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(violation);
      return acc;
    }, {});

    Object.entries(violationsByCategory).forEach(([category, categoryViolations]) => {
      if (categoryViolations.length > 1) {
        suggestions.push({
          type: 'bulk_fix',
          category,
          message: `Consider fixing all ${categoryViolations.length} ${category.replace('_', ' ')} violations`,
          affectedLines: categoryViolations.map(v => v.line),
          priority: categoryViolations[0].severity
        });
      }
    });

    return suggestions;
  }

  async findFiles(directory, extensions) {
    const files = [];
    const stack = [directory];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !this.shouldIgnoreDirectory(entry.name)) {
            stack.push(fullPath);
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

  shouldIgnoreDirectory(name) {
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage'];
    return ignorePatterns.includes(name);
  }
}