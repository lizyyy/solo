from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import List, Dict, Optional, Set, Tuple
from packaging.version import Version, InvalidVersion

from ..models import (
    Repository,
    Dependency,
    OwnerOpinion,
    ExtensionRequest,
    UpgradeBatch,
    OpinionType,
    ExtensionStatus,
    BatchStatus,
)
from ..parsers import ParseResult


class DecisionType(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_EXTENSION = "need_extension"
    PENDING = "pending"
    CONFLICT = "conflict"
    VERSION_MISMATCH = "version_mismatch"


class ValidationLevel(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    level: ValidationLevel
    message: str
    repo_name: Optional[str] = None
    package_name: Optional[str] = None
    rule_name: Optional[str] = None


@dataclass
class RepoUpgradeStatus:
    repo_name: str
    decision: DecisionType
    approved_packages: List[str]
    issues: List[ValidationIssue]
    can_upgrade: bool


@dataclass
class ValidationResult:
    repo_statuses: List[RepoUpgradeStatus]
    all_issues: List[ValidationIssue]
    approved_count: int
    rejected_count: int
    need_extension_count: int
    pending_count: int

    def __post_init__(self):
        self._sort_all()

    def _sort_all(self):
        self.repo_statuses.sort(key=lambda r: r.repo_name)
        self.all_issues.sort(key=lambda i: (i.repo_name or "", i.package_name or "", i.level))


class RuleEngine:
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def validate(self, parse_result: ParseResult) -> ValidationResult:
        self.issues = []
        repo_statuses: List[RepoUpgradeStatus] = []

        repos_by_name = {r.name: r for r in parse_result.repositories}
        opinions_by_repo = self._group_by_repo(parse_result.owner_opinions)
        extensions_by_repo = self._group_by_repo(parse_result.extension_requests)
        batches_by_package = self._map_batches_to_packages(parse_result.upgrade_batches)

        all_packages = [d.package_name for d in parse_result.dependencies]

        for repo_name in sorted(repos_by_name.keys()):
            repo = repos_by_name[repo_name]
            opinions = opinions_by_repo.get(repo_name, [])
            extensions = extensions_by_repo.get(repo_name, [])

            status = self._evaluate_repo(
                repo,
                opinions,
                extensions,
                all_packages,
                parse_result.dependencies,
                batches_by_package,
            )
            repo_statuses.append(status)

        approved = sum(1 for s in repo_statuses if s.decision == DecisionType.APPROVED)
        rejected = sum(1 for s in repo_statuses if s.decision == DecisionType.REJECTED)
        need_ext = sum(1 for s in repo_statuses if s.decision == DecisionType.NEED_EXTENSION)
        pending = sum(1 for s in repo_statuses if s.decision == DecisionType.PENDING)

        return ValidationResult(
            repo_statuses=repo_statuses,
            all_issues=self.issues,
            approved_count=approved,
            rejected_count=rejected,
            need_extension_count=need_ext,
            pending_count=pending,
        )

    def _group_by_repo(self, items: List) -> Dict[str, List]:
        result: Dict[str, List] = {}
        for item in items:
            repo_name = item.repo_name
            if repo_name not in result:
                result[repo_name] = []
            result[repo_name].append(item)
        return result

    def _map_batches_to_packages(self, batches: List[UpgradeBatch]) -> Dict[str, List[UpgradeBatch]]:
        result: Dict[str, List[UpgradeBatch]] = {}
        for batch in batches:
            for pkg in batch.packages:
                if pkg not in result:
                    result[pkg] = []
                result[pkg].append(batch)
        return result

    def _evaluate_repo(
        self,
        repo: Repository,
        opinions: List[OwnerOpinion],
        extensions: List[ExtensionRequest],
        all_packages: List[str],
        dependencies: List[Dependency],
        batches_by_package: Dict[str, List[UpgradeBatch]],
    ) -> RepoUpgradeStatus:
        issues: List[ValidationIssue] = []
        approved_packages: List[str] = []
        can_upgrade = True

        version_issues = self._check_versions(repo, dependencies)
        issues.extend(version_issues)

        opinion_result = self._check_owner_opinion(repo, opinions)
        issues.extend(opinion_result.issues)

        extension_result = self._check_extensions(repo, extensions)
        issues.extend(extension_result.issues)

        batch_issues = self._check_batch_conflicts(repo, all_packages, batches_by_package)
        issues.extend(batch_issues)

        has_error = any(i.level == ValidationLevel.ERROR for i in issues)
        has_warning = any(i.level == ValidationLevel.WARNING for i in issues)

        if has_error:
            decision = DecisionType.REJECTED
            can_upgrade = False
        elif extension_result.needs_extension:
            decision = DecisionType.NEED_EXTENSION
            can_upgrade = False
        elif opinion_result.is_pending:
            decision = DecisionType.PENDING
            can_upgrade = False
        elif opinion_result.is_approved:
            decision = DecisionType.APPROVED
            valid_pkgs = self._get_valid_packages(dependencies, issues)
            approved_packages = valid_pkgs
        else:
            decision = DecisionType.REJECTED
            can_upgrade = False

        self.issues.extend(issues)

        return RepoUpgradeStatus(
            repo_name=repo.name,
            decision=decision,
            approved_packages=approved_packages,
            issues=issues,
            can_upgrade=can_upgrade,
        )

    def _check_versions(self, repo: Repository, dependencies: List[Dependency]) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        for dep in dependencies:
            try:
                current = Version(repo.current_version)
                target = Version(dep.target_version)
                if dep.min_version:
                    min_ver = Version(dep.min_version)
                    if current < min_ver:
                        issues.append(ValidationIssue(
                            level=ValidationLevel.ERROR,
                            message=f"{repo.name} 当前版本 {repo.current_version} 低于最低要求 {dep.min_version}",
                            repo_name=repo.name,
                            package_name=dep.package_name,
                            rule_name="min_version_check",
                        ))
                if current >= target:
                    issues.append(ValidationIssue(
                        level=ValidationLevel.INFO,
                        message=f"{repo.name} 当前版本 {repo.current_version} 已达到或超过目标版本 {dep.target_version}",
                        repo_name=repo.name,
                        package_name=dep.package_name,
                        rule_name="version_already_met",
                    ))
            except InvalidVersion as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    message=f"版本号格式无效: {e}",
                    repo_name=repo.name,
                    package_name=dep.package_name,
                    rule_name="version_format",
                ))
        return issues

    def _check_owner_opinion(self, repo: Repository, opinions: List[OwnerOpinion]) -> 'OpinionCheckResult':
        issues: List[ValidationIssue] = []
        is_approved = False
        is_pending = False

        if not opinions:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message=f"{repo.name} 缺少负责人意见",
                repo_name=repo.name,
                rule_name="missing_opinion",
            ))
            is_pending = True
            return OpinionCheckResult(issues, is_approved, is_pending)

        valid_opinions = [o for o in opinions if o.owner == repo.owner]
        if not valid_opinions:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message=f"{repo.name} 没有负责人 {repo.owner} 的意见",
                repo_name=repo.name,
                rule_name="mismatched_owner",
            ))
            is_pending = True
            return OpinionCheckResult(issues, is_approved, is_pending)

        latest_opinion = sorted(valid_opinions, key=lambda o: o.opinion_date or date.min, reverse=True)[0]

        if latest_opinion.opinion == OpinionType.AGREE:
            is_approved = True
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                message=f"{repo.name} 负责人 {repo.owner} 已同意升级",
                repo_name=repo.name,
                rule_name="owner_approved",
            ))
        elif latest_opinion.opinion == OpinionType.DISAGREE:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message=f"{repo.name} 负责人 {repo.owner} 不同意升级: {latest_opinion.comment or '无说明'}",
                repo_name=repo.name,
                rule_name="owner_rejected",
            ))
        elif latest_opinion.opinion == OpinionType.NEED_EXTENSION:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message=f"{repo.name} 负责人 {repo.owner} 要求延期: {latest_opinion.comment or '无说明'}",
                repo_name=repo.name,
                rule_name="owner_needs_extension",
            ))
            is_pending = True
        else:
            is_pending = True

        return OpinionCheckResult(issues, is_approved, is_pending)

    def _check_extensions(self, repo: Repository, extensions: List[ExtensionRequest]) -> 'ExtensionCheckResult':
        issues: List[ValidationIssue] = []
        needs_extension = False

        if not extensions:
            return ExtensionCheckResult(issues, needs_extension)

        approved_extensions = [e for e in extensions if e.status == ExtensionStatus.APPROVED]
        pending_extensions = [e for e in extensions if e.status == ExtensionStatus.REQUESTED]
        rejected_extensions = [e for e in extensions if e.status == ExtensionStatus.REJECTED]

        if approved_extensions:
            ext = sorted(approved_extensions, key=lambda e: e.new_target_date, reverse=True)[0]
            needs_extension = True
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                message=f"{repo.name} 已批准延期至 {ext.new_target_date}，原因: {ext.reason}",
                repo_name=repo.name,
                rule_name="extension_approved",
            ))

        if pending_extensions:
            ext = pending_extensions[0]
            needs_extension = True
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message=f"{repo.name} 有延期申请待审批，申请至 {ext.new_target_date}，原因: {ext.reason}",
                repo_name=repo.name,
                rule_name="extension_pending",
            ))

        if rejected_extensions:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message=f"{repo.name} 延期申请已被驳回",
                repo_name=repo.name,
                rule_name="extension_rejected",
            ))

        return ExtensionCheckResult(issues, needs_extension)

    def _check_batch_conflicts(
        self,
        repo: Repository,
        packages: List[str],
        batches_by_package: Dict[str, List[UpgradeBatch]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        repo_batches: Set[str] = set()
        for pkg in packages:
            if pkg in batches_by_package:
                for batch in batches_by_package[pkg]:
                    repo_batches.add(batch.batch_id)

        if len(repo_batches) > 1:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message=f"{repo.name} 的依赖包涉及多个升级批次: {', '.join(sorted(repo_batches))}",
                repo_name=repo.name,
                rule_name="multiple_batches",
            ))

        return issues

    def _get_valid_packages(self, dependencies: List[Dependency], issues: List[ValidationIssue]) -> List[str]:
        error_packages = {i.package_name for i in issues if i.level == ValidationLevel.ERROR and i.package_name}
        return [d.package_name for d in dependencies if d.package_name not in error_packages]


@dataclass
class OpinionCheckResult:
    issues: List[ValidationIssue]
    is_approved: bool
    is_pending: bool


@dataclass
class ExtensionCheckResult:
    issues: List[ValidationIssue]
    needs_extension: bool
