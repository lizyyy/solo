# Network Policy Reachability Precheck CLI

A CLI tool to pre-check Kubernetes NetworkPolicy reachability before applying changes. This tool helps platform engineers validate traffic intents against NetworkPolicy configurations to identify potential connectivity issues.

## Features

- Parse Kubernetes YAML files (namespaces, pods, services)
- Parse NetworkPolicy YAML files
- Parse traffic intents from CSV
- Evaluate LabelSelector matching (including empty selectors)
- Check port name/number matching
- Handle cross-namespace access
- Generate Markdown and JSON reports
- Risk matrix analysis

## Installation

```bash
go build -o netpol-precheck ./cmd/netpol-precheck
mv netpol-precheck /usr/local/bin/
```

## Usage

```bash
netpol-precheck --k8s <k8s.yaml> --policy <policy.yaml> --intents <intents.csv> [--format markdown|json] [--output <file>]
```

### Arguments

- `--k8s`: Path to Kubernetes YAML file containing namespaces, pods, services
- `--policy`: Path to NetworkPolicy YAML file
- `--intents`: Path to traffic intents CSV file
- `--format`: Output format (markdown or json), default: markdown
- `--output`: Output file path, default: stdout

## Traffic Intents CSV Format

```csv
SourceNamespace,SourceLabels,DestinationNamespace,DestinationLabels,DestinationService,Port,Protocol,Description
frontend,app=frontend,tier=web,backend,app=backend,tier=api,,8080,TCP,Frontend to Backend API
frontend,app=frontend,backend,,backend-service,80,TCP,Frontend to Backend Service
```

### CSV Columns

- `SourceNamespace`: Source pod namespace
- `SourceLabels`: Source pod labels (comma-separated key=value pairs)
- `DestinationNamespace`: Destination pod/service namespace
- `DestinationLabels`: Destination pod labels
- `DestinationService`: Optional destination service name
- `Port`: Target port number
- `Protocol`: Protocol (TCP/UDP), default: TCP
- `Description`: Optional description

## Example

```bash
# Run with sample data
netpol-precheck --k8s sample/k8s.yaml --policy sample/policy.yaml --intents sample/traffic_intents.csv

# Output to JSON file
netpol-precheck --k8s sample/k8s.yaml --policy sample/policy.yaml --intents sample/traffic_intents.csv --format json --output report.json

# Output to Markdown file
netpol-precheck --k8s sample/k8s.yaml --policy sample/policy.yaml --intents sample/traffic_intents.csv --format markdown --output report.md
```

## Risk Levels

| Level | Color | Description |
|-------|-------|-------------|
| LOW | 🟩 | Traffic is explicitly allowed by policy |
| MEDIUM | 🟨 | No explicit policy allows this traffic |
| HIGH | 🟧 | Target or source pods not found |
| CRITICAL | 🟥 | Traffic will be blocked after policy change |

## Sample Output

```markdown
# Network Policy Reachability Precheck Report

## Summary
- Total traffic intents: 6
- Allowed: 3
- Denied: 3
- Critical risks: 2
- High risks: 1
- Medium risks: 1
- Low risks: 2

## Traffic Intent Results

| Source | Destination | Port | Protocol | Allowed | Risk Level | Reason |
|--------|-------------|------|----------|---------|------------|--------|
| frontend/map[app:frontend tier:web] | backend/map[app:backend tier:api] | 8080 | TCP | ✅ | 🟩 LOW | Allowed by policies: backend/backend-allow-frontend |
| frontend/map[app:frontend tier:web] | db/map[app:database tier:db] | 3306 | TCP | ❌ | 🟥 CRITICAL | Denied: no matching ingress rules found in policies |

## Risk Matrix

| Source | Destination | Port | Protocol | Allowed | Risk Level | Conflicting Policies |
|--------|-------------|------|----------|---------|------------|----------------------|
| frontend/map[app:frontend tier:web] | backend/map[app:backend tier:api] | 8080 | TCP | ✅ | 🟩 LOW | backend/backend-allow-frontend |

## Legend
- ✅ Allowed: Traffic is permitted by network policy
- ❌ Denied: Traffic is blocked by network policy
- 🟥 CRITICAL: Traffic will be blocked after policy change
- 🟧 HIGH: Target or source pods not found
- 🟨 MEDIUM: No explicit policy allows this traffic
- 🟩 LOW: Traffic is explicitly allowed by policy
```

## Testing

```bash
go test ./...
```

## Project Structure

```
.
├── cmd/
│   └── netpol-precheck/
│       └── main.go          # CLI entry point
├── pkg/
│   ├── engine/
│   │   └── reachability.go  # Policy evaluation engine
│   ├── model/
│   │   └── types.go         # Data models
│   ├── parser/
│   │   ├── yaml_parser.go   # YAML parsing
│   │   └── csv_parser.go    # CSV parsing
│   └── report/
│       └── reporter.go      # Report generation
├── sample/
│   ├── k8s.yaml             # Sample Kubernetes resources
│   ├── policy.yaml          # Sample NetworkPolicies
│   └── traffic_intents.csv  # Sample traffic intents
└── testdata/
    └── engine_test.go       # Unit tests
```

## Edge Cases Handled

- Empty LabelSelector (matches all pods)
- Missing labels on pods/namespaces
- Port name vs number matching
- Cross-namespace access
- Default deny policies
- Missing target pods/services
- Services without matching pods
