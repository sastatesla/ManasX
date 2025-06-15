#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

const CONFIG_PATH = path.join(os.homedir(), '.manasxrc');

function saveKey(key) {
  fs.writeFileSync(CONFIG_PATH, `GROQ_API_KEY=${key}\n`);
}

function getKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (fs.existsSync(CONFIG_PATH)) {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const match = content.match(/GROQ_API_KEY=(.*)/);
    if (match) return match[1].trim();
  }
  return null;
}

async function promptForKey() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter your GROQ API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function ensureApiKey() {
  let key = getKey();
  if (!key) {
    console.log('\n[manasx setup] GROQ_API_KEY not found.');
    key = await promptForKey();
    saveKey(key);
    console.log('\n[GROQ_API_KEY saved to ~/.manasxrc]\n');
  }
  process.env.GROQ_API_KEY = key;
  return key;
}

await ensureApiKey();
import('../src/cli/index.js');