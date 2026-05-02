# OTel Sampling Replay

Offline replay tool for OpenTelemetry sampling rules. Allows backend platform teams to test sampling rule changes against historical trace data before applying them in production.

## Features

- **Trace Parsing**: Load traces from JSONL format
- **Service Map**: Import service topology from YAML
- **Sampling Rules**: Define head-based and tail-based sampling rules
- **Trace Tree Reconstruction**: Rebuild complete trace/span trees
- **Orphan Span Detection**: Identify spans with non-existent parents
- **Clock Skew Detection**: Detect clock regression issues
- **Mixed Sampling Analysis**: Handle traces with different sampling decisions
- **Blind Path Detection**: Find error chains that may become invisible

## Installation

```bash
npm install
```

## Demo

Run the demo with sample data:

```bash
npm run demo
```

This will:
1. Parse sample traces from `sample/traces.jsonl`
2. Load service map from `sample/service-map.yaml`
3. Apply sampling rules from `sample/sampling-rules.yaml`
4. Generate `replay_report.md` and `kept_traces.json`

## Usage

```bash
otel-replay --traces <traces.jsonl> --services <service-map.yaml> --rules <sampling-rules.yaml> [--output <dir>]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--traces` | Path to traces JSONL file | Yes |
| `--services` | Path to service map YAML file | Yes |
| `--rules` | Path to sampling rules YAML file | Yes |
| `--output` | Output directory for reports | No (default: .) |

## Sample Data Format

### traces.jsonl

Each line is a JSON object representing a span:

```json
{
  "traceId": "abc123def456",
  "spanId": "span001",
  "parentSpanId": null,
  "serviceName": "api-gateway",
  "operationName": "POST /api/users",
  "startTime": 1704067200000,
  "endTime": 1704067200500,
  "status": { "code": 0 },
  "attributes": { "http.method": "POST" },
  "events": []
}
```

### service-map.yaml

```yaml
services:
  - name: api-gateway
    type: gateway
  - name: user-service
    type: backend

connections:
  - from: api-gateway
    to: user-service
```

### sampling-rules.yaml

```yaml
rules:
  - name: drop-errors
    type: tail
    conditions:
      - attribute: status.code
        operator: eq
        value: 1
    action: keep
    errorsOnly: true

  - name: sample-healthy
    type: head
    conditions:
      - attribute: http.status_code
        operator: eq
        value: 200
    action: keep
    probability: 0.1
```

### Sampling Rule Operators

- `eq`, `==`: Equals
- `neq`, `!=`: Not equals
- `gt`, `>`: Greater than
- `lt`, `<`: Less than
- `gte`, `>=`: Greater than or equal
- `lte`, `<=`: Less than or equal
- `contains`: String contains
- `exists`: Attribute exists

## Output

### replay_report.md

Contains:
- Summary statistics
- List of kept/dropped traces
- Blind paths (error chains that may become invisible)
- Mixed sampling traces
- Orphan span traces
- Clock skew warnings

### kept_traces.json

Contains the full trace data for traces that would be kept by the sampling rules.

## Architecture

```
src/
├── parser/           # Input file parsing
│   ├── traces.ts       # JSONL trace parser
│   ├── serviceMap.ts   # YAML service map parser
│   └── samplingRules.ts
├── model/           # Trace data modeling
│   ├── types.ts        # TypeScript interfaces
│   └── traceBuilder.ts # Tree reconstruction
├── engine/          # Sampling rule engine
│   └── samplingEngine.ts
├── reporter/        # Report generation
│   └── reporter.ts
└── cli/             # CLI interface
    └── cli.ts
```

## Testing

```bash
npm test
```

## License

MIT