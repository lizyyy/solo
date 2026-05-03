"""
JSON导出器 - 导出机器可读的JSON格式结果
"""
import json
from datetime import datetime
from typing import List, Dict, Any

from ..core import CandidateSchedule, Conflict
from ..models import Ship, Berth, Tug, TidalRecord


class JsonExporter:
    """JSON结果导出器"""
    
    @staticmethod
    def export(
        schedules: List[CandidateSchedule],
        conflicts: List[Conflict],
        ships: List[Ship],
        berths: List[Berth],
        tugs: List[Tug],
        tidal_records: List[TidalRecord],
        output_path: str,
        metadata: Dict[str, Any] = None
    ):
        """
        导出结果为JSON格式
        
        Args:
            schedules: 候选计划列表
            conflicts: 冲突列表
            ships: 船舶列表
            berths: 泊位列表
            tugs: 拖轮列表
            tidal_records: 潮汐记录列表
            output_path: 输出文件路径
            metadata: 额外的元数据
        """
        # 构建结果数据结构
        result = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '0.1.0',
                **(metadata or {})
            },
            'ships': JsonExporter._ships_to_dict(ships),
            'berths': JsonExporter._berths_to_dict(berths),
            'tugs': JsonExporter._tugs_to_dict(tugs),
            'tidal_records': JsonExporter._tidal_records_to_dict(tidal_records),
            'schedules': JsonExporter._schedules_to_dict(schedules),
            'conflicts': JsonExporter._conflicts_to_dict(conflicts),
            'summary': JsonExporter._generate_summary(schedules, conflicts)
        }
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, default=str)
    
    @staticmethod
    def _ships_to_dict(ships: List[Ship]) -> List[Dict[str, Any]]:
        """将船舶列表转换为字典列表"""
        result = []
        for ship in ships:
            result.append({
                'name': ship.name,
                'imo': ship.imo,
                'draft': ship.draft,
                'cargo_weight': ship.cargo_weight,
                'length': ship.length,
                'width': ship.width,
                'required_berth_types': ship.required_berth_types,
                'required_tug_count': ship.required_tug_count,
                'operation_duration_minutes': int(ship.operation_duration.total_seconds() / 60)
            })
        return result
    
    @staticmethod
    def _berths_to_dict(berths: List[Berth]) -> List[Dict[str, Any]]:
        """将泊位列表转换为字典列表"""
        result = []
        for berth in berths:
            result.append({
                'id': berth.id,
                'name': berth.name,
                'type': berth.type,
                'max_draft': berth.max_draft,
                'max_length': berth.max_length,
                'max_width': berth.max_width,
                'available_time_slots': [
                    {
                        'start': slot.start.strftime('%H:%M'),
                        'end': slot.end.strftime('%H:%M')
                    }
                    for slot in berth.available_time_slots
                ],
                'restrictions': berth.restrictions
            })
        return result
    
    @staticmethod
    def _tugs_to_dict(tugs: List[Tug]) -> List[Dict[str, Any]]:
        """将拖轮列表转换为字典列表"""
        result = []
        for tug in tugs:
            result.append({
                'id': tug.id,
                'name': tug.name,
                'capacity': tug.capacity,
                'available_time_slots': [
                    {
                        'start': slot.start.strftime('%H:%M'),
                        'end': slot.end.strftime('%H:%M')
                    }
                    for slot in tug.available_time_slots
                ]
            })
        return result
    
    @staticmethod
    def _tidal_records_to_dict(tidal_records: List[TidalRecord]) -> List[Dict[str, Any]]:
        """将潮汐记录列表转换为字典列表"""
        result = []
        for record in tidal_records:
            result.append({
                'time': record.time.strftime('%Y-%m-%d %H:%M'),
                'height': record.height
            })
        return result
    
    @staticmethod
    def _schedules_to_dict(schedules: List[CandidateSchedule]) -> List[Dict[str, Any]]:
        """将候选计划列表转换为字典列表"""
        result = []
        for schedule in schedules:
            result.append(schedule.to_dict())
        return result
    
    @staticmethod
    def _conflicts_to_dict(conflicts: List[Conflict]) -> List[Dict[str, Any]]:
        """将冲突列表转换为字典列表"""
        result = []
        for conflict in conflicts:
            result.append(conflict.to_dict())
        return result
    
    @staticmethod
    def _generate_summary(
        schedules: List[CandidateSchedule],
        conflicts: List[Conflict]
    ) -> Dict[str, Any]:
        """生成摘要信息"""
        # 统计计划
        total_schedules = len(schedules)
        feasible_schedules = sum(1 for s in schedules if s.is_feasible)
        infeasible_schedules = total_schedules - feasible_schedules
        
        # 统计冲突
        total_conflicts = len(conflicts)
        critical_conflicts = sum(1 for c in conflicts if c.severity == 'critical')
        high_conflicts = sum(1 for c in conflicts if c.severity == 'high')
        medium_conflicts = sum(1 for c in conflicts if c.severity == 'medium')
        low_conflicts = sum(1 for c in conflicts if c.severity == 'low')
        
        # 按冲突类型统计
        conflict_types = {}
        for conflict in conflicts:
            conflict_type = conflict.conflict_type
            if conflict_type not in conflict_types:
                conflict_types[conflict_type] = 0
            conflict_types[conflict_type] += 1
        
        return {
            'schedules': {
                'total': total_schedules,
                'feasible': feasible_schedules,
                'infeasible': infeasible_schedules
            },
            'conflicts': {
                'total': total_conflicts,
                'by_severity': {
                    'critical': critical_conflicts,
                    'high': high_conflicts,
                    'medium': medium_conflicts,
                    'low': low_conflicts
                },
                'by_type': conflict_types
            }
        }
