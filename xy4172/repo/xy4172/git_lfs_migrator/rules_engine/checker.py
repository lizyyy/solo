"""各类检查器实现"""
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from git_lfs_migrator.models import (
    CheckResult,
    FileType,
    GitAttributeRule,
    GitFile,
    Issue,
    IssueSeverity,
    IssueType,
    LFSStatus,
    ProtectedBranch,
    ScanResult,
)
from git_lfs_migrator.rules_engine.engine import RuleCategory, RuleResult


DEFAULT_LARGE_FILE_THRESHOLD = 100 * 1024


def check_large_files(
    files: Dict[str, GitFile],
    threshold_bytes: int = DEFAULT_LARGE_FILE_THRESHOLD,
) -> RuleResult:
    """
    检查大文件
    
    Args:
        files: 文件字典
        threshold_bytes: 大文件阈值（字节），默认 100KB
    
    Returns:
        RuleResult
    """
    large_files: List[GitFile] = []
    binary_large_files: List[GitFile] = []
    
    for file_path, git_file in files.items():
        if git_file.size >= threshold_bytes:
            large_files.append(git_file)
            if git_file.file_type == FileType.BINARY:
                binary_large_files.append(git_file)
    
    issues: List[Issue] = []
    
    if large_files:
        not_in_lfs = [f for f in large_files if f.lfs_status != LFSStatus.IN_LFS]
        
        if not_in_lfs:
            issues.append(Issue(
                issue_type=IssueType.LARGE_FILE,
                severity=IssueSeverity.HIGH,
                message=f"发现 {len(not_in_lfs)} 个大文件未纳入 LFS 管理",
                affected_files=[f.path for f in not_in_lfs],
                details={
                    "total_large_files": len(large_files),
                    "files_not_in_lfs": len(not_in_lfs),
                    "threshold_bytes": threshold_bytes,
                    "binary_files_count": len(binary_large_files),
                },
                suggestion="建议将这些大文件添加到 .gitattributes 并使用 git lfs migrate 迁移",
            ))
    
    return RuleResult(
        rule_name="large_files",
        category=RuleCategory.FILE_SIZE,
        passed=len(issues) == 0,
        issues=issues,
        details={
            "large_files_count": len(large_files),
            "binary_large_files_count": len(binary_large_files),
            "threshold_bytes": threshold_bytes,
        },
    )


def check_rule_conflicts(
    rules: List[GitAttributeRule],
    files: Optional[Dict[str, GitFile]] = None,
) -> RuleResult:
    """
    检查 .gitattributes 规则冲突
    
    Args:
        rules: 规则列表
        files: 文件字典（可选，用于检查实际文件匹配）
    
    Returns:
        RuleResult
    """
    from git_lfs_migrator.git_data.gitattributes import check_rule_conflicts as check_conflicts
    
    conflicts = check_conflicts(rules)
    issues: List[Issue] = []
    
    if conflicts:
        for conflict in conflicts:
            issues.append(Issue(
                issue_type=IssueType.RULE_CONFLICT,
                severity=IssueSeverity.HIGH,
                message=f"规则冲突: {conflict['rule1_pattern']} (第{conflict['rule1_line']}行) 与 "
                       f"{conflict['rule2_pattern']} (第{conflict['rule2_line']}行)",
                details=conflict,
                suggestion="请检查 .gitattributes 文件，确保 LFS 规则的一致性",
            ))
    
    return RuleResult(
        rule_name="rule_conflicts",
        category=RuleCategory.GITATTRIBUTES,
        passed=len(issues) == 0,
        issues=issues,
        details={"conflict_count": len(conflicts)},
    )


def check_case_sensitivity(files: Dict[str, GitFile]) -> RuleResult:
    """
    检查路径大小写冲突
    
    Args:
        files: 文件字典
    
    Returns:
        RuleResult
    """
    lowercase_map: Dict[str, List[str]] = defaultdict(list)
    
    for file_path in files.keys():
        lowercase_path = file_path.lower()
        lowercase_map[lowercase_path].append(file_path)
    
    case_conflicts: List[List[str]] = []
    for paths in lowercase_map.values():
        if len(paths) > 1:
            case_conflicts.append(paths)
    
    issues: List[Issue] = []
    
    if case_conflicts:
        for conflict in case_conflicts:
            issues.append(Issue(
                issue_type=IssueType.CASE_SENSITIVITY,
                severity=IssueSeverity.CRITICAL,
                message=f"路径大小写冲突: {', '.join(conflict)}",
                affected_files=conflict,
                details={
                    "conflicting_paths": conflict,
                    "lowercase": conflict[0].lower() if conflict else "",
                },
                suggestion="在区分大小写的文件系统上，这些路径会被视为不同文件。"
                          "建议统一命名规范并迁移历史记录。",
            ))
    
    return RuleResult(
        rule_name="case_sensitivity",
        category=RuleCategory.CASE_SENSITIVITY,
        passed=len(issues) == 0,
        issues=issues,
        details={"case_conflict_count": len(case_conflicts)},
    )


