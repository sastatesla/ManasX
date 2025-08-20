import fs from 'fs';
import path from 'path';
import { callAiModelOnCode } from '../utils/AiModel.js';

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

export default class SimpleBestPracticeAnalyzer {
  static async analyze(fileOrDir) {
    let filesToCheck = [];
    const stat = fs.statSync(fileOrDir);
    if (stat.isDirectory()) {
      filesToCheck = await getAllJSFiles(fileOrDir);
    } else {
      filesToCheck = [path.resolve(fileOrDir)];
    }

    const issues = [];

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