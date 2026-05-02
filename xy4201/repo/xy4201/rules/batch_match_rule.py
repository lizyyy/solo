"""
釉料批次匹配规则
检查釉料批次和作品编号是否匹配
"""

from typing import List, Dict, Optional, Set
from .base_rule import BaseRule
from ..models import (
    Risk, RiskType, RiskLevel, 
    GlazeBatch, WorkPiece, FiringRecord
)


class BatchMatchRule(BaseRule):
    """釉料批次匹配检查规则"""
    
    def __init__(self,
                 check_expired_batches: bool = True,
                 check_depleted_batches: bool = True):
        super().__init__(
            name="釉料批次匹配检查",
            description="检查作品使用的釉料批次是否存在、有效且匹配"
        )
        self.check_expired_batches = check_expired_batches
        self.check_depleted_batches = check_depleted_batches
        self.risk_counter = 0
    
    def check(self, firing_record: FiringRecord) -> List[Risk]:
        """
        检查釉料批次匹配
        
        Args:
            firing_record: 烧成记录
            
        Returns:
            风险列表
        """
        self.clear()
        risks: List[Risk] = []
        
        if not firing_record.work_pieces:
            self.add_warning("没有作品数据，无法检查釉料批次匹配")
            return risks
        
        batch_map = {batch.batch_id: batch for batch in firing_record.glaze_batches}
        
        used_batch_ids: Set[str] = set()
        
        for work in firing_record.work_pieces:
            if not work.glaze_batch_id:
                risk = self._create_no_batch_risk(work)
                risks.append(risk)
                continue
            
            used_batch_ids.add(work.glaze_batch_id)
            
            if work.glaze_batch_id not in batch_map:
                risk = self._create_missing_batch_risk(work)
                risks.append(risk)
            else:
                batch = batch_map[work.glaze_batch_id]
                
                if self.check_expired_batches and batch.status == "已过期":
                    risk = self._create_expired_batch_risk(work, batch)
                    risks.append(risk)
                
                if self.check_depleted_batches and batch.status == "已用完":
                    risk = self._create_depleted_batch_risk(work, batch)
                    risks.append(risk)
        
        for batch_id in batch_map:
            if batch_id not in used_batch_ids:
                risk = self._create_unused_batch_risk(batch_map[batch_id])
                risks.append(risk)
        
        risks.extend(self._check_duplicate_works(firing_record.work_pieces))
        
        return risks
    
    def _create_no_batch_risk(self, work: WorkPiece) -> Risk:
        """创建无釉料批次风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"BATCH-{self.risk_counter:04d}",
            risk_type=RiskType.BATCH_MISMATCH,
            level=RiskLevel.MEDIUM,
            title=f"作品缺少釉料批次 - {work.work_id}",
            description=f"作品 '{work.work_id}' 未关联任何釉料批次。\n"
                       f"作品信息:\n"
                       f"  - 编号: {work.work_id}\n"
                       f"  - 名称: {work.title or '未命名'}\n"
                       f"  - 艺术家: {work.artist or '未知'}\n"
                       f"  - 放置层: {work.shelf_layer or '未指定'}",
            related_data={
                "work_id": work.work_id,
                "work_title": work.title,
                "work_artist": work.artist,
                "shelf_layer": work.shelf_layer,
                "issue": "no_glaze_batch"
            }
        )
    
    def _create_missing_batch_risk(self, work: WorkPiece) -> Risk:
        """创建釉料批次不存在风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"BATCH-{self.risk_counter:04d}",
            risk_type=RiskType.BATCH_MISMATCH,
            level=RiskLevel.HIGH,
            title=f"釉料批次不存在 - {work.glaze_batch_id}",
            description=f"作品 '{work.work_id}' 关联的釉料批次 '{work.glaze_batch_id}' "
                       f"在釉料批次表中不存在。\n"
                       f"作品信息:\n"
                       f"  - 编号: {work.work_id}\n"
                       f"  - 名称: {work.title or '未命名'}\n"
                       f"关联批次: {work.glaze_batch_id}（不存在）",
            related_data={
                "work_id": work.work_id,
                "work_title": work.title,
                "glaze_batch_id": work.glaze_batch_id,
                "issue": "batch_not_found"
            }
        )
    
    def _create_expired_batch_risk(self, work: WorkPiece, batch: GlazeBatch) -> Risk:
        """创建使用过期釉料批次风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"BATCH-{self.risk_counter:04d}",
            risk_type=RiskType.BATCH_MISMATCH,
            level=RiskLevel.HIGH,
            title=f"使用过期釉料批次 - {batch.batch_id}",
            description=f"作品 '{work.work_id}' 使用了已过期的釉料批次。\n"
                       f"釉料批次信息:\n"
                       f"  - 批次编号: {batch.batch_id}\n"
                       f"  - 釉料名称: {batch.glaze_name}\n"
                       f"  - 状态: {batch.status}\n"
                       f"  - 过期日期: {batch.expiration_date.strftime('%Y-%m-%d') if batch.expiration_date else '未知'}\n"
                       f"作品: {work.work_id} - {work.title or '未命名'}",
            timestamp=batch.expiration_date,
            related_data={
                "work_id": work.work_id,
                "batch_id": batch.batch_id,
                "glaze_name": batch.glaze_name,
                "expiration_date": batch.expiration_date.isoformat() if batch.expiration_date else None,
                "issue": "expired_batch"
            }
        )
    
    def _create_depleted_batch_risk(self, work: WorkPiece, batch: GlazeBatch) -> Risk:
        """创建使用已用完釉料批次风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"BATCH-{self.risk_counter:04d}",
            risk_type=RiskType.BATCH_MISMATCH,
            level=RiskLevel.MEDIUM,
            title=f"使用已用完釉料批次 - {batch.batch_id}",
            description=f"作品 '{work.work_id}' 使用了状态为'已用完'的釉料批次。\n"
                       f"釉料批次信息:\n"
                       f"  - 批次编号: {batch.batch_id}\n"
                       f"  - 釉料名称: {batch.glaze_name}\n"
                       f"  - 状态: {batch.status}\n"
                       f"作品: {work.work_id} - {work.title or '未命名'}",
            related_data={
                "work_id": work.work_id,
                "batch_id": batch.batch_id,
                "glaze_name": batch.glaze_name,
                "issue": "depleted_batch"
            }
        )
    
    def _create_unused_batch_risk(self, batch: GlazeBatch) -> Risk:
        """创建未使用釉料批次风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"BATCH-{self.risk_counter:04d}",
            risk_type=RiskType.BATCH_MISMATCH,
            level=RiskLevel.LOW,
            title=f"釉料批次未被使用 - {batch.batch_id}",
            description=f"釉料批次 '{batch.batch_id}' 存在于批次表中，"
                       f"但未被任何作品使用。\n"
                       f"釉料批次信息:\n"
                       f"  - 批次编号: {batch.batch_id}\n"
                       f"  - 釉料名称: {batch.glaze_name}\n"
                       f"  - 数量: {batch.quantity or '未知'} {batch.unit}\n"
                       f"  - 状态: {batch.status}\n"
                       f"提示: 请确认是否遗漏了使用该批次的作品记录，或批次信息有误。",
            related_data={
                "batch_id": batch.batch_id,
                "glaze_name": batch.glaze_name,
                "quantity": batch.quantity,
                "unit": batch.unit,
                "status": batch.status,
                "issue": "unused_batch"
            }
        )
    
    def _check_duplicate_works(self, works: List[WorkPiece]) -> List[Risk]:
        """检查重复作品编号"""
        risks: List[Risk] = []
        work_id_counts: Dict[str, int] = {}
        
        for work in works:
            work_id_counts[work.work_id] = work_id_counts.get(work.work_id, 0) + 1
        
        for work_id, count in work_id_counts.items():
            if count > 1:
                self.risk_counter += 1
                risk = Risk(
                    risk_id=f"BATCH-{self.risk_counter:04d}",
                    risk_type=RiskType.BATCH_MISMATCH,
                    level=RiskLevel.HIGH,
                    title=f"重复作品编号 - {work_id}",
                    description=f"作品编号 '{work_id}' 出现了 {count} 次。\n"
                               f"作品编号应该是唯一的，请检查数据是否有误。",
                    related_data={
                        "work_id": work_id,
                        "duplicate_count": count,
                        "issue": "duplicate_work_id"
                    }
                )
                risks.append(risk)
        
        return risks
