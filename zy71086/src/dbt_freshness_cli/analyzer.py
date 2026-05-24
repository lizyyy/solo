from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict

from .parser import DBTArtifactsParser
from .dependency_graph import DependencyGraph
from .models import (
    FreshnessReport,
    ReportModel,
    ReportTable,
    Severity,
    ModelStatus,
    FreshnessStatus,
    ReportIssue,
    DBTResourceType,
    ExitCode,
)


class FreshnessAnalyzer:
    def __init__(
        self,
        parser: DBTArtifactsParser,
        graph: DependencyGraph,
        warn_threshold_minutes: int = 60,
        critical_threshold_minutes: int = 180,
        expected_frequency_minutes: int = 60,
        report_tables: Optional[Dict[str, str]] = None,
    ):
        self.parser = parser
        self.graph = graph
        self.warn_threshold = timedelta(minutes=warn_threshold_minutes)
        self.critical_threshold = timedelta(minutes=critical_threshold_minutes)
        self.expected_frequency = timedelta(minutes=expected_frequency_minutes)
        self.report_tables = report_tables or {}
        self.now = datetime.now().astimezone()

    def analyze(self) -> FreshnessReport:
        report = FreshnessReport(
            generated_at=self.now,
            severity=Severity.OK,
        )

        broken_deps = self.graph.find_missing_dependencies()
        report.broken_dependencies = broken_deps

        late_models: Dict[str, ReportModel] = {}
        all_nodes = set(self.parser.nodes.keys()) | set(self.parser.sources.keys())

        for unique_id in all_nodes:
            model_report = self._analyze_single_node(unique_id)
            if model_report and model_report.severity != Severity.OK:
                late_models[unique_id] = model_report

        self._propagate_downstream_impact(late_models)
        self._update_severity_from_issues(late_models)

        report.late_models = sorted(
            late_models.values(),
            key=lambda m: (self._severity_order(m.severity), -(m.minutes_late or 0))
        )

        report.report_tables = self._analyze_report_tables(late_models)
        self._calculate_statistics(report)
        report.calculate_summary()

        return report

    def _analyze_single_node(self, unique_id: str) -> Optional[ReportModel]:
        resource = self.parser.get_resource(unique_id)
        if not resource:
            return None

        model_status = self.parser.get_model_status(unique_id)
        freshness_status = self.parser.get_freshness_status(unique_id)

        issues: List[ReportIssue] = []
        severity = Severity.OK
        minutes_late: Optional[float] = None
        message: Optional[str] = None

        last_data_at = self.parser.get_last_data_at(unique_id)
        last_success_at = self.parser.get_last_success_at(unique_id)

        if last_data_at and last_data_at.tzinfo is None:
            last_data_at = last_data_at.astimezone()
        if last_success_at and last_success_at.tzinfo is None:
            last_success_at = last_success_at.astimezone()

        if unique_id.startswith("source."):
            if freshness_status == FreshnessStatus.UNKNOWN:
                severity = Severity.MISSING
                issues.append(ReportIssue.SOURCE_MISSING)
                message = f"Source '{unique_id}' has no freshness data"
            elif freshness_status == FreshnessStatus.ERROR:
                severity = Severity.CRITICAL
                issues.append(ReportIssue.MODEL_STALE)
                if last_data_at:
                    minutes_late = (self.now - last_data_at).total_seconds() / 60
                    message = f"Source data is stale by {minutes_late:.1f} minutes"
            elif freshness_status == FreshnessStatus.WARN:
                severity = Severity.WARNING
                issues.append(ReportIssue.MODEL_STALE)
                if last_data_at:
                    minutes_late = (self.now - last_data_at).total_seconds() / 60
                    message = f"Source data is warning stale by {minutes_late:.1f} minutes"
        else:
            if model_status == ModelStatus.SKIPPED:
                severity = Severity.SKIPPED
                issues.append(ReportIssue.MODEL_SKIPPED)
                message = f"Model '{unique_id}' was skipped in the run"
            elif model_status == ModelStatus.FAILED or model_status == ModelStatus.ERROR:
                severity = Severity.ERROR
                issues.append(ReportIssue.MODEL_STALE)
                message = f"Model '{unique_id}' failed during execution"
            elif model_status == ModelStatus.SUCCESS:
                if last_data_at:
                    data_age = self.now - last_data_at
                    minutes_late = data_age.total_seconds() / 60

                    if data_age > self.critical_threshold:
                        severity = Severity.CRITICAL
                        issues.append(ReportIssue.MODEL_STALE)
                        message = f"Model data is critically stale by {minutes_late:.1f} minutes"
                    elif data_age > self.warn_threshold:
                        severity = Severity.WARNING
                        issues.append(ReportIssue.MODEL_STALE)
                        message = f"Model data is stale by {minutes_late:.1f} minutes"
                else:
                    severity = Severity.WARNING
                    issues.append(ReportIssue.MODEL_STALE)
                    message = f"Model '{unique_id}' has no timestamp data"

        upstream_deps = self.graph.get_upstream_direct(unique_id)
        downstream_refs = self.graph.get_downstream_direct(unique_id)

        return ReportModel(
            unique_id=unique_id,
            name=resource.name,
            resource_type=resource.resource_type,
            status=model_status,
            freshness_status=freshness_status,
            severity=severity,
            issues=issues,
            last_success_at=last_success_at,
            last_data_at=last_data_at,
            minutes_late=minutes_late,
            expected_frequency_minutes=self.expected_frequency.total_seconds() / 60,
            upstream_dependencies=upstream_deps,
            downstream_references=downstream_refs,
            message=message,
        )

    def _propagate_downstream_impact(self, late_models: Dict[str, ReportModel]) -> None:
        changed = True
        while changed:
            changed = False
            for unique_id, model in list(late_models.items()):
                downstream = self.graph.get_downstream_direct(unique_id)
                for down_id in downstream:
                    if down_id not in late_models:
                        resource = self.parser.get_resource(down_id)
                        if resource:
                            status = self.parser.get_model_status(down_id)
                            freshness = self.parser.get_freshness_status(down_id)
                            down_model = ReportModel(
                                unique_id=down_id,
                                name=resource.name,
                                resource_type=resource.resource_type,
                                status=status,
                                freshness_status=freshness,
                                severity=self._get_inherited_severity(model.severity),
                                issues=[ReportIssue.DOWNSTREAM_IMPACT],
                                last_success_at=self.parser.get_last_success_at(down_id),
                                last_data_at=self.parser.get_last_data_at(down_id),
                                upstream_dependencies=self.graph.get_upstream_direct(down_id),
                                downstream_references=self.graph.get_downstream_direct(down_id),
                                message=f"Impacted by upstream issue: {unique_id}",
                            )
                            late_models[down_id] = down_model
                            changed = True
                    else:
                        existing = late_models[down_id]
                        if ReportIssue.DOWNSTREAM_IMPACT not in existing.issues:
                            existing.issues.append(ReportIssue.DOWNSTREAM_IMPACT)
                            existing.severity = self._worst_severity(
                                existing.severity,
                                self._get_inherited_severity(model.severity)
                            )
                            changed = True

    def _update_severity_from_issues(self, late_models: Dict[str, ReportModel]) -> None:
        for unique_id, model in late_models.items():
            upstream = self.graph.get_upstream(unique_id)
            for up_id in upstream:
                if up_id in late_models:
                    up_model = late_models[up_id]
                    if up_model.severity in [Severity.CRITICAL, Severity.ERROR, Severity.MISSING]:
                        if ReportIssue.UPSTREAM_LATE not in model.issues:
                            model.issues.append(ReportIssue.UPSTREAM_LATE)

    def _analyze_report_tables(self, late_models: Dict[str, ReportModel]) -> List[ReportTable]:
        tables: List[ReportTable] = []

        for table_name, unique_id in self.report_tables.items():
            status = Severity.OK
            affected: List[str] = []
            impacted = False

            if unique_id in late_models:
                model = late_models[unique_id]
                status = model.severity
                impacted = True
                affected.append(unique_id)

            for late_id, late_model in late_models.items():
                if self.graph.is_reachable(late_id, unique_id):
                    impacted = True
                    if late_id not in affected:
                        affected.append(late_id)
                    status = self._worst_severity(status, self._get_inherited_severity(late_model.severity))

            tables.append(ReportTable(
                table_name=table_name,
                unique_id=unique_id,
                status=status,
                affected_models=affected,
                impacted=impacted,
            ))

        return sorted(tables, key=lambda t: (self._severity_order(t.status), t.table_name))

    def _calculate_statistics(self, report: FreshnessReport) -> None:
        all_nodes = set(self.parser.nodes.keys()) | set(self.parser.sources.keys())
        report.total_nodes = len(all_nodes)

        for model in report.late_models:
            if model.severity == Severity.WARNING:
                report.warning_count += 1
            elif model.severity == Severity.CRITICAL:
                report.critical_count += 1
            elif model.severity == Severity.ERROR:
                report.error_count += 1
            elif model.severity == Severity.SKIPPED:
                report.skipped_count += 1
            elif model.severity == Severity.MISSING:
                report.missing_count += 1

        report.ok_count = report.total_nodes - len(report.late_models)

        if report.error_count > 0 or report.missing_count > 0:
            report.severity = Severity.ERROR
        elif report.critical_count > 0:
            report.severity = Severity.CRITICAL
        elif report.warning_count > 0 or report.skipped_count > 0:
            report.severity = Severity.WARNING
        else:
            report.severity = Severity.OK

    @staticmethod
    def _severity_order(severity: Severity) -> int:
        order = {
            Severity.ERROR: 0,
            Severity.CRITICAL: 1,
            Severity.WARNING: 2,
            Severity.SKIPPED: 3,
            Severity.MISSING: 4,
            Severity.OK: 5,
        }
        return order.get(severity, 99)

    @staticmethod
    def _worst_severity(a: Severity, b: Severity) -> Severity:
        order = {
            Severity.ERROR: 0,
            Severity.CRITICAL: 1,
            Severity.WARNING: 2,
            Severity.SKIPPED: 3,
            Severity.MISSING: 4,
            Severity.OK: 5,
        }
        return a if order.get(a, 99) < order.get(b, 99) else b

    @staticmethod
    def _get_inherited_severity(severity: Severity) -> Severity:
        mapping = {
            Severity.ERROR: Severity.CRITICAL,
            Severity.CRITICAL: Severity.WARNING,
            Severity.WARNING: Severity.WARNING,
            Severity.MISSING: Severity.CRITICAL,
            Severity.SKIPPED: Severity.WARNING,
            Severity.OK: Severity.OK,
        }
        return mapping.get(severity, Severity.WARNING)

    @staticmethod
    def get_exit_code(severity: Severity) -> ExitCode:
        mapping = {
            Severity.OK: ExitCode.SUCCESS,
            Severity.WARNING: ExitCode.WARNING,
            Severity.CRITICAL: ExitCode.CRITICAL,
            Severity.ERROR: ExitCode.ERROR,
            Severity.SKIPPED: ExitCode.WARNING,
            Severity.MISSING: ExitCode.ERROR,
        }
        return mapping.get(severity, ExitCode.ERROR)