def check_hash_conflicts(files: Dict[str, GitFile]) -> RuleResult:
    """
    检查同名不同哈希的冲突（历史中同一文件有不同哈希）
    
    Args:
        files: 文件字典
    
    Returns:
        RuleResult
    """
    path_hashes: Dict[str, Set[str]] = defaultdict(set)
    
    for file_path, git_file in files.items():
        path_hashes[file_path].add(git_file.blob_hash)
    
    hash_conflicts: List[Dict[str, Any]] = []
    
    for file_path, hashes in path_hashes.items():
        if len(hashes) > 1:
            hash_conflicts.append({
                "path": file_path,
                "hash_count": len(hashes),
                "hashes": list(hashes),
            })
    
    issues: List[Issue] = []
    
    if hash_conflicts:
        for conflict in hash_conflicts:
            issues.append(Issue(
                issue_type=IssueType.HASH_MISMATCH,
                severity=IssueSeverity.HIGH,
                message=f"历史中同一文件路径存在不同哈希: {conflict['path']}",
                affected_files=[conflict["path"]],
                details=conflict,
                suggestion="这可能表示文件在历史中被修改过。LFS 迁移时需要确保所有版本都正确处理。",
            ))
    
    return RuleResult(
        rule_name="hash_conflicts",
        category=RuleCategory.HASH_CONFLICT,
        passed=len(issues) == 0,
        issues=issues,
        details={"hash_conflict_count": len(hash_conflicts)},
    )


def check_protected_refs(
    protected_refs: List[ProtectedBranch],
    files: Optional[Dict[str, GitFile]] = None,
) -> RuleResult:
    """
    检查受保护标签和分支的迁移风险
    
    Args:
        protected_refs: 受保护引用列表
        files: 文件字典（可选）
    
    Returns:
        RuleResult
    """
    issues: List[Issue] = []
    protected_tags = [r for r in protected_refs if r.is_tag]
    protected_branches = [r for r in protected_refs if not r.is_tag]
    
    if protected_tags:
        issues.append(Issue(
            issue_type=IssueType.PROTECTED_TAG,
            severity=IssueSeverity.CRITICAL,
            message=f"发现 {len(protected_tags)} 个受保护标签",
            affected_files=[],
            details={
                "protected_tags": [t.name for t in protected_tags],
                "protected_branches": [b.name for b in protected_branches],
            },
            suggestion="标签通常指向固定提交。LFS 迁移会重写历史，导致标签引用失效。"
                      "建议：1) 删除旧标签后重新打标签，或 2) 使用 --include-tags 选项。",
        ))
    
    return RuleResult(
        rule_name="protected_refs",
        category=RuleCategory.PROTECTED_REFS,
        passed=len(issues) == 0,
        issues=issues,
        details={
            "protected_tags_count": len(protected_tags),
            "protected_branches_count": len(protected_branches),
        },
    )


