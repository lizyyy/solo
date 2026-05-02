# Plugin Validator CLI

Offline CLI tool for validating low-code platform plugins. Executes plugin hooks in a sandboxed environment and validates schema compatibility, timeout constraints, and side effects.

## Features

- 📋 Manifest validation
- 🔒 Sandboxed execution using VM2
- ✅ Input/Output schema validation with JSON Schema
- ⏱️ Timeout enforcement
- 🚫 Side effect detection (forbidden APIs)
- 🔄 Platform version compatibility check
- 📊 Markdown and JSONL report generation

## Project Structure

```
src/
├── types.ts              # TypeScript type definitions
├── manifest-parser.ts    # Manifest file parser
├── fixture-loader.ts     # Test fixture loader
├── policy-loader.ts      # Security policy loader
├── sandbox.ts            # Sandboxed executor
├── schema-validator.ts   # JSON Schema validator
├── test-orchestrator.ts  # Test orchestration
├── report-exporter.ts    # Report generation
└── cli.ts                # CLI entry point

example-plugin/
├── plugin-manifest.json  # Plugin manifest
├── policy.yaml           # Security policy
├── hooks/                # Plugin hooks
└── fixtures/             # Test fixtures
```

## Installation

```bash
npm install
npm run build
```

## Usage

### Validate a Plugin

```bash
npm run demo
# Or directly
node dist/cli.js ./example-plugin
```

### Specify Platform Version

```bash
node dist/cli.js ./example-plugin --platform-version 2.0.0
```

## Plugin Structure

A valid plugin must have:

### 1. `plugin-manifest.json`

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "platformVersion": "2.0.0",
  "hooks": [
    {
      "id": "my-hook",
      "entry": "hooks/my-hook.js",
      "timeout": 2000,
      "inputSchema": {
        "type": "object",
        "properties": { "name": { "type": "string" } },
        "required": ["name"]
      },
      "outputSchema": {
        "type": "object",
        "properties": { "greeting": { "type": "string" } },
        "required": ["greeting"]
      }
    }
  ]
}
```

### 2. `policy.yaml`

```yaml
forbiddenAPIs:
  - fs
  - net
  - http
  - https
maxExecutionTime: 5000
allowedGlobals:
  - console
  - JSON
  - Math
  - Date
```

### 3. Hook Files

Create JavaScript files in the `hooks/` directory with a `handler` function:

```javascript
function handler(input) {
  return {
    greeting: `Hello ${input.name}`
  };
}
```

### 4. Fixture Files

Create JSON files in the `fixtures/` directory:

```json
{
  "name": "test-case-1",
  "hookId": "my-hook",
  "input": { "name": "World" }
}
```

## Reports

After validation, two reports are generated:

### `compatibility_report.md`

Human-readable Markdown report with detailed results.

### `traces.jsonl`

Machine-readable JSONL (JSON Lines) file with execution traces.

## Example Plugin

The `example-plugin/` directory includes:

1. **transform-data** - A valid working hook
2. **timeout-hook** - A hook that intentionally times out
3. **drift-output** - A hook that returns mismatched output schema

Run `npm run demo` to see the validation in action!

## Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Watch and compile
- `npm run demo` - Run demo on example plugin
- `npm test` - Run tests (when implemented)

## License

MIT