import fs from 'fs/promises';
import { callAiModelOnPerformance } from '../utils/AiModel.js';

/**
 * PerformanceAnalyzer analyzes source files for performance metrics, issues, and suggestions.
 */
export default class PerformanceAnalyzer {
  /**
   * Analyze a source code file for performance artifacts and metrics.
   * @param {string} filePath - Path to the JS/TS file to analyze.
   * @returns {Promise<{metrics: Object, issues: Array, suggestions: Array}>}
   */
  static async analyze(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf-8');
      if (!code.trim()) return {
        metrics: {},
        issues: [],
        suggestions: []
      };
      // Call your AI model for performance analysis
      const result = await callAiModelOnPerformance(code, filePath);

      // Defensive: Ensure result shape
      return {
        metrics: result && typeof result.metrics === 'object' ? result.metrics : {},
        issues: Array.isArray(result?.issues) ? result.issues : [],
        suggestions: Array.isArray(result?.suggestions) ? result.suggestions : []
      };
    } catch (err) {
        console.error(`Error analyzing file ${filePath}:`, err);
      return {
        metrics: {},
        issues: [],
        suggestions: []
      };
    }
  }
}