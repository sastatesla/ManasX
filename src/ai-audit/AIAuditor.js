import AIDetector from './AIDetector.js';
import { callAiModelOnCode } from '../utils/AiModel.js';
import { logger } from '../utils/logger.js';

export default class AIAuditor {
  constructor(organizationalRules = null) {
    this.detector = new AIDetector();
    this.orgRules = organizationalRules;
    this.aiCodeRules = this.initializeAICodeRules();
  }

  initializeAICodeRules() {
    return {
      documentation: {
        'require-human-comments': {
          description: 'AI-generated code must include human review comments',
          severity: 'medium',
          check: (content, aiSections) => {
            const humanCommentPatterns = [
              /\/\/\s*Reviewed by:/i,
              /\/\/\s*Human verified:/i,
              /\/\/\s*@reviewed/i,
              /\/\*\*[\s\S]*?@human-verified[\s\S]*?\*\//
            ];

            const hasHumanComments = humanCommentPatterns.some(pattern => 
              pattern.test(content)
            );

            if (!hasHumanComments && aiSections.length > 0) {
              return [{
                rule: 'require-human-comments',
                message: 'AI-generated code must include human review comments',
                severity: 'medium',
                suggestion: 'Add comments like "// Reviewed by: [Name]" or "// @human-verified" to indicate human oversight'
              }];
            }
            return [];
          }
        },

        'require-unit-tests': {
          description: 'AI-generated functions must have corresponding unit tests',
          severity: 'high',
          check: (content, aiSections, filePath) => {
            const violations = [];
            const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\())/g;
            let match;
            
            const functions = [];
            while ((match = functionRegex.exec(content)) !== null) {
              const funcName = match[1] || match[2];
              const lineNum = content.substring(0, match.index).split('\n').length;
              
              const isInAISection = aiSections.some(section => 
                Math.abs(section.line - lineNum) <= 5
              );
              
              if (isInAISection) {
                functions.push({ name: funcName, line: lineNum });
              }
            }

            const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.');
            if (functions.length > 0 && !isTestFile) {
              violations.push({
                rule: 'require-unit-tests',
                message: `AI-generated functions need unit tests: ${functions.map(f => f.name).join(', ')}`,
                severity: 'high',
                functions: functions,
                suggestion: 'Create unit tests for AI-generated functions to ensure correctness and maintainability'
              });
            }

            return violations;
          }
        },

        'require-complexity-comments': {
          description: 'Complex AI-generated logic must have explanatory comments',
          severity: 'medium',
          check: (content, aiSections) => {
            const violations = [];
            const lines = content.split('\n');
            
            for (const section of aiSections) {
              const sectionContent = lines.slice(Math.max(0, section.line - 5), section.line + 5).join('\n');
              
              const complexityIndicators = [
                /for\s*\([^)]*\)\s*\{[\s\S]*?for\s*\([^)]*\)/, // Nested loops
                /if\s*\([^)]*\)\s*\{[\s\S]*?if\s*\([^)]*\)\s*\{[\s\S]*?if/, // Nested conditions
                /\.map\([\s\S]*?\.filter\([\s\S]*?\.reduce/, // Chained array methods
                /try\s*\{[\s\S]*?catch[\s\S]*?finally/ // Try-catch-finally blocks
              ];
              
              const isComplex = complexityIndicators.some(pattern => pattern.test(sectionContent));
              
              if (isComplex) {
                const hasExplanation = /\/\/\s*(?:This|The|Explanation|Logic|Algorithm|Purpose|Why)/.test(sectionContent);
                
                if (!hasExplanation) {
                  violations.push({
                    rule: 'require-complexity-comments',
                    message: 'Complex AI-generated code needs explanatory comments',
                    severity: 'medium',
                    line: section.line,
                    suggestion: 'Add comments explaining the purpose and logic of complex AI-generated code sections'
                  });
                }
              }
            }
            
            return violations;
          }
        }
      },

      quality: {
        'no-ai-placeholders': {
          description: 'AI-generated code must not contain placeholder comments',
          severity: 'high',
          check: (content) => {
            const placeholders = [
              /\/\/\s*TODO:/i,
              /\/\/\s*FIXME:/i,
              /\/\/\s*Add your.*here/i,
              /\/\/\s*Implementation.*here/i,
              /\/\/\s*Your code here/i,
              /\/\*\s*TODO[\s\S]*?\*\//i
            ];

            const violations = [];
            for (const pattern of placeholders) {
              const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
              for (const match of matches) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                violations.push({
                  rule: 'no-ai-placeholders',
                  message: 'Remove AI placeholder comments and implement proper code',
                  severity: 'high',
                  line: lineNum,
                  evidence: match[0].trim(),
                  suggestion: 'Replace placeholder comments with actual implementation or remove if not needed'
                });
              }
            }

            return violations;
          }
        },

        'consistent-naming': {
          description: 'AI-generated code should follow project naming conventions',
          severity: 'medium',
          check: (content, aiSections, filePath, learnedPatterns) => {
            if (!learnedPatterns?.recommendations?.naming) return [];

            const violations = [];
            const recommendations = learnedPatterns.recommendations.naming;
            const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\())/g;
            let match;

            while ((match = functionRegex.exec(content)) !== null) {
              const funcName = match[1] || match[2];
              const lineNum = content.substring(0, match.index).split('\n').length;
              
              const isInAISection = aiSections.some(section => 
                Math.abs(section.line - lineNum) <= 3
              );
              
              if (isInAISection && recommendations.functions) {
                const actualStyle = this.detectNamingStyle(funcName);
                const expectedStyle = recommendations.functions;
                
                if (actualStyle !== expectedStyle && actualStyle !== 'unknown') {
                  violations.push({
                    rule: 'consistent-naming',
                    message: `AI-generated function '${funcName}' should use ${expectedStyle} naming convention`,
                    severity: 'medium',
                    line: lineNum,
                    suggestion: `Rename to: ${this.convertNamingStyle(funcName, expectedStyle)}`
                  });
                }
              }
            }

            return violations;
          }
        }
      },

      security: {
        'ai-security-review': {
          description: 'AI-generated code with security implications needs extra review',
          severity: 'high',
          check: (content, aiSections) => {
            const violations = [];
            const securityPatterns = [
              { pattern: /eval\s*\(/, risk: 'Code execution vulnerability' },
              { pattern: /innerHTML\s*=/, risk: 'XSS vulnerability' },
              { pattern: /exec\s*\(/, risk: 'Command injection vulnerability' },
              { pattern: /\.query\s*\(/, risk: 'SQL injection vulnerability' },
              { pattern: /crypto\.createHash/, risk: 'Cryptographic implementation' },
              { pattern: /jwt\.sign/, risk: 'Authentication token handling' },
              { pattern: /password/i, risk: 'Password handling' }
            ];

            for (const { pattern, risk } of securityPatterns) {
              const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
              for (const match of matches) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                
                const isInAISection = aiSections.some(section => 
                  Math.abs(section.line - lineNum) <= 3
                );
                
                if (isInAISection) {
                  violations.push({
                    rule: 'ai-security-review',
                    message: `AI-generated code with security implications needs human security review: ${risk}`,
                    severity: 'high',
                    line: lineNum,
                    risk: risk,
                    suggestion: 'Have security team review AI-generated security-sensitive code'
                  });
                }
              }
            }

            return violations;
          }
        }
      },

      performance: {
        'ai-performance-review': {
          description: 'AI-generated performance-critical code needs review',
          severity: 'medium',
          check: (content, aiSections) => {
            const violations = [];
            const performancePatterns = [
              { pattern: /for\s*\([^)]*\)\s*\{[\s\S]*?for\s*\([^)]*\)/, issue: 'Nested loops' },
              { pattern: /\.forEach\s*\([\s\S]*?\.forEach/, issue: 'Nested forEach operations' },
              { pattern: /setTimeout\s*\([\s\S]*?setTimeout/, issue: 'Multiple setTimeout calls' },
              { pattern: /new\s+RegExp\s*\(.*\)/g, issue: 'RegExp construction in loop' },
              { pattern: /JSON\.parse\s*\([\s\S]*?JSON\.stringify/, issue: 'Inefficient JSON operations' }
            ];

            for (const { pattern, issue } of performancePatterns) {
              const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags))];
              for (const match of matches) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                
                const isInAISection = aiSections.some(section => 
                  Math.abs(section.line - lineNum) <= 5
                );
                
                if (isInAISection) {
                  violations.push({
                    rule: 'ai-performance-review',
                    message: `AI-generated code may have performance issues: ${issue}`,
                    severity: 'medium',
                    line: lineNum,
                    issue: issue,
                    suggestion: 'Review AI-generated code for performance optimization opportunities'
                  });
                }
              }
            }

            return violations;
          }
        }
      }
    };
  }

  async auditAICode(content, filePath, learnedPatterns = null) {
    try {
      const detection = await this.detector.detectAICode(content, filePath);
      
      if (!detection.isLikelyAI) {
        return {
          filePath,
          timestamp: new Date().toISOString(),
          isAIGenerated: false,
          confidence: detection.confidence,
          violations: [],
          recommendations: ['No AI-generated code detected']
        };
      }

      const violations = [];
      const recommendations = [];

      for (const [category, rules] of Object.entries(this.aiCodeRules)) {
        for (const [ruleId, rule] of Object.entries(rules)) {
          try {
            const ruleViolations = rule.check(content, detection.sections, filePath, learnedPatterns);
            violations.push(...ruleViolations.map(v => ({ ...v, category })));
          } catch (error) {
            logger.warn(`Error applying rule ${ruleId}: ${error.message}`);
          }
        }
      }

      recommendations.push(...this.generateAIRecommendations(detection, violations));

      if (this.orgRules) {
        const orgViolations = await this.applyOrganizationalRules(content, filePath, detection.sections);
        violations.push(...orgViolations);
      }

      return {
        filePath,
        timestamp: new Date().toISOString(),
        isAIGenerated: true,
        confidence: detection.confidence,
        aiIndicators: detection.indicators,
        violations: violations.sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity)),
        recommendations,
        overallScore: this.calculateAuditScore(violations),
        suggestedActions: this.generateActionPlan(violations)
      };
    } catch (error) {
      logger.error(`Error auditing AI code in ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async applyOrganizationalRules(content, filePath, aiSections) {
    const violations = [];
    
    
    for (const section of aiSections) {
      const lines = content.split('\n');
      const sectionContent = lines.slice(Math.max(0, section.line - 5), section.line + 5).join('\n');
      
      if (/function|const.*=.*=>/.test(sectionContent)) {
        if (!/(try\s*\{|catch\s*\(|throw\s+new\s+Error)/.test(sectionContent)) {
          violations.push({
            rule: 'org/require-error-handling',
            category: 'organizational',
            message: 'AI-generated functions must include proper error handling',
            severity: 'medium',
            line: section.line,
            suggestion: 'Add try-catch blocks or proper error validation to AI-generated functions'
          });
        }
      }
    }

    return violations;
  }

  generateAIRecommendations(detection, violations) {
    const recommendations = [];

    if (detection.confidence > 0.8) {
      recommendations.push('High confidence AI-generated code detected. Ensure thorough code review.');
    }

    if (violations.some(v => v.severity === 'high')) {
      recommendations.push('High-severity violations found in AI code. Address before merging.');
    }

    if (violations.some(v => v.category === 'security')) {
      recommendations.push('Security-related AI code detected. Mandatory security team review required.');
    }

    if (violations.some(v => v.rule === 'require-unit-tests')) {
      recommendations.push('Create comprehensive unit tests for AI-generated functions.');
    }

    const complexViolations = violations.filter(v => v.rule === 'require-complexity-comments');
    if (complexViolations.length > 0) {
      recommendations.push('Add explanatory comments to complex AI-generated logic sections.');
    }

    if (recommendations.length === 0) {
      recommendations.push('AI-generated code follows basic standards. Consider adding human review comments.');
    }

    return recommendations;
  }

  generateActionPlan(violations) {
    const actions = [];
    const violationsByCategory = violations.reduce((acc, v) => {
      acc[v.category] = (acc[v.category] || 0) + 1;
      return acc;
    }, {});

    if (violationsByCategory.security) {
      actions.push({
        priority: 'high',
        action: 'Schedule security team review',
        reason: `${violationsByCategory.security} security-related violations in AI code`
      });
    }

    if (violationsByCategory.quality) {
      actions.push({
        priority: 'medium',
        action: 'Address code quality issues',
        reason: `${violationsByCategory.quality} quality violations need attention`
      });
    }

    if (violationsByCategory.documentation) {
      actions.push({
        priority: 'low',
        action: 'Improve documentation',
        reason: `${violationsByCategory.documentation} documentation issues found`
      });
    }

    if (actions.length === 0) {
      actions.push({
        priority: 'low',
        action: 'Add human review marker',
        reason: 'Mark AI code as reviewed by human developer'
      });
    }

    return actions;
  }

  calculateAuditScore(violations) {
    const severityWeights = { critical: 20, high: 10, medium: 5, low: 2 };
    const totalPenalty = violations.reduce((sum, v) => sum + (severityWeights[v.severity] || 0), 0);
    return Math.max(0, 100 - Math.min(totalPenalty, 100));
  }

  getSeverityScore(severity) {
    const scores = { critical: 4, high: 3, medium: 2, low: 1 };
    return scores[severity] || 0;
  }


  detectNamingStyle(name) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
    if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake_case';
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
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
      default:
        return name;
    }
  }

  async auditDirectory(directory, options = {}) {
    const results = [];
    const files = await this.detector.findFiles(directory, options.extensions || ['.js', '.ts', '.jsx', '.tsx']);
    
    for (const filePath of files) {
      try {
        const content = await require('fs/promises').readFile(filePath, 'utf-8');
        const audit = await this.auditAICode(content, filePath, options.learnedPatterns);
        results.push(audit);
        
        if (audit.isAIGenerated && audit.violations.length > 0) {
          logger.info(`AI code audit issues: ${filePath} (${audit.violations.length} violations)`);
        }
      } catch (error) {
        logger.warn(`Error auditing ${filePath}: ${error.message}`);
      }
    }

    return {
      directory,
      timestamp: new Date().toISOString(),
      summary: {
        filesAnalyzed: results.length,
        aiGeneratedFiles: results.filter(r => r.isAIGenerated).length,
        totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
        averageScore: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length) : 100
      },
      results: results.sort((a, b) => a.overallScore - b.overallScore) // Worst scores first
    };
  }
}