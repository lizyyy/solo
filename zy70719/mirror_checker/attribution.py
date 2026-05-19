from datetime import datetime
from typing import List, Dict, Optional, Tuple
from uuid import uuid4
from .models import (
    BlockedProject,
    PackageVersion,
    SyncWindow,
    FreshnessCheckResult,
    ProjectBlockResult,
    FreshnessReport,
    FreshnessStatus,
    BlockReason,
    MirrorSource,
)
from .rules import FreshnessRulesEngine


class ProjectBlockAnalyzer:
    def __init__(self, rules_engine: Optional[FreshnessRulesEngine] = None):
        self.rules_engine = rules_engine or FreshnessRulesEngine()

    def analyze_project(
        self,
        project: BlockedProject,
        package_results: Dict[str, FreshnessCheckResult],
        all_packages: List[PackageVersion]
    ) -> ProjectBlockResult:
        blocked_packages = []
        block_reasons = {}

        for pkg_name in project.required_packages:
            pkg_result = package_results.get(pkg_name)
            if pkg_result:
                if pkg_result.status in [FreshnessStatus.CRITICAL, FreshnessStatus.STALE]:
                    blocked_packages.append(pkg_name)
                    block_reasons[pkg_name] = pkg_result.block_reason or BlockReason.UNKNOWN
                elif pkg_result.block_reason is not None:
                    blocked_packages.append(pkg_name)
                    block_reasons[pkg_name] = pkg_result.block_reason
            else:
                blocked_packages.append(pkg_name)
                block_reasons[pkg_name] = BlockReason.NO_DATA

        is_blocked = len(blocked_packages) > 0 and not project.is_manually_confirmed

        return ProjectBlockResult(
            project_name=project.project_name,
            priority=project.priority,
            is_blocked=is_blocked,
            blocked_packages=blocked_packages,
            block_reasons=block_reasons,
            contact=project.contact,
            description=project.description,
            is_manually_confirmed=project.is_manually_confirmed
        )


class ManualConfirmationManager:
    def __init__(self, confirmation_file: Optional[str] = None):
        self.confirmation_file = confirmation_file
        self.confirmed_projects: Dict[str, datetime] = {}
        self.confirmed_packages: Dict[str, datetime] = {}

    def confirm_project(self, project_name: str, confirmed_by: Optional[str] = None) -> None:
        self.confirmed_projects[project_name] = datetime.now()

    def confirm_package(self, package_name: str, confirmed_by: Optional[str] = None) -> None:
        self.confirmed_packages[package_name] = datetime.now()

    def is_project_confirmed(self, project_name: str) -> bool:
        return project_name in self.confirmed_projects

    def is_package_confirmed(self, package_name: str) -> bool:
        return package_name in self.confirmed_packages

    def get_confirmation_time(self, project_name: str) -> Optional[datetime]:
        return self.confirmed_projects.get(project_name)


class ReportGenerator:
    def __init__(self, rules_engine: Optional[FreshnessRulesEngine] = None):
        self.rules_engine = rules_engine or FreshnessRulesEngine()
        self.project_analyzer = ProjectBlockAnalyzer(self.rules_engine)

    def generate_report(
        self,
        mirror_source: MirrorSource,
        packages: List[PackageVersion],
        projects: List[BlockedProject],
        confirmation_manager: Optional[ManualConfirmationManager] = None
    ) -> FreshnessReport:
        package_results: List[FreshnessCheckResult] = []
        package_results_dict: Dict[str, FreshnessCheckResult] = {}

        for package in packages:
            result = self.rules_engine.check_package(
                package,
                mirror_source.sync_window
            )

            if confirmation_manager and confirmation_manager.is_package_confirmed(package.name):
                result.requires_manual_confirm = False
                result.status = FreshnessStatus.FRESH
                result.block_reason = None

            package_results.append(result)
            package_results_dict[package.name] = result

        project_results = []
        for project in projects:
            if confirmation_manager and confirmation_manager.is_project_confirmed(project.project_name):
                project = BlockedProject(
                    **project.dict(exclude={'is_manually_confirmed'}),
                    is_manually_confirmed=True
                )
            project_result = self.project_analyzer.analyze_project(
                project,
                package_results_dict,
                packages
            )
            project_results.append(project_result)

        total_packages = len(package_results)
        fresh_packages = sum(1 for r in package_results if r.status == FreshnessStatus.FRESH)
        stale_packages = sum(1 for r in package_results if r.status == FreshnessStatus.STALE)
        critical_packages = sum(1 for r in package_results if r.status == FreshnessStatus.CRITICAL)

        delays = [r.version_gap_result.time_delay_hours for r in package_results
                  if r.version_gap_result.time_delay_hours is not None]
        average_delay = sum(delays) / len(delays) if delays else 0.0

        if critical_packages > 0:
            overall_status = FreshnessStatus.CRITICAL
        elif stale_packages > 0:
            overall_status = FreshnessStatus.STALE
        elif fresh_packages == total_packages:
            overall_status = FreshnessStatus.FRESH
        else:
            overall_status = FreshnessStatus.WARNING

        blocked_projects = sum(1 for r in project_results if r.is_blocked)

        summary = {
            "total_packages": total_packages,
            "fresh_packages": fresh_packages,
            "stale_packages": stale_packages,
            "critical_packages": critical_packages,
            "fresh_rate": f"{(fresh_packages / total_packages * 100):.1f}%" if total_packages > 0 else "0%",
            "average_delay_hours": round(average_delay, 2),
            "total_projects": len(project_results),
            "blocked_projects": blocked_projects,
            "needs_manual_confirmation": sum(1 for r in package_results if r.requires_manual_confirm)
        }

        return FreshnessReport(
            report_id=str(uuid4()),
            generated_at=datetime.now(),
            mirror_source=mirror_source,
            total_packages=total_packages,
            fresh_packages=fresh_packages,
            stale_packages=stale_packages,
            critical_packages=critical_packages,
            average_delay_hours=average_delay,
            project_results=project_results,
            package_results=package_results,
            overall_status=overall_status,
            summary=summary
        )
