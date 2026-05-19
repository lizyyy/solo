#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from binary_scanner.core.file_parser import FileParser, FileInfo
from binary_scanner.core.signature import SignatureVerifier
from binary_scanner.rules.risk_engine import RiskEngine
from binary_scanner.report.generator import ReportGenerator

class BinaryScannerCLI:
    def __init__(self):
        self.parser = argparse.ArgumentParser(
            description="Binary File Signature Hash Risk Scan CLI",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  %(prog)s --dir /path/to/scan --output report.json
  %(prog)s --file /path/to/binary --format json,csv
  %(prog)s --dir /path/to/scan --rules --summary
  %(prog)s --list-rules
            """
        )
        self._setup_arguments()

    def _setup_arguments(self):
        group = self.parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--dir", type=str, help="Directory to scan")
        group.add_argument("--file", type=str, help="Single file to scan")
        group.add_argument("--list-rules", action="store_true", help="List all available risk rules")
        
        self.parser.add_argument("--output", type=str, help="Output file path (without extension)")
        self.parser.add_argument("--format", type=str, default="json", 
                            help="Output format(s): json, csv, summary (comma-separated)")
        self.parser.add_argument("--no-signature", action="store_true", 
                            help="Skip signature verification (faster)")
        self.parser.add_argument("--no-recursive", action="store_true",
                            help="Don't scan directories recursively")
        self.parser.add_argument("--follow-symlinks", action="store_true",
                            help="Follow symbolic links")
        self.parser.add_argument("--max-size", type=int, default=100,
                            help="Max file size in MB (default: 100)")
        self.parser.add_argument("--summary", action="store_true",
                            help="Print summary to console")
        self.parser.add_argument("--rules", action="store_true",
                            help="Show risk rules applied in summary")

    def run(self, args=None):
        parsed_args = self.parser.parse_args(args)
        
        if parsed_args.list_rules:
            self._print_rule_list()
            return 0
        
        if parsed_args.dir:
            if not Path(parsed_args.dir).exists():
                print(f"Error: Directory '{parsed_args.dir}' does not exist", file=sys.stderr)
                return 1
            results = self._scan_directory(parsed_args)
        elif parsed_args.file:
            if not Path(parsed_args.file).exists():
                print(f"Error: File '{parsed_args.file}' does not exist", file=sys.stderr)
                return 1
            results = self._scan_file(parsed_args)
        else:
            self.parser.print_help()
            return 1
        
        if parsed_args.output or parsed_args.summary:
            self._generate_output(results, parsed_args)
        
        if parsed_args.summary:
            self._print_console_summary(results)
        
        return 0

    def _scan_directory(self, args) -> List[FileInfo]:
        print(f"Scanning directory: {args.dir}")
        
        parser = FileParser(max_file_size=args.max_size * 1024 * 1024)
        recursive = not args.no_recursive
        
        file_infos = parser.scan_directory(
            args.dir,
            recursive=recursive,
            follow_symlinks=args.follow_symlinks
        )
        
        print(f"Found {len(file_infos)} files")
        
        return self._process_files(file_infos, args)

    def _scan_file(self, args) -> List[FileInfo]:
        print(f"Scanning file: {args.file}")
        
        parser = FileParser(max_file_size=args.max_size * 1024 * 1024)
        file_info = parser.parse_file(args.file)
        
        if not file_info:
            print("Error: Could not parse file", file=sys.stderr)
            return []
        
        return self._process_files([file_info], args)

    def _process_files(self, file_infos: List[FileInfo], args) -> List[FileInfo]:
        if not args.no_signature:
            print("Verifying signatures...")
            verifier = SignatureVerifier()
            for file_info in file_infos:
                file_info.signature_info = verifier.verify_signature(file_info.file_path)
        
        print("Evaluating risks...")
        risk_engine = RiskEngine()
        for file_info in file_infos:
            risk_result = risk_engine.evaluate_file(file_info)
            file_info.risk_level = risk_result["overall_risk"]
            file_info.risk_reasons = risk_result["risk_reasons"]
        
        return file_infos

    def _generate_output(self, results: List[FileInfo], args):
        output_formats = [f.strip().lower() for f in args.format.split(',')]
        output_base = args.output or "scan_report"
        
        generator = ReportGenerator()
        
        for fmt in output_formats:
            if fmt == "json":
                path = f"{output_base}.json"
                generator.generate_json_report(results, path)
                print(f"JSON report saved to: {path}")
            elif fmt == "csv":
                path = f"{output_base}.csv"
                generator.generate_csv_report(results, path)
                print(f"CSV report saved to: {path}")
            elif fmt == "summary":
                path = f"{output_base}.txt"
                generator.generate_summary_report(results, path)
                print(f"Summary report saved to: {path}")
            else:
                print(f"Warning: Unknown format '{fmt}'", file=sys.stderr)

    def _print_console_summary(self, results: List[FileInfo]):
        print("\n" + "=" * 80)
        print("SCAN SUMMARY")
        print("=" * 80)
        
        risk_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'unknown': 0}
        for r in results:
            level = r.risk_level.lower()
            if level in risk_counts:
                risk_counts[level] += 1
            else:
                risk_counts['unknown'] += 1
        
        print(f"\nTotal Files Scanned: {len(results)}")
        print("\nRisk Breakdown:")
        for level, count in risk_counts.items():
            if count > 0:
                indicator = "  "
                if level == 'critical':
                    indicator = "!!"
                elif level == 'high':
                    indicator = "! "
                print(f"  {indicator} {level.upper():10} : {count}")
        
        high_risk = [r for r in results if r.risk_level in ['critical', 'high']]
        if high_risk:
            print("\nHigh Risk Files:")
            for r in sorted(high_risk, key=lambda x: x.risk_level):
                print(f"  [{r.risk_level.upper()}] {r.file_path}")
                for reason in r.risk_reasons[:2]:
                    print(f"      - {reason}")
        
        print("\n" + "=" * 80 + "\n")

    def _print_rule_list(self):
        print("=" * 80)
        print("AVAILABLE RISK RULES")
        print("=" * 80 + "\n")
        
        risk_engine = RiskEngine()
        rules = risk_engine.get_rule_descriptions()
        
        for rule in rules:
            status = "✓" if rule['enabled'] == 'True' else "✗"
            print(f"[{status}] {rule['id']} - {rule['name']}")
            print(f"      Level: {rule['level'].upper()}")
            print(f"      {rule['description']}")
            print()
        
        print(f"Total: {len(rules)} rules\n")

def main():
    cli = BinaryScannerCLI()
    return cli.run()

if __name__ == "__main__":
    sys.exit(main())
