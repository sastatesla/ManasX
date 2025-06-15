import fs from 'fs/promises';
import PerformanceAnalyzer from '../analysis/PerformanceAnalyzer.js';
import { logger } from '../utils/logger.js';

// Utility to normalize various possible field names to codeSnippet for issues/suggestions
function normalizeIssue(issue) {
  if (!issue || typeof issue !== "object") return issue;
  let codeSnippet = issue.codeSnippet || issue['code snippet'] || issue.snippet || '';
  return {
    ...issue,
    codeSnippet,
  };
}
function normalizeSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") return suggestion;
  let codeSnippet = suggestion.codeSnippet || suggestion.code || '';
  return {
    ...suggestion,
    codeSnippet,
  };
}

export default class PerformanceAgent {
  /**
   * Analyze file for performance issues, metrics, and log detailed suggestions.
   * @param {string} file - Path to the file to analyze.
   * @returns {Promise<{metrics: Object, issues: Array, suggestions: Array}>}
   */
  async analyze(file) {
    if (!file) {
      logger.error('No file path provided to analyze.');
      return { metrics: {}, issues: [], suggestions: [] };
    }

    logger.info(`Analyzing ${file} for performance issues...`);
    try {
      const content = await fs.readFile(file, 'utf-8');
      if (!content.trim()) {
        logger.warn(`The file ${file} is empty. No analysis performed.`);
        return { metrics: {}, issues: [], suggestions: [] };
      }

      const { metrics = {}, issues = [], suggestions = [] } = await PerformanceAnalyzer.analyze(file);

      // Log metrics, if any
      if (metrics && Object.keys(metrics).length > 0) {
        logger.info('Performance metrics:');
        for (const [key, value] of Object.entries(metrics)) {
          logger.info(`  - ${key}: ${value}`);
        }
      } else {
        logger.info('No performance metrics found.');
      }

      // Normalize and log issues, if any
      if (issues && issues.length) {
        logger.info(`Performance issues found (${issues.length}):`);
        for (const rawIssue of issues) {
          const issue = normalizeIssue(rawIssue);
          if (issue && typeof issue === "object") {
            const { type, line, message, codeSnippet } = issue;
            logger.info(
              `  [${type ? type + ' | ' : ''}Line ${line}] ${message}` +
              (codeSnippet ? `\n    Code: ${codeSnippet}` : '')
            );
          } else {
            logger.info(`  - ${issue}`);
          }
        }
      } else {
        logger.info('No performance issues found.');
      }

      // Normalize and log suggestions, if any
      if (suggestions && suggestions.length) {
        logger.info('Suggestions:');
        for (const rawSuggestion of suggestions) {
          const suggestion = normalizeSuggestion(rawSuggestion);
          if (suggestion && typeof suggestion === "object") {
            const { description, codeSnippet } = suggestion;
            logger.info(
              `  - ${description}` +
              (codeSnippet ? `Code: ${codeSnippet}` : '')
            );
          } else {
            logger.info(`  - ${suggestion}`);
          }
        }
      } else {
        logger.info('No suggestions available.');
      }

      return { metrics, issues, suggestions };
    } catch (error) {
      logger.error('Error analyzing file for performance issues:', error);
      return { metrics: {}, issues: [], suggestions: [] };
    }
  }
}