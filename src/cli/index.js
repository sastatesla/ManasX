import { Command } from 'commander';
import pkg from '../../package.json' with { type: 'json' };
import { runDebugAnalysis, runPerformanceAnalysis, runPatternLearning, runDriftDetection, runRuleInit, runRuleValidation, runComplianceCheck, runAIAudit, runAIDetection, runContinuousWatch, showMonitoringStatus, runMCPServer } from '../index.js';

const program = new Command();

program
  .name('agentic')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('debug <file>')
  .description('Analyze the code for debugging and suggest improvements')
  .action((file) => {
    runDebugAnalysis(file);
  });

program
  .command('perf <file>')
  .description('Analyze code for performance issues and suggest improvements')
  .action((file) => {
    runPerformanceAnalysis(file);
  });

program
  .command('learn [directory]')
  .description('Learn patterns from existing codebase')
  .option('-o, --output <file>', 'Save learned patterns to file', 'patterns.json')
  .option('--max-files <number>', 'Maximum files to analyze', '1000')
  .action((directory, options) => {
    runPatternLearning(directory || '.', options);
  });

program
  .command('drift <files...>')
  .description('Check for pattern drift in files')
  .option('-p, --patterns <file>', 'Use patterns from file', 'patterns.json')
  .option('-t, --threshold <number>', 'Compliance threshold (0-1)', '0.7')
  .option('--include-info', 'Include informational violations')
  .action((files, options) => {
    runDriftDetection(files, options);
  });

program
  .command('compliance [directory]')
  .description('Run full compliance check against organizational rules')
  .option('-r, --rules <file>', 'Rules configuration file', 'manasx-rules.json')
  .option('-p, --patterns <file>', 'Learned patterns file', 'patterns.json')
  .option('--format <format>', 'Output format (console|json|html)', 'console')
  .action((directory, options) => {
    runComplianceCheck(directory || '.', options);
  });

program
  .command('rules')
  .description('Rule management commands')
  .addCommand(
    new Command('init')
      .description('Initialize rule configuration')
      .option('-f, --file <file>', 'Configuration file name', 'manasx-rules.json')
      .action((options) => {
        runRuleInit(options);
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate rule configuration')
      .option('-f, --file <file>', 'Configuration file', 'manasx-rules.json')
      .action((options) => {
        runRuleValidation(options);
      })
  );

program
  .command('ai-audit <files...>')
  .description('Audit AI-generated code against organizational standards')
  .option('-p, --patterns <file>', 'Learned patterns file', 'patterns.json')
  .option('-r, --rules <file>', 'Rules configuration file', 'manasx-rules.json')
  .option('--format <format>', 'Output format (console|json)', 'console')
  .action((files, options) => {
    runAIAudit(files, options);
  });

program
  .command('ai-detect <files...>')
  .description('Detect likely AI-generated code patterns')
  .option('--threshold <number>', 'Detection confidence threshold (0-1)', '0.6')
  .option('--format <format>', 'Output format (console|json)', 'console')
  .action((files, options) => {
    runAIDetection(files, options);
  });

program
  .command('watch [directory]')
  .description('Start continuous monitoring of codebase for real-time governance')
  .option('-p, --patterns <file>', 'Learned patterns file', 'patterns.json')
  .option('-r, --rules <file>', 'Rules configuration file', 'manasx-rules.json')
  .option('--no-ai-detection', 'Disable AI code detection')
  .option('--no-drift-detection', 'Disable drift detection')
  .option('--no-rule-checking', 'Disable organizational rule checking')
  .option('--log-file <file>', 'Log file path', '.manasx/monitor.log')
  .option('--context-log <file>', 'Context log for AI tools', '.manasx/context.log')
  .option('--mcp-port <number>', 'MCP server port', '8765')
  .option('--no-mcp', 'Disable MCP server for AI tool integration')
  .action((directory, options) => {
    runContinuousWatch(directory || '.', options);
  });

program
  .command('watch-all')
  .description('Start continuous monitoring of entire repository from root')
  .option('-p, --patterns <file>', 'Learned patterns file', 'patterns.json')
  .option('-r, --rules <file>', 'Rules configuration file', 'manasx-rules.json')
  .option('--no-ai-detection', 'Disable AI code detection')
  .option('--no-drift-detection', 'Disable drift detection')
  .option('--no-rule-checking', 'Disable organizational rule checking')
  .option('--log-file <file>', 'Log file path', '.manasx/monitor.log')
  .option('--context-log <file>', 'Context log for AI tools', '.manasx/context.log')
  .option('--mcp-port <number>', 'MCP server port', '8765')
  .option('--no-mcp', 'Disable MCP server for AI tool integration')
  .action((options) => {
    runContinuousWatch('.', options);
  });

program
  .command('status')
  .description('Show monitoring status and recent governance activity')
  .option('--context-log <file>', 'Context log file', '.manasx/context.log')
  .option('--format <format>', 'Output format (console|json)', 'console')
  .action((options) => {
    showMonitoringStatus(options);
  });

program
  .command('mcp-server')
  .description('Start Model Context Protocol server for AI tool integration')
  .option('-p, --port <number>', 'Server port', '3001')
  .option('--context-log <file>', 'Context log file', '.manasx/context.log')
  .option('--patterns <file>', 'Learned patterns file', 'patterns.json')
  .option('--rules <file>', 'Rules configuration file', 'manasx-rules.json')
  .action((options) => {
    runMCPServer(options);
  });

program.parse(process.argv);
