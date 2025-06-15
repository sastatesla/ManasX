import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { callAiModelOnCode } from '../utils/AiModel.js';

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


/**
 * Recursively collect all JS files from a directory.
 */
async function getAllJSFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getAllJSFiles(res));
    } else if (entry.name.endsWith('.js')) {
      files.push(res);
    }
  }
  return files;
}

// async function callAIModelOnCode(code, filename) {
//   const prompt = `You are a code reviewer. Review the following JavaScript code for best practices, maintainability, and style. Suggest improvements. Respond in JSON: [{line, message, suggestion}].\n\nFile: ${filename}\n\nCode:\n${code}`;
//   const completion = await openai.chat.completions.create({
//     messages: [{ role: 'user', content: prompt }],
//     model: 'gpt-4o',
//   });
//   // Parse completion.choices[0].message.content as JSON.
//   // Handle errors as needed.
//   return JSON.parse(completion.choices[0].message.content);
// }

export default class BestPracticesAnalyzer {
  /**
   * Analyze a file or directory using ESLint and an AI model.
   * @param {string} fileOrDir - Path to a file or directory.
   * @returns {Promise<Array>} List of issues (from ESLint + AI).
   */
  static async analyze(fileOrDir) {
    let filesToCheck = [];
    const stat = fs.statSync(fileOrDir);
    if (stat.isDirectory()) {
      filesToCheck = await getAllJSFiles(fileOrDir);
    } else {
      filesToCheck = [path.resolve(fileOrDir)];
    }

    // 1. ESLint
    const eslint = new ESLint({ fix: false });
    const results = await eslint.lintFiles(filesToCheck);

    const issues = [];
    for (const result of results) {
      for (const msg of result.messages) {
        issues.push({
          source: 'ESLint',
          file: result.filePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
          rule: msg.ruleId,
          severity: msg.severity === 2 ? 'error' : 'warning'
        });
      }
    }

    // 2. AI Model
    for (const filePath of filesToCheck) {
      const code = fs.readFileSync(filePath, 'utf-8');
      const aiSuggestions = await callAiModelOnCode(code, filePath);
      for (const ai of aiSuggestions) {
        issues.push({
          source: 'AI',
          file: filePath,
          line: ai.line,
          message: ai.message,
          suggestion: ai.suggestion,
          severity: 'info'
        });
      }
    }

    return issues;
  }
}