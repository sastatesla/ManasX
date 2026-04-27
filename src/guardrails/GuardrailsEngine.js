import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';
import RuleEngine from '../governance/RuleEngine.js';
import AIDetector from '../ai-audit/AIDetector.js';
import AIAuditor from '../ai-audit/AIAuditor.js';

export class GuardrailsEngine {
  constructor() {
    this.ruleEngine = new RuleEngine();
    this.aiDetector = new AIDetector();
    this.aiAuditor = new AIAuditor(this.ruleEngine);
  }

  static installHooks() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error('Not a git repository. Cannot install hooks.');
    }
    
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    const script = `#!/bin/sh\n# ManasX Guardrails\nmanasx hooks check-commit || exit 1\n`;
    
    fs.writeFileSync(preCommitPath, script, { mode: 0o755 });
    return preCommitPath;
  }

  async checkCommit() {
    try {
      let stagedFiles = [];
      try {
        stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM | grep -E "\\.(js|jsx|ts|tsx)$"', { stdio: 'pipe' })
          .toString()
          .trim()
          .split('\n')
          .filter(Boolean);
      } catch (e) {
        // grep exits with 1 if no matches
        return true; 
      }

      if (stagedFiles.length === 0) return true;

      await this.ruleEngine.loadRules().catch(() => {});
      let patterns = null;
      try {
        if (fs.existsSync('patterns.json')) {
           patterns = JSON.parse(fs.readFileSync('patterns.json', 'utf8'));
        }
      } catch (e) {}

      let allPassed = true;

      for (const file of stagedFiles) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        
        // Check AI Detection
        const detection = await this.aiDetector.detectAICode(content, file, { skipAiCall: true }); // Avoid synchronous expensive calls in hooks usually, but pattern is fast
        if (detection.isLikelyAI) {
           logger.aiDetected(`Staged file ${file} contains AI-generated code (${(detection.confidence*100).toFixed(1)}% conf)`);
           
           // Verify contract
           const audit = await this.aiAuditor.auditAICode(content, file, patterns);
           const criticalOrHigh = audit.violations.filter(v => v.severity === 'critical' || v.severity === 'high');
           
           if (criticalOrHigh.length > 0) {
             logger.error(`Guardrail blocked commit: AI code in ${file} violates critical/high rules`);
             criticalOrHigh.forEach(v => logger.warn(`  - ${v.rule || v.ruleId}: ${v.message}`));
             allPassed = false;
           }
        }
        
        // Check standard rules
        const ruleViolations = await this.ruleEngine.applyRules(file, content, patterns);
        const blockerRules = ruleViolations.filter(v => v.severity === 'critical');
        if (blockerRules.length > 0) {
           logger.error(`Guardrail blocked commit: ${file} contains critical rule violations`);
           blockerRules.forEach(v => logger.warn(`  - [${v.ruleId}] ${v.message}`));
           allPassed = false;
        }
      }
      
      return allPassed;
    } catch (e) {
      logger.error(`Error during guardrails check: ${e.message}`);
      return false; // fail safe
    }
  }

  static getContract() {
    return {
      version: '1.0',
      description: 'ManasX Agent Guardrails Contract',
      rules: [
        {
          id: 'require-human-comments',
          description: 'AI-generated code must include a human review comment.',
          severity: 'high'
        },
        {
          id: 'no-ai-placeholders',
          description: 'Production code must not contain AI placeholder comments like // TODO: Implementation.',
          severity: 'critical'
        },
        {
          id: 'require-unit-tests',
          description: 'AI-generated exported logical functions must have corresponding unit tests.',
          severity: 'high'
        }
      ]
    };
  }
}
