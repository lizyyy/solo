# Local Storage Migrator

CLI tool for rehearsing IndexedDB/localStorage data migrations before production releases.

## Features

- **Snapshot-based migration testing**: Load multiple user data snapshots and replay migrations
- **Version chain execution**: Execute migrations sequentially from old to new versions
- **Field-level diff**: Track exactly what changes in each migration step
- **Validation rules**: YAML-based validation rules with type checking, range validation, etc.
- **Rollback support**: Automatic rollback on migration failure with seed data for recovery
- **Report generation**: markdown reports and JSON summaries

## Installation

```bash
npm install
```

## Quick Start

```bash
npm run demo
```

This runs a demo with sample snapshots, migrations, and rules.

## Project Structure

```
src/
├── cli.js              # CLI entry point
├── snapshot-parser.js  # Snapshot loading and version detection
├── migration-executor.js # Migration chain execution with rollback
├── rule-validator.js    # YAML rule validation and diff computation
└── report-exporter.js   # Report generation (markdown + JSON)
```

## Sample Data

### Snapshots (`sample/snapshots/`)

JSON files representing user local storage at different versions:

```json
{
  "version": 1,
  "data": { "user": { "name": "John" } },
  "metadata": { "source": "indexedDB" }
}
```

### Migrations (`sample/migrations/`)

Migration scripts named with version prefix:

```javascript
module.exports = {
  up: async (data, context) => {
    data.user.displayName = data.user.name;
    delete data.user.name;
    return data;
  },
  down: async (data, context) => {
    data.user.name = data.user.displayName;
    delete data.user.displayName;
    return data;
  }
};
```

### Rules (`sample/rules/rules.yaml`)

```yaml
validations:
  - version: "*"
    field: user.name
    rules:
      - type: string
      - required: true
```

## Usage

```bash
node src/cli.js \
  --snapshots sample/snapshots \
  --migrations sample/migrations \
  --rules sample/rules/rules.yaml \
  --output sample/output \
  --from 1 \
  --to 3 \
  --verbose
```

### Options

- `-s, --snapshots <path>`: Directory containing snapshot JSON files (required)
- `-m, --migrations <path>`: Directory containing migration scripts (required)
- `-r, --rules <path>`: YAML file with validation rules (required)
- `-o, --output <path>`: Output directory for reports (required)
- `-f, --from <version>`: Starting version
- `-t, --to <version>`: Target version
- `-v, --verbose`: Verbose output
- `--skip-validation`: Skip rule validation

## Output

After running, you'll get:

- `migration_report.md`: Detailed markdown report with all steps
- `summary.json`: Machine-readable summary
- `rollback_seeds.json`: Seed data for rollback (if failures occurred)

## Testing

```bash
npm test
```

## Demo

Run `npm run demo` to execute a full migration chain with sample data.

The demo:

1. Loads 3 snapshots (v1, v2, v3)
2. Executes 2 migrations (v2 and v3)
3. Validates each step against rules
4. Generates reports in `sample/output/`
