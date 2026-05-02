from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

import semantic_version

from ..indexer import FileEntry, FileIndexer
from ..parsers import (
    ChecksumParser,
    LicenseParser,
    SBOMParser,
    ChangelogParser,
    CILogParser,
)


class RuleSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Violation:
    rule_id: str
    rule_name: str
    severity: RuleSeverity
    message: str
    file: Optional[str] = None
    line: Optional[int] = None
    expected: Any = None
    actual: Any = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleResult:
    rule_id: str
    rule_name: str
    passed: bool
    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)
    duration_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VerificationResult:
    overall_passed: bool
    results: List[RuleResult]
    scan_time: str = ""
    target_path: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def total_violations(self) -> int:
        return sum(len(r.violations) for r in self.results)
    
    @property
    def critical_violations(self) -> List[Violation]:
        crits = []
        for r in self.results:
            crits.extend([v for v in r.violations if v.severity == RuleSeverity.CRITICAL])
        return crits
    
    def get_violations_by_severity(self, severity: RuleSeverity) -> List[Violation]:
        violations = []
        for r in self.results:
            violations.extend([v for v in r.violations if v.severity == severity])
        return violations


class Rule:
    def __init__(
        self,
        rule_id: str,
        name: str,
        description: str,
        severity: RuleSeverity = RuleSeverity.HIGH,
        run_fn: Optional[Callable[..., RuleResult]] = None,
    ):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.severity = severity
        self._run_fn = run_fn
        self.enabled = True
    
    def run(self, context: Dict[str, Any]) -> RuleResult:
        if self._run_fn:
            return self._run_fn(self, context)
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            violations=[],
        )


