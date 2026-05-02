from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
from dataclasses import dataclass, field
from uuid import uuid4

from models import (
    PackageEvidence,
    ValidationIssue,
    IssueSeverity,
    IssueType,
    ReviewStatus,
    WorkSession,
    ServiceNote,
    ClaimApplication,
    FileEntry,
)


@dataclass
class ValidationResult:
    total_issues: int = 0
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)
    packages_with_issues: Dict[str, List[ValidationIssue]] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)


class BaseValidator:
    def validate(self, **kwargs) -> List[ValidationIssue]:
        raise NotImplementedError("Subclasses must implement validate method")
    
    def _create_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        waybill_number: str = "",
        affected_files: List[str] = None,
        affected_notes: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> ValidationIssue:
        return ValidationIssue(
            issue_id=f"issue_{uuid4().hex[:12]}",
            issue_type=issue_type,
            severity=severity,
            message=message,
            waybill_number=waybill_number,
            affected_files=affected_files or [],
            affected_notes=affected_notes or [],
            review_status=ReviewStatus.PENDING,
            metadata=metadata or {}
        )


class DuplicateWaybillValidator(BaseValidator):
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        waybill_to_sources: Dict[str, List[str]] = defaultdict(list)
        waybill_to_files: Dict[str, List[str]] = defaultdict(list)
        
        for waybill_number, package in packages.items():
            for photo in package.all_photos:
                if photo.file_path:
                    waybill_to_files[waybill_number].append(photo.filename)
            
            for note in package.service_notes:
                waybill_to_sources[waybill_number].append(note.source_file or "unknown")
            
            for claim in package.claim_applications:
                waybill_to_sources[waybill_number].append(claim.source_file or "unknown")
        
        for waybill_number, package in packages.items():
            total_photos = len(package.all_photos)
            total_notes = len(package.service_notes)
            total_claims = len(package.claim_applications)
            
            if total_claims > 1:
                unique_reasons = set(c.claim_reason for c in package.claim_applications if c.claim_reason)
                unique_amounts = set(c.claim_amount for c in package.claim_applications)
                
                if len(unique_amounts) > 1:
                    amounts_str = ", ".join(f"¥{a}" for a in sorted(unique_amounts))
                    issue = self._create_issue(
                        issue_type=IssueType.DUPLICATE_WAYBILL,
                        severity=IssueSeverity.CRITICAL,
                        message=f"运单 [{waybill_number}] 存在 {total_claims} 条赔付申请且金额不一致: {amounts_str}",
                        waybill_number=waybill_number,
                        metadata={
                            "claim_count": total_claims,
                            "unique_amounts": [str(a) for a in unique_amounts],
                            "unique_reasons": list(unique_reasons)
                        }
                    )
                    issues.append(issue)
                else:
                    issue = self._create_issue(
                        issue_type=IssueType.DUPLICATE_WAYBILL,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 存在 {total_claims} 条重复的赔付申请记录",
                        waybill_number=waybill_number,
                        metadata={
                            "claim_count": total_claims,
                        }
                    )
                    issues.append(issue)
            
            if total_notes > 1:
                unique_contents = set(n.content for n in package.service_notes if n.content)
                if len(unique_contents) == 1:
                    pass
                else:
                    issue = self._create_issue(
                        issue_type=IssueType.DUPLICATE_WAYBILL,
                        severity=IssueSeverity.INFO,
                        message=f"运单 [{waybill_number}] 有 {total_notes} 条不同的客服备注记录",
                        waybill_number=waybill_number,
                        metadata={
                            "note_count": total_notes,
                        }
                    )
                    issues.append(issue)
        
        return issues


