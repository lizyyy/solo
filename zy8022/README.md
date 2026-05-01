# Email DNS Health Checker

A Python CLI tool for performing email delivery DNS health checks on domains before launching new sending domains.

## Features

- **SPF Validation**: Checks SPF records for validity, include loops, and 10 lookup limit
- **DKIM Validation**: Verifies DKIM records exist and are valid for specified selectors
- **DMARC Validation**: Checks DMARC records, policies, and alignment
- **Duplicate TXT Detection**: Finds duplicate TXT records
- **Risk-Based Reporting**: Generates reports with critical, warning, and info levels
- **Multiple Output Formats**: Markdown and CSV reports

## Installation

```bash
pip install -e .
```

Or install dependencies:

```bash
pip install -r requirements.txt
```

## Quick Start

1. Initialize sample files:

```bash
email-dns-checker init
```

2. Run the check:

```bash
email-dns-checker check -d samples/domains.csv -r samples/dns_records.json -p samples/provider_policy.yaml
```

## Usage

### Commands

#### `check` - Run DNS health check

```bash
email-dns-checker check [OPTIONS]
```

Options:
- `-d, --domains TEXT`: Path to domains CSV file (required)
- `-r, --dns-records TEXT`: Path to DNS records JSON file (required)
- `-p, --policy TEXT`: Path to provider policy YAML file (required)
- `-m, --output-markdown TEXT`: Output Markdown report file (default: report.md)
- `-c, --output-csv TEXT`: Output CSV report file (default: report.csv)

Example:

```bash
email-dns-checker check \
  -d domains.csv \
  -r dns_records.json \
  -p provider_policy.yaml \
  -m my_report.md \
  -c my_report.csv
```

#### `init` - Initialize sample files

```bash
email-dns-checker init
```

Creates sample configuration files in the current directory.

## Input Files

### 1. domains.csv

CSV file containing domains to check and their DKIM selectors.

```csv
domain,selectors
example.com,selector1,selector2
test-domain.com,default
good-domain.com,mail
```

### 2. dns_records.json

JSON file containing offline DNS records for all domains and subdomains.

```json
{
  "example.com": {
    "TXT": [
      "v=spf1 include:_spf.google.com -all"
    ]
  },
  "selector1._domainkey.example.com": {
    "TXT": [
      "v=DKIM1; k=rsa; p=..."
    ]
  },
  "_dmarc.example.com": {
    "TXT": [
      "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
    ]
  }
}
```

### 3. provider_policy.yaml

YAML file defining email provider policies.

```yaml
providers:
  - name: google_workspace
    spf_includes:
      - _spf.google.com
    dkim_selectors:
      - google
    dmarc_org_domain: example.com
```

## Checks Performed

### SPF Checks
- `SPF_MISSING`: No valid SPF record found
- `SPF_MULTIPLE`: Multiple SPF records found
- `SPF_TOO_MANY_LOOKUPS`: SPF exceeds 10 DNS lookups
- `SPF_INCLUDE_LOOP`: SPF include loop detected
- `SPF_MISSING_INCLUDE`: Missing recommended SPF include

### DKIM Checks
- `DKIM_MISSING`: DKIM record missing for selector
- `DKIM_INVALID`: Invalid DKIM record

### DMARC Checks
- `DMARC_MISSING`: No valid DMARC record found
- `DMARC_MULTIPLE`: Multiple DMARC records found
- `DMARC_NO_POLICY`: DMARC record missing policy (p=)
- `DMARC_POLICY_NONE`: DMARC policy set to 'none'
- `DMARC_ALIGNMENT_MISMATCH`: DMARC org domain mismatch

### Other Checks
- `TXT_DUPLICATE`: Duplicate TXT records found

## Output Reports

### Markdown Report
Human-readable report with summary and detailed results by domain.

### CSV Report
Machine-readable report suitable for integration with other tools.

## Project Structure

```
email-dns-checker/
├── email_dns_checker/
│   ├── __init__.py
│   ├── parser.py          # Input file parsers (CSV, JSON, YAML)
│   ├── rule_engine.py     # Validation rules (SPF, DKIM, DMARC)
│   ├── report.py          # Report generation (Markdown, CSV)
│   └── cli.py             # CLI interface
├── samples/
│   ├── domains.csv
│   ├── dns_records.json
│   └── provider_policy.yaml
├── tests/
│   └── test_checker.py
├── setup.py
├── requirements.txt
└── README.md
```

## Development

### Running Tests

```bash
python -m pytest tests/
```

## License

MIT License
