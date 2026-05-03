from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import json

from app.models import (
    ConstructionPlan, TrackSection, PowerWindow,
    WorkTrain, PersonnelQualification, PlanPersonnel,
    ConflictCheck, ConflictType, ApprovalStatus,
    TrackSection
)
from app.services.import_service import log_audit


def check_time_overlap(
    start1: datetime, end1: datetime,
    start2: datetime, end2: datetime
) -> bool:
    """检查两个时间区间是否有重叠"""
    return not (end1 <= start2 or end2 <= start1)


def calculate_overlap_time(
    start1: datetime, end1: datetime,
    start2: datetime, end2: datetime
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """计算重叠时间区间"""
    if not check_time_overlap(start1, end1, start2, end2):
        return None, None
    
    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)
    return overlap_start, overlap_end


def parse_track_sections(section_str: str) -> List[str]:
    """解析轨行区段字符串，支持多种分隔符"""
    if not section_str:
        return []
    
    import re
    sections = re.split(r'[,，、;；\s]+', section_str.strip())
    return [s.strip() for s in sections if s.strip()]


class TrackConflictChecker:
    """轨行区重复占用检测器"""
    
    @staticmethod
    def check_plan(
        db: Session,
        plan: ConstructionPlan,
        check_all: bool = False
    ) -> List[ConflictCheck]:
        """检查单个施工计划的轨行区冲突
        
        Args:
            db: 数据库会话
            plan: 待检查的施工计划
            check_all: 是否检查所有计划（包括已审签的），否则只检查非已撤销的
            
        Returns:
            冲突检查结果列表
        """
        conflicts = []
        
        plan_sections = parse_track_sections(plan.track_section)
        if not plan_sections:
            return conflicts
        
        query = db.query(ConstructionPlan).filter(
            ConstructionPlan.id != plan.id,
            ConstructionPlan.line == plan.line
        )
        
        if not check_all:
            query = query.filter(
                ConstructionPlan.status != ApprovalStatus.CANCELLED
            )
        
        other_plans = query.all()
        
        for other_plan in other_plans:
            other_sections = parse_track_sections(other_plan.track_section)
            
            common_sections = set(plan_sections) & set(other_sections)
            if not common_sections:
                continue
            
            if check_time_overlap(plan.start_time, plan.end_time, 
                                   other_plan.start_time, other_plan.end_time):
                
                overlap_start, overlap_end = calculate_overlap_time(
                    plan.start_time, plan.end_time,
                    other_plan.start_time, other_plan.end_time
                )
                
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.TRACK_CONFLICT,
                    related_plan_id=other_plan.id,
                    description=f"轨行区 [{', '.join(common_sections)}] 重复占用。"
                                f"本计划 [{plan.plan_no}: {plan.plan_name}] 时间: {plan.start_time} - {plan.end_time}"
                                f"与计划 [{other_plan.plan_no}: {other_plan.plan_name}] 时间: {other_plan.start_time} - {other_plan.end_time}"
                                f"重叠时间: {overlap_start} - {overlap_end}",
                    risk_level="高风险"
                )
                
                conflicts.append(conflict)
        
        return conflicts


