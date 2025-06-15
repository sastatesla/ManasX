import fs from 'fs/promises';
import { callAiModelOnPerformance } from '../utils/AiModel.js';

export default class PerformanceAnalyzer {
  /**
   * @param {string} filePath 
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
      const result = await callAiModelOnPerformance(code, filePath);

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