"""
Rule Engine Module

Implements risk scoring rules for notebook audit results.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class RiskLevel(Enum):
    """Risk severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class RiskRule:
    """A single risk detection rule."""
    rule_id: str
    name: str
    description: str
    risk_level: RiskLevel
    score_weight: int
    applicable_categories: List[str] = field(default_factory=list)


@dataclass
class RiskFinding:
    """A finding from applying a risk rule."""
    rule_id: str
    rule_name: str
    risk_level: RiskLevel
    score: int
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    notebook_path: Optional[str] = None
    cell_index: Optional[int] = None


@dataclass
class AuditScore:
    """Overall audit score for a notebook or set of notebooks."""
    total_score: int = 0
    max_possible_score: int = 100
    risk_findings: List[RiskFinding] = field(default_factory=list)
    category_scores: Dict[str, int] = field(default_factory=dict)

    @property
    def risk_percentage(self) -> float:
        return (self.total_score / self.max_possible_score) * 100 if self.max_possible_score > 0 else 0

    @property
    def risk_rating(self) -> str:
        pct = self.risk_percentage
        if pct < 20:
            return "LOW"
        elif pct < 50:
            return "MEDIUM"
        elif pct < 75:
            return "HIGH"
        else:
            return "CRITICAL"


class RuleEngine:
    """Engine for applying risk scoring rules to notebook analysis results."""

    DEFAULT_RULES = [
        RiskRule(
            rule_id="EXEC001",
            name="Execution Count Out of Order",
            description="Code cells have execution_count values that are not sequential",
            risk_level=RiskLevel.ERROR,
            score_weight=15,
            applicable_categories=["execution"]
        ),
        RiskRule(
            rule_id="EXEC002",
            name="Skipped Execution Numbers",
            description="Some execution numbers were skipped during notebook run",
            risk_level=RiskLevel.WARNING,
            score_weight=10,
            applicable_categories=["execution"]
        ),
        RiskRule(
            rule_id="EXEC003",
            name="Notebook Never Executed",
            description="Notebook has code cells but none have been executed",
            risk_level=RiskLevel.ERROR,
            score_weight=20,
            applicable_categories=["execution"]
        ),
        RiskRule(
            rule_id="PATH001",
            name="Relative Path Escape Detected",
            description="Code contains path patterns that escape the notebook directory",
            risk_level=RiskLevel.WARNING,
            score_weight=12,
            applicable_categories=["path"]
        ),
        RiskRule(
            rule_id="PATH002",
            name="Absolute Path Usage",
            description="Code uses absolute paths which may not work on other systems",
            risk_level=RiskLevel.WARNING,
            score_weight=8,
            applicable_categories=["path"]
        ),
        RiskRule(
            rule_id="DATA001",
            name="Missing Data File Reference",
            description="Notebook references a data file that cannot be found",
            risk_level=RiskLevel.ERROR,
            score_weight=18,
            applicable_categories=["data"]
        ),
        RiskRule(
            rule_id="DATA002",
            name="Missing Asset in Manifest",
            description="Referenced data file is not listed in datasets_manifest.yaml",
            risk_level=RiskLevel.WARNING,
            score_weight=10,
            applicable_categories=["data"]
        ),
        RiskRule(
            rule_id="SEED001",
            name="No Random Seed Set",
            description="Notebook uses random operations but doesn't set a seed",
            risk_level=RiskLevel.WARNING,
            score_weight=8,
            applicable_categories=["reproducibility"]
        ),
        RiskRule(
            rule_id="SEED002",
            name="Inconsistent Random Seeds",
            description="Multiple different random seeds are set in the notebook",
            risk_level=RiskLevel.WARNING,
            score_weight=12,
            applicable_categories=["reproducibility"]
        ),
        RiskRule(
            rule_id="OUTPUT001",
            name="Large Output Detected",
            description="Cell output exceeds threshold and should be cleared",
            risk_level=RiskLevel.WARNING,
            score_weight=5,
            applicable_categories=["output"]
        ),
        RiskRule(
            rule_id="OUTPUT002",
            name="Excessive Output Size",
            description="Total notebook output size is very large",
            risk_level=RiskLevel.ERROR,
            score_weight=15,
            applicable_categories=["output"]
        ),
        RiskRule(
            rule_id="DEPS001",
            name="Unknown External Dependency",
            description="Notebook imports a library not in environment dependencies",
            risk_level=RiskLevel.WARNING,
            score_weight=7,
            applicable_categories=["dependency"]
        ),
        RiskRule(
            rule_id="DEPS002",
            name="Missing Environment File",
            description="No environment dependencies file provided for validation",
            risk_level=RiskLevel.INFO,
            score_weight=3,
            applicable_categories=["dependency"]
        ),
        RiskRule(
            rule_id="ORDER001",
            name="Execution Dependency Risk",
            description="Cells may have implicit dependencies on execution order",
            risk_level=RiskLevel.WARNING,
            score_weight=10,
            applicable_categories=["execution"]
        ),
    ]

    def __init__(
        self,
        rules: Optional[List[RiskRule]] = None,
        large_output_threshold: int = 1024 * 100,
        critical_output_threshold: int = 1024 * 1024
    ):
        """
        Initialize the rule engine.

        Args:
            rules: Optional list of custom rules. Uses defaults if not provided.
            large_output_threshold: Threshold in bytes for large output warning
            critical_output_threshold: Threshold in bytes for critical output alert
        """
        self.rules = rules or self.DEFAULT_RULES
        self.large_output_threshold = large_output_threshold
        self.critical_output_threshold = critical_output_threshold
        self._rule_map = {r.rule_id: r for r in self.rules}

    def apply_rules(
        self,
        notebook_analyses: List[Any],
        scan_results: List[Any]
    ) -> AuditScore:
        """
        Apply all rules to notebook analyses and scan results.

        Args:
            notebook_analyses: List of NotebookAnalysis objects
            scan_results: List of ScanResult objects

        Returns:
            AuditScore with total risk assessment
        """
        score = AuditScore()
        category_scores: Dict[str, int] = {
            "execution": 0,
            "path": 0,
            "data": 0,
            "reproducibility": 0,
            "output": 0,
            "dependency": 0
        }

        for analysis in notebook_analyses:
            findings = self._check_execution_rules(analysis)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

            findings = self._check_path_rules(analysis)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

            findings = self._check_output_rules(analysis)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

            findings = self._check_reproducibility_rules(analysis)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

        for scan_result in scan_results:
            findings = self._check_data_rules(scan_result)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

            findings = self._check_dependency_rules(scan_result)
            for finding in findings:
                score.risk_findings.append(finding)
                category_scores[finding.details.get("category", "other")] += finding.score

        score.category_scores = {k: v for k, v in category_scores.items() if v > 0}
        score.total_score = sum(f.score for f in score.risk_findings)
        score.total_score = min(score.total_score, score.max_possible_score)

        return score

    def _check_execution_rules(self, analysis: Any) -> List[RiskFinding]:
        """Check execution-related rules."""
        findings = []

        for issue in analysis.execution_order_issues:
            if issue.get('severity') == 'error':
                rule = self._rule_map.get("EXEC001") or self.DEFAULT_RULES[0]
                findings.append(RiskFinding(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    risk_level=RiskLevel.ERROR,
                    score=rule.score_weight,
                    message=issue.get('message', 'Execution order issue detected'),
                    details={"category": "execution", "issue": issue},
                    notebook_path=analysis.notebook_path,
                    cell_index=issue.get('cell_index')
                ))
            else:
                rule = self._rule_map.get("EXEC002") or self.DEFAULT_RULES[1]
                findings.append(RiskFinding(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    risk_level=RiskLevel.WARNING,
                    score=rule.score_weight,
                    message=issue.get('message', 'Skipped execution numbers'),
                    details={"category": "execution", "issue": issue},
                    notebook_path=analysis.notebook_path,
                    cell_index=issue.get('cell_index')
                ))

        if analysis.executed_cells == 0 and analysis.total_cells > 0:
            code_cells = [c for c in analysis.cells if c.cell_type == 'code']
            if code_cells:
                rule = self._rule_map.get("EXEC003") or self.DEFAULT_RULES[2]
                findings.append(RiskFinding(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    risk_level=RiskLevel.ERROR,
                    score=rule.score_weight,
                    message="Notebook has code cells but none have been executed",
                    details={"category": "execution"},
                    notebook_path=analysis.notebook_path
                ))

        return findings

    def _check_path_rules(self, analysis: Any) -> List[RiskFinding]:
        """Check path-related rules."""
        findings = []

        for issue in analysis.path_escape_issues:
            rule = self._rule_map.get("PATH001") or self.DEFAULT_RULES[3]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.WARNING,
                score=rule.score_weight,
                message=f"Path escape pattern detected: {issue.get('pattern')}",
                details={"category": "path", "pattern": issue.get('pattern')},
                notebook_path=analysis.notebook_path,
                cell_index=issue.get('cell_index')
            ))

        for ref in analysis.data_file_refs:
            if ref.startswith('/'):
                rule = self._rule_map.get("PATH002") or self.DEFAULT_RULES[4]
                findings.append(RiskFinding(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    risk_level=RiskLevel.WARNING,
                    score=rule.score_weight,
                    message=f"Absolute path usage: {ref}",
                    details={"category": "path", "path": ref},
                    notebook_path=analysis.notebook_path
                ))

        return findings

    def _check_output_rules(self, analysis: Any) -> List[RiskFinding]:
        """Check output-related rules."""
        findings = []

        for cell in analysis.cells:
            if cell.has_large_output and cell.large_output_size < self.critical_output_threshold:
                rule = self._rule_map.get("OUTPUT001") or self.DEFAULT_RULES[9]
                findings.append(RiskFinding(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    risk_level=RiskLevel.WARNING,
                    score=rule.score_weight,
                    message=f"Large output detected ({cell.large_output_size} bytes)",
                    details={"category": "output", "size": cell.large_output_size},
                    notebook_path=analysis.notebook_path,
                    cell_index=cell.cell_index
                ))

        if analysis.total_output_size > self.critical_output_threshold:
            rule = self._rule_map.get("OUTPUT002") or self.DEFAULT_RULES[10]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.ERROR,
                score=rule.score_weight,
                message=f"Excessive total output size: {analysis.total_output_size} bytes",
                details={"category": "output", "total_size": analysis.total_output_size},
                notebook_path=analysis.notebook_path
            ))

        return findings

    def _check_reproducibility_rules(self, analysis: Any) -> List[RiskFinding]:
        """Check reproducibility-related rules."""
        findings = []

        has_random_ops = any(
            'random' in cell.source.lower() or 'rand' in cell.source.lower()
            for cell in analysis.cells if cell.cell_type == 'code'
        )

        if has_random_ops and not analysis.random_seed_cells:
            rule = self._rule_map.get("SEED001") or self.DEFAULT_RULES[7]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.WARNING,
                score=rule.score_weight,
                message="Random operations detected but no seed is set",
                details={"category": "reproducibility"},
                notebook_path=analysis.notebook_path
            ))

        unique_seeds = set()
        for seed_info in analysis.random_seed_cells:
            import re
            for match in re.finditer(r"seed\((\d+)\)", seed_info.get('source', '')):
                unique_seeds.add(match.group(1))

        if len(unique_seeds) > 1:
            rule = self._rule_map.get("SEED002") or self.DEFAULT_RULES[8]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.WARNING,
                score=rule.score_weight,
                message=f"Multiple random seeds detected: {unique_seeds}",
                details={"category": "reproducibility", "seeds": list(unique_seeds)},
                notebook_path=analysis.notebook_path
            ))

        return findings

    def _check_data_rules(self, scan_result: Any) -> List[RiskFinding]:
        """Check data reference rules."""
        findings = []

        for missing in scan_result.missing_data_files:
            rule = self._rule_map.get("DATA001") or self.DEFAULT_RULES[5]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.ERROR,
                score=rule.score_weight,
                message=f"Missing data file: {missing.file_path}",
                details={"category": "data", "file": missing.file_path},
                notebook_path=scan_result.notebook_path,
                cell_index=missing.line_number
            ))

        return findings

    def _check_dependency_rules(self, scan_result: Any) -> List[RiskFinding]:
        """Check dependency-related rules."""
        findings = []

        for dep in scan_result.unresolved_imports:
            rule = self._rule_map.get("DEPS001") or self.DEFAULT_RULES[11]
            findings.append(RiskFinding(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                risk_level=RiskLevel.WARNING,
                score=rule.score_weight,
                message=f"Unknown external dependency: {dep}",
                details={"category": "dependency", "library": dep},
                notebook_path=scan_result.notebook_path
            ))

        return findings

    def get_risk_summary(self, score: AuditScore) -> Dict[str, Any]:
        """Generate a human-readable risk summary."""
        return {
            "total_score": score.total_score,
            "max_score": score.max_possible_score,
            "risk_percentage": round(score.risk_percentage, 2),
            "risk_rating": score.risk_rating,
            "total_findings": len(score.risk_findings),
            "findings_by_level": {
                level.value: sum(1 for f in score.risk_findings if f.risk_level == level)
                for level in RiskLevel
            },
            "category_scores": score.category_scores,
            "top_findings": sorted(
                score.risk_findings,
                key=lambda f: (f.risk_level.value, -f.score),
                reverse=True
            )[:10]
        }