class PhotoMissingValidator(BaseValidator):
    MIN_REQUIRED_PHOTOS = 2
    
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        for waybill_number, package in packages.items():
            total_photos = len(package.all_photos)
            
            has_claim = len(package.claim_applications) > 0
            
            if has_claim:
                min_photos = max(self.MIN_REQUIRED_PHOTOS, 2)
                
                has_waybill_photo = len(package.waybill_photos) > 0
                has_damage_photo = len(package.damage_photos) > 0
                
                missing_categories = []
                if not has_waybill_photo:
                    missing_categories.append("面单照片")
                if not has_damage_photo and len(package.package_photos) == 0:
                    missing_categories.append("包裹/破损照片")
                
                if missing_categories:
                    issue = self._create_issue(
                        issue_type=IssueType.PHOTO_MISSING,
                        severity=IssueSeverity.CRITICAL,
                        message=f"运单 [{waybill_number}] 存在赔付申请但缺少证据照片: {', '.join(missing_categories)}",
                        waybill_number=waybill_number,
                        metadata={
                            "total_photos": total_photos,
                            "waybill_photos": len(package.waybill_photos),
                            "damage_photos": len(package.damage_photos),
                            "package_photos": len(package.package_photos),
                            "has_claim": has_claim
                        }
                    )
                    issues.append(issue)
                
                elif total_photos < min_photos:
                    issue = self._create_issue(
                        issue_type=IssueType.PHOTO_MISSING,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 照片数量不足 ({total_photos}张，建议至少{min_photos}张用于申诉)",
                        waybill_number=waybill_number,
                        metadata={
                            "total_photos": total_photos,
                            "min_required": min_photos
                        }
                    )
                    issues.append(issue)
            
            else:
                if total_photos == 0:
                    issue = self._create_issue(
                        issue_type=IssueType.PHOTO_MISSING,
                        severity=IssueSeverity.INFO,
                        message=f"运单 [{waybill_number}] 没有任何照片记录",
                        waybill_number=waybill_number,
                        metadata={
                            "total_photos": 0,
                            "has_claim": False
                        }
                    )
                    issues.append(issue)
        
        return issues


class TimestampMissingValidator(BaseValidator):
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        for waybill_number, package in packages.items():
            photos_without_timestamp = []
            photos_with_timestamp = []
            
            for photo in package.all_photos:
                ts = photo.best_timestamp
                if ts:
                    photos_with_timestamp.append(photo)
                else:
                    photos_without_timestamp.append(photo)
            
            total_photos = len(package.all_photos)
            
            if total_photos > 0:
                missing_count = len(photos_without_timestamp)
                
                if missing_count == total_photos:
                    issue = self._create_issue(
                        issue_type=IssueType.TIMESTAMP_MISSING,
                        severity=IssueSeverity.CRITICAL,
                        message=f"运单 [{waybill_number}] 所有 {total_photos} 张照片都缺少时间戳（EXIF或文件时间）",
                        waybill_number=waybill_number,
                        affected_files=[p.filename for p in photos_without_timestamp],
                        metadata={
                            "total_photos": total_photos,
                            "missing_count": missing_count,
                            "missing_files": [p.filename for p in photos_without_timestamp]
                        }
                    )
                    issues.append(issue)
                
                elif missing_count > 0:
                    issue = self._create_issue(
                        issue_type=IssueType.TIMESTAMP_MISSING,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 有 {missing_count}/{total_photos} 张照片缺少时间戳",
                        waybill_number=waybill_number,
                        affected_files=[p.filename for p in photos_without_timestamp],
                        metadata={
                            "total_photos": total_photos,
                            "missing_count": missing_count,
                            "with_timestamp_count": len(photos_with_timestamp)
                        }
                    )
                    issues.append(issue)
        
        return issues