class RuleEngine:
    def __init__(self, indexer: Optional[FileIndexer] = None):
        self.indexer = indexer
        self.rules: Dict[str, Rule] = {}
        self._register_builtin_rules()
    
    def _register_builtin_rules(self):
        self.add_rule(Rule(
            "version-consistency",
            "版本一致性检查",
            "检查所有文件中的版本号是否一致",
            severity=RuleSeverity.CRITICAL,
            run_fn=self._check_version_consistency,
        ))
        
        self.add_rule(Rule(
            "semantic-version",
            "语义化版本检查",
            "检查版本号是否符合语义化版本规范",
            severity=RuleSeverity.MEDIUM,
            run_fn=self._check_semantic_version,
        ))
        
        self.add_rule(Rule(
            "hash-verification",
            "哈希校验",
            "验证checksums.txt中的哈希值与文件实际哈希是否匹配",
            severity=RuleSeverity.CRITICAL,
            run_fn=self._check_hashes,
        ))
        
        self.add_rule(Rule(
            "sbom-licenses",
            "SBOM许可证检查",
            "检查SBOM中所有组件是否都有许可证信息",
            severity=RuleSeverity.HIGH,
            run_fn=self._check_sbom_licenses,
        ))
        
        self.add_rule(Rule(
            "license-inventory",
            "许可证清单检查",
            "检查许可证清单与SBOM中的组件是否一致",
            severity=RuleSeverity.HIGH,
            run_fn=self._check_license_inventory,
        ))
        
        self.add_rule(Rule(
            "changelog-exists",
            "Changelog存在性检查",
            "检查是否包含changelog且包含当前版本",
            severity=RuleSeverity.MEDIUM,
            run_fn=self._check_changelog,
        ))
        
        self.add_rule(Rule(
            "ci-log-errors",
            "CI日志错误检查",
            "检查CI日志中是否存在错误",
            severity=RuleSeverity.HIGH,
            run_fn=self._check_ci_log_errors,
        ))
        
        self.add_rule(Rule(
            "signature-files",
            "签名文件检查",
            "检查是否存在签名文件(.sig, .asc等)",
            severity=RuleSeverity.MEDIUM,
            run_fn=self._check_signature_files,
        ))
        
        self.add_rule(Rule(
            "package-naming",
            "包名规范检查",
            "检查包名是否符合规范",
            severity=RuleSeverity.MEDIUM,
            run_fn=self._check_package_naming,
        ))
    
    def add_rule(self, rule: Rule) -> "RuleEngine":
        self.rules[rule.rule_id] = rule
        return self
    
    def enable_rule(self, rule_id: str) -> "RuleEngine":
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True
        return self
    
    def disable_rule(self, rule_id: str) -> "RuleEngine":
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False
        return self
    
    def verify(self, context: Dict[str, Any]) -> VerificationResult:
        from time import perf_counter
        
        scan_time = datetime.now().isoformat()
        
        results: List[RuleResult] = []
        overall_passed = True
        
        for rule_id, rule in self.rules.items():
            if not rule.enabled:
                continue
            
            start_time = perf_counter()
            try:
                result = rule.run(context)
                result.duration_ms = (perf_counter() - start_time) * 1000
                
                if not result.passed:
                    overall_passed = False
                
                results.append(result)
            except Exception as e:
                violation = Violation(
                    rule_id=rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.MEDIUM,
                    message=f"规则执行出错: {str(e)}",
                    details={"error_type": type(e).__name__},
                )
                results.append(RuleResult(
                    rule_id=rule_id,
                    rule_name=rule.name,
                    passed=False,
                    violations=[violation],
                    duration_ms=(perf_counter() - start_time) * 1000,
                ))
                overall_passed = False
        
        target_path = ""
        if self.indexer:
            target_path = str(self.indexer.base_path)
        
        return VerificationResult(
            overall_passed=overall_passed,
            results=results,
            scan_time=scan_time,
            target_path=target_path,
        )
    
    def _check_version_consistency(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        versions = set()
        version_sources: Dict[str, List[str]] = {}
        
        for entry in indexer.entries.values():
            if entry.version:
                versions.add(entry.version)
                if entry.version not in version_sources:
                    version_sources[entry.version] = []
                version_sources[entry.version].append(entry.path)
        
        if not versions:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未从文件名中检测到版本号",
                )],
                metadata={"versions_found": 0},
            )
        
        if len(versions) > 1:
            violations = []
            for version, sources in version_sources.items():
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=f"发现不一致的版本号: {version}",
                    expected="单一版本号",
                    actual=str(versions),
                    details={"sources": sources, "version": version},
                ))
            
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={"versions_found": list(versions), "count": len(versions)},
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={"version": next(iter(versions)), "sources": version_sources},
        )
    
    def _check_semantic_version(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        violations = []
        valid_versions = []
        
        for entry in indexer.entries.values():
            if entry.version:
                try:
                    semantic_version.Version(entry.version)
                    valid_versions.append(entry.version)
                except ValueError:
                    try:
                        semantic_version.NpmSpec(entry.version)
                        valid_versions.append(entry.version)
                    except ValueError:
                        violations.append(Violation(
                            rule_id=rule.rule_id,
                            rule_name=rule.name,
                            severity=rule.severity,
                            message=f"版本号不符合语义化规范: {entry.version}",
                            file=entry.path,
                            expected="语义化版本 (x.y.z)",
                            actual=entry.version,
                        ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={"valid_versions": list(set(valid_versions))},
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={"versions": list(set(valid_versions))},
        )
    
    def _check_hashes(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        checksum_entries = indexer.get_by_type("checksum")
        if not checksum_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="未找到checksums文件",
                )],
            )
        
        base_path = indexer.base_path
        parser = ChecksumParser()
        all_violations = []
        checked_count = 0
        
        for cs_entry in checksum_entries:
            cs_path = base_path / cs_entry.path
            parser.parse(cs_path)
            
            for filename, cs_hash_entry in parser.filename_to_entry.items():
                actual_entry = None
                for path, entry in indexer.entries.items():
                    if entry.filename == filename or path.endswith(filename):
                        actual_entry = entry
                        break
                
                if actual_entry:
                    checked_count += 1
                    if actual_entry.sha256.lower() != cs_hash_entry.hash_value.lower():
                        all_violations.append(Violation(
                            rule_id=rule.rule_id,
                            rule_name=rule.name,
                            severity=RuleSeverity.CRITICAL,
                            message=f"哈希不匹配: {filename}",
                            file=actual_entry.path,
                            expected=cs_hash_entry.hash_value.lower(),
                            actual=actual_entry.sha256.lower(),
                            details={"checksum_file": cs_entry.path, "algorithm": cs_hash_entry.algorithm},
                        ))
                else:
                    all_violations.append(Violation(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        severity=RuleSeverity.HIGH,
                        message=f"checksums中引用的文件不存在: {filename}",
                        file=cs_entry.path,
                        line=cs_hash_entry.line_number,
                        expected=f"文件 {filename} 存在",
                        actual="文件不存在",
                    ))
        
        if all_violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=all_violations,
                metadata={"checked_count": checked_count, "checksum_files": [e.path for e in checksum_entries]},
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={"checked_count": checked_count, "checksum_files": [e.path for e in checksum_entries]},
        )
    
    def _check_sbom_licenses(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        sbom_entries = indexer.get_by_type("sbom")
        if not sbom_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.MEDIUM,
                    message="未找到SBOM文件",
                )],
            )
        
        base_path = indexer.base_path
        parser = SBOMParser()
        violations = []
        total_components = 0
        components_with_licenses = 0
        
        for sbom_entry in sbom_entries:
            sbom_path = base_path / sbom_entry.path
            parser.parse(sbom_path)
            
            for component in parser.components:
                total_components += 1
                if component.licenses:
                    components_with_licenses += 1
                else:
                    violations.append(Violation(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        message=f"组件缺少许可证信息: {component.name}",
                        file=sbom_entry.path,
                        expected="有许可证",
                        actual="无许可证",
                        details={"component": component.name, "version": component.version, "purl": component.purl},
                    ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={
                    "total_components": total_components,
                    "with_licenses": components_with_licenses,
                    "missing_licenses": total_components - components_with_licenses,
                },
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={
                "total_components": total_components,
                "all_licensed": True,
            },
        )
    
    def _check_license_inventory(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        sbom_entries = indexer.get_by_type("sbom")
        license_entries = indexer.get_by_type("license")
        
        if not sbom_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未找到SBOM，跳过许可证一致性检查",
                )],
            )
        
        if not license_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="未找到许可证清单文件",
                )],
            )
        
        base_path = indexer.base_path
        
        sbom_parser = SBOMParser()
        sbom_components: Set[str] = set()
        
        for sbom_entry in sbom_entries:
            sbom_path = base_path / sbom_entry.path
            sbom_parser.parse(sbom_path)
            for comp in sbom_parser.components:
                sbom_components.add(comp.name)
        
        license_parser = LicenseParser()
        license_components: Set[str] = set()
        
        for lic_entry in license_entries:
            lic_path = base_path / lic_entry.path
            license_parser.parse(lic_path)
            for entry in license_parser.entries:
                license_components.add(entry.component)
        
        violations = []
        
        for comp in sbom_components - license_components:
            violations.append(Violation(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                severity=rule.severity,
                message=f"SBOM中的组件未在许可证清单中找到: {comp}",
                expected=f"许可证清单包含 {comp}",
                actual="组件缺失",
            ))
        
        for comp in license_components - sbom_components:
            violations.append(Violation(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                severity=RuleSeverity.LOW,
                message=f"许可证清单中有多余的组件，SBOM中不存在: {comp}",
                expected=f"SBOM包含 {comp}",
                actual="组件不存在于SBOM",
            ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={
                    "sbom_components": sorted(list(sbom_components)),
                    "license_components": sorted(list(license_components)),
                    "missing_in_license": sorted(list(sbom_components - license_components)),
                    "extra_in_license": sorted(list(license_components - sbom_components)),
                },
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={
                "component_count": len(sbom_components),
                "match": True,
            },
        )
    
    def _check_changelog(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        changelog_entries = indexer.get_by_type("changelog")
        if not changelog_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="未找到Changelog文件",
                )],
            )
        
        base_path = indexer.base_path
        
        expected_versions = set()
        for entry in indexer.entries.values():
            if entry.version:
                expected_versions.add(entry.version)
        
        if not expected_versions:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未检测到版本号，无法验证Changelog是否包含对应版本",
                )],
            )
        
        parser = ChangelogParser()
        found_versions = set()
        
        for cl_entry in changelog_entries:
            cl_path = base_path / cl_entry.path
            parser.parse(cl_path)
            for entry in parser.entries:
                found_versions.add(entry.version)
        
        violations = []
        for version in expected_versions:
            version_found = False
            for found in found_versions:
                if found == version or found.startswith(version) or version.startswith(found):
                    version_found = True
                    break
            
            if not version_found:
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=f"Changelog中未找到版本 {version} 的条目",
                    expected=f"Changelog包含版本 {version}",
                    actual=f"已找到的版本: {sorted(list(found_versions))}",
                ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={
                    "expected_versions": sorted(list(expected_versions)),
                    "found_versions": sorted(list(found_versions)),
                },
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={
                "versions_verified": sorted(list(expected_versions)),
                "changelog_versions": sorted(list(found_versions)),
            },
        )
    
    def _check_ci_log_errors(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        ci_log_entries = indexer.get_by_type("ci_log")
        if not ci_log_entries:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未找到CI日志文件，跳过检查",
                )],
            )
        
        base_path = indexer.base_path
        parser = CILogParser()
        violations = []
        
        for log_entry in ci_log_entries:
            log_path = base_path / log_entry.path
            parser.parse(log_path)
            
            for error in parser.errors:
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.HIGH,
                    message=f"CI日志中发现错误: {error.message[:100]}",
                    file=log_entry.path,
                    line=error.line_number,
                    details={"raw_message": error.message},
                ))
            
            for warning in parser.warnings:
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message=f"CI日志中发现警告: {warning.message[:100]}",
                    file=log_entry.path,
                    line=warning.line_number,
                    details={"raw_message": warning.message},
                ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={"log_files": [e.path for e in ci_log_entries]},
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={"log_files": [e.path for e in ci_log_entries], "no_errors": True},
        )
    
    def _check_signature_files(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        signature_entries = indexer.get_by_type("signature")
        artifacts = indexer.get_all_artifacts()
        
        if not artifacts:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未找到发布包文件，跳过签名检查",
                )],
            )
        
        signed_artifacts = set()
        for sig_entry in signature_entries:
            base_name = sig_entry.filename
            for ext in [".sig", ".asc", ".sign"]:
                if base_name.endswith(ext):
                    base_name = base_name[:-len(ext)]
                    break
            signed_artifacts.add(base_name)
        
        violations = []
        for artifact in artifacts:
            has_sig = False
            if artifact.filename in signed_artifacts:
                has_sig = True
            else:
                for sig_base in signed_artifacts:
                    if artifact.filename.startswith(sig_base) or sig_base in artifact.filename:
                        has_sig = True
                        break
            
            if not has_sig:
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=f"发布包缺少签名文件: {artifact.filename}",
                    file=artifact.path,
                    expected="存在对应的 .sig 或 .asc 签名文件",
                    actual="无签名文件",
                ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={
                    "signature_files": [e.path for e in signature_entries],
                    "artifacts": [e.filename for e in artifacts],
                },
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={
                "signature_files": [e.path for e in signature_entries],
                "artifacts_signed": len(artifacts),
            },
        )
    
    def _check_package_naming(self, rule: Rule, context: Dict[str, Any]) -> RuleResult:
        indexer = context.get("indexer") or self.indexer
        if not indexer:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message="没有可用的文件索引",
                )],
            )
        
        artifacts = indexer.get_all_artifacts()
        if not artifacts:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=True,
                warnings=[Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message="未找到发布包文件",
                )],
            )
        
        violations = []
        import re
        
        for artifact in artifacts:
            filename = artifact.filename.lower()
            
            if artifact.version:
                if artifact.version not in filename:
                    violations.append(Violation(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        message=f"包名中未包含版本号: {artifact.filename}",
                        file=artifact.path,
                        expected=f"包含版本号 {artifact.version}",
                        actual=artifact.filename,
                    ))
            
            if not re.search(r'[a-z]', filename):
                violations.append(Violation(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    severity=RuleSeverity.LOW,
                    message=f"包名格式可疑: {artifact.filename}",
                    file=artifact.path,
                    details={"filename": artifact.filename},
                ))
        
        if violations:
            return RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                passed=False,
                violations=violations,
                metadata={"artifacts_count": len(artifacts)},
            )
        
        return RuleResult(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            passed=True,
            metadata={"artifacts_count": len(artifacts), "naming_ok": True},
        )
