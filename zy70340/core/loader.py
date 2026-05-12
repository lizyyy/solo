import json
from pathlib import Path
from typing import Dict, List, Any
from datetime import date, datetime
from .models import (
    Vulnerability, Service, Dependency, WaiveException, 
    TriageResult, Severity, Exploitability, Status, Ecosystem
)


class DataLoader:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def load_vulnerabilities(self) -> Dict[str, Vulnerability]:
        file_path = self.data_dir / "vulnerabilities.json"
        if not file_path.exists():
            return {}
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        vulnerabilities = {}
        for item in data:
            vuln = Vulnerability(
                id=item["id"],
                cve_id=item.get("cve_id"),
                title=item["title"],
                description=item["description"],
                ecosystem=Ecosystem(item["ecosystem"]),
                package_name=item["package_name"],
                severity=Severity(item["severity"]),
                exploitability=Exploitability(item["exploitability"]),
                fixed_version=item["fixed_version"],
                cwe=item.get("cwe", ""),
                cvss_score=item.get("cvss_score"),
                references=item.get("references", []),
                import_date=datetime.fromisoformat(item["import_date"]).date() if item.get("import_date") else None,
                scan_id=item.get("scan_id")
            )
            vulnerabilities[vuln.id] = vuln
        
        return vulnerabilities
    
    def save_vulnerabilities(self, vulnerabilities: Dict[str, Vulnerability]) -> None:
        file_path = self.data_dir / "vulnerabilities.json"
        data = []
        for vuln in vulnerabilities.values():
            data.append({
                "id": vuln.id,
                "cve_id": vuln.cve_id,
                "title": vuln.title,
                "description": vuln.description,
                "ecosystem": vuln.ecosystem.value,
                "package_name": vuln.package_name,
                "severity": vuln.severity.value,
                "exploitability": vuln.exploitability.value,
                "fixed_version": vuln.fixed_version,
                "cwe": vuln.cwe,
                "cvss_score": vuln.cvss_score,
                "references": vuln.references,
                "import_date": vuln.import_date.isoformat() if vuln.import_date else None,
                "scan_id": vuln.scan_id
            })
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_services(self) -> Dict[str, Service]:
        file_path = self.data_dir / "services.json"
        if not file_path.exists():
            return {}
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        services = {}
        for item in data:
            service = Service(
                name=item["name"],
                owner=item["owner"],
                owner_email=item["owner_email"],
                is_internal=item.get("is_internal", True),
                is_exposed=item.get("is_exposed", False),
                description=item.get("description", "")
            )
            services[service.name] = service
        
        return services
    
    def save_services(self, services: Dict[str, Service]) -> None:
        file_path = self.data_dir / "services.json"
        data = []
        for service in services.values():
            data.append({
                "name": service.name,
                "owner": service.owner,
                "owner_email": service.owner_email,
                "is_internal": service.is_internal,
                "is_exposed": service.is_exposed,
                "description": service.description
            })
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_dependencies(self) -> List[Dependency]:
        file_path = self.data_dir / "dependencies.json"
        if not file_path.exists():
            return []
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        dependencies = []
        for item in data:
            dep = Dependency(
                name=item["name"],
                version=item["version"],
                ecosystem=Ecosystem(item["ecosystem"]),
                is_direct=item.get("is_direct", True),
                parent_dependencies=item.get("parent_dependencies", []),
                service_name=item["service_name"]
            )
            dependencies.append(dep)
        
        return dependencies
    
    def save_dependencies(self, dependencies: List[Dependency]) -> None:
        file_path = self.data_dir / "dependencies.json"
        data = []
        for dep in dependencies:
            data.append({
                "name": dep.name,
                "version": dep.version,
                "ecosystem": dep.ecosystem.value,
                "is_direct": dep.is_direct,
                "parent_dependencies": dep.parent_dependencies,
                "service_name": dep.service_name
            })
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_exceptions(self) -> Dict[str, WaiveException]:
        file_path = self.data_dir / "exceptions.json"
        if not file_path.exists():
            return {}
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        exceptions = {}
        for item in data:
            exc = WaiveException(
                id=item["id"],
                vulnerability_id=item["vulnerability_id"],
                service_name=item["service_name"],
                reason=item["reason"],
                owner=item["owner"],
                approve_date=datetime.fromisoformat(item["approve_date"]).date(),
                expire_date=datetime.fromisoformat(item["expire_date"]).date(),
                notes=item.get("notes", "")
            )
            exceptions[exc.id] = exc
        
        return exceptions
    
    def save_exceptions(self, exceptions: Dict[str, WaiveException]) -> None:
        file_path = self.data_dir / "exceptions.json"
        data = []
        for exc in exceptions.values():
            data.append({
                "id": exc.id,
                "vulnerability_id": exc.vulnerability_id,
                "service_name": exc.service_name,
                "reason": exc.reason,
                "owner": exc.owner,
                "approve_date": exc.approve_date.isoformat(),
                "expire_date": exc.expire_date.isoformat(),
                "notes": exc.notes
            })
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_triage_results(self) -> Dict[str, TriageResult]:
        file_path = self.data_dir / "triage_results.json"
        if not file_path.exists():
            return {}
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        triage_results = {}
        for item in data:
            tr = TriageResult(
                id=item["id"],
                vulnerability_id=item["vulnerability_id"],
                service_name=item["service_name"],
                status=Status(item["status"]),
                triager=item["triager"],
                triage_date=datetime.fromisoformat(item["triage_date"]).date(),
                notes=item.get("notes", ""),
                fixed_version=item.get("fixed_version")
            )
            triage_results[tr.id] = tr
        
        return triage_results
    
    def save_triage_results(self, triage_results: Dict[str, TriageResult]) -> None:
        file_path = self.data_dir / "triage_results.json"
        data = []
        for tr in triage_results.values():
            data.append({
                "id": tr.id,
                "vulnerability_id": tr.vulnerability_id,
                "service_name": tr.service_name,
                "status": tr.status.value,
                "triager": tr.triager,
                "triage_date": tr.triage_date.isoformat(),
                "notes": tr.notes,
                "fixed_version": tr.fixed_version
            })
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
