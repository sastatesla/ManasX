import chalk from 'chalk';

function colorizeArgs(args, colorFn) {
  return args.map(arg => {
    // Stringify objects for better readability
    if (typeof arg === 'object') {
      return colorFn(JSON.stringify(arg, null, 2));
    }
    return colorFn(String(arg));
  });
}

export const logger = {
  info: (...args) => console.log(chalk.blue('[INFO]'), ...colorizeArgs(args, chalk.cyan)),
  warn: (...args) => console.warn(chalk.yellow('[WARN]'), ...colorizeArgs(args, chalk.yellowBright)),
  error: (...args) => console.error(chalk.red('[ERROR]'), ...colorizeArgs(args, chalk.redBright)),
};