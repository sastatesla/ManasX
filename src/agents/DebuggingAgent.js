import fs from 'fs/promises';
import BestPracticesAnalyzer from '../analysis/SimpleBestPracticeAnalyzer.js';
import BestPracticesSuggester from '../suggestions/BestPracticeSuggester.js';
import { logger } from '../utils/logger.js';

export default class BestPracticesAgent {
  async analyze(file) {
    if (!file) {
      logger.error('No file path provided to analyze.');
      return { issues: [], suggestions: [] };
    }

    logger.info(`Debugging ${file} for best coding practices...`);
    try {
      const content = await fs.readFile(file, 'utf-8');
      if (!content.trim()) {
        logger.warn(`The file ${file} is empty. No analysis performed.`);
        return { issues: [], suggestions: [] };
      }

      const issues = await BestPracticesAnalyzer.analyze(file);
      const suggestions = BestPracticesSuggester.suggest(issues);

      if (issues && issues.length) {
        logger.warn(`Best practices issues found (${issues.length}):`);
        for (const issue of issues) {
          logger.warn(
            `  [Line ${issue.line}] ${issue.message}`
          );
        }
      } else {
        logger.info('No best practice issues found.');
      }

      if (suggestions && suggestions.length) {
        logger.info('Suggestions:');
        for (const suggestion of suggestions) {
  if (suggestion && typeof suggestion === "object") {
    const { line, message, suggestion: sug } = suggestion;
    logger.info(`  [Line ${line}] ${message} | Suggestion: ${sug}`);
  } else {
    logger.info(`  - ${suggestion}`);
  }
}
      } else {
        logger.info('No suggestions available.');
      }

      return { issues, suggestions };
    } catch (error) {
      logger.error('Error analyzing file for best practices:', error);
      return { issues: [], suggestions: [] };
    }
  }
}