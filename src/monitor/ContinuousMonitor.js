import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import PatternLearner from '../governance/PatternLearner.js';
import DriftDetector from '../governance/DriftDetector.js';
import RuleEngine from '../governance/RuleEngine.js';
import AIDetector from '../ai-audit/AIDetector.js';
import AIAuditor from '../ai-audit/AIAuditor.js';
import { logger } from '../utils/logger.js';
import { LogFormatter } from '../utils/logFormatter.js';

export default class ContinuousMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      watchDirectory: options.watchDirectory || process.cwd(),
      extensions: options.extensions || ['.js', '.ts', '.jsx', '.tsx'],
      debounceMs: options.debounceMs || 1000, // Wait 1s after changes before analyzing
      enableAIDetection: options.enableAIDetection !== false,
      enableDriftDetection: options.enableDriftDetection !== false,
      enableRuleChecking: options.enableRuleChecking !== false,
      logFile: options.logFile || '.manasx/monitor.log',
      contextLogFile: options.contextLogFile || '.manasx/context.log',
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      ...options
    };

    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.isRunning = false;
    this.stats = {
      filesWatched: 0,
      changesDetected: 0,
      violationsFound: 0,
      aiCodeDetected: 0,
      startTime: null
    };

    this.patternLearner = new PatternLearner();
    this.driftDetector = null;
    this.ruleEngine = new RuleEngine();
    this.aiDetector = new AIDetector();
    this.aiAuditor = new AIAuditor();
    this.logFormatter = new LogFormatter();
    
    this.learnedPatterns = null;
    this.organizationalRules = null;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Monitor is already running');
      return;
    }

    try {
      logger.monitor(`Starting ManasX governance monitoring...`);
      
      await this.loadConfiguration();
      
      await this.setupLogging();
      
      await this.setupFileWatchers();
      
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      logger.success(`Watching ${this.stats.filesWatched} files for governance violations`);
      this.emit('started', { stats: this.stats });
      
      this.logContext({
        event: 'monitor_started',
        timestamp: new Date().toISOString(),
        watchDirectory: this.options.watchDirectory,
        filesWatched: this.stats.filesWatched,
        configuration: {
          hasPatterns: !!this.learnedPatterns,
          hasRules: !!this.organizationalRules,
          aiDetection: this.options.enableAIDetection,
          driftDetection: this.options.enableDriftDetection,
          ruleChecking: this.options.enableRuleChecking
        }
      });
      
    } catch (error) {
      logger.error(`Failed to start monitor: ${error.message}`);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping continuous monitor...');
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    this.isRunning = false;
    
    const duration = new Date() - this.stats.startTime;
    const durationStr = Math.round(duration / 1000);
    logger.monitor(`Stopped after ${durationStr}s • ${this.stats.changesDetected} changes • ${this.stats.violationsFound} violations`);
    
    this.logFormatter.writeSummaryReport({
      ...this.stats,
      duration: durationStr
    });
    
    this.logContext({
      event: 'monitor_stopped',
      timestamp: new Date().toISOString(),
      duration: Math.round(duration / 1000),
      stats: this.stats
    });
    
    this.emit('stopped', { stats: this.stats });
  }

  async loadConfiguration() {
    try {
      const patternsPath = path.join(this.options.watchDirectory, 'patterns.json');
      if (fs.existsSync(patternsPath)) {
        const content = fs.readFileSync(patternsPath, 'utf-8');
        this.learnedPatterns = JSON.parse(content);
        this.driftDetector = new DriftDetector(this.learnedPatterns);
        logger.info('Loaded learned patterns for drift detection');
      }
    } catch (error) {
      logger.warn(`Could not load patterns: ${error.message}`);
    }

    try {
      await this.ruleEngine.loadRules();
      this.organizationalRules = true;
      logger.info('Loaded organizational rules');
    } catch (error) {
      logger.warn(`Could not load rules: ${error.message}`);
    }
  }

  async setupLogging() {
    const logDir = path.dirname(this.options.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const contextLogDir = path.dirname(this.options.contextLogFile);
    if (!fs.existsSync(contextLogDir)) {
      fs.mkdirSync(contextLogDir, { recursive: true });
    }

    this.rotateLogs();
  }

  async setupFileWatchers() {
    const files = await this.findWatchableFiles();
    
    for (const filePath of files) {
      try {
        const watcher = fs.watch(filePath, { encoding: 'utf8' }, (eventType) => {
          if (eventType === 'change') {
            this.handleFileChange(filePath);
          }
        });
        
        this.watchers.set(filePath, watcher);
        this.stats.filesWatched++;
      } catch (error) {
        logger.warn(`Could not watch ${filePath}: ${error.message}`);
      }
    }

    const directories = new Set();
    files.forEach(file => directories.add(path.dirname(file)));
    
    for (const dirPath of directories) {
      try {
        const watcher = fs.watch(dirPath, { encoding: 'utf8' }, (eventType, filename) => {
          if (eventType === 'rename' && filename) {
            const fullPath = path.join(dirPath, filename);
            if (this.shouldWatchFile(fullPath)) {
              setTimeout(() => this.handleFileChange(fullPath), 100);
            }
          }
        });
        
        this.watchers.set(dirPath, watcher);
      } catch (error) {
        logger.warn(`Could not watch directory ${dirPath}: ${error.message}`);
      }
    }
  }

  handleFileChange(filePath) {
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }

    const timer = setTimeout(async () => {
      await this.analyzeFile(filePath);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  async analyzeFile(filePath) {
    try {
      if (!fs.existsSync(filePath) || !this.shouldWatchFile(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.options.watchDirectory, filePath);
      
      this.stats.changesDetected++;
      
      const analysis = {
        file: relativePath,
        timestamp: new Date().toISOString(),
        violations: [],
        insights: [],
        aiDetection: null,
        driftScore: null,
        recommendations: []
      };

      if (this.options.enableAIDetection) {
        const aiResult = await this.aiDetector.detectAICode(content, filePath);
        analysis.aiDetection = {
          isLikelyAI: aiResult.isLikelyAI,
          confidence: aiResult.confidence,
          indicators: aiResult.indicators.slice(0, 3), // Top 3 indicators
          recommendation: aiResult.recommendation
        };

        if (aiResult.isLikelyAI) {
          this.stats.aiCodeDetected++;
          analysis.insights.push('AI-generated code detected');
          
          const auditResult = await this.aiAuditor.auditAICode(content, filePath, this.learnedPatterns);
          analysis.violations.push(...auditResult.violations);
          analysis.recommendations.push(...auditResult.recommendations);
        }
      }

      if (this.options.enableDriftDetection && this.driftDetector) {
        const driftResult = await this.driftDetector.detectDrift(filePath);
        analysis.driftScore = driftResult.complianceScore;
        analysis.violations.push(...driftResult.violations);
        
        if (driftResult.complianceScore < 80) {
          analysis.insights.push(`Code drift detected (${driftResult.complianceScore}/100 compliance)`);
        }
      }

      if (this.options.enableRuleChecking && this.organizationalRules) {
        const ruleViolations = await this.ruleEngine.applyRules(filePath, content, this.learnedPatterns);
        analysis.violations.push(...ruleViolations);
      }

      this.stats.violationsFound += analysis.violations.length;

      this.displayViolations(analysis);
      
      this.logAnalysis(analysis);
      
      if (analysis.violations.length > 0 || analysis.insights.length > 0) {
        this.emit('analysis', analysis);
      }

      const contextData = {
        event: 'file_analyzed',
        ...analysis,
        summary: {
          hasViolations: analysis.violations.length > 0,
          hasInsights: analysis.insights.length > 0,
          totalIssues: analysis.violations.length,
          severity: this.getHighestSeverity(analysis.violations)
        }
      };
      
      this.logFormatter.writeContextLog(contextData);
      this.logFormatter.writeDailyLog(contextData);
      
      if (analysis.violations.length > 0) {
        this.logFormatter.writeViolationsLog(analysis.violations, relativePath);
      }

    } catch (error) {
      logger.warn(`Error analyzing ${filePath}: ${error.message}`);
    }
  }

  logAnalysis(analysis) {
    const logEntry = {
      timestamp: analysis.timestamp,
      file: analysis.file,
      summary: {
        violations: analysis.violations.length,
        insights: analysis.insights.length,
        aiDetected: analysis.aiDetection?.isLikelyAI || false,
        driftScore: analysis.driftScore
      }
    };

    if (analysis.violations.length > 0) {
      logEntry.violations = analysis.violations.map(v => ({
        rule: v.rule,
        category: v.category,
        severity: v.severity,
        message: v.message,
        line: v.line
      }));
    }

    this.appendToLog(this.options.logFile, JSON.stringify(logEntry) + '\n');
  }

  displayViolations(analysis) {
    const { file, violations, aiDetection } = analysis;
    
    logger.fileChange(file, violations, aiDetection?.isLikelyAI);
  }
  
  groupViolationsBySeverity(violations) {
    const groups = { critical: [], high: [], medium: [], low: [], info: [] };
    
    violations.forEach(violation => {
      const severity = violation.severity?.toLowerCase() || 'info';
      if (groups[severity]) {
        groups[severity].push(violation);
      } else {
        groups.info.push(violation);
      }
    });
    
    return groups;
  }

  logContext(contextData) {
    const contextEntry = {
      timestamp: contextData.timestamp || new Date().toISOString(),
      ...contextData
    };

    this.appendToLog(this.options.contextLogFile, JSON.stringify(contextEntry) + '\n');
  }

  appendToLog(logFile, data) {
    try {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.options.maxLogSize) {
          const rotatedFile = `${logFile}.${Date.now()}`;
          fs.renameSync(logFile, rotatedFile);
        }
      }

      fs.appendFileSync(logFile, data);
    } catch (error) {
      logger.warn(`Error writing to log ${logFile}: ${error.message}`);
    }
  }

  rotateLogs() {
    const logFiles = [this.options.logFile, this.options.contextLogFile];
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.options.maxLogSize) {
          const rotatedFile = `${logFile}.${Date.now()}`;
          fs.renameSync(logFile, rotatedFile);
          logger.info(`Rotated log file: ${logFile} -> ${rotatedFile}`);
        }
      }
    }
  }

  async findWatchableFiles() {
    const files = [];
    const stack = [this.options.watchDirectory];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !this.shouldIgnoreDirectory(entry.name)) {
            stack.push(fullPath);
          } else if (entry.isFile() && this.shouldWatchFile(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        logger.warn(`Skipping directory ${currentDir}: ${error.message}`);
      }
    }

    return files;
  }

  shouldWatchFile(filePath) {
    const ext = path.extname(filePath);
    return this.options.extensions.includes(ext);
  }

  shouldIgnoreDirectory(name) {
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.manasx'];
    return ignorePatterns.includes(name) || name.startsWith('.');
  }

  getHighestSeverity(violations) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    let highest = 0;
    let highestName = 'info';

    for (const violation of violations) {
      const score = severityOrder[violation.severity] || 0;
      if (score > highest) {
        highest = score;
        highestName = violation.severity;
      }
    }

    return highestName;
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      uptime: this.stats.startTime ? new Date() - this.stats.startTime : 0
    };
  }

  getRecentAnalysis(limit = 10) {
    try {
      if (!fs.existsSync(this.options.contextLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.options.contextLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-limit);
      
      return recentLines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry && entry.event === 'file_analyzed');
    } catch (error) {
      logger.warn(`Error reading recent analysis: ${error.message}`);
      return [];
    }
  }

  getOrganizationalContext() {
    return {
      hasLearnedPatterns: !!this.learnedPatterns,
      hasOrganizationalRules: !!this.organizationalRules,
      patternsSummary: this.learnedPatterns ? {
        confidence: this.learnedPatterns.confidence,
        naming: this.learnedPatterns.recommendations?.naming,
        imports: this.learnedPatterns.recommendations?.imports
      } : null,
      monitoringStats: this.getStats(),
      recentIssues: this.getRecentAnalysis(5)
    };
  }
}