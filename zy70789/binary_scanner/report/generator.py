import json
import csv
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
import hashlib

class ReportGenerator:
    def __init__(self):
        pass

    def generate_json_report(self, scan_results: List[Any], output_path: str, pretty_print: bool = True) -> str:
        report_data = self._build_report_structure(scan_results)
        
        indent = 2 if pretty_print else None
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=indent, sort_keys=True, ensure_ascii=False)
        
        return output_path

    def generate_csv_report(self, scan_results: List[Any], output_path: str) -> str:
        rows = []
        for result in scan_results:
            row = self._flatten_file_info(result)
            rows.append(row)
        
        if rows:
            fieldnames = sorted(list(rows[0].keys()))
            with open(output_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for row in rows:
                    writer.writerow(row)
        
        return output_path

    def generate_summary_report(self, scan_results: List[Any], output_path: str) -> str:
        summary = self._calculate_summary(scan_results)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("           BINARY SIGNATURE HASH RISK SCAN SUMMARY REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Scan Date: {summary['scan_date']}\n")
            f.write(f"Total Files Scanned: {summary['total_files']}\n")
            f.write(f"Total Size: {self._format_size(summary['total_size'])}\n\n")
            
            f.write("-" * 80 + "\n")
            f.write("Risk Level Summary\n")
            f.write("-" * 80 + "\n")
            for level, count in sorted(summary['risk_summary'].items()):
                f.write(f"  {level.upper():10} : {count} files\n")
            f.write("\n")
            
            f.write("-" * 80 + "\n")
            f.write("File Type Summary\n")
            f.write("-" * 80 + "\n")
            for ftype, count in sorted(summary['file_type_summary'].items()):
                f.write(f"  {ftype:30} : {count} files\n")
            f.write("\n")
            
            f.write("-" * 80 + "\n")
            f.write("Signature Summary\n")
            f.write("-" * 80 + "\n")
            f.write(f"  Files with Signature: {summary['signature_summary']['signed']}\n")
            f.write(f"  Files without Signature: {summary['signature_summary']['unsigned']}\n")
            f.write(f"  Valid Signatures: {summary['signature_summary']['valid']}\n")
            f.write(f"  Invalid Signatures: {summary['signature_summary']['invalid']}\n\n")
            
            f.write("=" * 80 + "\n")
            f.write("Risk Files Detail\n")
            f.write("=" * 80 + "\n\n")
            
            for level in ['critical', 'high', 'medium', 'low']:
                level_files = [r for r in scan_results if r.risk_level == level]
                if level_files:
                    f.write(f"\n[{level.upper()} RISK FILES] ({len(level_files)})\n")
                    f.write("-" * 80 + "\n")
                    for file_info in sorted(level_files, key=lambda x: x.file_path):
                        f.write(f"\nFile: {file_info.file_path}\n")
                        f.write(f"  Type: {file_info.file_type}\n")
                        f.write(f"  Size: {file_info.file_size} bytes\n")
                        f.write(f"  SHA256: {file_info.sha256}\n")
                        if file_info.risk_reasons:
                            f.write("  Risk Reasons:\n")
                            for reason in file_info.risk_reasons:
                                f.write(f"    - {reason}\n")
                        f.write("\n")
        
        return output_path

    def _build_report_structure(self, scan_results: List[Any]) -> Dict[str, Any]:
        sorted_results = sorted(scan_results, key=lambda x: x.file_path)
        
        files_data = []
        for result in sorted_results:
            file_dict = result.to_dict()
            file_dict = self._sort_dict_recursively(file_dict)
            files_data.append(file_dict)
        
        summary = self._calculate_summary(scan_results)
        
        return {
            "report_version": "1.0",
            "scan_date": summary['scan_date'],
            "scan_id": self._generate_scan_id(scan_results),
            "summary": {
                "total_files": summary['total_files'],
                "total_size": summary['total_size'],
                "risk_summary": summary['risk_summary'],
                "file_type_summary": summary['file_type_summary'],
                "signature_summary": summary['signature_summary']
            },
            "files": files_data
        }

    def _calculate_summary(self, scan_results: List[Any]) -> Dict[str, Any]:
        risk_summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'unknown': 0}
        file_type_summary = {}
        signature_summary = {'signed': 0, 'unsigned': 0, 'valid': 0, 'invalid': 0}
        total_size = 0
        
        for result in scan_results:
            risk_level = result.risk_level.lower()
            if risk_level in risk_summary:
                risk_summary[risk_level] += 1
            else:
                risk_summary['unknown'] += 1
            
            ftype = result.file_type or "Unknown"
            file_type_summary[ftype] = file_type_summary.get(ftype, 0) + 1
            
            has_sig = result.signature_info.get("has_signature", False)
            if has_sig:
                signature_summary['signed'] += 1
                if result.signature_info.get("signature_valid", False):
                    signature_summary['valid'] += 1
                else:
                    signature_summary['invalid'] += 1
            else:
                signature_summary['unsigned'] += 1
            
            total_size += result.file_size
        
        return {
            "scan_date": datetime.utcnow().isoformat() + "Z",
            "total_files": len(scan_results),
            "total_size": total_size,
            "risk_summary": risk_summary,
            "file_type_summary": file_type_summary,
            "signature_summary": signature_summary
        }

    def _flatten_file_info(self, file_info: Any) -> Dict[str, Any]:
        flattened = {
            "file_path": file_info.file_path,
            "file_name": file_info.file_name,
            "file_size": file_info.file_size,
            "magic_bytes": file_info.magic_bytes,
            "file_type": file_info.file_type,
            "sha256": file_info.sha256,
            "md5": file_info.md5,
            "risk_level": file_info.risk_level,
            "risk_reasons": " | ".join(file_info.risk_reasons),
            "parse_errors": " | ".join(file_info.parse_errors),
            "has_signature": file_info.signature_info.get("has_signature", False),
            "signature_valid": file_info.signature_info.get("signature_valid", False),
            "team_identifier": file_info.signature_info.get("team_identifier", ""),
            "bundle_identifier": file_info.signature_info.get("bundle_identifier", ""),
            "authority": " | ".join(file_info.signature_info.get("authority", [])),
            "signed_time": file_info.signature_info.get("signed_time", ""),
            "signature_errors": " | ".join(file_info.signature_info.get("errors", []))
        }
        return flattened

    def _sort_dict_recursively(self, d: Any) -> Any:
        if isinstance(d, dict):
            return {k: self._sort_dict_recursively(v) for k, v in sorted(d.items())}
        elif isinstance(d, list):
            return [self._sort_dict_recursively(item) for item in d]
        else:
            return d

    def _generate_scan_id(self, scan_results: List[Any]) -> str:
        hash_input = "|".join(sorted(r.sha256 for r in scan_results if r.sha256))
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def _format_size(self, size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
