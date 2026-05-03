# Passkey/FIDO2 Credential Compatibility Pre-check CLI

A local CLI tool for pre-checking Passkey/FIDO2 credential compatibility issues before they affect your users.

## Features

- **RP ID Validation**: Check for mismatched relying party IDs
- **Resident Key Check**: Verify discoverable credential requirements
- **UV/UP Flag Validation**: Ensure user verification and presence requirements
- **Algorithm Support Check**: Detect unsupported or unknown COSE algorithms
- **Signature Counter Regression Detection**: Identify cloned credentials via counter rollbacks
- **Cross-Device Sync Risk Analysis**: Detect credentials used across multiple devices
- **Interactive HTML Reports**: Visualize issues with a browser-based dashboard

## Installation

```bash
# Clone the repository
cd passkey-compat-checker

# Install the package
pip install -e .

# Or install with dev dependencies for testing
pip install -e ".[dev]"
```

## Quick Start

### Using Sample Data

The tool comes with sample data that demonstrates various compatibility issues:

```bash
# Run with sample data (verbose mode)
passkey-compat-check -v \
  --rp-config samples/relying_party.json \
  --auth-logs samples/authenticator_logs.jsonl \
  --browser-matrix samples/browser_matrix.yaml \
  --users samples/users.csv \
  --output-dir ./output
```

### Sample Output

```
🔍 Passkey/FIDO2 Compatibility Pre-check Tool
==================================================

📂 Validating input files...
  ✓ All input files found

📥 Loading data...
  ✓ RP Config: Example Inc. (example.com)
  ✓ Browser Matrix: 8 browser entries
  ✓ Users: 5 users
  ✓ Authenticator Logs: 31 entries

🔬 Running compatibility checks...
  ✓ Total issues found: 9
    - CRITICAL: 1
    - HIGH: 3
    - MEDIUM: 5

📄 Generating reports...
  ✓ output/issues.csv
  ✓ output/compat_report.md
  ✓ output/diff.html

✅ Compatibility check completed!

📊 Summary:
  - Users analyzed: 5
  - Credentials analyzed: 11
  - Log entries processed: 31
  - Issues detected: 9

📁 Output files:
  - output/issues.csv
  - output/compat_report.md
  - output/diff.html

💡 Open diff.html in your browser for an interactive visualization.
```

## Input Files

### 1. relying_party.json

Relying Party configuration specifying your security requirements:

```json
{
  "rp_id": "example.com",
  "rp_name": "Example Inc.",
  "origins": [
    "https://example.com",
    "https://app.example.com"
  ],
  "resident_key_required": true,
  "user_verification_required": true,
  "supported_algorithms": [-7, -257],
  "cross_device_allowed": false
}
```

**Fields:**
- `rp_id`: The expected relying party ID
- `resident_key_required`: Whether discoverable credentials are required
- `user_verification_required`: Whether UV (biometric/PIN) is required
- `supported_algorithms`: List of supported COSE algorithm IDs
- `cross_device_allowed`: Whether cross-device credential sync is allowed

### 2. authenticator_logs.jsonl

Newline-delimited JSON logs of authenticator operations:

```json
{"credential_id": "cred-001", "user_id": "user-001", "rp_id": "example.com", "timestamp": "2024-01-15T08:30:00Z", "sign_count": 1, "resident_key": true, "user_verified": true, "user_present": true, "algorithm": -7, "device_id": "device-mac-001", "browser": "Chrome", "browser_version": "120.0.6099", "platform": "macOS"}
```

**Key fields for validation:**
- `sign_count`: Signature counter (must be strictly increasing)
- `resident_key`: Whether the credential is discoverable
- `user_verified`: User verification (UV) flag
- `user_present`: User presence (UP) flag
- `algorithm`: COSE algorithm ID
- `device_id`: Unique device identifier for cross-device detection

### 3. browser_matrix.yaml

Browser compatibility matrix for reference:

```yaml
browsers:
  - browser: Chrome
    version: "120+"
    platform: macOS
    fido2_supported: true
    resident_key_supported: true
    user_verification_supported: true
    supported_algorithms: [-7, -8, -257, -37]
```

### 4. users.csv

User information for reference:

```csv
user_id,username,display_name,email
user-001,john.doe,John Doe,john.doe@example.com
```

## Output Files

### 1. issues.csv

Machine-readable issue list:

| Column | Description |
|--------|-------------|
| `issue_id` | Unique issue identifier (e.g., ISS-0001) |
| `category` | Issue category (rp_id, resident_key, uv_up, etc.) |
| `severity` | Severity level (critical, high, medium, low, info) |
| `title` | Brief issue title |
| `description` | Detailed description |
| `affected_credential_ids` | Semicolon-separated credential IDs |
| `affected_user_ids` | Semicolon-separated user IDs |
| `affected_devices` | Semicolon-separated device IDs |
| `additional_info` | JSON blob with extra details |
| `timestamp` | When the issue was detected |

