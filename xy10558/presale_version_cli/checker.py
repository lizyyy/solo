from __future__ import annotations

from typing import List

from .config import Config
from .models import (
    CHECK_RULES,
    CheckResult,
    CheckStatus,
    Document,
    DocumentType,
    ProjectState,
    ReviewStatus,
)


class Checker:
    def __init__(self, state: ProjectState):
        self.state = state
    
    def run_all_checks(self) -> List[CheckResult]:
        results: List[CheckResult] = []
        
        for rule in CHECK_RULES:
            existing_result = next(
                (r for r in self.state.check_results if r.rule_id == rule.id),
                None,
            )
            
            if existing_result and existing_result.is_overridden:
                results.append(existing_result)
                continue
            
            check_method = getattr(self, f"_check_{rule.id.lower()}")
            result = check_method(rule)
            results.append(result)
        
        self.state.check_results = results
        return results
    
    def _check_req_exists(self, rule) -> CheckResult:
        docs = [d for d in self.state.documents if d.type == DocumentType.REQUIREMENTS and d.is_active]
        if docs:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.PASS,
                message=f"找到 {len(docs)} 份需求清单",
                details={"documents": [d.name for d in docs]},
                is_blocking=rule.is_blocking,
            )
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.FAIL,
            message="未找到需求清单文档",
            details={"required": ["需求清单不存在"]},
            is_blocking=rule.is_blocking,
        )
    
    def _check_quot_exists(self, rule) -> CheckResult:
        docs = [d for d in self.state.documents if d.type == DocumentType.QUOTATION and d.is_active]
        if docs:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.PASS,
                message=f"找到 {len(docs)} 份报价表",
                details={"documents": [d.name for d in docs]},
                is_blocking=rule.is_blocking,
            )
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.FAIL,
            message="未找到报价表文档",
            details={"required": ["报价表不存在"]},
            is_blocking=rule.is_blocking,
        )
    
    def _check_quot_version(self, rule) -> CheckResult:
        docs = [d for d in self.state.documents if d.type == DocumentType.QUOTATION and d.is_active]
        if not docs:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.FAIL,
                message="无法检查报价表版本（无报价表）",
                is_blocking=rule.is_blocking,
            )
        
        mismatched = [d for d in docs if d.version != self.state.current_version]
        if mismatched:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.FAIL,
                message=f"报价表版本与方案版本不一致",
                details={
                    "current_version": self.state.current_version,
                    "mismatched": [f"{d.name}: {d.version}" for d in mismatched],
                },
                is_blocking=rule.is_blocking,
            )
        
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.PASS,
            message="报价表版本一致",
            details={"version": self.state.current_version},
            is_blocking=rule.is_blocking,
        )
    
    def _check_att_required(self, rule) -> CheckResult:
        attachments = [d for d in self.state.documents if d.type == DocumentType.ATTACHMENT and d.is_active]
        attachment_names = [d.metadata.get("category", d.name) for d in attachments]
        
        missing = []
        for required in Config.REQUIRED_ATTACHMENTS:
            found = any(required in name for name in attachment_names)
            if not found:
                missing.append(required)
        
        if missing:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.FAIL,
                message=f"缺失必要附件",
                details={"missing_attachments": missing},
                is_blocking=rule.is_blocking,
            )
        
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.PASS,
            message="所有必要附件齐全",
            details={"required": Config.REQUIRED_ATTACHMENTS},
            is_blocking=rule.is_blocking,
        )
    
    def _check_rev_closed(self, rule) -> CheckResult:
        open_reviews = [r for r in self.state.review_items if r.status != ReviewStatus.CLOSED]
        
        if open_reviews:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.FAIL,
                message=f"存在未关闭的评审意见",
                details={
                    "count": len(open_reviews),
                    "open_items": [f"{r.content[:50]}..." for r in open_reviews],
                },
                is_blocking=rule.is_blocking,
            )
        
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.PASS,
            message="所有评审意见已关闭",
            is_blocking=rule.is_blocking,
        )
    
    def _check_multi_scheme(self, rule) -> CheckResult:
        schemes = set()
        for d in self.state.documents:
            if not d.is_active:
                continue
            if "方案A" in d.name or "方案A" in str(d.metadata.get("scheme", "")):
                schemes.add("方案A")
            if "方案B" in d.name or "方案B" in str(d.metadata.get("scheme", "")):
                schemes.add("方案B")
            if "方案" in d.name:
                schemes.add(d.name)
        
        if len(schemes) > 1:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.WARNING,
                message=f"检测到多套方案混放",
                details={"schemes": list(schemes)},
                is_blocking=rule.is_blocking,
            )
        
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.PASS,
            message="方案集唯一",
            is_blocking=rule.is_blocking,
        )
    
    def _check_versions_consistent(self, rule) -> CheckResult:
        active_docs = [d for d in self.state.documents if d.is_active]
        if not active_docs:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.WARNING,
                message="无文档可检查",
                is_blocking=rule.is_blocking,
            )
        
        versions = set(d.version for d in active_docs)
        
        if len(versions) > 1:
            return CheckResult(
                rule_id=rule.id,
                status=CheckStatus.WARNING,
                message=f"存在多个版本号",
                details={"versions": sorted(versions)},
                is_blocking=rule.is_blocking,
            )
        
        return CheckResult(
            rule_id=rule.id,
            status=CheckStatus.PASS,
            message="所有文档版本一致",
            details={"version": list(versions)[0]},
            is_blocking=rule.is_blocking,
        )