class TimeOutOfOrderValidator(BaseValidator):
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        for waybill_number, package in packages.items():
            photos_with_timestamp = [p for p in package.all_photos if p.best_timestamp]
            
            if len(photos_with_timestamp) < 2:
                continue
            
            sorted_photos = sorted(photos_with_timestamp, key=lambda p: p.best_timestamp)
            
            if len(package.claim_applications) > 0:
                latest_photo = sorted_photos[-1]
                earliest_photo = sorted_photos[0]
                
                claim_times = [c.apply_time for c in package.claim_applications if c.apply_time]
                
                for claim_time in claim_times:
                    photos_before_claim = [p for p in sorted_photos if p.best_timestamp and p.best_timestamp <= claim_time]
                    
                    if not photos_before_claim:
                        issue = self._create_issue(
                            issue_type=IssueType.TIME_OUT_OF_ORDER,
                            severity=IssueSeverity.WARNING,
                            message=f"运单 [{waybill_number}] 赔付申请时间 ({claim_time}) 早于所有照片拍摄时间",
                            waybill_number=waybill_number,
                            metadata={
                                "claim_time": claim_time.isoformat() if claim_time else None,
                                "earliest_photo_time": earliest_photo.best_timestamp.isoformat() if earliest_photo.best_timestamp else None,
                                "latest_photo_time": latest_photo.best_timestamp.isoformat() if latest_photo.best_timestamp else None
                            }
                        )
                        issues.append(issue)
            
            out_of_order_count = 0
            out_of_order_pairs = []
            
            for i in range(1, len(sorted_photos)):
                prev_photo = sorted_photos[i-1]
                curr_photo = sorted_photos[i]
                
                prev_ts = prev_photo.best_timestamp
                curr_ts = curr_photo.best_timestamp
                
                if prev_ts and curr_ts:
                    time_diff = curr_ts - prev_ts
                    
                    if time_diff.total_seconds() < 0:
                        out_of_order_count += 1
                        out_of_order_pairs.append({
                            "earlier_photo": prev_photo.filename,
                            "earlier_time": prev_ts.isoformat(),
                            "later_photo": curr_photo.filename,
                            "later_time": curr_ts.isoformat()
                        })
            
            if out_of_order_count > 0:
                issue = self._create_issue(
                    issue_type=IssueType.TIME_OUT_OF_ORDER,
                    severity=IssueSeverity.CRITICAL,
                    message=f"运单 [{waybill_number}] 存在 {out_of_order_count} 处照片时间倒序，可能存在伪造风险",
                    waybill_number=waybill_number,
                    affected_files=[p.filename for p in photos_with_timestamp],
                    metadata={
                        "total_photos_with_timestamp": len(photos_with_timestamp),
                        "out_of_order_count": out_of_order_count,
                        "out_of_order_pairs": out_of_order_pairs
                    }
                )
                issues.append(issue)
        
        return issues


class NoteConflictValidator(BaseValidator):
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        CONFLICT_KEYWORDS = [
            ("破损", "完好"),
            ("损坏", "正常"),
            ("湿", "干"),
            ("泡水", "干燥"),
            ("丢失", "送达"),
            ("少件", "完整"),
            ("拒签", "签收"),
            ("退回", "妥投"),
            ("延误", "准时"),
            ("超时", "正常"),
        ]
        
        for waybill_number, package in packages.items():
            notes = package.service_notes
            
            if len(notes) < 2:
                continue
            
            note_contents = [n.content for n in notes if n.content]
            if len(note_contents) < 2:
                continue
            
            found_conflicts = []
            
            for i, content1 in enumerate(note_contents):
                content1_lower = content1.lower()
                
                for j, content2 in enumerate(note_contents[i+1:], start=i+1):
                    content2_lower = content2.lower()
                    
                    for pos_word, neg_word in CONFLICT_KEYWORDS:
                        pos_in_1 = pos_word in content1_lower
                        pos_in_2 = pos_word in content2_lower
                        neg_in_1 = neg_word in content1_lower
                        neg_in_2 = neg_word in content2_lower
                        
                        if (pos_in_1 and neg_in_2) or (neg_in_1 and pos_in_2):
                            conflict_type = f"{pos_word}/{neg_word}"
                            
                            note1_time = notes[i].timestamp
                            note2_time = notes[j].timestamp
                            
                            found_conflicts.append({
                                "conflict_type": conflict_type,
                                "note1_index": i,
                                "note1_content": content1,
                                "note1_time": note1_time.isoformat() if note1_time else None,
                                "note2_index": j,
                                "note2_content": content2,
                                "note2_time": note2_time.isoformat() if note2_time else None,
                            })
            
            if found_conflicts:
                conflict_types = set(c["conflict_type"] for c in found_conflicts)
                issue = self._create_issue(
                    issue_type=IssueType.NOTE_CONFLICT,
                    severity=IssueSeverity.CRITICAL,
                    message=f"运单 [{waybill_number}] 客服备注存在冲突描述: {', '.join(conflict_types)}",
                    waybill_number=waybill_number,
                    affected_notes=[n.content for n in notes],
                    metadata={
                        "note_count": len(notes),
                        "conflict_count": len(found_conflicts),
                        "conflicts": found_conflicts
                    }
                )
                issues.append(issue)
            
            time_sorted_notes = sorted(
                [n for n in notes if n.timestamp],
                key=lambda n: n.timestamp
            )
            
            if len(time_sorted_notes) >= 2:
                pass
        
        return issues


