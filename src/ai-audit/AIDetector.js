import { callAiModelOnCode } from '../utils/AiModel.js';
import { logger } from '../utils/logger.js';

export default class AIDetector {
  constructor() {
    this.patterns = this.initializeDetectionPatterns();
    this.confidence = {
      HIGH: 0.8,
      MEDIUM: 0.6,
      LOW: 0.4
    };
  }

  initializeDetectionPatterns() {
    return {
      comments: [
        /\/\*\*\s*\n\s*\*\s*.*\s*\n\s*\*\s*@param.*\s*\n\s*\*\s*@returns.*\s*\n\s*\*\//,
        /\/\/\s*TODO:\s*Implement/i,
        /\/\/\s*Helper function/i,
        /\/\/\s*Main logic/i,
        /\/\*\*[\s\S]*?This function[\s\S]*?\*\//,
        /\/\/\s*Example usage:/i
      ],

      naming: [
        /^(helper|util|process|handle|manage|create|get|set|update|delete|validate|format|parse|convert|transform|calculate)[A-Z]/,
        /^[a-z]+([A-Z][a-z]+){2,}$/, // Long camelCase names
        /^(is|has|can|should|will)[A-Z]/, // Boolean function prefixes
      ],

      structure: [
        /try\s*\{[\s\S]*?\}\s*catch\s*\(\s*error?\s*\)\s*\{\s*console\.(log|error)/,
        /(?:let|const|var)\s+(result|data|response|output|input|temp|item|element|value|obj|arr)\s*=/,
        /if\s*\(\s*!\s*\w+\s*\)\s*\{[\s\S]*?return/,
        /if\s*\(\s*typeof\s+\w+\s*===?\s*['"`]undefined['"`]\s*\)/,
      ],

      imports: [
        /import\s+\*\s+as\s+\w+\s+from/, // Namespace imports
        /import\s+\{[\s\S]*?\}\s+from\s+['"`][./]*utils/, // Utils imports
        /import.*path.*from\s+['"`]path['"`]/, // Common Node.js imports
      ],

      errorHandling: [
        /catch\s*\(\s*(?:error?|err?|e)\s*\)\s*\{\s*throw\s+new\s+Error/,
        /catch\s*\(\s*(?:error?|err?|e)\s*\)\s*\{\s*console\.error.*return/,
        /if\s*\(\s*!.*\)\s*throw\s+new\s+Error\(/,
      ],

      documentation: [
        /\/\*\*[\s\S]*?@example[\s\S]*?\*\//,
        /\/\*\*[\s\S]*?@description[\s\S]*?\*\//,
        /\/\/\s*Usage:/i,
        /\/\/\s*Returns:/i,
      ],

      aiSignatures: [
        /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\/\/\s*Implementation/,
        /\/\/\s*Add your.*here/i,
        /\/\/\s*Your code here/i,
        /\/\/\s*Implementation goes here/i,
        /(?:let|const|var)\s+(config|options|settings|params|args)\s*=\s*\{/,
      ]
    };
  }

  async detectAICode(content, filePath) {
    const result = {
      filePath,
      timestamp: new Date().toISOString(),
      isLikelyAI: false,
      confidence: 0,
      indicators: [],
      sections: [],
      recommendation: ''
    };

    try {
      const patternResults = this.analyzePatterns(content);
      
      const aiAnalysis = await this.performAIAnalysis(content, filePath);
      
      result.indicators = [...patternResults.indicators, ...aiAnalysis.indicators];
      result.sections = [...patternResults.sections, ...aiAnalysis.sections];
      
      result.confidence = this.calculateConfidence(result.indicators);
      result.isLikelyAI = result.confidence >= this.confidence.MEDIUM;
      
      result.recommendation = this.generateRecommendation(result);
      
      return result;
    } catch (error) {
      logger.error(`Error detecting AI code in ${filePath}: ${error.message}`);
      return result;
    }
  }

  analyzePatterns(content) {
    const indicators = [];
    const sections = [];
    const lines = content.split('\n');

    for (const pattern of this.patterns.comments) {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push({
          type: 'comment_pattern',
          description: 'AI-typical comment structure detected',
          confidence: 0.6,
          evidence: matches[0].substring(0, 100)
        });
      }
    }

    const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      if (funcName) {
        for (const pattern of this.patterns.naming) {
          if (pattern.test(funcName)) {
            indicators.push({
              type: 'naming_pattern',
              description: 'AI-typical function naming detected',
              confidence: 0.4,
              evidence: funcName,
              line: this.getLineNumber(content, match.index)
            });
            break;
          }
        }
      }
    }

    for (const pattern of this.patterns.structure) {
      const matches = [...content.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        indicators.push({
          type: 'structure_pattern',
          description: 'AI-typical code structure detected',
          confidence: 0.5,
          evidence: match[0].substring(0, 100),
          line: this.getLineNumber(content, match.index)
        });
      }
    }

    for (const pattern of this.patterns.imports) {
      const matches = [...content.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        indicators.push({
          type: 'import_pattern',
          description: 'AI-typical import pattern detected',
          confidence: 0.3,
          evidence: match[0],
          line: this.getLineNumber(content, match.index)
        });
      }
    }

    for (const pattern of this.patterns.errorHandling) {
      const matches = [...content.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        indicators.push({
          type: 'error_handling_pattern',
          description: 'AI-typical error handling detected',
          confidence: 0.7,
          evidence: match[0].substring(0, 150),
          line: this.getLineNumber(content, match.index)
        });
      }
    }

    for (const pattern of this.patterns.documentation) {
      const matches = [...content.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        indicators.push({
          type: 'documentation_pattern',
          description: 'AI-typical documentation detected',
          confidence: 0.5,
          evidence: match[0].substring(0, 100),
          line: this.getLineNumber(content, match.index)
        });
      }
    }

    for (const pattern of this.patterns.aiSignatures) {
      const matches = [...content.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        indicators.push({
          type: 'ai_signature',
          description: 'Strong AI code signature detected',
          confidence: 0.8,
          evidence: match[0].substring(0, 100),
          line: this.getLineNumber(content, match.index)
        });
      }
    }

    return { indicators, sections };
  }

  async performAIAnalysis(content, filePath) {
    const indicators = [];
    const sections = [];

    try {
      const prompt = `
Analyze the following code to determine if it was likely generated by an AI assistant (like ChatGPT, Claude, Copilot, etc.).

Look for patterns such as:
- Overly verbose comments or documentation
- Generic variable names (result, data, response, etc.)
- Template-like code structure
- Defensive programming patterns
- AI-typical error handling
- Perfect formatting and consistent style
- Generic function names
- Educational comments

Return a JSON object with:
{
  "isLikelyAI": boolean,
  "confidence": number (0-1),
  "reasons": ["specific reasons why this might be AI-generated"],
  "sections": [{"line": number, "reason": "why this section looks AI-generated"}]
}

Code to analyze:
\`\`\`
${content}
\`\`\`
`;

      const response = await callAiModelOnCode(content, filePath);
      
      if (typeof response === 'string') {
        try {
          const analysis = JSON.parse(response);
          
          if (analysis.reasons) {
            analysis.reasons.forEach(reason => {
              indicators.push({
                type: 'ai_analysis',
                description: reason,
                confidence: analysis.confidence || 0.5,
                evidence: 'AI analysis'
              });
            });
          }

          if (analysis.sections) {
            sections.push(...analysis.sections.map(section => ({
              line: section.line,
              reason: section.reason,
              confidence: analysis.confidence || 0.5
            })));
          }
        } catch (parseError) {
          logger.warn(`Could not parse AI analysis response: ${parseError.message}`);
        }
      }
    } catch (error) {
      logger.warn(`AI analysis failed: ${error.message}`);
    }

    return { indicators, sections };
  }

  calculateConfidence(indicators) {
    if (indicators.length === 0) return 0;

    const weights = {
      'ai_signature': 1.0,
      'error_handling_pattern': 0.8,
      'comment_pattern': 0.7,
      'structure_pattern': 0.6,
      'ai_analysis': 0.8,
      'documentation_pattern': 0.5,
      'naming_pattern': 0.4,
      'import_pattern': 0.3
    };

    let totalWeight = 0;
    let weightedScore = 0;

    indicators.forEach(indicator => {
      const weight = weights[indicator.type] || 0.5;
      totalWeight += weight;
      weightedScore += indicator.confidence * weight;
    });

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    return Math.min(avgScore * (1 - Math.exp(-indicators.length / 3)), 0.95);
  }

  generateRecommendation(result) {
    if (result.confidence >= this.confidence.HIGH) {
      return 'This code appears to be AI-generated with high confidence. Consider adding human review comments and ensuring it follows organizational standards.';
    } else if (result.confidence >= this.confidence.MEDIUM) {
      return 'This code shows patterns consistent with AI generation. Review for adherence to coding standards and add appropriate documentation.';
    } else if (result.confidence >= this.confidence.LOW) {
      return 'Some AI-typical patterns detected. Verify the code follows established patterns and conventions.';
    } else {
      return 'No strong indicators of AI generation detected.';
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  async analyzeDirectory(directory, options = {}) {
    const { extensions = ['.js', '.ts', '.jsx', '.tsx'] } = options;
    const results = [];

    try {
      const files = await this.findFiles(directory, extensions);
      
      for (const filePath of files) {
        try {
          const content = await require('fs/promises').readFile(filePath, 'utf-8');
          const analysis = await this.detectAICode(content, filePath);
          results.push(analysis);
          
          if (analysis.isLikelyAI) {
            logger.info(`AI code detected: ${filePath} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          logger.warn(`Error analyzing ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error analyzing directory ${directory}: ${error.message}`);
    }

    return {
      directory,
      timestamp: new Date().toISOString(),
      filesAnalyzed: results.length,
      aiGeneratedFiles: results.filter(r => r.isLikelyAI).length,
      results: results.sort((a, b) => b.confidence - a.confidence)
    };
  }

  async findFiles(directory, extensions) {
    const fs = require('fs/promises');
    const path = require('path');
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