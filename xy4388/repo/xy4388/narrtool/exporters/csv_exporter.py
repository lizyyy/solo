"""CSV 问题清单导出器"""

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from narrtool.database.models import (
    CheckResult,
    CheckStatus,
    CheckType,
    Severity,
    Screening,
)


class CSVExporter:
    """CSV 问题清单导出器"""
    
    def __init__(self, session):
        self.session = session
    
    def export(
        self,
        screening_id: int,
        output_path: str | Path,
        include_dismissed: bool = False,
    ) -> Path:
        """导出问题清单 CSV"""
        screening = self.session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        query = self.session.query(CheckResult).filter(
            CheckResult.screening_id == screening_id
        )
        
        if not include_dismissed:
            query = query.filter(CheckResult.status != CheckStatus.DISMISSED)
        
        results = query.order_by(
            CheckResult.severity,
            CheckResult.created_at
        ).all()
        
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "ID",
                "电影名称",
                "问题类型",
                "严重程度",
                "状态",
                "问题描述",
                "开始时间(秒)",
                "结束时间(秒)",
                "备注",
                "创建时间",
                "更新时间",
            ])
            
            for result in results:
                writer.writerow([
                    result.id,
                    screening.movie_name,
                    self._format_check_type(result.check_type),
                    self._format_severity(result.severity),
                    self._format_status(result.status),
                    result.description,
                    result.time_start if result.time_start is not None else "",
                    result.time_end if result.time_end is not None else "",
                    result.notes if result.notes else "",
                    result.created_at.strftime("%Y-%m-%d %H:%M:%S") if result.created_at else "",
                    result.updated_at.strftime("%Y-%m-%d %H:%M:%S") if result.updated_at else "",
                ])
        
        return output_path
    
    def export_all(
        self,
        output_path: str | Path,
        include_dismissed: bool = False,
    ) -> Path:
        """导出所有场次的问题清单"""
        query = self.session.query(CheckResult)
        
        if not include_dismissed:
            query = query.filter(CheckResult.status != CheckStatus.DISMISSED)
        
        results = query.order_by(
            CheckResult.screening_id,
            CheckResult.severity,
            CheckResult.created_at
        ).all()
        
        screenings = {
            s.id: s for s in self.session.query(Screening).all()
        }
        
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "ID",
                "场次ID",
                "电影名称",
                "问题类型",
                "严重程度",
                "状态",
                "问题描述",
                "开始时间(秒)",
                "结束时间(秒)",
                "备注",
                "创建时间",
                "更新时间",
            ])
            
            for result in results:
                screening = screenings.get(result.screening_id)
                movie_name = screening.movie_name if screening else ""
                
                writer.writerow([
                    result.id,
                    result.screening_id,
                    movie_name,
                    self._format_check_type(result.check_type),
                    self._format_severity(result.severity),
                    self._format_status(result.status),
                    result.description,
                    result.time_start if result.time_start is not None else "",
                    result.time_end if result.time_end is not None else "",
                    result.notes if result.notes else "",
                    result.created_at.strftime("%Y-%m-%d %H:%M:%S") if result.created_at else "",
                    result.updated_at.strftime("%Y-%m-%d %H:%M:%S") if result.updated_at else "",
                ])
        
        return output_path
    
    def _format_check_type(self, check_type: CheckType) -> str:
        """格式化检查类型"""
        type_names = {
            CheckType.DIALOGUE_OVERLAP: "口述压住对白",
            CheckType.MISSING_SCENE: "关键场景问题",
            CheckType.VOLUNTEER_CONFLICT: "志愿者冲突",
        }
        return type_names.get(check_type, check_type.value)
    
    def _format_severity(self, severity: Severity) -> str:
        """格式化严重程度"""
        severity_names = {
            Severity.HIGH: "高",
            Severity.MEDIUM: "中",
            Severity.LOW: "低",
        }
        return severity_names.get(severity, severity.value)
    
    def _format_status(self, status: CheckStatus) -> str:
        """格式化状态"""
        status_names = {
            CheckStatus.PENDING: "待复核",
            CheckStatus.CONFIRMED: "已确认",
            CheckStatus.DISMISSED: "已驳回",
        }
        return status_names.get(status, status.value)
