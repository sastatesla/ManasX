import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';

const API_KEY = process.env.GROQ_API_KEY || process.env.AI_MODEL_API_KEY;
const API_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";

/**
 * DRY utility to call Groq/OpenAI-compatible chat API.
 * @param {string} prompt - The system/user prompt for the model.
 * @param {object} [options] - Optional: { model, temperature }
 * @returns {Promise<string>} - The raw content returned by the model.
 */
async function callGroqChatModel(prompt, options = {}) {
  if (!API_KEY) throw new Error("GROQ_API_KEY is not set.");
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature !== undefined ? options.temperature : 0.2;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  // Try both OpenAI-compatible and Groq format
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  } else if (typeof data.choices?.[0]?.text === "string") {
    return data.choices[0].text;
  } else {
    throw new Error("Unexpected response format from Groq");
  }
}

/**
 * Call Groq API with Llama 3 for code review and best practices.
 * @param {string} code - The source code to review.
 * @param {string} filename - The name of the file.
 * @returns {Promise<Array>} Suggestions in the format [{line, message, suggestion}]
 */
export async function callAiModelOnCode(code, filename) {
  const prompt = `
You are an expert JavaScript reviewer. Analyze the following code for best practices, maintainability, and style. 
Identify specific lines with issues and provide suggestions in this JSON array format:
[{"line": <line number>, "message": <short message>, "suggestion": <suggestion>}]. 
Only output JSON. 

File: ${filename}
Code:
${code}
`;
  const content = await callGroqChatModel(prompt);
  try {
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

/**
 * Call Groq API to analyze code for performance metrics, issues, and suggestions.
 * @param {string} code - The source code to analyze.
 * @param {string} filename - The name of the file.
 * @returns {Promise<{metrics: Object, issues: Array, suggestions: Array}>}
 */
export async function callAiModelOnPerformance(code, filename) {
  const prompt = `
You are a code performance analysis assistant. Analyze the following ${filename} file for performance metrics, common performance issues, and actionable suggestions.
Return ONLY a valid JSON object with these keys:
- metrics: an object with keys like cyclomaticComplexity, functionCount, loopCount, maxNestingDepth, and any other relevant metrics.
- issues: an array of objects; each has type, message, line, and code snippet indicating the performance issue.
- suggestions: an array of actionable suggestions to improve performance.

DO NOT include any extra text, comments, or markdown. Return ONLY the JSON.

Code to analyze:
---
${code}
---
`;

  const content = await callGroqChatModel(prompt);

  // Extract the first JSON object from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }
  } else {
    console.error("No JSON object found in AI response.");
  }

  return { metrics: {}, issues: [], suggestions: [] };
}