"""检查服务"""

import json
from typing import Dict, List, Optional

from narrtool.checkers import (
    CheckResult as CheckResultData,
    DialogueOverlapChecker,
    MissingSceneChecker,
    VolunteerConflictChecker,
)
from narrtool.database.models import (
    CheckResult as CheckResultModel,
    CheckStatus,
    CheckType,
    Severity,
    Screening,
)


class CheckService:
    """检查服务"""
    
    def __init__(self, session):
        self.session = session
        
        self.checkers = [
            DialogueOverlapChecker(),
            MissingSceneChecker(),
            VolunteerConflictChecker(),
        ]
    
    def run_checks(self, screening_id: int, clear_existing: bool = True) -> List[CheckResultModel]:
        """
        运行所有检查
        clear_existing: 是否清除已有检查结果
        """
        if clear_existing:
            self.session.query(CheckResultModel).filter(
                CheckResultModel.screening_id == screening_id
            ).delete()
        
        all_results: List[CheckResultModel] = []
        
        for checker in self.checkers:
            checker_results = checker.check(screening_id, self.session)
            for result_data in checker_results:
                model = self._create_model(screening_id, result_data)
                self.session.add(model)
                all_results.append(model)
        
        self.session.flush()
        return all_results
    
    def _create_model(
        self,
        screening_id: int,
        result_data: CheckResultData
    ) -> CheckResultModel:
        """将检查结果数据转换为数据库模型"""
        return CheckResultModel(
            screening_id=screening_id,
            check_type=result_data.check_type,
            severity=result_data.severity,
            status=CheckStatus.PENDING,
            description=result_data.description,
            related_ids=json.dumps(result_data.related_ids) if result_data.related_ids else None,
            time_start=result_data.time_start,
            time_end=result_data.time_end,
            notes=None,
        )
    
    def get_results(
        self,
        screening_id: Optional[int] = None,
        check_type: Optional[CheckType] = None,
        status: Optional[CheckStatus] = None,
        severity: Optional[Severity] = None,
    ) -> List[CheckResultModel]:
        """获取检查结果"""
        query = self.session.query(CheckResultModel)
        
        if screening_id is not None:
            query = query.filter(CheckResultModel.screening_id == screening_id)
        
        if check_type is not None:
            query = query.filter(CheckResultModel.check_type == check_type)
        
        if status is not None:
            query = query.filter(CheckResultModel.status == status)
        
        if severity is not None:
            query = query.filter(CheckResultModel.severity == severity)
        
        return query.order_by(CheckResultModel.created_at).all()
    
    def get_result(self, result_id: int) -> Optional[CheckResultModel]:
        """获取单个检查结果"""
        return self.session.query(CheckResultModel).filter(
            CheckResultModel.id == result_id
        ).first()
    
    def update_status(
        self,
        result_id: int,
        status: CheckStatus,
        notes: Optional[str] = None,
    ) -> bool:
        """
        更新检查结果状态（改判）
        """
        result = self.get_result(result_id)
        if not result:
            return False
        
        result.status = status
        if notes is not None:
            result.notes = notes
        
        self.session.flush()
        return True
    
    def add_notes(self, result_id: int, notes: str) -> bool:
        """添加备注"""
        result = self.get_result(result_id)
        if not result:
            return False
        
        result.notes = notes
        self.session.flush()
        return True
    
    def get_statistics(self, screening_id: Optional[int] = None) -> Dict:
        """获取检查统计"""
        query = self.session.query(CheckResultModel)
        
        if screening_id is not None:
            query = query.filter(CheckResultModel.screening_id == screening_id)
        
        all_results = query.all()
        
        stats = {
            "total": len(all_results),
            "by_type": {},
            "by_status": {},
            "by_severity": {},
        }
        
        for result in all_results:
            check_type = result.check_type.value
            status = result.status.value
            severity = result.severity.value
            
            stats["by_type"][check_type] = stats["by_type"].get(check_type, 0) + 1
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            stats["by_severity"][severity] = stats["by_severity"].get(severity, 0) + 1
        
        return stats