class PowerConflictChecker:
    """停电窗口不匹配检测器"""
    
    @staticmethod
    def check_plan(
        db: Session,
        plan: ConstructionPlan
    ) -> List[ConflictCheck]:
        """检查施工计划的停电窗口匹配情况"""
        conflicts = []
        
        if not plan.power_requirement:
            return conflicts
        
        plan_sections = parse_track_sections(plan.track_section)
        
        power_sections = set()
        for section_name in plan_sections:
            track_section = db.query(TrackSection).filter(
                or_(
                    TrackSection.section_id == section_name,
                    TrackSection.section_name == section_name
                )
            ).first()
            
            if track_section and track_section.power_section:
                power_sections.add(track_section.power_section)
        
        power_requirement_sections = parse_track_sections(plan.power_requirement)
        power_sections.update(power_requirement_sections)
        
        if not power_sections:
            conflict = ConflictCheck(
                plan_id=plan.id,
                conflict_type=ConflictType.POWER_CONFLICT,
                description=f"计划 [{plan.plan_no}] 要求停电，但无法找到对应的供电区段。"
                           f"轨行区: {plan.track_section}, 停电要求: {plan.power_requirement}",
                risk_level="中风险"
            )
            conflicts.append(conflict)
            return conflicts
        
        for power_section in power_sections:
            power_windows = db.query(PowerWindow).filter(
                PowerWindow.power_section == power_section,
                PowerWindow.status != "取消"
            ).all()
            
            if not power_windows:
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.POWER_CONFLICT,
                    description=f"计划 [{plan.plan_no}] 需要供电区段 [{power_section}] 停电，"
                               f"但没有找到对应的停电窗口计划。",
                    risk_level="高风险"
                )
                conflicts.append(conflict)
                continue
            
            has_matching_window = False
            latest_window = None
            
            for window in power_windows:
                if check_time_overlap(plan.start_time, plan.end_time, 
                                       window.start_time, window.end_time):
                    overlap_start, overlap_end = calculate_overlap_time(
                        plan.start_time, plan.end_time,
                        window.start_time, window.end_time
                    )
                    
                    if (overlap_start == plan.start_time and 
                        overlap_end == plan.end_time):
                        has_matching_window = True
                        break
                    else:
                        latest_window = window
            
            if not has_matching_window:
                if latest_window:
                    conflict = ConflictCheck(
                        plan_id=plan.id,
                        conflict_type=ConflictType.POWER_CONFLICT,
                        related_power_id=latest_window.id,
                        description=f"计划 [{plan.plan_no}] 时间窗口 ({plan.start_time} - {plan.end_time}) "
                                   f"与供电区段 [{power_section}] 的停电窗口不完全匹配。"
                                   f"可用停电窗口: {latest_window.start_time} - {latest_window.end_time}",
                        risk_level="高风险"
                    )
                else:
                    conflict = ConflictCheck(
                        plan_id=plan.id,
                        conflict_type=ConflictType.POWER_CONFLICT,
                        description=f"计划 [{plan.plan_no}] 时间窗口 ({plan.start_time} - {plan.end_time}) "
                                   f"与供电区段 [{power_section}] 的所有停电窗口都没有重叠。",
                        risk_level="严重"
                    )
                conflicts.append(conflict)
        
        return conflicts


class TrainConflictChecker:
    """作业车相向冲突检测器"""
    
    @staticmethod
    def check_plan(
        db: Session,
        plan: ConstructionPlan
    ) -> List[ConflictCheck]:
        """检查施工计划关联的作业车冲突"""
        conflicts = []
        
        if not plan.work_train_required:
            return conflicts
        
        plan_trains = db.query(WorkTrain).filter(
            WorkTrain.plan_id == plan.id
        ).all()
        
        if not plan_trains:
            other_trains = db.query(WorkTrain).filter(
                WorkTrain.line == plan.line,
                check_time_overlap_condition(WorkTrain, plan)
            ).all()
            
            if other_trains:
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.TRAIN_CONFLICT,
                    description=f"计划 [{plan.plan_no}] 需要作业车，但未关联具体作业车信息。"
                               f"检测到同线路同时段有 {len(other_trains)} 台作业车运行，存在潜在冲突风险。",
                    risk_level="中风险"
                )
                conflicts.append(conflict)
            return conflicts
        
        for train in plan_trains:
            conflicts.extend(TrainConflictChecker._check_single_train(db, train, plan))
        
        return conflicts
    
    @staticmethod
    def _check_single_train(
        db: Session,
        train: WorkTrain,
        plan: ConstructionPlan
    ) -> List[ConflictCheck]:
        """检查单台作业车的冲突"""
        conflicts = []
        
        other_trains = db.query(WorkTrain).filter(
            WorkTrain.id != train.id,
            WorkTrain.line == train.line
        ).all()
        
        for other_train in other_trains:
            if not check_time_overlap(train.start_time, train.end_time,
                                       other_train.start_time, other_train.end_time):
                continue
            
            train_sections = parse_track_sections(f"{train.start_section},{train.end_section}")
            other_sections = parse_track_sections(f"{other_train.start_section},{other_train.end_section}")
            
            path_conflict = TrainConflictChecker._check_path_conflict(
                train, other_train, db
            )
            
            if path_conflict:
                overlap_start, overlap_end = calculate_overlap_time(
                    train.start_time, train.end_time,
                    other_train.start_time, other_train.end_time
                )
                
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.TRAIN_CONFLICT,
                    related_train_id=other_train.id,
                    description=f"作业车相向冲突检测："
                               f"本车 [{train.train_id}] ({train.direction}) 区段: {train.start_section} -> {train.end_section}, "
                               f"时间: {train.start_time} - {train.end_time}"
                               f"与他车 [{other_train.train_id}] ({other_train.direction}) 区段: {other_train.start_section} -> {other_train.end_section}, "
                               f"时间: {other_train.start_time} - {other_train.end_time}"
                               f"重叠时间: {overlap_start} - {overlap_end}。"
                               f"冲突类型: {path_conflict}",
                    risk_level="严重"
                )
                conflicts.append(conflict)
        
        return conflicts
    
    @staticmethod
    def _check_path_conflict(
        train1: WorkTrain,
        train2: WorkTrain,
        db: Session
    ) -> Optional[str]:
        """检查两台作业车是否存在路径冲突
        
        Returns:
            冲突类型描述，如果没有冲突返回 None
        """
        start1, end1 = train1.start_section, train1.end_section
        start2, end2 = train2.start_section, train2.end_section
        
        sections1 = {start1, end1}
        sections2 = {start2, end2}
        
        if sections1 & sections2:
            if train1.direction != train2.direction:
                return "相向行驶于同一区段"
            else:
                if start1 == start2 and end1 == end2:
                    return "同向跟随行驶（同一区段）"
                return "部分区段重叠（同向）"
        
        adjacency = TrainConflictChecker._get_adjacency_map(db, train1.line)
        path1 = TrainConflictChecker._get_path_sections(start1, end1, adjacency)
        path2 = TrainConflictChecker._get_path_sections(start2, end2, adjacency)
        
        common_path = path1 & path2
        if common_path:
            if train1.direction != train2.direction:
                return f"相向行驶，路径重叠于: {common_path}"
            else:
                return f"同向行驶，路径重叠于: {common_path}"
        
        return None
    
    @staticmethod
    def _get_adjacency_map(db: Session, line: str) -> Dict[str, List[str]]:
        """获取线路的邻接关系映射"""
        sections = db.query(TrackSection).filter(
            TrackSection.line == line
        ).all()
        
        adjacency = {}
        for section in sections:
            adjacency[section.section_id] = []
            adjacency[section.section_name] = []
            
            if section.adjacent_sections:
                try:
                    adjacent = json.loads(section.adjacent_sections)
                    adjacency[section.section_id].extend(adjacent)
                    adjacency[section.section_name].extend(adjacent)
                except:
                    pass
        
        return adjacency
    
    @staticmethod
    def _get_path_sections(
        start: str, end: str, 
        adjacency: Dict[str, List[str]]
    ) -> set:
        """获取从起点到终点的路径上的所有区段（简化BFS）"""
        if start == end:
            return {start}
        
        visited = set()
        queue = [(start, {start})]
        
        while queue:
            current, path = queue.pop(0)
            if current == end:
                return path
            
            if current in visited:
                continue
            visited.add(current)
            
            neighbors = adjacency.get(current, [])
            for neighbor in neighbors:
                if neighbor not in visited:
                    queue.append((neighbor, path | {neighbor}))
        
        return {start, end}


