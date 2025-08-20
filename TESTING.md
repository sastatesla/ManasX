# Testing ManasX Enterprise Governance Platform

This guide walks you through testing all the new governance features of ManasX.

## Prerequisites

1. **Install Dependencies**
```bash
npm install
```

2. **Set up GROQ API Key** (if not already done)
```bash
# The tool will prompt you on first run, or set manually:
export GROQ_API_KEY="your_groq_api_key_here"
# OR create ~/.manasxrc with: GROQ_API_KEY=your_key_here
```

## 🧪 Testing Workflow (Step-by-Step)

### Step 1: Learn Your Codebase Patterns

```bash
# Learn patterns from the ManasX codebase itself
node src/cli/index.js learn src/

# This will:
# - Analyze naming conventions (camelCase, snake_case, etc.)
# - Learn import patterns (relative vs absolute)
# - Identify folder structures
# - Save results to patterns.json
```

**Expected Output:**
- Console showing analysis progress
- `patterns.json` file created with learned patterns
- Summary of confidence level and recommendations

### Step 2: Initialize Organizational Rules

```bash
# Create a sample rule configuration
node src/cli/index.js rules init

# This creates manasx-rules.json with default enterprise rules
```

**Expected Output:**
- `manasx-rules.json` file created
- Console confirmation of rule initialization

### Step 3: Test Individual Analysis Commands

#### 3.1 Test AI Code Detection
Create a test file with AI-like patterns:

```bash
# Create test file
cat > test-ai-code.js << 'EOF'
/**
 * This function calculates the total sum of an array
 * @param {Array} numbers - Array of numbers to sum
 * @returns {number} The total sum
 */
function calculateTotal(numbers) {
  // Helper function to validate input
  if (!numbers || !Array.isArray(numbers)) {
    throw new Error('Input must be an array');
  }
  
  let result = 0;
  // Main logic for summing
  for (let i = 0; i < numbers.length; i++) {
    result += numbers[i];
  }
  return result;
}

// Example usage:
const data = [1, 2, 3, 4, 5];
console.log(calculateTotal(data));
EOF

# Test AI detection
node src/cli/index.js ai-detect test-ai-code.js
```

**Expected Output:**
- High confidence AI detection score
- List of AI indicators (verbose comments, generic naming, etc.)
- Recommendation message

#### 3.2 Test Drift Detection
```bash
# Test drift detection against learned patterns
node src/cli/index.js drift test-ai-code.js

# Should show compliance score and any pattern violations
```

#### 3.3 Test AI Auditing
```bash
# Run full AI audit
node src/cli/index.js ai-audit test-ai-code.js

# Should detect AI code and suggest improvements
```

### Step 4: Test Continuous Monitoring (Core Feature)

#### 4.1 Start Monitoring in Background
```bash
# Start continuous monitoring (runs forever until Ctrl+C)
node src/cli/index.js watch src/ &

# This will:
# - Start file watching
# - Launch MCP server on port 8765
# - Create .manasx/ directory with logs
```

**Expected Output:**
```
Starting continuous monitoring on src/...
Loaded learned patterns for drift detection
Loaded organizational rules
Monitor started successfully. Watching X files.
Continuous monitoring active. Press Ctrl+C to stop.
MCP Server running on port 8765 for AI tool integration
AI tools can now query organizational context and rules via MCP protocol
```

#### 4.2 Test Real-time Detection
In another terminal, make changes to trigger analysis:

```bash
# Create a new file to trigger monitoring
cat > src/test-monitored-file.js << 'EOF'
// This should trigger AI detection and rule violations
eval('console.log("dangerous code")'); // Security violation

var badVariable = "should use const"; // Naming violation

function helper() { // AI-like naming
  // TODO: Implement this function
  return null;
}
EOF

# The monitor should immediately detect and log violations
```

**Expected Output in Monitor Terminal:**
```
[INFO] src/test-monitored-file.js AI-generated code detected
[WARN] [src/test-monitored-file.js] Found 3 violations
  [CRITICAL] Use of eval() is prohibited for security reasons
  [LOW] Variable 'badVariable' should use camelCase naming
  [HIGH] Remove AI placeholder comments and implement proper code
```

#### 4.3 Check Monitoring Status
```bash
# In another terminal, check status
node src/cli/index.js status

# Should show active monitoring and recent activity
```

### Step 5: Test MCP Integration (AI Tool Integration)

#### 5.1 Test MCP Server Health
```bash
# Test if MCP server is responding
curl http://localhost:8765/health

# Should return: {"healthy":true,"monitor":true,"timestamp":"..."}
```

