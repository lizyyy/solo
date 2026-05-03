from typing import Optional, List
from datetime import datetime
import uuid

from models.case import Case, CaseStatus
from models.risk import Risk, RiskStatus
from models.review import Review, ReviewRecord, ReviewAction


class ReviewManager:
    """
    复核管理器
    负责风险的确认、驳回和复核记录管理
    """
    
    def __init__(self):
        self._reviewers: List[str] = []
    
    def confirm_risk(self, 
                     case: Case, 
                     risk_id: str, 
                     reviewer: str = None, 
                     notes: str = None) -> bool:
        """
        确认风险
        
        Args:
            case: 病例对象
            risk_id: 风险ID
            reviewer: 复核人员
            notes: 复核备注
            
        Returns:
            是否操作成功
        """
        # 查找风险
        risk = case.get_risk_by_id(risk_id)
        
        if risk is None:
            return False
        
        # 确认风险
        risk.confirm(reviewer=reviewer, notes=notes)
        
        # 创建复核记录
        self._create_review_record(
            case=case,
            risk=risk,
            action=ReviewAction.CONFIRM,
            reviewer=reviewer,
            notes=notes
        )
        
        # 更新病例状态
        self._update_case_status(case)
        
        return True
    
    def dismiss_risk(self, 
                     case: Case, 
                     risk_id: str, 
                     reviewer: str = None, 
                     notes: str = None) -> bool:
        """
        驳回风险
        
        Args:
            case: 病例对象
            risk_id: 风险ID
            reviewer: 复核人员
            notes: 复核备注
            
        Returns:
            是否操作成功
        """
        # 查找风险
        risk = case.get_risk_by_id(risk_id)
        
        if risk is None:
            return False
        
        # 驳回风险
        risk.dismiss(reviewer=reviewer, notes=notes)
        
        # 创建复核记录
        self._create_review_record(
            case=case,
            risk=risk,
            action=ReviewAction.DISMISS,
            reviewer=reviewer,
            notes=notes
        )
        
        # 更新病例状态
        self._update_case_status(case)
        
        return True
    
    def add_review_note(self,
                        case: Case,
                        risk_id: str,
                        reviewer: str = None,
                        notes: str = None) -> bool:
        """
        添加复核备注（不改变风险状态）
        
        Args:
            case: 病例对象
            risk_id: 风险ID
            reviewer: 复核人员
            notes: 备注内容
            
        Returns:
            是否操作成功
        """
        # 查找风险
        risk = case.get_risk_by_id(risk_id)
        
        if risk is None:
            return False
        
        # 创建复核记录
        self._create_review_record(
            case=case,
            risk=risk,
            action=ReviewAction.ADD_NOTE,
            reviewer=reviewer,
            notes=notes
        )
        
        return True
    
    def batch_confirm_risks(self,
                            case: Case,
                            risk_ids: List[str],
                            reviewer: str = None,
                            notes: str = None) -> int:
        """
        批量确认风险
        
        Args:
            case: 病例对象
            risk_ids: 风险ID列表
            reviewer: 复核人员
            notes: 复核备注
            
        Returns:
            成功确认的数量
        """
        success_count = 0
        
        for risk_id in risk_ids:
            if self.confirm_risk(case, risk_id, reviewer, notes):
                success_count += 1
        
        return success_count
    
    def batch_dismiss_risks(self,
                            case: Case,
                            risk_ids: List[str],
                            reviewer: str = None,
                            notes: str = None) -> int:
        """
        批量驳回风险
        
        Args:
            case: 病例对象
            risk_ids: 风险ID列表
            reviewer: 复核人员
            notes: 复核备注
            
        Returns:
            成功驳回的数量
        """
        success_count = 0
        
        for risk_id in risk_ids:
            if self.dismiss_risk(case, risk_id, reviewer, notes):
                success_count += 1
        
        return success_count
    
    def get_review_history(self, case: Case, risk_id: str = None) -> List[ReviewRecord]:
        """
        获取复核历史
        
        Args:
            case: 病例对象
            risk_id: 风险ID（可选，如果不指定则返回所有复核记录）
            
        Returns:
            复核记录列表
        """
        if case.review is None:
            return []
        
        if risk_id:
            return case.review.get_records_for_risk(risk_id)
        
        return case.review.records
    
    def get_review_statistics(self, case: Case) -> dict:
        """
        获取复核统计信息
        
        Args:
            case: 病例对象
            
        Returns:
            统计信息字典
        """
        stats = {
            "total_risks": 0,
            "pending": 0,
            "confirmed": 0,
            "dismissed": 0,
            "review_records_count": 0,
            "last_review_time": None
        }
        
        if case.risks:
            stats["total_risks"] = len(case.risks)
            stats["pending"] = len(case.get_risks_by_status(RiskStatus.PENDING))
            stats["confirmed"] = len(case.get_risks_by_status(RiskStatus.CONFIRMED))
            stats["dismissed"] = len(case.get_risks_by_status(RiskStatus.DISMISSED))
        
        if case.review and case.review.records:
            stats["review_records_count"] = len(case.review.records)
            
            # 获取最后复核时间
            if case.review.records:
                last_record = case.review.records[-1]
                if last_record.timestamp:
                    stats["last_review_time"] = last_record.timestamp.isoformat()
        
        return stats
    
    def _create_review_record(self,
                              case: Case,
                              risk: Risk,
                              action: ReviewAction,
                              reviewer: str = None,
                              notes: str = None):
        """
        创建复核记录
        
        Args:
            case: 病例对象
            risk: 风险对象
            action: 操作类型
            reviewer: 复核人员
            notes: 备注
        """
        # 确保病例有Review对象
        if case.review is None:
            case.review = Review(case_id=case.case_id)
        
        # 创建记录ID
        record_id = f"REVIEW_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        # 获取之前的状态
        previous_status = None
        if risk.reviewed_at:
            previous_status = risk.status.value
        
        # 创建复核记录
        record = ReviewRecord(
            record_id=record_id,
            risk_id=risk.risk_id,
            case_id=case.case_id,
            action=action,
            reviewer=reviewer,
            notes=notes,
            previous_status=previous_status,
            new_status=risk.status.value
        )
        
        # 添加到病例
        case.review.add_record(record)
    
    def _update_case_status(self, case: Case):
        """
        更新病例状态
        
        Args:
            case: 病例对象
        """
        pending_count = len(case.get_risks_by_status(RiskStatus.PENDING))
        confirmed_count = len(case.get_risks_by_status(RiskStatus.CONFIRMED))
        dismissed_count = len(case.get_risks_by_status(RiskStatus.DISMISSED))
        
        # 判断状态
        if pending_count > 0:
            # 还有待复核的风险
            case.status = CaseStatus.UNDER_REVIEW
        elif confirmed_count > 0 or dismissed_count > 0:
            # 所有风险都已复核
            case.status = CaseStatus.REVIEW_COMPLETED
        else:
            # 没有风险
            case.status = CaseStatus.RISKS_DETECTED
        
        # 更新时间戳
        case.update_timestamp()
    
    def reset_risk(self, case: Case, risk_id: str, reviewer: str = None) -> bool:
        """
        重置风险状态为待复核（用于撤销操作）
        
        Args:
            case: 病例对象
            risk_id: 风险ID
            reviewer: 操作人
            
        Returns:
            是否操作成功
        """
        risk = case.get_risk_by_id(risk_id)
        
        if risk is None:
            return False
        
        # 记录之前的状态
        previous_status = risk.status.value
        
        # 重置状态
        risk.status = RiskStatus.PENDING
        risk.reviewed_at = None
        
        # 创建复核记录
        self._create_review_record(
            case=case,
            risk=risk,
            action=ReviewAction.EDIT_RISK,
            reviewer=reviewer,
            notes=f"重置风险状态: {previous_status} -> 待复核"
        )
        
        # 更新病例状态
        self._update_case_status(case)
        
        return True