def check_time_overlap_condition(model, plan: ConstructionPlan):
    """创建时间重叠的查询条件"""
    return and_(
        model.start_time < plan.end_time,
        model.end_time > plan.start_time
    )


class QualificationConflictChecker:
    """人员资质过期检测器"""
    
    @staticmethod
    def check_plan(
        db: Session,
        plan: ConstructionPlan,
        check_date: datetime = None
    ) -> List[ConflictCheck]:
        """检查施工计划相关人员的资质有效性"""
        conflicts = []
        
        if check_date is None:
            check_date = datetime.now()
        
        plan_personnel = db.query(PlanPersonnel).filter(
            PlanPersonnel.plan_id == plan.id
        ).all()
        
        personnel_ids = [pp.personnel_id for pp in plan_personnel]
        
        if not personnel_ids:
            conflict = ConflictCheck(
                plan_id=plan.id,
                conflict_type=ConflictType.QUALIFICATION_CONFLICT,
                description=f"计划 [{plan.plan_no}] 未关联任何作业人员。"
                           f"建议确认作业负责人和关键岗位人员配置。",
                risk_level="低风险"
            )
            conflicts.append(conflict)
            return conflicts
        
        personnel_list = db.query(PersonnelQualification).filter(
            PersonnelQualification.id.in_(personnel_ids)
        ).all()
        
        personnel_map = {p.id: p for p in personnel_list}
        
        for pp in plan_personnel:
            personnel = personnel_map.get(pp.personnel_id)
            if not personnel:
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.QUALIFICATION_CONFLICT,
                    related_personnel_id=pp.personnel_id,
                    description=f"计划 [{plan.plan_no}] 中的人员 ID [{pp.personnel_id}] 不存在于资质库中。",
                    risk_level="高风险"
                )
                conflicts.append(conflict)
                continue
            
            if not personnel.is_active:
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.QUALIFICATION_CONFLICT,
                    related_personnel_id=personnel.id,
                    description=f"人员 [{personnel.name} (ID: {personnel.employee_id})] 资质状态为非激活。"
                               f"资质类型: {personnel.qualification_type}, 证书号: {personnel.certificate_no}",
                    risk_level="高风险"
                )
                conflicts.append(conflict)
                continue
            
            if personnel.expiry_date <= check_date:
                days_expired = (check_date - personnel.expiry_date).days
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.QUALIFICATION_CONFLICT,
                    related_personnel_id=personnel.id,
                    description=f"人员 [{personnel.name} (ID: {personnel.employee_id})] 资质已过期。"
                               f"资质类型: {personnel.qualification_type}, 证书号: {personnel.certificate_no}"
                               f"过期日期: {personnel.expiry_date.strftime('%Y-%m-%d')}, "
                               f"已过期 {days_expired} 天",
                    risk_level="严重"
                )
                conflicts.append(conflict)
                continue
            
            days_to_expiry = (personnel.expiry_date - check_date).days
            if days_to_expiry <= 30:
                conflict = ConflictCheck(
                    plan_id=plan.id,
                    conflict_type=ConflictType.QUALIFICATION_CONFLICT,
                    related_personnel_id=personnel.id,
                    description=f"人员 [{personnel.name} (ID: {personnel.employee_id})] 资质即将过期。"
                               f"资质类型: {personnel.qualification_type}, 证书号: {personnel.certificate_no}"
                               f"过期日期: {personnel.expiry_date.strftime('%Y-%m-%d')}, "
                               f"剩余 {days_to_expiry} 天",
                    risk_level="中风险"
                )
                conflicts.append(conflict)
        
        return conflicts


