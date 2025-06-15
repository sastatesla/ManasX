# ManasX

**ManasX** is a powerful, AI-driven command-line tool for analyzing the performance of JavaScript and TypeScript source files. It detects performance bottlenecks, computes key metrics, and suggests actionable improvements—all from your terminal. 

---

## Features

- **AI-Powered Static Analysis:** Uses advanced AI models to analyze your code for performance issues and inefficiencies.
- **Comprehensive Metrics:** Reports metrics such as cyclomatic complexity, function count, loop count, and maximum nesting depth.
- **Actionable Suggestions:** Provides clear, line-specific recommendations and code snippets to improve performance.
- **Issue Detection:** Identifies inefficient code patterns, unoptimized loops, deeply nested logic, and more.
- **CLI Simplicity:** Analyze your code with a single command—no need to write any code or import modules.
- **Supports JS and TS:** Works out of the box with both JavaScript and TypeScript files.
- **Customizable/Extensible:** Easily integrate with your workflow or CI/CD for automated code health checks.

---

## Installation

Install globally via npm:

```sh
npm install -g manasx
```

---

## API Key Setup

On first run, ManasX will prompt you to enter your GROQ API key and save it securely in `~/.manasxrc`.
You only need to do this once.

Get your GROQ API key at: https://console.groq.com/

If you ever need to update the key, just edit `~/.manasxrc` or set the `GROQ_API_KEY` environment variable.

## Usage 01

Analyze a file for performance issues:

```sh
manasx perf path/to/yourfile.js
```

**Example:**

```sh
manasx perf src/app.js
```


## Usage 02

Analyze a file for performance issues:

```sh
manasx debug path/to/yourfile.js
```

**Example:**

```sh
manasx debug src/app.js
```

The tool will print:
- Key performance metrics
- Any detected performance issues (with types, lines, and code snippets)
- AI-generated suggestions for improvement (with line numbers and sample code, if available)

---

## Example Output

```
Analyzing src/app.js for performance issues...
Performance metrics:
  - cyclomaticComplexity: 7
  - functionCount: 3
  - loopCount: 2
  - maxNestingDepth: 3

Performance issues found (2):
  [loop | Line 15] Unoptimized for-loop detected.
    Code: for (let i = 0; i < arr.length; i++) { ... }
  [nesting | Line 32] Deeply nested conditional logic.
    Code: if (a) { if (b) { if (c) { ... } } }

Suggestions:
  - [Line 15] Use Array.prototype.map() for better performance and readability.
    Code: arr.map(item => ...)
  - [Line 32] Refactor nested conditionals into separate functions or use guard clauses.
```

---

## Command-Line Options

- `-h`, `--help`: Show usage information.
- `-v`, `--version`: Show the current version of ManasX.

---

## How It Works

1. **Reads your source file** and sends it (securely) to an AI-powered analysis engine.
2. **Analyzes** for performance metrics and anti-patterns.
3. **Prints** results and actionable suggestions to your terminal.

---

## Use Cases

- **Code Reviews:** Instantly check for performance issues before merging PRs.
- **Learning:** See real examples of how to optimize code, with references to the exact lines.
- **Automation:** Integrate with CI/CD to fail builds on critical performance issues.
- **Refactoring:** Get a prioritized list of what to improve in legacy codebases.

---

## Contributing

Pull requests, bug reports, and feature suggestions are welcome! Please [open an issue](https://github.com/yourusername/manasx/issues) or submit a PR.

---

## License

MIT

---

## Disclaimer

- ManasX uses AI models and may require an API key for remote analysis.
- Your code is processed securely and not stored.
- Suggestions are best-effort and may not cover all edge cases.

---

