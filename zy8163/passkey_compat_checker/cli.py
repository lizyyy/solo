"""
CLI entry point for Passkey/FIDO2 compatibility checker
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

from .loaders import DataLoader
from .validators import CompatibilityValidator
from .reporters import ReportGenerator


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        prog='passkey-compat-check',
        description='Passkey/FIDO2 Credential Compatibility Pre-check CLI Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Basic usage with sample data
  passkey-compat-check \\
    --rp-config samples/relying_party.json \\
    --auth-logs samples/authenticator_logs.jsonl \\
    --browser-matrix samples/browser_matrix.yaml \\
    --users samples/users.csv \\
    --output-dir ./output

  # Verbose mode
  passkey-compat-check -v \\
    --rp-config relying_party.json \\
    --auth-logs authenticator_logs.jsonl \\
    --browser-matrix browser_matrix.yaml \\
    --users users.csv
        '''
    )
    
    parser.add_argument(
        '--rp-config',
        required=True,
        help='Path to relying_party.json configuration file'
    )
    
    parser.add_argument(
        '--auth-logs',
        required=True,
        help='Path to authenticator_logs.jsonl log file'
    )
    
    parser.add_argument(
        '--browser-matrix',
        required=True,
        help='Path to browser_matrix.yaml file'
    )
    
    parser.add_argument(
        '--users',
        required=True,
        help='Path to users.csv file'
    )
    
    parser.add_argument(
        '--output-dir',
        default='.',
        help='Directory to output reports (default: current directory)'
    )
    
    parser.add_argument(
        '--issues-csv',
        default=None,
        help='Path for issues.csv output (overrides --output-dir)'
    )
    
    parser.add_argument(
        '--report-md',
        default=None,
        help='Path for compat_report.md output (overrides --output-dir)'
    )
    
    parser.add_argument(
        '--diff-html',
        default=None,
        help='Path for diff.html output (overrides --output-dir)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 1.0.0'
    )
    
    args = parser.parse_args()
    
    try:
        return run_check(
            rp_config_path=args.rp_config,
            auth_logs_path=args.auth_logs,
            browser_matrix_path=args.browser_matrix,
            users_path=args.users,
            output_dir=args.output_dir,
            issues_csv=args.issues_csv,
            report_md=args.report_md,
            diff_html=args.diff_html,
            verbose=args.verbose,
        )
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


def run_check(
    rp_config_path: str,
    auth_logs_path: str,
    browser_matrix_path: str,
    users_path: str,
    output_dir: str = '.',
    issues_csv: Optional[str] = None,
    report_md: Optional[str] = None,
    diff_html: Optional[str] = None,
    verbose: bool = False,
) -> int:
    """Run the compatibility check"""
    
    if verbose:
        print('🔍 Passkey/FIDO2 Compatibility Pre-check Tool')
        print('=' * 50)
        print()
    
    if verbose:
        print('📂 Validating input files...')
    
    validation = DataLoader.validate_input_files(
        rp_path=rp_config_path,
        logs_path=auth_logs_path,
        matrix_path=browser_matrix_path,
        users_path=users_path,
    )
    
    missing = [name for name, exists in validation.items() if not exists]
    if missing:
        print(f'Error: Missing or unreadable files: {", ".join(missing)}', file=sys.stderr)
        return 1
    
    if verbose:
        print('  ✓ All input files found')
    
    if verbose:
        print()
        print('📥 Loading data...')
    
    rp_config = DataLoader.load_relying_party_config(rp_config_path)
    browser_matrix = DataLoader.load_browser_matrix(browser_matrix_path)
    users = DataLoader.load_users(users_path)
    logs = DataLoader.load_authenticator_logs(auth_logs_path)
    
    if verbose:
        print(f'  ✓ RP Config: {rp_config.rp_name} ({rp_config.rp_id})')
        print(f'  ✓ Browser Matrix: {len(browser_matrix)} browser entries')
        print(f'  ✓ Users: {len(users)} users')
        print(f'  ✓ Authenticator Logs: {len(logs)} entries')
    
    if verbose:
        print()
        print('🔬 Running compatibility checks...')
    
    validator = CompatibilityValidator(
        rp_config=rp_config,
        browser_matrix=browser_matrix,
        users=users,
        logs=logs,
    )
    
    report = validator.validate_all()
    
    if verbose:
        print(f'  ✓ Total issues found: {len(report.issues)}')
        
        severity_counts = report.summary.get('severity_distribution', {})
        for severity in ['critical', 'high', 'medium', 'low', 'info']:
            count = severity_counts.get(severity, 0)
            if count > 0:
                print(f'    - {severity.upper()}: {count}')
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    issues_csv_path = issues_csv or str(output_path / 'issues.csv')
    report_md_path = report_md or str(output_path / 'compat_report.md')
    diff_html_path = diff_html or str(output_path / 'diff.html')
    
    if verbose:
        print()
        print('📄 Generating reports...')
    
    reporter = ReportGenerator(report)
    
    reporter.generate_issues_csv(issues_csv_path)
    if verbose:
        print(f'  ✓ {issues_csv_path}')
    
    reporter.generate_compat_report_md(report_md_path)
    if verbose:
        print(f'  ✓ {report_md_path}')
    
    reporter.generate_diff_html(diff_html_path)
    if verbose:
        print(f'  ✓ {diff_html_path}')
    
    print()
    print('✅ Compatibility check completed!')
    print()
    print('📊 Summary:')
    print(f'  - Users analyzed: {report.total_users}')
    print(f'  - Credentials analyzed: {report.total_credentials}')
    print(f'  - Log entries processed: {report.total_log_entries}')
    print(f'  - Issues detected: {len(report.issues)}')
    print()
    print('📁 Output files:')
    print(f'  - {issues_csv_path}')
    print(f'  - {report_md_path}')
    print(f'  - {diff_html_path}')
    print()
    print('💡 Open diff.html in your browser for an interactive visualization.')
    
    if report.issues:
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