### 2. compat_report.md

Human-readable markdown report with:
- Executive summary
- Issue severity distribution
- Algorithm usage statistics
- Browser compatibility analysis
- Detailed issue breakdowns

### 3. diff.html

**Interactive HTML dashboard** featuring:
- 📊 **Overview tab**: Summary statistics and bar charts
- 🔍 **Issues tab**: Filterable, expandable issue cards
- 🔢 **Algorithms tab**: Algorithm usage visualization
- 🌐 **Browsers tab**: Browser compatibility breakdown

**Open in your browser:**
```bash
# macOS
open output/diff.html

# Linux
xdg-open output/diff.html

# Windows
start output/diff.html
```

## Issue Categories

| Category | Severity | Description |
|----------|----------|-------------|
| `rp_id` | HIGH | Mismatched relying party ID |
| `resident_key` | MEDIUM | Non-resident key when required |
| `uv_up` | HIGH/MEDIUM | Missing user verification or presence |
| `algorithm` | HIGH | Unsupported algorithm |
| `unknown_algorithm` | MEDIUM | Algorithm not in COSE registry |
| `counter` | CRITICAL/HIGH | Signature counter regression |
| `sync_risk` | MEDIUM | Cross-device sync detected |

## Edge Cases Handled

### 1. Unknown Algorithms

The tool identifies algorithms not in the standard COSE registry:

```
Algorithm: 999 (Unknown)
Category: unknown_algorithm
Severity: MEDIUM
```

**Sample scenario** in `samples/authenticator_logs.jsonl`:
```json
{"credential_id": "cred-unknown-algo-005", ..., "algorithm": 999, ...}
```

### 2. Cross-Device Counter Regression

Special handling for credentials that appear on multiple devices with regressive counters:

```
Credential: cred-cross-device-regress-008
From: device-mac-003 (count: 21)
To: device-ios-002 (count: 10)
Delta: -11
Is Cross-Device: true
Severity: HIGH
```

**This is distinct from same-device regressions:**
- **Same-device (CRITICAL)**: Strong indicator of credential cloning
- **Cross-device (HIGH)**: May indicate sync issues or platform keychain problems

## Command Reference

```bash
passkey-compat-check --help

Usage: passkey-compat-check [OPTIONS]

  Passkey/FIDO2 Credential Compatibility Pre-check CLI Tool

Options:
  --rp-config TEXT           Path to relying_party.json [required]
  --auth-logs TEXT           Path to authenticator_logs.jsonl [required]
  --browser-matrix TEXT      Path to browser_matrix.yaml [required]
  --users TEXT               Path to users.csv [required]
  --output-dir TEXT          Output directory [default: .]
  --issues-csv TEXT          Custom path for issues.csv
  --report-md TEXT           Custom path for compat_report.md
  --diff-html TEXT           Custom path for diff.html
  -v, --verbose              Enable verbose output
  --version                  Show version
  --help                     Show this message
```

## Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=passkey_compat_checker
```

## Sample Data Details

The `samples/` directory contains test data covering various scenarios:

| Credential | Issue | Description |
|------------|-------|-------------|
| `cred-normal-001` | None | Perfectly valid credential |
| `cred-rp-mismatch-002` | RP_ID | Wrong domain |
| `cred-no-resident-003` | RESIDENT_KEY | Non-discoverable |
| `cred-no-uv-004` | UV_UP | No user verification |
| `cred-unknown-algo-005` | UNKNOWN_ALGORITHM | Algorithm 999 (unknown) |
| `cred-unsupported-algo-006` | ALGORITHM | EdDSA (-8) not in RP list |
| `cred-counter-regress-007` | COUNTER (CRITICAL) | Same-device rollback |
| `cred-cross-device-regress-008` | COUNTER (HIGH) | Cross-device rollback |
| `cred-cross-device-sync-009` | SYNC_RISK | Multiple devices |
| `cred-no-up-010` | UV_UP | No user presence |
| `cred-normal-011` | None | Another valid credential |

## Architecture

```
passkey_compat_checker/
├── __init__.py       # Package version
├── models.py         # Data classes (Issue, CredentialState, etc.)
├── loaders.py        # File parsers (JSON, YAML, CSV, JSONL)
├── validators.py     # Core validation logic
├── reporters.py      # Report generators (CSV, MD, HTML)
└── cli.py            # Command-line interface
```

## License

MIT License - see LICENSE file for details.
