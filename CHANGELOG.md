# Changelog

All notable changes to ManasX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-04-09
### Added
- **Team Identity Tracking**: `manasx identity set/show` commands to track developer identities, branches, and teams.
- **Review Workflow**: A persistent offline database (`ViolationTracker.js`) with `manasx review list/approve/waive/flag` commands to establish a secure review process instead of just monitoring.
- **SARIF Code Scanning**: Natively added Github Advanced Security output capability to CI checks via `manasx ci check src --format sarif`. 
- **CI Scaffold Initialization**: `manasx ci init github` provides a quickstart pipeline configurations.
- **Reporting Command**: `manasx report` exports structured data filtering into `.csv` and `.json` formats.
- **Git Guardrails Engine**: `manasx hooks install` strictly installs a local `pre-commit` Git hook running `manasx hooks check-commit` to prevent unauthorized AI-generated code leaks.
- **Analysis Execution Queue**: File monitors now wrap the Groq communication in an `AnalysisQueue` saving unchanged content hashes and limiting massive parallel directory changes from exhausting API quotas.
- **MCP Agent Contract**: Exposed `get-agent-contract` inside the MCP Server giving AI-assistants like Cursor standard protocol definitions prior to making project edits.
- **Rule Verification & Signing**: `manasx rules sign` and `verify` calculate a cryptographic hash ensuring organizational rule definitions haven't been quietly modified.
- **PII Scrubbing**: `manasx --redact-pii` strips localized strings and secrets out of the memory-buffer before querying external Large Language Models.

### Fixed
- **Watcher Max Limit Exhaustion**: Fully migrated raw O(n) OS `fs.watch` recursions to the more efficient `chokidar` library.
- **Runtime ESM Bugs**: Re-factored native `require('fs/promises')` inclusions breaking under Node ES-Modules inside `AIAuditor`.
- **Duplicate CLI Registration**: Fixed Commander crashing when double registering the `rules` actions and defaulting required arguments incorrectly.
- Extraneous logs stripped out of the core LLM execution block.
