import PerformanceAgent from './agents/PerformanceAgent.js';
import BestPracticesAgent from './agents/DebuggingAgent.js';
import PatternLearner from './governance/PatternLearner.js';
import DriftDetector from './governance/DriftDetector.js';
import RuleEngine from './governance/RuleEngine.js';
import AIDetector from './ai-audit/AIDetector.js';
import AIAuditor from './ai-audit/AIAuditor.js';
import { logger } from './utils/logger.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import ContinuousMonitor from './monitor/ContinuousMonitor.js';
import MCPServer from './integrations/MCPServer.js';



export async function runPerformanceAnalysis(file) {
  try {
    const agent = new PerformanceAgent();
    await agent.analyze(file);
  } catch (error) {
    logger.error(error.message);
  }
}

export async function runDebugAnalysis(file) {
  try {
    const agent = new BestPracticesAgent();
    await agent.analyze(file);
  } catch (error) {
    logger.error(error.message);
  }
}


export async function runPatternLearning(directory, options) {
  try {
    logger.info(`Learning patterns from ${directory}...`);
    const learner = new PatternLearner();
    const patterns = await learner.learnFromDirectory(directory, {
      maxFiles: parseInt(options.maxFiles) || 1000
    });
    
    if (options.output) {
      await learner.savePatterns(patterns, options.output);
      logger.info(`Patterns saved to ${options.output}`);
    }
    
    logger.info(`\nPattern Learning Summary:`);
    logger.info(`Confidence: ${patterns.confidence}`);
    logger.info(`Recommended naming: ${JSON.stringify(patterns.recommendations.naming, null, 2)}`);
    logger.info(`Popular libraries: ${patterns.recommendations.imports.popularLibraries.join(', ')}`);
    
  } catch (error) {
    logger.error(`Pattern learning failed: ${error.message}`);
  }
}

export async function runDriftDetection(files, options) {
  try {
    let patterns = null;
    if (options.patterns) {
      try {
        const content = await fs.readFile(options.patterns, 'utf-8');
        patterns = JSON.parse(content);
      } catch (error) {
        logger.warn(`Could not load patterns from ${options.patterns}: ${error.message}`);
      }
    }
    
    if (!patterns) {
      logger.error('No patterns available. Run "manasx learn" first.');
      return;
    }
    
    const detector = new DriftDetector(patterns);
    
    for (const file of files) {
      logger.info(`\nChecking drift in ${file}...`);
      const result = await detector.detectDrift(file, {
        threshold: parseFloat(options.threshold) || 0.7,
        includeInfo: options.includeInfo
      });
      
      if (result.files) {
        logger.info(`Compliance Score: ${result.summary.overallScore}/100`);
        logger.info(`Total Violations: ${result.summary.totalViolations}`);
      } else {
        logger.info(`Compliance Score: ${result.complianceScore}/100`);
        if (result.violations.length > 0) {
          logger.warn(`Found ${result.violations.length} violations:`);
          result.violations.forEach(v => {
            logger.warn(`  [${v.severity.toUpperCase()}] Line ${v.line}: ${v.message}`);
          });
        } else {
          logger.info('No violations found.');
        }
      }
    }
    
  } catch (error) {
    logger.error(`Drift detection failed: ${error.message}`);
  }
}