def check_rollback_risk(
    scan_result: ScanResult,
    check_result: Optional[CheckResult] = None,
) -> RuleResult:
    """
    检查回滚风险
    
    Args:
        scan_result: 扫描结果
        check_result: 检查结果（可选）
    
    Returns:
        RuleResult
    """
    issues: List[Issue] = []
    rollback_scenarios: List[str] = []
    
    if scan_result.large_files > 100:
        rollback_scenarios.append("大文件数量较多，迁移后仓库大小变化大")
    
    if scan_result.binary_files > 50:
        rollback_scenarios.append("二进制文件较多，LFS 指针与实际文件切换复杂")
    
    files_in_lfs = sum(
        1 for f in scan_result.file_sizes.values()
        if f.lfs_status in (LFSStatus.IN_LFS, LFSStatus.POINTER_FILE)
    )
    if files_in_lfs > 0:
        rollback_scenarios.append("已有部分文件在 LFS 中，混合迁移增加复杂度")
    
    if check_result and check_result.case_conflicts:
        rollback_scenarios.append("存在路径大小写冲突，回滚时可能导致文件覆盖")
    
    if check_result and check_result.hash_conflicts:
        rollback_scenarios.append("存在哈希冲突，回滚时难以恢复原始状态")
    
    if rollback_scenarios:
        issues.append(Issue(
            issue_type=IssueType.ROLLBACK_RISK,
            severity=IssueSeverity.HIGH,
            message="检测到高回滚风险场景",
            details={"rollback_scenarios": rollback_scenarios},
            suggestion="建议：1) 在临时镜像中完整演练迁移流程；"
                      "2) 迁移前创建完整备份；"
                      "3) 考虑使用 --object-map 记录迁移映射以便回滚。",
        ))
    
    return RuleResult(
        rule_name="rollback_risk",
        category=RuleCategory.ROLLBACK,
        passed=len(issues) == 0,
        issues=issues,
        details={
            "rollback_scenario_count": len(rollback_scenarios),
            "rollback_scenarios": rollback_scenarios,
        },
    )


def check_submodules(
    submodules: List[Dict[str, str]],
    scan_result: Optional[ScanResult] = None,
) -> RuleResult:
    """
    检查子模块引用
    
    Args:
        submodules: 子模块列表
        scan_result: 扫描结果（可选）
    
    Returns:
        RuleResult
    """
    issues: List[Issue] = []
    
    if submodules:
        issues.append(Issue(
            issue_type=IssueType.SUBMODULE_BROKEN,
            severity=IssueSeverity.MEDIUM,
            message=f"发现 {len(submodules)} 个子模块",
            affected_files=[s.get("path", "") for s in submodules],
            details={
                "submodules": submodules,
            },
            suggestion="LFS 迁移重写历史后，子模块引用的提交哈希可能失效。"
                      "建议：1) 检查子模块是否也需要 LFS 迁移；"
                      "2) 迁移后更新 .gitmodules 和父仓库中的子模块引用。",
        ))
    
    return RuleResult(
        rule_name="submodules",
        category=RuleCategory.SUBMODULE,
        passed=len(issues) == 0,
        issues=issues,
        details={"submodule_count": len(submodules)},
    )


def perform_full_check(
    scan_result: ScanResult,
    large_file_threshold: int = DEFAULT_LARGE_FILE_THRESHOLD,
) -> CheckResult:
    """
    执行完整检查
    
    Args:
        scan_result: 扫描结果
        large_file_threshold: 大文件阈值
    
    Returns:
        CheckResult
    """
    check_result = CheckResult(scan_result=scan_result)
    
    large_file_result = check_large_files(scan_result.file_sizes, large_file_threshold)
    check_result.issues.extend(large_file_result.issues)
    
    rule_conflict_result = check_rule_conflicts(scan_result.gitattributes_rules, scan_result.file_sizes)
    check_result.issues.extend(rule_conflict_result.issues)
    
    case_result = check_case_sensitivity(scan_result.file_sizes)
    check_result.issues.extend(case_result.issues)
    if "case_conflict_count" in case_result.details:
        check_result.case_conflicts = [
            [] for _ in range(case_result.details["case_conflict_count"])
        ]
    
    hash_result = check_hash_conflicts(scan_result.file_sizes)
    check_result.issues.extend(hash_result.issues)
    if "hash_conflict_count" in hash_result.details:
        check_result.hash_conflicts = [
            {} for _ in range(hash_result.details["hash_conflict_count"])
        ]
    
    protected_result = check_protected_refs(scan_result.protected_branches, scan_result.file_sizes)
    check_result.issues.extend(protected_result.issues)
    
    rollback_result = check_rollback_risk(scan_result, check_result)
    check_result.issues.extend(rollback_result.issues)
    if "rollback_scenarios" in rollback_result.details:
        check_result.rollback_scenarios = rollback_result.details["rollback_scenarios"]
    
    submodule_result = check_submodules(
        [{"path": s.path, "url": s.url} for s in scan_result.submodules],
        scan_result,
    )
    check_result.issues.extend(submodule_result.issues)
    
    return check_result
