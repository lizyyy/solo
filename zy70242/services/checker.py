"""业务规则检查器 - 核心业务逻辑"""

from typing import List, Optional, Set, Tuple, Dict, Any
from dataclasses import asdict

from .models import (
    TransferBatch,
    ReceiptRecord,
    DossierCatalog,
    CheckIssue,
    BatchCheckResult,
    CheckResult,
    ReceiptStatus,
    parse_page_range,
    format_page_range,
)
from .storage import Storage


class Checker:
    """卷宗移交检查器"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def check(self, batch_id: Optional[str] = None) -> CheckResult:
        batches = []
        if batch_id:
            batch = self.storage.get_batch(batch_id)
            if not batch:
                return CheckResult(
                    success=False,
                    total_batches=0,
                    passed_count=0,
                    failed_count=0,
                    error=f"批次不存在: {batch_id}"
                )
            batches = [batch]
        else:
            batches = self.storage.get_all_batches()
        
        if not batches:
            return CheckResult(
                success=True,
                total_batches=0,
                passed_count=0,
                failed_count=0,
                failures=[]
            )
        
        failures: List[BatchCheckResult] = []
        passed_count = 0
        
        for batch in batches:
            result = self._check_single_batch(batch)
            if result.passed:
                passed_count += 1
            else:
                failures.append(result)
            
            issues_dicts = [asdict(i) for i in result.issues]
            self.storage.save_check_result(
                batch.batch_id,
                batch.case_id,
                result.passed,
                issues_dicts
            )
        
        failed_count = len(batches) - passed_count
        
        self.storage.add_history(
            "check",
            True,
            f"检查批次 {len(batches)} 个, 通过 {passed_count} 个, 失败 {failed_count} 个"
        )
        
        return CheckResult(
            success=True,
            total_batches=len(batches),
            passed_count=passed_count,
            failed_count=failed_count,
            failures=failures
        )
    
    def _check_single_batch(self, batch: TransferBatch) -> BatchCheckResult:
        issues: List[CheckIssue] = []
        
        receipt = self.storage.get_receipt_by_batch(batch.batch_id)
        catalog = self.storage.get_catalog_by_case(batch.case_id)
        
        issues.extend(self._check_batch_integrity(batch))
        issues.extend(self._check_catalog_consistency(batch, catalog))
        
        if receipt:
            issues.extend(self._check_receipt_match(batch, receipt, catalog))
            issues.extend(self._check_page_numbering(batch, receipt))
            issues.extend(self._check_return_logic(batch, receipt))
        
        issues.extend(self._check_stage_flow(batch, receipt))
        
        passed = len([i for i in issues if i.severity == "error"]) == 0
        
        return BatchCheckResult(
            batch_id=batch.batch_id,
            case_id=batch.case_id,
            issues=issues,
            passed=passed
        )
    
    def _check_batch_integrity(self, batch: TransferBatch) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        if batch.total_pages <= 0:
            issues.append(CheckIssue(
                type="INVALID_PAGE_COUNT",
                message=f"移交页码总数无效: {batch.total_pages}",
                details="total_pages 必须大于 0",
                severity="error"
            ))
        
        if batch.dossier_count <= 0:
            issues.append(CheckIssue(
                type="INVALID_DOSSIER_COUNT",
                message=f"卷宗数量无效: {batch.dossier_count}",
                details="dossier_count 必须大于 0",
                severity="error"
            ))
        
        if batch.from_stage == batch.to_stage:
            issues.append(CheckIssue(
                type="INVALID_STAGE_FLOW",
                message=f"移交阶段无效: {batch.from_stage} -> {batch.to_stage}",
                details="源阶段和目标阶段不能相同",
                severity="error"
            ))
        
        return issues
    
    def _check_catalog_consistency(self, batch: TransferBatch, catalog: List[DossierCatalog]) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        if not catalog:
            issues.append(CheckIssue(
                type="MISSING_CATALOG",
                message="缺少卷宗目录",
                details=f"案件 {batch.case_id} 没有导入目录记录",
                severity="warning"
            ))
            return issues
        
        page_set: Set[int] = set()
        gaps: List[Tuple[int, int]] = []
        overlaps: List[Tuple[int, int]] = []
        total_catalog_pages = 0
        prev_end = 0
        
        for item in catalog:
            total_catalog_pages += item.page_count
            
            for page in range(item.page_start, item.page_end + 1):
                if page in page_set:
                    overlaps.append((item.page_start, item.page_end))
                page_set.add(page)
            
            if item.page_start > prev_end + 1 and prev_end > 0:
                gaps.append((prev_end + 1, item.page_start - 1))
            
            prev_end = max(prev_end, item.page_end)
            
            if item.page_count != (item.page_end - item.page_start + 1):
                issues.append(CheckIssue(
                    type="CATALOG_PAGE_MISMATCH",
                    message=f"目录条目 '{item.item_name}' 页码计数不一致",
                    details=f"page_count={item.page_count}, 实际范围={item.page_start}-{item.page_end}(共{item.page_end - item.page_start + 1}页)",
                    severity="error"
                ))
        
        if gaps:
            gap_str = ", ".join([f"{g[0]}-{g[1]}" for g in gaps])
            issues.append(CheckIssue(
                type="CATALOG_GAP",
                message="目录存在页码间隙",
                details=f"间隙页码: {gap_str}",
                severity="error"
            ))
        
        if overlaps:
            overlap_str = ", ".join([f"{o[0]}-{o[1]}" for o in overlaps])
            issues.append(CheckIssue(
                type="CATALOG_OVERLAP",
                message="目录存在页码重叠",
                details=f"重叠页码范围: {overlap_str}",
                severity="error"
            ))
        
        if total_catalog_pages != batch.total_pages:
            issues.append(CheckIssue(
                type="TOTAL_PAGE_MISMATCH",
                message="目录总页数与移交批次页数不一致",
                details=f"目录总页数={total_catalog_pages}, 批次总页数={batch.total_pages}",
                severity="error"
            ))
        
        if catalog and max(item.page_end for item in catalog) > batch.total_pages:
            issues.append(CheckIssue(
                type="PAGE_RANGE_EXCEED",
                message="目录页码超出批次范围",
                details=f"批次最大页码={batch.total_pages}, 目录最大页码={max(item.page_end for item in catalog)}",
                severity="error"
            ))
        
        return issues
    
    def _check_receipt_match(self, batch: TransferBatch, receipt: ReceiptRecord, catalog: List[DossierCatalog]) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        if batch.case_id != receipt.case_id:
            issues.append(CheckIssue(
                type="CASE_ID_MISMATCH",
                message="签收记录案件号与批次不一致",
                details=f"批次案件号={batch.case_id}, 签收案件号={receipt.case_id}",
                severity="error"
            ))
        
        if receipt.received_page_count is not None:
            expected = batch.total_pages
            actual = receipt.received_page_count
            
            if actual != expected:
                diff = expected - actual
                issues.append(CheckIssue(
                    type="RECEIVED_PAGE_COUNT_MISMATCH",
                    message=f"实收页数与移交页数不一致",
                    details=f"移交页数={expected}, 实收页数={actual}, 差异={diff}页",
                    severity="error"
                ))
        
        return issues
    
    def _check_page_numbering(self, batch: TransferBatch, receipt: ReceiptRecord) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        expected_pages = set(range(1, batch.total_pages + 1))
        missing_pages = receipt.get_missing_pages_list()
        extra_pages = receipt.get_extra_pages_list()
        
        if missing_pages:
            for page in missing_pages:
                if page < 1 or page > batch.total_pages:
                    issues.append(CheckIssue(
                        type="INVALID_MISSING_PAGE",
                        message=f"缺失页码超出有效范围",
                        details=f"页码 {page} 超出有效范围 1-{batch.total_pages}",
                        severity="error"
                    ))
            
            valid_missing = [p for p in missing_pages if 1 <= p <= batch.total_pages]
            if valid_missing:
                issues.append(CheckIssue(
                    type="MISSING_PAGES",
                    message="存在缺页",
                    details=f"缺失页码: {format_page_range(valid_missing)}",
                    severity="error"
                ))
        
        if extra_pages:
            valid_extra = [p for p in extra_pages if 1 <= p <= batch.total_pages]
            if valid_extra:
                issues.append(CheckIssue(
                    type="EXTRA_PAGES",
                    message="存在多余页码",
                    details=f"多余页码: {format_page_range(valid_extra)}",
                    severity="error"
                ))
            
            out_of_range = [p for p in extra_pages if p < 1 or p > batch.total_pages]
            if out_of_range:
                issues.append(CheckIssue(
                    type="INVALID_EXTRA_PAGE",
                    message=f"多余页码超出有效范围",
                    details=f"页码 {format_page_range(out_of_range)} 超出有效范围 1-{batch.total_pages}",
                    severity="warning"
                ))
        
        both = set(missing_pages) & set(extra_pages)
        if both:
            issues.append(CheckIssue(
                type="CONFLICTING_PAGE_STATUS",
                message="页码同时被标记为缺失和多余",
                details=f"冲突页码: {format_page_range(sorted(both))}",
                severity="error"
            ))
        
        return issues
    
    def _check_return_logic(self, batch: TransferBatch, receipt: ReceiptRecord) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        if receipt.status == ReceiptStatus.RETURNED:
            if not receipt.return_reason:
                issues.append(CheckIssue(
                    type="RETURN_WITHOUT_REASON",
                    message="退回记录缺少退回原因",
                    details="status=returned 时必须填写 return_reason",
                    severity="error"
                ))
            else:
                missing_pages = receipt.get_missing_pages_list()
                catalog = self.storage.get_catalog_by_case(batch.case_id)
                
                if missing_pages and receipt.return_reason.value == "missing_pages":
                    issues.append(CheckIssue(
                        type="RETURN_MISSING_PAGES",
                        message="因缺页被退回",
                        details=f"缺失页码: {format_page_range(missing_pages)}",
                        severity="warning"
                    ))
                
                if catalog and receipt.return_reason.value == "catalog_mismatch":
                    issues.append(CheckIssue(
                        type="RETURN_CATALOG_MISMATCH",
                        message="因目录不符被退回",
                        details=receipt.return_notes or "目录与实际卷宗不一致",
                        severity="warning"
                    ))
        else:
            if receipt.return_reason:
                issues.append(CheckIssue(
                    type="REASON_WITHOUT_RETURN",
                    message="非退回状态但有退回原因",
                    details=f"status={receipt.status}, return_reason={receipt.return_reason}",
                    severity="warning"
                ))
        
        return issues
    
    def _check_stage_flow(self, batch: TransferBatch, receipt: Optional[ReceiptRecord]) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        valid_flows = {
            ("filing", "trial"),
            ("trial", "archive"),
            ("filing", "archive"),
        }
        
        flow = (batch.from_stage.value, batch.to_stage.value)
        if flow not in valid_flows:
            issues.append(CheckIssue(
                type="INVALID_STAGE_TRANSITION",
                message="不合法的阶段流转",
                details=f"{batch.from_stage} -> {batch.to_stage}, 合法流转: 立案->审判, 审判->归档, 立案->归档",
                severity="error"
            ))
        
        if receipt:
            if receipt.status == ReceiptStatus.PENDING:
                issues.append(CheckIssue(
                    type="RECEIPT_PENDING",
                    message="签收尚未完成",
                    details=f"批次 {batch.batch_id} 签收状态: pending",
                    severity="info"
                ))
            elif receipt.status == ReceiptStatus.RETURNED:
                issues.append(CheckIssue(
                    type="RETURNED",
                    message="卷宗已被退回",
                    details=f"退回原因: {receipt.return_reason}",
                    severity="warning"
                ))
        
        return issues
