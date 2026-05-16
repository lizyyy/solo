content = r'''#!/usr/bin/env python3
import click
import json
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
import re
from dataclasses import dataclass, asdict, field
from enum import Enum

class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"

@dataclass
class Vulnerability:
    id: str
    component_name: str
    component_version: str
    severity: str
    description: str = ""
    cvss_score: Optional[float] = None
    source: str = ""

@dataclass
class ExceptionEntry:
    vulnerability_id: str
    component_name: str
    component_version: str
    reason: str
    expires_at: str
    reviewer: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "active"
    
    def is_expired(self) -> bool:
        try:
            expire_date = datetime.fromisoformat(self.expires_at)
            return datetime.now() > expire_date
        except (ValueError, TypeError):
            return True
    
    def days_until_expiry(self) -> Optional[int]:
        try:
            expire_date = datetime.fromisoformat(self.expires_at)
            delta = expire_date - datetime.now()
            return delta.days
        except (ValueError, TypeError):
            return None

@dataclass
class ProcessingError:
    row_number: int
    raw_data: str
    error_message: str
    source_file: str

class SBOMParser:
    @staticmethod
    def parse_cyclonedx(file_path: str) -> Tuple[List[Vulnerability], List[ProcessingError]]:
        vulnerabilities = []
        errors = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if "vulnerabilities" in data:
                for idx, vuln in enumerate(data["vulnerabilities"], 1):
                    try:
                        component = vuln.get("component", {})
                        ratings = vuln.get("ratings", [])
                        severity = "unknown"
                        cvss_score = None
                        if ratings:
                            severity = ratings[0].get("severity", "unknown").lower()
                            cvss_score = ratings[0].get("score")
                        
                        vulnerabilities.append(Vulnerability(
                            id=vuln.get("id", ""),
                            component_name=component.get("name", ""),
                            component_version=component.get("version", ""),
                            severity=severity,
                            description=vuln.get("description", ""),
                            cvss_score=cvss_score,
                            source="cyclonedx"
                        ))
                    except Exception as e:
                        errors.append(ProcessingError(
                            row_number=idx,
                            raw_data=json.dumps(vuln),
                            error_message=f"parse error: {str(e)}",
                            source_file=file_path
                        ))
        except json.JSONDecodeError as e:
            errors.append(ProcessingError(
                row_number=0,
                raw_data="",
                error_message=f"JSON decode error: {str(e)}",
                source_file=file_path
            ))
        except Exception as e:
            errors.append(ProcessingError(
                row_number=0,
                raw_data="",
                error_message=f"file read error: {str(e)}",
                source_file=file_path
            ))
        
        return vulnerabilities, errors

class ExceptionManager:
    def __init__(self, exceptions_file: str = "exceptions.json"):
        self.exceptions_file = exceptions_file
        self.exceptions: List[ExceptionEntry] = []
        self._load_exceptions()
    
    def _load_exceptions(self) -> None:
        if not os.path.exists(self.exceptions_file):
            self.exceptions = []
            return
        
        try:
            with open(self.exceptions_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.exceptions = [ExceptionEntry(**item) for item in data]
        except Exception as e:
            self.exceptions = []
    
    def _save_exceptions(self) -> None:
        try:
            with open(self.exceptions_file, "w", encoding="utf-8") as f:
                json.dump([asdict(e) for e in self.exceptions], f, indent=2)
        except Exception as e:
            pass
    
    def add_exception(self, exception: ExceptionEntry) -> bool:
        self.exceptions.append(exception)
        self._save_exceptions()
        return True
    
    def find_exception(self, vuln_id: str, component_name: str, component_version: str) -> Optional[ExceptionEntry]:
        for exc in self.exceptions:
            if exc.status != "active":
                continue
            
            if exc.vulnerability_id and exc.vulnerability_id != "*":
                if exc.vulnerability_id.lower() != vuln_id.lower():
                    continue
            
            if exc.component_name and exc.component_name != "*":
                pattern = exc.component_name.replace("*", ".*").replace("?", ".")
                if not re.match(f"^{pattern}$", component_name, re.IGNORECASE):
                    continue
            
            if exc.component_version and exc.component_version != "*":
                pattern = exc.component_version.replace("*", ".*").replace("?", ".")
                if not re.match(f"^{pattern}$", component_version, re.IGNORECASE):
                    continue
            
            return exc
        
        return None
    
    def get_expiring_exceptions(self, days: int = 7) -> List[ExceptionEntry]:
        expiring = []
        for exc in self.exceptions:
            days_left = exc.days_until_expiry()
            if days_left is not None and 0 <= days_left <= days:
                expiring.append(exc)
        return expiring
    
    def get_expired_exceptions(self) -> List[ExceptionEntry]:
        return [exc for exc in self.exceptions if exc.is_expired()]

@click.group()
def cli():
    """SBOM Exception Management Tool"""
    pass

@cli.command()
@click.argument("sbom_path", type=click.Path(exists=True))
@click.option("--exceptions", "-e", default="exceptions.json", help="exceptions file path")
@click.option("--output-json", "-j", default="report.json", help="JSON report path")
@click.option("--quiet", "-q", is_flag=True, help="quiet mode")
def scan(sbom_path: str, exceptions: str, output_json: str, quiet: bool):
    """Scan SBOM file and match exceptions"""
    all_vulnerabilities = []
    all_errors = []
    exception_manager = ExceptionManager(exceptions)
    
    path = Path(sbom_path)
    if path.is_file():
        files = [path]
    else:
        files = list(path.rglob("*.json"))
    
    for file_path in files:
        if not quiet:
            click.echo(f"Processing: {file_path}")
        vulns, errors = SBOMParser.parse_cyclonedx(str(file_path))
        all_vulnerabilities.extend(vulns)
        all_errors.extend(errors)
    
    total = len(all_vulnerabilities)
    excepted = 0
    expired_excepted = 0
    for vuln in all_vulnerabilities:
        exc = exception_manager.find_exception(vuln.id, vuln.component_name, vuln.component_version)
        if exc:
            if exc.is_expired():
                expired_excepted += 1
            else:
                excepted += 1
    
    unexcepted = total - excepted - expired_excepted
    
    if not quiet:
        click.echo(f"\nTotal vulnerabilities: {total}")
        click.echo(f"Excepted (active): {excepted}")
        click.echo(f"Excepted (expired): {expired_excepted}")
        click.echo(f"Needs attention: {unexcepted}")
        click.echo(f"Processing errors: {len(all_errors)}")
        
        if all_errors:
            click.echo("\nErrors:")
            for err in all_errors:
                click.echo(f"  [{err.source_file}:{err.row_number}] {err.error_message}")
    
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({
            "total": total,
            "excepted_active": excepted,
            "excepted_expired": expired_excepted,
            "unexcepted": unexcepted,
            "errors": [asdict(e) for e in all_errors],
            "vulnerabilities": [asdict(v) for v in all_vulnerabilities]
        }, f, indent=2)
    
    if not quiet:
        click.echo(f"\nJSON report saved to: {output_json}")
    
    if all_errors:
        sys.exit(1)
    sys.exit(0)

@cli.command()
@click.option("--vuln-id", required=True, help="vulnerability ID (supports *)")
@click.option("--component", required=True, help="component name (supports *)")
@click.option("--version", required=True, help="component version (supports *)")
@click.option("--reason", required=True, help="exception reason")
@click.option("--expires", required=True, help="expiration date (ISO format)")
@click.option("--reviewer", required=True, help="reviewer name")
@click.option("--exceptions", "-e", default="exceptions.json", help="exceptions file path")
def add(vuln_id: str, component: str, version: str, reason: str, expires: str, reviewer: str, exceptions: str):
    """Add a new exception"""
    exception_manager = ExceptionManager(exceptions)
    
    try:
        datetime.fromisoformat(expires)
    except ValueError:
        click.echo("Error: invalid date format, use ISO format (e.g. 2024-12-31)", err=True)
        sys.exit(1)
    
    exception = ExceptionEntry(
        vulnerability_id=vuln_id,
        component_name=component,
        component_version=version,
        reason=reason,
        expires_at=expires,
        reviewer=reviewer
    )
    
    exception_manager.add_exception(exception)
    click.echo("Exception added successfully!")

@cli.command()
@click.option("--days", "-d", default=7, type=int, help="check exceptions expiring in N days")
@click.option("--exceptions", "-e", default="exceptions.json", help="exceptions file path")
def check_expiry(days: int, exceptions: str):
    """Check for expiring exceptions"""
    exception_manager = ExceptionManager(exceptions)
    
    expiring = exception_manager.get_expiring_exceptions(days)
    expired = exception_manager.get_expired_exceptions()
    
    if expired:
        click.echo(f"Expired exceptions ({len(expired)}):")
        for exc in expired:
            click.echo(f"  - {exc.vulnerability_id} - expired on {exc.expires_at}")
    
    if expiring:
        click.echo(f"\nExceptions expiring in {days} days ({len(expiring)}):")
        for exc in expiring:
            days_left = exc.days_until_expiry()
            click.echo(f"  - {exc.vulnerability_id} - expires in {days_left} days")
    
    if not expired and not expiring:
        click.echo("No expired or expiring exceptions")
    
    if expired:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    cli()
'''

with open("sbom_exception_cli.py", "w", encoding="utf-8") as f:
    f.write(content)

print("SBOM exception CLI script created successfully!")