class TimeOverlapChecker:
    """时间窗口重叠检测器（通用检查）"""
    
    @staticmethod
    def check_plan(
        db: Session,
        plan: ConstructionPlan
    ) -> List[ConflictCheck]:
        """检查计划时间与其他计划的潜在时间冲突"""
        conflicts = []
        
        other_plans = db.query(ConstructionPlan).filter(
            ConstructionPlan.id != plan.id,
            ConstructionPlan.line == plan.line,
            ConstructionPlan.status != ApprovalStatus.CANCELLED,
            check_time_overlap_condition(ConstructionPlan, plan)
        ).all()
        
        for other_plan in other_plans:
            overlap_start, overlap_end = calculate_overlap_time(
                plan.start_time, plan.end_time,
                other_plan.start_time, other_plan.end_time
            )
            
            overlap_minutes = int((overlap_end - overlap_start).total_seconds() / 60)
            
            conflict = ConflictCheck(
                plan_id=plan.id,
                conflict_type=ConflictType.TIME_OVERLAP,
                related_plan_id=other_plan.id,
                description=f"时间窗口重叠提示："
                           f"本计划 [{plan.plan_no}: {plan.plan_name}] "
                           f"与计划 [{other_plan.plan_no}: {other_plan.plan_name}] "
                           f"在同一线路 [{plan.line}] 存在时间重叠。"
                           f"重叠时间: {overlap_start} - {overlap_end} ({overlap_minutes} 分钟)。"
                           f"注意：这是提示信息，请结合轨行区和停电窗口检查判断是否为实际冲突。",
                risk_level="低风险"
            )
            conflicts.append(conflict)
        
        return conflicts