#### 5.2 Test MCP Tools
```bash
# Get organizational context
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/get-organizational-context",
    "params": {}
  }'

# Check code compliance
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/check-code-compliance",
    "params": {
      "code": "const test = \"hello world\";",
      "filename": "test.js"
    }
  }'
```

**Expected Output:**
- JSON response with organizational context
- Compliance score and any violations

### Step 6: Test Full Compliance Workflow

```bash
# Run comprehensive compliance check
node src/cli/index.js compliance src/

# Should analyze all files against learned patterns and organizational rules
```

## 🔍 Testing Scenarios

### Scenario 1: AI Code Detection
**Purpose:** Verify AI code detection accuracy

1. Create files with AI-typical patterns:
   - Verbose JSDoc comments
   - Generic variable names (result, data, response)
   - Perfect error handling patterns
   - Template-like structure

2. Test detection confidence levels

3. Verify audit recommendations

### Scenario 2: Pattern Drift Detection
**Purpose:** Verify drift detection against learned patterns

1. Learn patterns from existing codebase
2. Create files that violate learned patterns:
   - Different naming convention
   - Different import style
   - Different folder structure
3. Verify drift scores and violation reporting

### Scenario 3: Organizational Rule Enforcement
**Purpose:** Test custom rule enforcement

1. Modify `manasx-rules.json` with custom rules
2. Create code that violates these rules
3. Verify rule enforcement and reporting

### Scenario 4: Continuous Integration
**Purpose:** Test real-time monitoring during development

1. Start monitoring
2. Simulate development workflow:
   - Create new files
   - Modify existing files
   - Save frequently
3. Verify real-time detection and logging

## 📊 Expected Test Results

### Successful Tests Should Show:

1. **Pattern Learning:**
   - Confidence score (low/medium/high)
   - Learned naming conventions
   - Import preferences
   - Folder structure patterns

2. **AI Detection:**
   - Confidence scores (0-1)
   - Specific indicators found
   - Appropriate recommendations

3. **Drift Detection:**
   - Compliance scores (0-100)
   - Specific violations with line numbers
   - Severity levels

4. **Continuous Monitoring:**
   - Real-time file change detection
   - Analysis within 1-2 seconds of file changes
   - MCP server accessibility
   - Structured logging

5. **MCP Integration:**
   - HTTP endpoints responding
   - JSON-RPC tools working
   - Organizational context accessible

## 🐛 Troubleshooting Common Issues

### Issue: GROQ API Key Not Found
```bash
# Solution: Set up API key
echo "GROQ_API_KEY=your_key_here" > ~/.manasxrc
```

### Issue: No Patterns File
```bash
# Solution: Run learning first
node src/cli/index.js learn .
```

### Issue: Monitor Not Starting
```bash
# Check for permission issues with .manasx directory
mkdir -p .manasx
chmod 755 .manasx
```

### Issue: MCP Server Port Conflict
```bash
# Use different port
node src/cli/index.js watch --mcp-port 8766
```

### Issue: No File Changes Detected
```bash
# Check file extensions are supported (.js, .ts, .jsx, .tsx)
# Ensure files are in watched directory
# Check console for error messages
```

## 📈 Performance Testing

### Load Testing
```bash
# Create multiple files rapidly to test monitoring performance
for i in {1..10}; do
  echo "console.log('test file $i');" > test-file-$i.js
  sleep 0.1
done
```

### Memory Usage
```bash
# Monitor memory usage during long-running monitoring
# Should stay stable over time
ps aux | grep "node.*watch"
```

## ✅ Success Criteria

The system is working correctly if:

1. ✅ Pattern learning completes without errors and saves patterns.json
2. ✅ AI code detection identifies AI-generated patterns with reasonable accuracy
3. ✅ Drift detection catches deviations from learned patterns
4. ✅ Continuous monitoring starts successfully and watches files
5. ✅ MCP server responds to HTTP requests and provides organizational context
6. ✅ Real-time analysis occurs within 1-2 seconds of file changes
7. ✅ Log files are created and contain structured data
8. ✅ Status command shows accurate monitoring information

## 🔄 Integration with AI Tools

### For Claude Code CLI Users:
The MCP server exposes organizational context that Claude can query to provide context-aware code suggestions.

### For Cursor Users:
The structured logs in `.manasx/context.log` can be consumed to provide real-time governance feedback.

### For Other AI Tools:
The MCP protocol provides a standard way for any AI coding assistant to integrate with ManasX governance data.

---

**Next Steps After Testing:**
- Set up continuous monitoring in your development workflow
- Configure organizational rules for your team
- Integrate with your preferred AI coding tools
- Set up team-wide pattern learning and rule sharing