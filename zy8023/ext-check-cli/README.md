# Browser Extension Publishing Pre-Check CLI

A local CLI tool for browser extension teams to pre-check extensions before publishing to Chrome Web Store, Firefox Add-ons, or other marketplaces.

## Features

- **Manifest V2/V3 Detection**: Detects manifest version mixing issues
- **Host Permissions Analysis**: Checks for overly broad host permissions
- **Content Scripts Conflict Detection**: Identifies overlapping content script patterns
- **Asset Validation**: Verifies icons, version, privacy policy, and locale files
- **Permission Whitelist**: Validates permissions against a configurable whitelist YAML
- **Wildcard Domain Handling**: Properly handles `<all_urls>`, `https://*/*`, and `*://*.example.com/*` patterns
- **Default Locale Validation**: Ensures required locale files exist

## Installation

```bash
cd ext-check-cli
npm install
```

## Usage

```bash
node src/cli/index.js --dir <extension-directory> --whitelist <whitelist.yaml> --output <output-dir>
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Extension source directory |
| `--manifest` | `-m` | Path to manifest.json (alternative to --dir) |
| `--whitelist` | `-w` | Path to permission whitelist YAML |
| `--changelog` | `-c` | Path to changelog file |
| `--output` | `-o` | Output directory for reports |
| `--verbose` | `-v` | Verbose output |
| `--help` | `-h` | Show help message |

### Quick Start

```bash
# Run with sample extension
npm start

# Or run directly
node src/cli/index.js \
  --dir samples/sample-extension \
  --whitelist samples/permission-whitelist.yaml \
  --output out
```

## Output

The tool generates three files in the output directory:

1. **findings.json** - Structured JSON with all findings
2. **report.md** - Human-readable Markdown report
3. **checklist.txt** - Executable fix checklist

## Permission Whitelist Format

```yaml
allowed_permissions:
  - storage
  - activeTab

allowed_hosts:
  - https://example.com/*
  - https://api.example.org/*
```

## Project Structure

```
ext-check-cli/
├── src/
│   ├── manifest/
│   │   └── parser.js      # Manifest V2/V3 parsing and analysis
│   ├── permissions/
│   │   └── checker.js     # Permission whitelist validation
│   ├── assets/
│   │   └── validator.js   # Icon, version, privacy, locale checks
│   ├── reports/
│   │   └── exporter.js    # Report generation (JSON, MD, checklist)
│   └── cli/
│       └── index.js       # CLI entry point
├── samples/
│   ├── sample-extension/   # Good extension sample
│   ├── sample-extension-bad/ # Extension with issues
│   └── permission-whitelist.yaml
└── out/                    # Generated reports
```

## Checks Performed

### Manifest Analysis
- Manifest V2 vs V3 mixing detection
- Background script/page conflict
- Content scripts service_worker vs scripts conflict

### Permission Checks
- Sensitive permissions not in whitelist
- Overly broad host permissions (`<all_urls>`, `*://*/*`)
- Wildcard subdomain patterns

### Asset Validation
- Required icons (128.png for Chrome Web Store)
- Semantic version format
- Privacy policy file presence
- Default locale directory and messages.json

### Content Scripts
- Overlapping match patterns
- Missing exclude_matches