class ClaimAmountAbnormalValidator(BaseValidator):
    MIN_AMOUNT_THRESHOLD = Decimal("1.00")
    MAX_AMOUNT_THRESHOLD = Decimal("10000.00")
    HIGH_AMOUNT_THRESHOLD = Decimal("2000.00")
    
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        all_claim_amounts = []
        for waybill_number, package in packages.items():
            for claim in package.claim_applications:
                if claim.claim_amount > Decimal("0"):
                    all_claim_amounts.append((waybill_number, claim))
        
        if all_claim_amounts:
            amounts = [c.claim_amount for _, c in all_claim_amounts]
            avg_amount = sum(amounts, Decimal("0")) / len(amounts) if amounts else Decimal("0")
            max_amount = max(amounts) if amounts else Decimal("0")
            min_amount = min(amounts) if amounts else Decimal("0")
        
        for waybill_number, package in packages.items():
            for claim in package.claim_applications:
                amount = claim.claim_amount
                
                if amount == Decimal("0"):
                    issue = self._create_issue(
                        issue_type=IssueType.CLAIM_AMOUNT_ABNORMAL,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 赔付金额为0元，请确认",
                        waybill_number=waybill_number,
                        metadata={
                            "amount": str(amount),
                            "claim_reason": claim.claim_reason
                        }
                    )
                    issues.append(issue)
                
                elif amount < self.MIN_AMOUNT_THRESHOLD:
                    issue = self._create_issue(
                        issue_type=IssueType.CLAIM_AMOUNT_ABNORMAL,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 赔付金额 ¥{amount} 过低，低于阈值 ¥{self.MIN_AMOUNT_THRESHOLD}",
                        waybill_number=waybill_number,
                        metadata={
                            "amount": str(amount),
                            "min_threshold": str(self.MIN_AMOUNT_THRESHOLD)
                        }
                    )
                    issues.append(issue)
                
                elif amount > self.MAX_AMOUNT_THRESHOLD:
                    issue = self._create_issue(
                        issue_type=IssueType.CLAIM_AMOUNT_ABNORMAL,
                        severity=IssueSeverity.CRITICAL,
                        message=f"运单 [{waybill_number}] 赔付金额 ¥{amount} 过高，超过阈值 ¥{self.MAX_AMOUNT_THRESHOLD}，请重点审核",
                        waybill_number=waybill_number,
                        metadata={
                            "amount": str(amount),
                            "max_threshold": str(self.MAX_AMOUNT_THRESHOLD)
                        }
                    )
                    issues.append(issue)
                
                elif amount > self.HIGH_AMOUNT_THRESHOLD:
                    issue = self._create_issue(
                        issue_type=IssueType.CLAIM_AMOUNT_ABNORMAL,
                        severity=IssueSeverity.WARNING,
                        message=f"运单 [{waybill_number}] 赔付金额 ¥{amount} 较高（超过 ¥{self.HIGH_AMOUNT_THRESHOLD}），建议核对证据材料",
                        waybill_number=waybill_number,
                        metadata={
                            "amount": str(amount),
                            "high_threshold": str(self.HIGH_AMOUNT_THRESHOLD)
                        }
                    )
                    issues.append(issue)
                
                if claim.approved_amount is not None:
                    if claim.approved_amount != amount:
                        diff = amount - claim.approved_amount
                        issue = self._create_issue(
                            issue_type=IssueType.CLAIM_AMOUNT_ABNORMAL,
                            severity=IssueSeverity.INFO,
                            message=f"运单 [{waybill_number}] 申请金额 ¥{amount} 与核定金额 ¥{claim.approved_amount} 不一致（差额 ¥{diff}）",
                            waybill_number=waybill_number,
                            metadata={
                                "requested_amount": str(amount),
                                "approved_amount": str(claim.approved_amount),
                                "difference": str(diff)
                            }
                        )
                        issues.append(issue)
        
        return issues