class ConflictCheckService:
    """冲突检查服务主类"""
    
    @staticmethod
    def run_full_check(
        db: Session,
        plan: ConstructionPlan,
        operator: str = "system",
        auto_save: bool = True
    ) -> Dict[str, Any]:
        """对单个计划执行完整的冲突检查
        
        Args:
            db: 数据库会话
            plan: 施工计划对象
            operator: 操作人
            auto_save: 是否自动保存冲突结果到数据库
            
        Returns:
            检查结果汇总
        """
        all_conflicts = []
        
        checkers = [
            ("轨行区冲突", TrackConflictChecker, ConflictType.TRACK_CONFLICT),
            ("停电窗口冲突", PowerConflictChecker, ConflictType.POWER_CONFLICT),
            ("作业车冲突", TrainConflictChecker, ConflictType.TRAIN_CONFLICT),
            ("人员资质", QualificationConflictChecker, ConflictType.QUALIFICATION_CONFLICT),
            ("时间重叠", TimeOverlapChecker, ConflictType.TIME_OVERLAP),
        ]
        
        results = {}
        
        for check_name, checker_class, conflict_type in checkers:
            try:
                if checker_class == TrackConflictChecker:
                    conflicts = checker_class.check_plan(db, plan)
                elif checker_class == QualificationConflictChecker:
                    conflicts = checker_class.check_plan(db, plan, plan.start_time)
                else:
                    conflicts = checker_class.check_plan(db, plan)
                
                all_conflicts.extend(conflicts)
                results[check_name] = {
                    "count": len(conflicts),
                    "conflicts": [c.description for c in conflicts]
                }
            except Exception as e:
                results[check_name] = {
                    "count": 0,
                    "error": str(e)
                }
        
        if auto_save:
            db.query(ConflictCheck).filter(
                ConflictCheck.plan_id == plan.id,
                ConflictCheck.is_resolved == False
            ).delete(synchronize_session=False)
            
            for conflict in all_conflicts:
                db.add(conflict)
            
            db.commit()
        
        risk_summary = {
            "严重": len([c for c in all_conflicts if c.risk_level == "严重"]),
            "高风险": len([c for c in all_conflicts if c.risk_level == "高风险"]),
            "中风险": len([c for c in all_conflicts if c.risk_level == "中风险"]),
            "低风险": len([c for c in all_conflicts if c.risk_level == "低风险"]),
        }
        
        log_audit(
            db, "冲突检查", operator, "plan", plan.id,
            {
                "plan_no": plan.plan_no,
                "total_conflicts": len(all_conflicts),
                "risk_summary": risk_summary,
                "check_details": results
            }
        )
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "total_conflicts": len(all_conflicts),
            "risk_summary": risk_summary,
            "can_approve": (
                risk_summary["严重"] == 0 and 
                risk_summary["高风险"] == 0
            ),
            "details": results,
            "conflicts": [
                {
                    "type": c.conflict_type.value,
                    "risk_level": c.risk_level,
                    "description": c.description
                }
                for c in all_conflicts
            ]
        }
    
    @staticmethod
    def run_batch_check(
        db: Session,
        plan_ids: List[int] = None,
        operator: str = "system"
    ) -> List[Dict]:
        """批量执行冲突检查
        
        Args:
            db: 数据库会话
            plan_ids: 计划 ID 列表，为 None 时检查所有未撤销的计划
            operator: 操作人
            
        Returns:
            每个计划的检查结果列表
        """
        query = db.query(ConstructionPlan)
        
        if plan_ids:
            query = query.filter(ConstructionPlan.id.in_(plan_ids))
        else:
            query = query.filter(
                ConstructionPlan.status != ApprovalStatus.CANCELLED
            )
        
        plans = query.all()
        
        results = []
        for plan in plans:
            try:
                result = ConflictCheckService.run_full_check(
                    db, plan, operator, auto_save=True
                )
                results.append(result)
            except Exception as e:
                results.append({
                    "plan_id": plan.id,
                    "plan_no": plan.plan_no,
                    "error": str(e)
                })
        
        return results
    
    @staticmethod
    def get_conflicts_by_plan(
        db: Session,
        plan_id: int,
        include_resolved: bool = False
    ) -> List[ConflictCheck]:
        """获取指定计划的冲突记录"""
        query = db.query(ConflictCheck).filter(
            ConflictCheck.plan_id == plan_id
        )
        
        if not include_resolved:
            query = query.filter(ConflictCheck.is_resolved == False)
        
        return query.order_by(
            db.case(
                (ConflictCheck.risk_level == "严重", 1),
                (ConflictCheck.risk_level == "高风险", 2),
                (ConflictCheck.risk_level == "中风险", 3),
                (ConflictCheck.risk_level == "低风险", 4),
                else_=5
            ),
            ConflictCheck.check_time.desc()
        ).all()
    
    @staticmethod
    def resolve_conflict(
        db: Session,
        conflict_id: int,
        resolved_by: str,
        resolution_notes: str
    ) -> ConflictCheck:
        """标记冲突为已解决"""
        conflict = db.query(ConflictCheck).filter(
            ConflictCheck.id == conflict_id
        ).first()
        
        if not conflict:
            raise ValueError(f"冲突记录不存在: {conflict_id}")
        
        conflict.is_resolved = True
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.utcnow()
        conflict.resolution_notes = resolution_notes
        
        db.commit()
        db.refresh(conflict)
        
        log_audit(
            db, "冲突解决", resolved_by, "conflict", conflict.id,
            {
                "conflict_id": conflict.id,
                "plan_id": conflict.plan_id,
                "conflict_type": conflict.conflict_type.value,
                "resolution_notes": resolution_notes
            }
        )
        
        return conflict
