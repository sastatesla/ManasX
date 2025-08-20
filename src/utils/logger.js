import chalk from 'chalk';

function colorizeArgs(args, colorFn) {
  return args.map(arg => {
    if (typeof arg === 'object') {
      return colorFn(JSON.stringify(arg, null, 2));
    }
    return colorFn(String(arg));
  });
}

export const logger = {
  info: (...args) => console.log(chalk.dim('ℹ'), ...colorizeArgs(args, chalk.dim)),
  warn: (...args) => console.log(chalk.yellow('⚠'), ...colorizeArgs(args, chalk.dim)),
  error: (...args) => console.log(chalk.red('✖'), ...colorizeArgs(args, chalk.dim)),
  success: (...args) => console.log(chalk.green('✓'), ...colorizeArgs(args, chalk.dim)),
  
  monitor: (...args) => console.log(chalk.dim('◦'), ...colorizeArgs(args, chalk.dim)),
  
  critical: (...args) => console.log(chalk.red('●'), ...colorizeArgs(args, chalk.dim)),
  high: (...args) => console.log(chalk.red('●'), ...colorizeArgs(args, chalk.dim)),
  medium: (...args) => console.log(chalk.yellow('●'), ...colorizeArgs(args, chalk.dim)),
  low: (...args) => console.log(chalk.blue('●'), ...colorizeArgs(args, chalk.dim)),
  
  aiDetected: (...args) => console.log(chalk.cyan('◉'), ...colorizeArgs(args, chalk.dim)),
  
  violation: (severity, ...args) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        logger.critical(...args);
        break;
      case 'high':
        logger.high(...args);
        break;
      case 'medium':
        logger.medium(...args);
        break;
      case 'low':
        logger.low(...args);
        break;
      default:
        logger.info(...args);
    }
  },
  
  fileChange: (file, violations, aiDetected) => {
    const violationCount = violations.length;
    
    if (violationCount === 0 && !aiDetected) {
      console.log(chalk.green('✓') + chalk.dim(` ${file} `) + chalk.green('clean'));
      return;
    }
    
    const fileHeader = chalk.cyan('📁') + chalk.bold.white(` ${file} `) + chalk.dim('being monitored');
    console.log(fileHeader);
    
    if (aiDetected) {
      console.log(chalk.cyan('  ◉ AI-DETECTED') + chalk.dim(' - Generated code identified'));
    }
    
    if (violationCount > 0) {
      const critical = violations.filter(v => v.severity === 'critical');
      const high = violations.filter(v => v.severity === 'high');
      const medium = violations.filter(v => v.severity === 'medium');
      const low = violations.filter(v => v.severity === 'low');
      
      if (critical.length > 0) {
        critical.forEach(v => {
          console.log(chalk.red('  ● CRITICAL') + chalk.dim(` @line:${v.line} `) + chalk.red(v.message));
        });
      }
      
      if (high.length > 0) {
        high.forEach(v => {
          console.log(chalk.red('  ● HIGH') + chalk.dim(` @line:${v.line} `) + chalk.dim(v.message));
        });
      }
      
      if (medium.length > 0) {
        medium.forEach(v => {
          console.log(chalk.yellow('  ● MEDIUM') + chalk.dim(` @line:${v.line} `) + chalk.dim(v.message));
        });
      }
      
      if (low.length > 0) {
        low.forEach(v => {
          console.log(chalk.blue('  ● LOW') + chalk.dim(` @line:${v.line} `) + chalk.dim(v.message));
        });
      }
      
      const summary = [];
      if (critical.length > 0) summary.push(chalk.red(`${critical.length} critical`));
      if (high.length > 0) summary.push(chalk.red(`${high.length} high`));
      if (medium.length > 0) summary.push(chalk.yellow(`${medium.length} medium`));
      if (low.length > 0) summary.push(chalk.blue(`${low.length} low`));
      
      console.log(chalk.dim('  └─ ') + summary.join(chalk.dim(' • ')) + chalk.dim(' violations found'));
    }
    
    console.log();
  }
};