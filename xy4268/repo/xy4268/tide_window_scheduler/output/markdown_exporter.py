"""
Markdown导出器 - 导出供调度员阅读的Markdown格式调度单
"""
from datetime import datetime
from typing import List, Dict, Any

from ..core import CandidateSchedule, Conflict
from ..models import Ship, Berth, Tug, TidalRecord


class MarkdownExporter:
    """Markdown调度单导出器"""
    
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
        导出结果为Markdown格式调度单
        
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
        # 构建Markdown内容
        content = []
        
        # 标题
        content.append('# 潮窗靠泊推演器 - 调度单')
        content.append('')
        content.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        content.append('')
        
        # 摘要
        content.append('## 1. 执行摘要')
        content.append('')
        
        # 统计信息
        total_schedules = len(schedules)
        feasible_schedules = sum(1 for s in schedules if s.is_feasible)
        infeasible_schedules = total_schedules - feasible_schedules
        total_conflicts = len(conflicts)
        
        content.append('| 指标 | 数量 |')
        content.append('|------|------|')
        content.append(f'| 总计划数 | {total_schedules} |')
        content.append(f'| 可行计划 | {feasible_schedules} |')
        content.append(f'| 不可行计划 | {infeasible_schedules} |')
        content.append(f'| 冲突数量 | {total_conflicts} |')
        content.append('')
        
        # 可行计划
        content.append('## 2. 可行靠离泊计划')
        content.append('')
        
        feasible = [s for s in schedules if s.is_feasible]
        
        if feasible:
            # 按到达时间排序
            feasible.sort(key=lambda s: s.arrival_time if s.arrival_time else datetime.max)
            
            for i, schedule in enumerate(feasible, 1):
                content.append(f'### 2.{i} {schedule.ship.name}')
                content.append('')
                
                # 基本信息
                content.append('#### 基本信息')
                content.append('')
                content.append(f'- **船舶**: {schedule.ship.name}')
                content.append(f'- **吃水深度**: {schedule.ship.draft:.2f}m')
                content.append(f'- **货重**: {schedule.ship.cargo_weight:.0f}吨')
                content.append(f'- **船长**: {schedule.ship.length:.0f}m')
                content.append(f'- **船宽**: {schedule.ship.width:.0f}m')
                content.append(f'- **需要拖轮数**: {schedule.ship.required_tug_count}艘')
                content.append('')
                
                # 计划信息
                content.append('#### 靠离泊计划')
                content.append('')
                content.append(f'- **泊位**: {schedule.berth.name} ({schedule.berth.type})')
                content.append(f'- **泊位最大吃水**: {schedule.berth.max_draft:.2f}m')
                content.append(f'- **预计靠泊时间**: {schedule.arrival_time.strftime("%Y-%m-%d %H:%M") if schedule.arrival_time else "未确定"}')
                content.append(f'- **预计离泊时间**: {schedule.departure_time.strftime("%Y-%m-%d %H:%M") if schedule.departure_time else "未确定"}')
                content.append(f'- **作业时长**: {int(schedule.ship.operation_duration.total_seconds() / 60)}分钟')
                content.append('')
                
                # 潮窗信息
                content.append('#### 潮窗信息')
                content.append('')
                
                if schedule.berthing_tidal_window:
                    bw = schedule.berthing_tidal_window
                    content.append('**靠泊潮窗**:')
                    content.append(f'- **开始时间**: {bw.get("start_time", "").strftime("%Y-%m-%d %H:%M") if bw.get("start_time") else "未知"}')
                    content.append(f'- **结束时间**: {bw.get("end_time", "").strftime("%Y-%m-%d %H:%M") if bw.get("end_time") else "未知"}')
                    content.append(f'- **最小潮高**: {bw.get("min_height", 0):.2f}m')
                    content.append(f'- **最大潮高**: {bw.get("max_height", 0):.2f}m')
                    content.append(f'- **所需水深**: {bw.get("required_depth", 0):.2f}m')
                    content.append('')
                else:
                    content.append('> ⚠️ 无可用靠泊潮窗信息')
                    content.append('')
                
                if schedule.conflicts:
                    content.append('#### 注意事项')
                    content.append('')
                    for conflict in schedule.conflicts:
                        severity_icon = '🔴' if conflict.get('severity') == 'critical' else '🟠'
                        content.append(f'{severity_icon} **[{conflict.get("severity", "unknown").upper()}]** {conflict.get("type", "unknown")}: {conflict.get("description", "")}')
                    content.append('')
        
        else:
            content.append('> ❌ 没有可行的靠离泊计划')
            content.append('')
        
        # 不可行计划
        content.append('## 3. 不可行计划及原因分析')
        content.append('')
        
        infeasible = [s for s in schedules if not s.is_feasible]
        
        if infeasible:
            for i, schedule in enumerate(infeasible, 1):
                content.append(f'### 3.{i} {schedule.ship.name}')
                content.append('')
                
                # 基本信息
                content.append(f'- **船舶**: {schedule.ship.name}')
                content.append(f'- **吃水深度**: {schedule.ship.draft:.2f}m')
                content.append(f'- **货重**: {schedule.ship.cargo_weight:.0f}吨')
                content.append('')
                
                # 冲突原因
                content.append('#### 不可行原因')
                content.append('')
                
                if schedule.conflicts:
                    for conflict in schedule.conflicts:
                        severity_icon = '🔴' if conflict.get('severity') == 'critical' else '🟠'
                        content.append(f'{severity_icon} **[{conflict.get("severity", "unknown").upper()}]** {conflict.get("type", "unknown")}')
                        content.append(f'  - 描述: {conflict.get("description", "")}')
                        content.append('')
                else:
                    content.append('> ⚠️ 未明确记录冲突原因')
                    content.append('')
        else:
            content.append('> ✅ 没有不可行的计划')
            content.append('')
        
        # 冲突详情
        content.append('## 4. 冲突详情')
        content.append('')
        
        if conflicts:
            # 按严重程度分组
            critical = [c for c in conflicts if c.severity == 'critical']
            high = [c for c in conflicts if c.severity == 'high']
            medium = [c for c in conflicts if c.severity == 'medium']
            low = [c for c in conflicts if c.severity == 'low']
            
            if critical:
                content.append('### 4.1 关键冲突 (CRITICAL) 🔴')
                content.append('')
                for i, conflict in enumerate(critical, 1):
                    content.append(f'#### 4.1.{i} {conflict.conflict_type}')
                    content.append('')
                    content.append(f'- **类型**: {conflict.conflict_type}')
                    content.append(f'- **严重程度**: {conflict.severity}')
                    content.append(f'- **描述**: {conflict.description}')
                    if conflict.involved_schedules:
                        content.append(f'- **涉及计划**: {", ".join(conflict.involved_schedules)}')
                    content.append('')
            
            if high:
                content.append('### 4.2 高优先级冲突 (HIGH) 🟠')
                content.append('')
                for i, conflict in enumerate(high, 1):
                    content.append(f'#### 4.2.{i} {conflict.conflict_type}')
                    content.append('')
                    content.append(f'- **类型**: {conflict.conflict_type}')
                    content.append(f'- **严重程度**: {conflict.severity}')
                    content.append(f'- **描述**: {conflict.description}')
                    if conflict.involved_schedules:
                        content.append(f'- **涉及计划**: {", ".join(conflict.involved_schedules)}')
                    content.append('')
            
            if medium or low:
                content.append('### 4.3 其他冲突')
                content.append('')
                other = medium + low
                for i, conflict in enumerate(other, 1):
                    content.append(f'- **[{conflict.severity.upper()}]** {conflict.conflict_type}: {conflict.description}')
                content.append('')
        
        else:
            content.append('> ✅ 没有检测到冲突')
            content.append('')
        
        # 输入数据参考
        content.append('## 5. 输入数据参考')
        content.append('')
        
        # 潮汐表
        content.append('### 5.1 潮汐表')
        content.append('')
        content.append('| 时间 | 潮高 (m) |')
        content.append('|------|----------|')
        for record in tidal_records:
            content.append(f'| {record.time.strftime("%Y-%m-%d %H:%M")} | {record.height:.2f} |')
        content.append('')
        
        # 船舶信息
        content.append('### 5.2 船舶信息')
        content.append('')
        content.append('| 船舶名称 | 吃水 (m) | 货重 (吨) | 船长 (m) | 船宽 (m) | 需要拖轮数 |')
        content.append('|----------|----------|-----------|----------|----------|------------|')
        for ship in ships:
            content.append(f'| {ship.name} | {ship.draft:.2f} | {ship.cargo_weight:.0f} | {ship.length:.0f} | {ship.width:.0f} | {ship.required_tug_count} |')
        content.append('')
        
        # 泊位信息
        content.append('### 5.3 泊位信息')
        content.append('')
        content.append('| 泊位名称 | 类型 | 最大吃水 (m) | 最大长度 (m) | 最大宽度 (m) |')
        content.append('|----------|------|---------------|--------------|--------------|')
        for berth in berths:
            content.append(f'| {berth.name} | {berth.type} | {berth.max_draft:.2f} | {berth.max_length:.0f} | {berth.max_width:.0f} |')
        content.append('')
        
        # 拖轮信息
        content.append('### 5.4 拖轮信息')
        content.append('')
        content.append('| 拖轮名称 | 拖力 (吨) | 可用时段 |')
        content.append('|----------|-----------|----------|')
        for tug in tugs:
            slots_str = '; '.join([str(slot) for slot in tug.available_time_slots]) if tug.available_time_slots else '全天可用'
            content.append(f'| {tug.name} | {tug.capacity:.0f} | {slots_str} |')
        content.append('')
        
        # 页脚
        content.append('---')
        content.append('')
        content.append('*此调度单由潮窗靠泊推演器自动生成，仅供参考。请调度员根据实际情况进行调整。*')
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
