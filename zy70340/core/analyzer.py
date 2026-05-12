from typing import Dict, List, Tuple, Optional
from datetime import date
from packaging.version import parse as parse_version
from .models import (
    Vulnerability, Service, Dependency, WaiveException, 
    TriageResult, ImpactAnalysis, Status, Severity, Exploitability, Ecosystem
)


class VulnerabilityAnalyzer:
    def __init__(
        self,
        vulnerabilities: Dict[str, Vulnerability],
        services: Dict[str, Service],
        dependencies: List[Dependency],
        exceptions: Dict[str, WaiveException],
        triage_results: Dict[str, TriageResult]
    ):
        self.vulnerabilities = vulnerabilities
        self.services = services
        self.dependencies = dependencies
        self.exceptions = exceptions
        self.triage_results = triage_results
    
    def find_affected_dependencies(self, vulnerability: Vulnerability) -> List[Dependency]:
        affected = []
        
        for dep in self.dependencies:
            if dep.ecosystem != vulnerability.ecosystem:
                continue
            
            if dep.name != vulnerability.package_name:
                continue
            
            dep_version = parse_version(dep.version)
            fixed_version = parse_version(vulnerability.fixed_version)
            
            if dep_version < fixed_version:
                affected.append(dep)
        
        return affected
    
    def find_affected_services(self, vulnerability: Vulnerability) -> List[Service]:
        affected_deps = self.find_affected_dependencies(vulnerability)
        affected_service_names = set(dep.service_name for dep in affected_deps)
        
        affected_services = []
        for service_name in affected_service_names:
            if service_name in self.services:
                affected_services.append(self.services[service_name])
        
        return affected_services
    
    def get_triage_result(self, vulnerability_id: str, service_name: str) -> Optional[TriageResult]:
        for tr in self.triage_results.values():
            if tr.vulnerability_id == vulnerability_id and tr.service_name == service_name:
                return tr
        return None
    
    def get_exception(self, vulnerability_id: str, service_name: str) -> Optional[WaiveException]:
        for exc in self.exceptions.values():
            if exc.vulnerability_id == vulnerability_id and exc.service_name == service_name:
                return exc
        return None
    
    def is_exception_expired(self, exception: WaiveException) -> bool:
        today = date.today()
        return today > exception.expire_date
    
    def determine_overall_status(self, vulnerability: Vulnerability) -> Status:
        affected_services = self.find_affected_services(vulnerability)
        
        if not affected_services:
            return Status.FALSE_POSITIVE
        
        all_fixed = True
        all_waived_or_expired = True
        any_active_exception = False
        
        for service in affected_services:
            tr = self.get_triage_result(vulnerability.id, service.name)
            exc = self.get_exception(vulnerability.id, service.name)
            
            if tr and tr.status == Status.FIXED:
                continue
            
            all_fixed = False
            
            if exc:
                if self.is_exception_expired(exc):
                    all_waived_or_expired = False
                else:
                    any_active_exception = True
            else:
                all_waived_or_expired = False
        
        if all_fixed:
            return Status.FIXED
        
        if any_active_exception and not all_fixed:
            if all_waived_or_expired:
                return Status.WAIVED
            else:
                return Status.TRIAGED
        
        any_triaged = False
        for service in affected_services:
            tr = self.get_triage_result(vulnerability.id, service.name)
            if tr and tr.status in [Status.TRIAGED, Status.WAIVED]:
                any_triaged = True
                break
        
        if any_triaged:
            return Status.TRIAGED
        
        return Status.NEW
    
    def analyze_impact(self, vulnerability: Vulnerability) -> ImpactAnalysis:
        affected_services = self.find_affected_services(vulnerability)
        affected_deps = self.find_affected_dependencies(vulnerability)
        status = self.determine_overall_status(vulnerability)
        
        triage_result = None
        exception = None
        is_exception_expired = False
        
        if status == Status.FIXED:
            for service in affected_services:
                tr = self.get_triage_result(vulnerability.id, service.name)
                if tr and tr.status == Status.FIXED:
                    triage_result = tr
                    break
        
        elif status == Status.WAIVED:
            for service in affected_services:
                exc = self.get_exception(vulnerability.id, service.name)
                if exc and not self.is_exception_expired(exc):
                    exception = exc
                    break
        
        return ImpactAnalysis(
            vulnerability=vulnerability,
            affected_services=affected_services,
            affected_dependencies=affected_deps,
            status=status,
            triage_result=triage_result,
            exception=exception,
            is_exception_expired=is_exception_expired
        )
    
    def analyze_all(self) -> List[ImpactAnalysis]:
        results = []
        for vuln in self.vulnerabilities.values():
            results.append(self.analyze_impact(vuln))
        return results
    
    def sort_by_priority(self, analyses: List[ImpactAnalysis]) -> List[ImpactAnalysis]:
        def severity_order(analysis: ImpactAnalysis) -> int:
            order = {
                Severity.CRITICAL: 0,
                Severity.HIGH: 1,
                Severity.MEDIUM: 2,
                Severity.LOW: 3
            }
            return order[analysis.vulnerability.severity]
        
        def exploitability_order(analysis: ImpactAnalysis) -> int:
            order = {
                Exploitability.ACTIVE: 0,
                Exploitability.PROOF_OF_CONCEPT: 1,
                Exploitability.UNPROVEN: 2
            }
            return order[analysis.vulnerability.exploitability]
        
        def has_exposed_service(analysis: ImpactAnalysis) -> int:
            return 0 if any(s.is_exposed for s in analysis.affected_services) else 1
        
        def status_order(analysis: ImpactAnalysis) -> int:
            order = {
                Status.NEW: 0,
                Status.TRIAGED: 1,
                Status.WAIVED: 3,
                Status.FIXED: 4,
                Status.FALSE_POSITIVE: 5
            }
            return order.get(analysis.status, 2)
        
        return sorted(
            analyses,
            key=lambda x: (
                status_order(x),
                severity_order(x),
                exploitability_order(x),
                has_exposed_service(x)
            )
        )