export async function runComplianceCheck(directory, options) {
  try {
    const ruleEngine = new RuleEngine();
    let rules;
    try {
      rules = await ruleEngine.loadRules(options.rules);
    } catch (error) {
      logger.warn(`Could not load rules: ${error.message}. Using defaults.`);
      rules = ruleEngine.getDefaultConfiguration();
    }
    
    let patterns = null;
    if (options.patterns) {
      try {
        const content = await fs.readFile(options.patterns, 'utf-8');
        patterns = JSON.parse(content);
      } catch (error) {
        logger.warn(`Could not load patterns: ${error.message}`);
      }
    }
    
    logger.info(`Running compliance check on ${directory}...`);
    logger.info(`Rules loaded: ${ruleEngine.rules.size} active rules`);
    
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    const files = await findCodeFiles(directory, extensions);
    
    let totalViolations = 0;
    let filesWithViolations = 0;
    
    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8');
      const violations = await ruleEngine.applyRules(filePath, content, patterns);
      
      if (violations.length > 0) {
        filesWithViolations++;
        totalViolations += violations.length;
        
        if (options.format === 'console') {
          logger.warn(`\n${path.relative(process.cwd(), filePath)}:`);
          violations.forEach(v => {
            logger.warn(`  [${v.severity.toUpperCase()}] Line ${v.line}: ${v.message}`);
          });
        }
      }
    }
    
    const complianceRate = Math.round(((files.length - filesWithViolations) / files.length) * 100);
    
    // Enhanced compliance summary
    const chalk = (await import('chalk')).default;
    console.log(chalk.bold.yellow('\n📊 Compliance Summary:'));
    console.log(chalk.gray(`Files analyzed: ${files.length}`));
    console.log(chalk.gray(`Files with violations: ${filesWithViolations}`));
    console.log(chalk.gray(`Total violations: ${totalViolations}`));
    
    const rateColor = complianceRate >= 80 ? 'green' : complianceRate >= 60 ? 'yellow' : 'red';
    console.log(chalk[rateColor](`Compliance rate: ${complianceRate}%`));
    
    if (complianceRate < 80) {
      console.log(chalk.yellow('\n⚠️  Compliance below recommended threshold (80%)'));
      console.log(chalk.cyan('💡 Consider running: manasx watch [directory] for continuous monitoring'));
    } else {
      console.log(chalk.green('\n✅ Good compliance rate! Keep up the good work.'));
    }
    
  } catch (error) {
    logger.error(`Compliance check failed: ${error.message}`);
  }
}

export async function runRuleInit(options) {
  try {
    const ruleEngine = new RuleEngine();
    const config = await ruleEngine.createInitialConfig(options.file);
    logger.info(`Rule configuration initialized at ${options.file}`);
    logger.info('Edit the configuration to customize rules for your organization.');
  } catch (error) {
    logger.error(`Rule initialization failed: ${error.message}`);
  }
}

export async function runRuleValidation(options) {
  try {
    const ruleEngine = new RuleEngine();
    const config = await ruleEngine.loadRules(options.file);
    logger.info(`✓ Configuration ${options.file} is valid`);
    logger.info(`Loaded ${Object.keys(config.rules).length} rule categories`);
  } catch (error) {
    logger.error(`✗ Configuration validation failed: ${error.message}`);
  }
}

