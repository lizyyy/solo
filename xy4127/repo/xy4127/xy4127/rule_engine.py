import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from collections import defaultdict

from .models import Package, Issue, Photo, Remark, ClaimForm


class RuleEngine:
    """规则引擎 - 校验异常包裹规则"""
    
    SEVERITY_CRITICAL = "critical"
    SEVERITY_HIGH = "high"
    SEVERITY_MEDIUM = "medium"
    SEVERITY_LOW = "low"
    
    ISSUE_MISSING_PHOTO = "missing_photo"
    ISSUE_MISSING_TIMESTAMP = "missing_timestamp"
    ISSUE_DUPLICATE_TRACKING = "duplicate_tracking"
    ISSUE_CONFLICT_REMARK = "conflict_remark"
    ISSUE_TIMESTAMP_OUT_OF_ORDER = "timestamp_out_of_order"
    ISSUE_AMOUNT_MISMATCH = "amount_mismatch"
    ISSUE_MISSING_CLAIM = "missing_claim"
    ISSUE_DUPLICATE_CLAIM = "duplicate_claim"
    
    def __init__(self):
        self.min_photos_required = 2
        self.max_claim_amount = 10000.0
    
    def check_all(self, packages: Dict[str, Package]) -> List[Issue]:
        """执行所有规则检查"""
        issues = []
        
        for tracking_no, pkg in packages.items():
            issues.extend(self._check_package(pkg))
        
        issues.extend(self._check_duplicate_tracking(packages))
        issues.extend(self._check_duplicate_claims(packages))
        
        return issues
    
    def _check_package(self, pkg: Package) -> List[Issue]:
        """检查单个包裹"""
        issues = []
        
        issues.extend(self._check_missing_photos(pkg))
        issues.extend(self._check_missing_timestamps(pkg))
        issues.extend(self._check_timestamp_order(pkg))
        issues.extend(self._check_remark_conflicts(pkg))
        issues.extend(self._check_amount_mismatch(pkg))
        issues.extend(self._check_claim_amount_anomaly(pkg))
        
        return issues
    
    def _check_missing_photos(self, pkg: Package) -> List[Issue]:
        """检查缺少照片"""
        issues = []
        
        if len(pkg.photos) < self.min_photos_required:
            issues.append(Issue(
                tracking_no=pkg.tracking_no,
                issue_type=self.ISSUE_MISSING_PHOTO,
                severity=self.SEVERITY_CRITICAL,
                description=f"照片数量不足: 只有 {len(pkg.photos)} 张, 最少需要 {self.min_photos_required} 张",
                details={
                    "actual_count": len(pkg.photos),
                    "required_count": self.min_photos_required,
                }
            ))
        
        return issues
    
    def _check_missing_timestamps(self, pkg: Package) -> List[Issue]:
        """检查照片缺少时间戳"""
        issues = []
        
        for photo in pkg.photos:
            if not photo.timestamp and not photo.exif_datetime and not photo.file_modified:
                issues.append(Issue(
                    tracking_no=pkg.tracking_no,
                    issue_type=self.ISSUE_MISSING_TIMESTAMP,
                    severity=self.SEVERITY_HIGH,
                    description=f"照片缺少时间戳: {photo.file_name}",
                    details={
                        "file_name": photo.file_name,
                        "file_path": photo.file_path,
                    }
                ))
        
        return issues
    
    def _check_timestamp_order(self, pkg: Package) -> List[Issue]:
        """检查时间戳倒序"""
        issues = []
        
        if len(pkg.photos) < 2:
            return issues
        
        photos_with_ts = [(p, p.timestamp or p.exif_datetime or p.file_modified) 
                          for p in pkg.photos]
        photos_with_ts = [(p, ts) for p, ts in photos_with_ts if ts]
        
        if len(photos_with_ts) < 2:
            return issues
        
        photos_sorted = sorted(photos_with_ts, key=lambda x: x[1])
        
        for i in range(len(photos_with_ts) - 1):
            current_p, current_ts = photos_with_ts[i]
            next_p, next_ts = photos_with_ts[i + 1]
            
            if current_ts and next_ts and current_ts > next_ts:
                issues.append(Issue(
                    tracking_no=pkg.tracking_no,
                    issue_type=self.ISSUE_TIMESTAMP_OUT_OF_ORDER,
                    severity=self.SEVERITY_MEDIUM,
                    description=f"照片时间戳倒序: {current_p.file_name} ({current_ts}) 在 {next_p.file_name} ({next_ts}) 之后",
                    details={
                        "earlier_file": current_p.file_name,
                        "earlier_timestamp": current_ts.isoformat() if current_ts else None,
                        "later_file": next_p.file_name,
                        "later_timestamp": next_ts.isoformat() if next_ts else None,
                    }
                ))
        
        return issues
    
    def _check_remark_conflicts(self, pkg: Package) -> List[Issue]:
        """检查备注冲突"""
        issues = []
        
        if len(pkg.remarks) < 2:
            return issues
        
        tracking_nos = set()
        amounts = set()
        issue_types = set()
        
        for remark in pkg.remarks:
            tracking_nos.add(remark.tracking_no.upper())
            if remark.claim_amount > 0:
                amounts.add(remark.claim_amount)
            if remark.issue_type:
                issue_types.add(remark.issue_type)
        
        if len(amounts) > 1:
            issues.append(Issue(
                tracking_no=pkg.tracking_no,
                issue_type=self.ISSUE_CONFLICT_REMARK,
                severity=self.SEVERITY_HIGH,
                description=f"赔付金额冲突: 多个备注中金额不一致 {sorted(amounts)}",
                details={
                    "amounts": list(amounts),
                    "remark_count": len(pkg.remarks),
                }
            ))
        
        if len(issue_types) > 1:
            issues.append(Issue(
                tracking_no=pkg.tracking_no,
                issue_type=self.ISSUE_CONFLICT_REMARK,
                severity=self.SEVERITY_MEDIUM,
                description=f"问题类型不一致: {sorted(issue_types)}",
                details={
                    "issue_types": list(issue_types),
                }
            ))
        
        return issues
    
    def _check_amount_mismatch(self, pkg: Package) -> List[Issue]:
        """检查备注与赔付表金额不一致"""
        issues = []
        
        if not pkg.claim_form:
            return issues
        
        claim_amount = pkg.claim_form.claim_amount
        
        for remark in pkg.remarks:
            if remark.claim_amount > 0 and abs(remark.claim_amount - claim_amount) > 0.01:
                issues.append(Issue(
                    tracking_no=pkg.tracking_no,
                    issue_type=self.ISSUE_AMOUNT_MISMATCH,
                    severity=self.SEVERITY_HIGH,
                    description=f"金额不一致: 备注金额 {remark.claim_amount} 元 vs 赔付表金额 {claim_amount} 元",
                    details={
                        "remark_amount": remark.claim_amount,
                        "claim_amount": claim_amount,
                        "source_file_remark": remark.source_file,
                        "source_file_claim": pkg.claim_form.source_file,
                    }
                ))
        
        return issues
    
    def _check_claim_amount_anomaly(self, pkg: Package) -> List[Issue]:
        """检查赔付金额异常"""
        issues = []
        
        amounts = []
        
        if pkg.claim_form and pkg.claim_form.claim_amount > 0:
            amounts.append(pkg.claim_form.claim_amount)
        
        for remark in pkg.remarks:
            if remark.claim_amount > 0:
                amounts.append(remark.claim_amount)
        
        for amount in amounts:
            if amount > self.max_claim_amount:
                issues.append(Issue(
                    tracking_no=pkg.tracking_no,
                    issue_type="amount_anomaly",
                    severity=self.SEVERITY_CRITICAL,
                    description=f"赔付金额异常: {amount} 元 超过阈值 {self.max_claim_amount} 元",
                    details={
                        "amount": amount,
                        "threshold": self.max_claim_amount,
                    }
                ))
            elif amount <= 0:
                issues.append(Issue(
                    tracking_no=pkg.tracking_no,
                    issue_type="amount_anomaly",
                    severity=self.SEVERITY_HIGH,
                    description=f"赔付金额异常: 金额为 0 或负数",
                    details={
                        "amount": amount,
                    }
                ))
        
        return issues
    
    def _check_duplicate_tracking(self, packages: Dict[str, Package]) -> List[Issue]:
        """检查重复运单号（不同来源）"""
        issues = []
        
        tracking_counts = defaultdict(int)
        for tracking_no in packages.keys():
            normalized = tracking_no.upper().strip()
            tracking_counts[normalized] += 1
        
        for tracking_no, count in tracking_counts.items():
            if count > 1:
                issues.append(Issue(
                    tracking_no=tracking_no,
                    issue_type=self.ISSUE_DUPLICATE_TRACKING,
                    severity=self.SEVERITY_CRITICAL,
                    description=f"重复运单号: 出现 {count} 次",
                    details={
                        "count": count,
                    }
                ))
        
        return issues
    
    def _check_duplicate_claims(self, packages: Dict[str, Package]) -> List[Issue]:
        """检查重复赔付申请"""
        issues = []
        
        claim_tracking = set()
        
        for tracking_no, pkg in packages.items():
            if pkg.claim_form:
                normalized = tracking_no.upper().strip()
                if normalized in claim_tracking:
                    issues.append(Issue(
                        tracking_no=tracking_no,
                        issue_type=self.ISSUE_DUPLICATE_CLAIM,
                        severity=self.SEVERITY_CRITICAL,
                        description=f"重复赔付申请: 该运单号已有赔付记录",
                        details={
                            "tracking_no": tracking_no,
                        }
                    ))
                claim_tracking.add(normalized)
        
        return issues
