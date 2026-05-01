# Helm Drift Checker

A Helm upgrade drift pre-flight CLI for platform engineers.

## Features

- **Field Change Detection**: Compare current values vs target chart defaults
- **Deprecated Configuration: Detect deprecated fields still in use
- **Resource Limit/Probe Risk**: Check resource quotas and probe configurations
- **Conflict Detection**: Identify conflicts across environment overrides
- **Manual Confirmation Plan**: Generate actionable patch_plan.md
- **Issues Report**: Export issues to CSV

## Installation

```bash
pip install -e .
```

## Usage

### Basic Usage with Sample Data

```bash
helm-drift-checker \
  --current-values helm_drift_checker/samples/current_values.yaml \
  --target-defaults helm_drift_checker/samples/target_defaults.yaml \
  --cluster-snapshot helm_drift_checker/samples/cluster_snapshot.json \
  --upgrade-policy helm_drift_checker/samples/upgrade_policy.yaml \
  --output-dir ./output
```

### With Environment Overrides for Conflict Detection

```bash
helm-drift-checker \
  --current-values helm_drift_checker/samples/current_values.yaml \
  --target-defaults helm_drift_checker/samples/target_defaults.yaml \
  --cluster-snapshot helm_drift_checker/samples/cluster_snapshot.json \
  --upgrade-policy helm_drift_checker/samples/upgrade_policy.yaml \
  --env-overrides helm_drift_checker/samples/env_dev.yaml helm_drift_checker/samples/env_prod.yaml \
  --output-dir ./output
```

## Input Files

### current_values.yaml
Your current Helm release values.

### target_defaults.yaml
The new chart's default values.yaml.

### cluster_snapshot.json
JSON snapshot of your cluster resources:

```json
{
  "resources": {
    "deployments": [...],
    "statefulsets": [...],
    "daemonsets": [...]
  }
}
```

### upgrade_policy.yaml
Configuration for upgrade rules:

```yaml
deprecated_fields:
  - oldField
risk_thresholds:
  resource_limits:
    cpu: "2"
    memory: "2Gi"
required_manual_confirm:
  - replicaCount
  - service.type
allowed_changes:
  - image.tag
conflict_resolution: manual
```

## Output Files

### patch_plan.md
Detailed change plan with checkboxes for manual confirmation.

### issues.csv
All issues in CSV format for easy importing.

## Project Structure

```
helm_drift_checker/
├── parser/          # File parsers for YAML, JSON, policy
├── diff/            # Configuration diff engine
├── rules/           # Validation and risk assessment rules
├── report/          # Report generation (patch_plan.md, issues.csv)
├── samples/         # Sample input data
└── cli.py          # Command-line interface
```

## License

MIT