class ClaimDocumentMissingValidator(BaseValidator):
    def validate(self, packages: Dict[str, PackageEvidence]) -> List[ValidationIssue]:
        issues = []
        
        for waybill_number, package in packages.items():
            if len(package.claim_applications) == 0:
                continue
            
            has_waybill_photo = len(package.waybill_photos) > 0
            has_damage_photo = len(package.damage_photos) > 0
            has_package_photo = len(package.package_photos) > 0
            has_any_photo = len(package.all_photos) > 0
            has_service_notes = len(package.service_notes) > 0
            
            missing_items = []
            
            if not has_waybill_photo:
                missing_items.append("面单照片")
            
            if not has_damage_photo and not has_package_photo:
                missing_items.append("包裹/破损照片")
            
            if missing_items:
                issue = self._create_issue(
                    issue_type=IssueType.CLAIM_DOCUMENT_MISSING,
                    severity=IssueSeverity.CRITICAL,
                    message=f"运单 [{waybill_number}] 存在赔付申请但缺少关键证据材料: {', '.join(missing_items)}",
                    waybill_number=waybill_number,
                    metadata={
                        "has_claim": True,
                        "has_waybill_photo": has_waybill_photo,
                        "has_damage_photo": has_damage_photo,
                        "has_package_photo": has_package_photo,
                        "has_any_photo": has_any_photo,
                        "has_service_notes": has_service_notes,
                        "claim_count": len(package.claim_applications)
                    }
                )
                issues.append(issue)
            
            elif not has_service_notes:
                issue = self._create_issue(
                    issue_type=IssueType.CLAIM_DOCUMENT_MISSING,
                    severity=IssueSeverity.WARNING,
                    message=f"运单 [{waybill_number}] 存在赔付申请但缺少客服备注记录",
                    waybill_number=waybill_number,
                    metadata={
                        "has_service_notes": False
                    }
                )
                issues.append(issue)
        
        return issues


class ValidationEngine:
    def __init__(self):
        self.validators = {
            "duplicate_waybill": DuplicateWaybillValidator(),
            "photo_missing": PhotoMissingValidator(),
            "timestamp_missing": TimestampMissingValidator(),
            "time_out_of_order": TimeOutOfOrderValidator(),
            "note_conflict": NoteConflictValidator(),
            "claim_amount_abnormal": ClaimAmountAbnormalValidator(),
            "claim_document_missing": ClaimDocumentMissingValidator(),
        }
    
    def validate_all(
        self,
        packages: Dict[str, PackageEvidence]
    ) -> ValidationResult:
        result = ValidationResult()
        
        try:
            all_issues: List[ValidationIssue] = []
            
            all_issues.extend(
                self.validators["duplicate_waybill"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["photo_missing"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["timestamp_missing"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["time_out_of_order"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["note_conflict"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["claim_amount_abnormal"].validate(packages=packages)
            )
            
            all_issues.extend(
                self.validators["claim_document_missing"].validate(packages=packages)
            )
            
            result.issues = all_issues
            result.total_issues = len(all_issues)
            
            for issue in all_issues:
                if issue.severity == IssueSeverity.CRITICAL:
                    result.critical_count += 1
                elif issue.severity == IssueSeverity.WARNING:
                    result.warning_count += 1
                else:
                    result.info_count += 1
                
                if issue.waybill_number:
                    if issue.waybill_number not in result.packages_with_issues:
                        result.packages_with_issues[issue.waybill_number] = []
                    result.packages_with_issues[issue.waybill_number].append(issue)
        
        except Exception as e:
            result.errors.append(f"校验引擎执行错误: {str(e)}")
        
        return result
    
    def validate_single(
        self,
        validator_name: str,
        **kwargs
    ) -> List[ValidationIssue]:
        if validator_name not in self.validators:
            raise ValueError(f"未知的校验器: {validator_name}")
        
        return self.validators[validator_name].validate(**kwargs)
    
    def validate_session(self, session: WorkSession) -> ValidationResult:
        result = self.validate_all(packages=session.packages)
        
        for issue in result.issues:
            session.issues[issue.issue_id] = issue
        
        return result
