import { Command } from 'commander';
import pkg from '../../package.json' assert { type: 'json' };
import { runDebugAnalysis, runPerformanceAnalysis } from '../index.js';

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

// program
//   .command('practices <fileOrDir>')
//   .description('Analyze code or directory for best coding practices (using ESLint)')
//   .action((fileOrDir) => {
//     runBestPracticesAnalysis(fileOrDir);
//   });

program.parse(process.argv);