export async function runAIAudit(files, options) {
  try {
    let patterns = null;
    let ruleEngine = null;
    
    if (options.patterns) {
      try {
        const content = await fs.readFile(options.patterns, 'utf-8');
        patterns = JSON.parse(content);
      } catch (error) {
        logger.warn(`Could not load patterns: ${error.message}`);
      }
    }
    
    if (options.rules) {
      try {
        ruleEngine = new RuleEngine();
        await ruleEngine.loadRules(options.rules);
      } catch (error) {
        logger.warn(`Could not load rules: ${error.message}`);
      }
    }
    
    const auditor = new AIAuditor(ruleEngine);
    
    for (const file of files) {
      logger.info(`\nAuditing AI code in ${file}...`);
      const content = await fs.readFile(file, 'utf-8');
      const result = await auditor.auditAICode(content, file, patterns);
      
      if (!result.isAIGenerated) {
        logger.info('No AI-generated code detected.');
        continue;
      }
      
      logger.info(`AI Code Detected (${(result.confidence * 100).toFixed(1)}% confidence)`);
      logger.info(`Audit Score: ${result.overallScore}/100`);
      
      if (result.violations.length > 0) {
        logger.warn(`Found ${result.violations.length} violations:`);
        result.violations.forEach(v => {
          logger.warn(`  [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        logger.info('\nRecommendations:');
        result.recommendations.forEach(rec => {
          logger.info(`  • ${rec}`);
        });
      }
      
      if (result.suggestedActions.length > 0) {
        logger.info('\nSuggested Actions:');
        result.suggestedActions.forEach(action => {
          logger.info(`  [${action.priority.toUpperCase()}] ${action.action}: ${action.reason}`);
        });
      }
    }
    
  } catch (error) {
    logger.error(`AI audit failed: ${error.message}`);
  }
}

export async function runAIDetection(files, options) {
  try {
    const detector = new AIDetector();
    const threshold = parseFloat(options.threshold) || 0.6;
    
    for (const file of files) {
      logger.info(`\nAnalyzing ${file} for AI-generated code...`);
      const content = await fs.readFile(file, 'utf-8');
      const result = await detector.detectAICode(content, file);
      
      if (result.confidence >= threshold) {
        logger.warn(`AI Code Detected: ${(result.confidence * 100).toFixed(1)}% confidence`);
        
        if (result.indicators.length > 0) {
          logger.info('Indicators:');
          result.indicators.slice(0, 5).forEach(indicator => {
            logger.info(`  • ${indicator.description} (${(indicator.confidence * 100).toFixed(0)}%)`);
          });
        }
        
        logger.info(`\nRecommendation: ${result.recommendation}`);
      } else {
        logger.info(`Low confidence (${(result.confidence * 100).toFixed(1)}%) - likely human-written code`);
      }
    }
    
  } catch (error) {
    logger.error(`AI detection failed: ${error.message}`);
  }
}


async function findCodeFiles(directory, extensions) {
  const files = [];
  const stack = [directory];
  
  while (stack.length > 0) {
    const currentDir = stack.pop();
    
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          const shouldIgnore = ['node_modules', '.git', 'dist', 'build'].some(pattern => 
            entry.name.includes(pattern)
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


export async function runContinuousWatch(directory, options) {
  try {
    logger.monitor('Starting ManasX Continuous Monitoring');
    
    // Check if setup files exist
    const hasPatterns = fsSync.existsSync(options.patterns || 'patterns.json');
    const hasRules = fsSync.existsSync(options.rules || 'manasx-rules.json');
    
    if (!hasPatterns || !hasRules) {
      logger.warn('Setup incomplete. Missing configuration files:');
      if (!hasPatterns) logger.warn('   ❌ patterns.json (run: manasx learn)');
      if (!hasRules) logger.warn('   ❌ manasx-rules.json (run: manasx rules init)');
      logger.info('💡 Run `manasx init` for guided setup');
    }
    
    logger.info(`📁 Watching: ${directory}`);
    logger.info('🔍 Monitoring features enabled:');
    
    const features = [];
    if (!options.noDriftDetection) features.push('Pattern drift detection');
    if (!options.noRuleChecking) features.push('Organizational rule violations');
    if (!options.noAiDetection) features.push('AI-generated code auditing');
    if (!options.noMcp) features.push('Real-time AI tool integration');
    
    features.forEach(feature => {
      logger.info(`   • ${feature}`);
    });
    
    logger.info(`📝 Logs: ${options.logFile || '.manasx/monitor.log'}`);
    logger.info(`🤖 Context: ${options.contextLog || '.manasx/context.log'}`);
    
    if (!options.noMcp) {
      logger.info(`🔗 MCP Server: port ${options.mcpPort || 8765}`);
    }
    
    logger.success('✅ Monitor started! File changes will be analyzed in real-time.');
    logger.info('Press Ctrl+C to stop monitoring');
    
    const monitor = new ContinuousMonitor({
      watchDirectory: directory,
      enableAIDetection: !options.noAiDetection,
      enableDriftDetection: !options.noDriftDetection,
      enableRuleChecking: !options.noRuleChecking,
      logFile: options.logFile,
      contextLogFile: options.contextLog
    });
    
    let mcpServer = null;
    if (!options.noMcp) {
      mcpServer = new MCPServer(monitor, { port: parseInt(options.mcpPort) || 8765 });
      await mcpServer.start();
    }
    
    await monitor.start();
    
    const cleanup = async () => {
      logger.info('Shutting down monitor...');
      await monitor.stop();
      if (mcpServer) {
        await mcpServer.stop();
      }
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    monitor.on('analysis', (analysis) => {
      if (analysis.insights && analysis.insights.length > 0) {
        analysis.insights.forEach(insight => {
          logger.info(`[${analysis.file}] ${insight}`);
        });
      }
    });
    
    logger.info('Continuous monitoring active. Press Ctrl+C to stop.');
    if (mcpServer) {
      logger.info(`MCP Server running on port ${mcpServer.options.port} for AI tool integration`);
      logger.info('AI tools can now query organizational context and rules via MCP protocol');
    }
    
    await new Promise(() => {}); // Run forever until interrupted
    
  } catch (error) {
    logger.error(`Continuous monitoring failed: ${error.message}`);
    process.exit(1);
  }
}

export async function showMonitoringStatus(options) {
  try {
    const contextLogFile = options.contextLog;
    
    if (!fsSync.existsSync(contextLogFile)) {
      logger.warn('No monitoring activity found. Run "manasx watch" to start monitoring.');
      return;
    }
    
    const content = fsSync.readFileSync(contextLogFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    const entries = lines
      .slice(-20) // Last 20 entries
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry);
    
    if (entries.length === 0) {
      logger.info('No monitoring activity found.');
      return;
    }
    
    const latestStatus = entries.find(e => e.event === 'monitor_started' || e.event === 'monitor_stopped');
    const isRunning = latestStatus?.event === 'monitor_started';
    
    logger.info(`\nMonitoring Status: ${isRunning ? 'ACTIVE' : 'STOPPED'}`);
    
    if (latestStatus) {
      logger.info(`Last event: ${latestStatus.timestamp}`);
      if (isRunning && latestStatus.filesWatched) {
        logger.info(`Watching: ${latestStatus.filesWatched} files`);
        logger.info(`Configuration: AI Detection: ${latestStatus.configuration?.aiDetection ? 'ON' : 'OFF'}, Drift Detection: ${latestStatus.configuration?.driftDetection ? 'ON' : 'OFF'}`);
      }
    }
    
    const recentAnalysis = entries
      .filter(e => e.event === 'file_analyzed')
      .slice(-10);
    
    if (recentAnalysis.length > 0) {
      logger.info('\nRecent Activity:');
      recentAnalysis.forEach(analysis => {
        const time = new Date(analysis.timestamp).toLocaleTimeString();
        const issues = analysis.summary?.totalIssues || 0;
        const severity = analysis.summary?.severity || 'info';
        const aiDetected = analysis.summary?.hasInsights ? ' [AI-DETECTED]' : '';
        
        if (issues > 0) {
          logger.warn(`  ${time} - ${analysis.file}: ${issues} ${severity} issues${aiDetected}`);
        } else {
          logger.info(`  ${time} - ${analysis.file}: Clean${aiDetected}`);
        }
      });
    }
    
    const fileAnalysisCount = entries.filter(e => e.event === 'file_analyzed').length;
    const violationsCount = entries
      .filter(e => e.event === 'file_analyzed')
      .reduce((sum, e) => sum + (e.summary?.totalIssues || 0), 0);
    const aiDetectedCount = entries
      .filter(e => e.event === 'file_analyzed' && e.aiDetection?.isLikelyAI)
      .length;
    
    logger.info('\nSummary (last 20 events):');
    logger.info(`Files analyzed: ${fileAnalysisCount}`);
    logger.info(`Total violations: ${violationsCount}`);
    logger.info(`AI-generated code detected: ${aiDetectedCount}`);
    
    if (options.format === 'json') {
      const summary = {
        isRunning,
        lastUpdate: latestStatus?.timestamp,
        stats: {
          filesAnalyzed: fileAnalysisCount,
          totalViolations: violationsCount,
          aiCodeDetected: aiDetectedCount
        },
        recentActivity: recentAnalysis.slice(-5)
      };
      console.log(JSON.stringify(summary, null, 2));
    }
    
  } catch (error) {
    logger.error(`Error showing status: ${error.message}`);
  }
}

export async function runGuidedSetup(directory, options = {}) {
  const chalk = (await import('chalk')).default;
  
  console.log(chalk.bold.cyan('\n🚀 ManasX Enterprise Governance Setup\n'));
  console.log('This guided setup will configure ManasX for comprehensive code governance:');
  console.log('  📚 Learn your codebase patterns');
  console.log('  ⚙️  Configure organizational rules');
  console.log('  🔍 Validate setup');
  console.log('  👀 Start continuous monitoring\n');
  
  try {
    // Step 1: Pattern Learning
    if (!options.skipPatterns) {
      console.log(chalk.bold.yellow('Step 1/4: Learning Codebase Patterns 📚'));
      console.log('Analyzing your codebase to learn organizational conventions...\n');
      
      await runPatternLearning(directory, { 
        output: options.patternsFile || 'patterns.json' 
      });
      
      console.log(chalk.green('✅ Pattern learning complete!\n'));
    }
    
    // Step 2: Rule Configuration
    if (!options.skipRules) {
      console.log(chalk.bold.yellow('Step 2/4: Configuring Organizational Rules ⚙️'));
      console.log('Setting up governance rules for your organization...\n');
      
      await runRuleInit({ 
        file: options.rulesFile || 'manasx-rules.json' 
      });
      
      console.log(chalk.green('✅ Rule configuration complete!\n'));
    }
    
    // Step 3: Validation
    if (!options.skipValidation) {
      console.log(chalk.bold.yellow('Step 3/4: Validating Setup 🔍'));
      console.log('Running comprehensive validation checks...\n');
      
      await runComplianceCheck(directory, {
        rules: options.rulesFile || 'manasx-rules.json',
        patterns: options.patternsFile || 'patterns.json'
      });
      
      await runRuleValidation({ 
        file: options.rulesFile || 'manasx-rules.json' 
      });
      
      console.log(chalk.green('✅ Setup validation complete!\n'));
    }
    
    // Step 4: Ready to Monitor
    console.log(chalk.bold.yellow('Step 4/4: Ready for Continuous Monitoring 👀'));
    console.log('Your ManasX setup is complete! Here\'s what you can do next:\n');
    
    console.log(chalk.bold.white('Start Continuous Monitoring:'));
    console.log(chalk.cyan(`  manasx watch ${directory}`));
    console.log('  This will monitor your codebase for:');
    console.log('    • Pattern drift detection');
    console.log('    • Rule violations');
    console.log('    • AI-generated code auditing');
    console.log('    • Real-time governance insights\n');
    
    console.log(chalk.bold.white('Other useful commands:'));
    console.log(chalk.cyan('  manasx status') + '              # Check monitoring status');
    console.log(chalk.cyan('  manasx compliance') + '          # Run full compliance check');
    console.log(chalk.cyan('  manasx drift <files>') + '       # Check specific files for drift');
    console.log(chalk.cyan('  manasx ai-detect <files>') + '   # Detect AI-generated code\n');
    
    console.log(chalk.bold.green('🎉 ManasX Enterprise Governance is ready!'));
    console.log(chalk.gray('Pro tip: Run `manasx watch` to start continuous monitoring and get real-time insights in your AI coding tools.\n'));
    
  } catch (error) {
    console.error(chalk.red(`Setup failed: ${error.message}`));
    console.log(chalk.yellow('\nYou can run individual setup steps manually:'));
    console.log(chalk.cyan('  manasx learn') + '               # Learn patterns');
    console.log(chalk.cyan('  manasx rules init') + '          # Initialize rules');
    console.log(chalk.cyan('  manasx compliance') + '          # Validate setup');
  }
}

export async function runMCPServer(options = {}) {
  try {
    const port = parseInt(options.port) || 3001;
    const server = new MCPServer(options);
    
    logger.monitor(`Starting MCP server for AI tool integration...`);
    await server.start(port);
    logger.success(`MCP server running on port ${port}`);
    logger.info(`AI tools can now access organizational context via MCP protocol`);
    
    process.on('SIGINT', async () => {
      logger.monitor('Shutting down MCP server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Failed to start MCP server: ${error.message}`);
  }
}