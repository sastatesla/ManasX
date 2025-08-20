#!/usr/bin/env node

/**
 * Quick test setup script for ManasX
 * Creates sample files and demonstrates functionality
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const testDir = 'test-workspace';

console.log('🚀 Setting up ManasX test environment...\n');

// Create test workspace
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

// Sample files to test different scenarios

// 1. AI-generated looking code
const aiCodeSample = `/**
 * This function processes user data and returns formatted results
 * @param {Object} userData - The user data object
 * @param {Object} options - Processing options
 * @returns {Object} Processed and formatted user data
 */
function processUserData(userData, options = {}) {
  // Validate input parameters
  if (!userData || typeof userData !== 'object') {
    throw new Error('userData must be a valid object');
  }

  // Initialize result object
  const result = {
    processed: true,
    timestamp: new Date().toISOString(),
    data: null
  };

  try {
    // Main processing logic
    const processedData = {
      id: userData.id || generateId(),
      name: userData.name || 'Unknown User',
      email: userData.email || '',
      settings: { ...defaultSettings, ...userData.settings }
    };

    // Apply any additional processing options
    if (options.includeMetadata) {
      processedData.metadata = {
        processedAt: result.timestamp,
        version: '1.0.0'
      };
    }

    result.data = processedData;
    return result;

  } catch (error) {
    console.error('Error processing user data:', error.message);
    throw new Error(\`Processing failed: \${error.message}\`);
  }
}

// Helper function to generate unique IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Default user settings
const defaultSettings = {
  theme: 'light',
  notifications: true,
  language: 'en'
};`;

// 2. Code that violates common patterns
const badPracticeCode = `var userName = "test_user"; // Should use const and camelCase

// Using eval - security violation
eval('console.log("This is dangerous")');

function helper(data) {
  // TODO: Implement this function properly
  return data;
}

// Synchronous file operation
const fs = require('fs');
const content = fs.readFileSync('./somefile.txt');

// Poor error handling
function riskyFunction() {
  return JSON.parse(someUndefinedVariable);
}

// Using innerHTML - XSS risk
document.getElementById('content').innerHTML = userInput;`;

// 3. Good practice code (follows patterns)
const goodCode = `const apiClient = {
  async fetchUserData(userId) {
    try {
      const response = await fetch(\`/api/users/\${userId}\`);
      
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      throw error;
    }
  }
};

const userService = {
  async createUser(userData) {
    // Human verified: This function handles user creation with proper validation
    const validatedData = this.validateUserData(userData);
    return await apiClient.createUser(validatedData);
  },
  
  validateUserData(userData) {
    if (!userData.email || !userData.name) {
      throw new Error('Email and name are required');
    }
    return userData;
  }
};`;

// Write test files
fs.writeFileSync(path.join(testDir, 'ai-generated.js'), aiCodeSample);
fs.writeFileSync(path.join(testDir, 'bad-practices.js'), badPracticeCode);
fs.writeFileSync(path.join(testDir, 'good-code.js'), goodCode);

console.log('✅ Created test files in', testDir);
console.log('   - ai-generated.js (AI-typical patterns)');
console.log('   - bad-practices.js (Various violations)');
console.log('   - good-code.js (Good practices)\n');

// Create a minimal organizational rules file
const sampleRules = {
  "metadata": {
    "version": "1.0.0",
    "name": "Test Organization Rules",
    "description": "Sample rules for testing ManasX",
    "author": "Test Suite"
  },
  "global": {
    "severity": "medium"
  },
  "rules": {
    "security": {
      "enabled": true,
      "rules": {
        "no-eval": {
          "name": "No eval() usage",
          "severity": "critical",
          "enabled": true
        },
        "no-dangerous-html": {
          "name": "No innerHTML usage", 
          "severity": "high",
          "enabled": true
        }
      }
    },
    "naming": {
      "enabled": true,
      "rules": {
        "consistent-variables": {
          "name": "Use camelCase for variables",
          "severity": "low",
          "enabled": true
        }
      }
    }
  },
  "exceptions": []
};

fs.writeFileSync('test-rules.json', JSON.stringify(sampleRules, null, 2));
console.log('✅ Created test-rules.json\n');

console.log('🧪 Quick Test Commands:');
console.log('');
console.log('1. Learn patterns from test workspace:');
console.log('   node src/cli/index.js learn test-workspace');
console.log('');
console.log('2. Detect AI-generated code:');
console.log('   node src/cli/index.js ai-detect test-workspace/ai-generated.js');
console.log('');
console.log('3. Check compliance with test rules:');
console.log('   node src/cli/index.js compliance test-workspace -r test-rules.json');
console.log('');
console.log('4. Start continuous monitoring:');
console.log('   node src/cli/index.js watch test-workspace -r test-rules.json');
console.log('');
console.log('5. Check MCP server (after starting watch):');
console.log('   curl http://localhost:8765/health');
console.log('');

// Test if we can run a basic command
try {
  console.log('🔍 Testing basic CLI functionality...');
  const result = execSync('node src/cli/index.js --help', { encoding: 'utf8' });
  console.log('✅ CLI is working!\n');
  
  console.log('📋 Available commands:');
  // Extract commands from help output
  const commands = result.match(/^\s+(\w+(?:\s+\w+)*)\s+.+$/gm);
  if (commands) {
    commands.slice(0, 10).forEach(cmd => {
      console.log('   ', cmd.trim());
    });
  }
  
} catch (error) {
  console.log('❌ CLI test failed:', error.message);
  console.log('   Make sure to run: npm install');
}

console.log('\n🎯 Next Steps:');
console.log('1. Set up your GROQ API key if you haven\'t already');
console.log('2. Run the test commands above');
console.log('3. Try modifying files in test-workspace/ while monitoring is active');
console.log('4. Check the generated logs in .manasx/ directory');
console.log('\nHappy testing! 🚀');