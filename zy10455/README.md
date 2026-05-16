# OpenAPI Sample Fuzzer

A command-line tool to test OpenAPI schema compatibility by perturbing example values and validating them against the schema.

## Features

- **Schema Parsing**: Automatically extracts examples from OpenAPI specifications (YAML/JSON)
- **Perturbation Rules**: Applies various mutation strategies to test schema robustness
- **Validation**: Validates perturbed samples against the original schema
- **Comprehensive Reporting**: Generates terminal summary, JSON, and HTML reports
- **Coverage Statistics**: Tracks which rules and schema paths were tested

## Installation

```bash
npm install
npm run build
npm link  # Optional: to make 'openapi-fuzz' command available globally
```

## Usage

### Basic Usage

```bash
npx ts-node src/cli.ts -i examples/openapi-normal.yaml
```

### With Custom Output Directory

```bash
npx ts-node src/cli.ts -i examples/openapi-dirty.yaml -o ./my-results
```

### Fail Fast Mode (stop on first failure)

```bash
npx ts-node src/cli.ts -i examples/openapi-normal.yaml --fail-fast
```

### Specific Output Format

```bash
npx ts-node src/cli.ts -i examples/openapi-normal.yaml -f json
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <file>` | Path to OpenAPI file (required) | |
| `-o, --output <directory>` | Output directory for reports | `./fuzz-results` |
| `-r, --rules <file>` | Path to custom fuzz rules configuration | |
| `-f, --format <format>` | Output format: json, html, or both | `both` |
| `-v, --verbose` | Enable verbose output | |
| `--fail-fast` | Stop on first validation failure | |
| `-h, --help` | Display help message | |

## Perturbation Rules

The fuzzer applies the following perturbation rules by default:

| Rule | Description |
|------|-------------|
| **Replace with null** | Replace non-null values with null to test nullability |
| **Replace with empty string** | Replace string values with empty strings |
| **Shuffle array items** | Randomly shuffle array items to test order sensitivity |
| **Reverse array** | Reverse the order of array items |
| **Sort array** | Sort array items alphabetically |
| **Remove required field** | Remove required fields from objects |
| **Add extra field** | Add unexpected fields to objects |

## Output Reports

The tool generates three types of output:

1. **Terminal Summary** - Color-coded summary with key metrics and top failures
2. **JSON Report** (`fuzz-report.json`) - Machine-readable complete report
3. **HTML Report** (`fuzz-report.html`) - Beautiful, shareable HTML report for team review

## Example Output

```
╔════════════════════════════════════════╗
║           OpenAPI Fuzz Results          ║
╚════════════════════════════════════════╝

📊 Summary
  Total Tests:     42
  ✓ Passed:        28
  ✗ Failed:        14
  Pass Rate:       66.7%
  Duration:        156ms

📈 Coverage
  Rules Applied:   7/7
  Samples Found:   12
  Perturbations:   42
  Schema Paths:    8

❌ Failures
  1. Replace with null
     Location:    $.paths./users.get.responses.200.content.application/json.example
     Operation:   Replaced value with null
     Original:    [{"id":1,...}]
     Perturbed:   null
     Errors:
       - type: must be array
```

## Testing

```bash
npm test
```

## Project Structure

```
src/
├── cli/              # CLI interface
├── schema/           # OpenAPI schema parsing
├── fuzzer/           # Perturbation logic
├── validation/       # Schema validation
├── report/           # Report generation
├── types/            # TypeScript type definitions
└── cli.ts            # Entry point
```

## License

MIT
