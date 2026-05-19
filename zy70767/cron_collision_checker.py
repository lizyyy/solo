#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cron排期碰撞资源标签排查CLI
核心功能：Cron解析、窗口展开、资源冲突检测、风险排序、报告导出
"""

import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict


class CronParser:
    """Cron表达式解析器"""
    
    MONTH_MAP = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    WEEKDAY_MAP = {
        'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    }
    
    def __init__(self):
        self.field_ranges = [
            (0, 59),    # minute
            (0, 23),    # hour
            (1, 31),    # day of month
            (1, 12),    # month
            (0, 6)      # day of week
        ]
        self.field_names = ['minute', 'hour', 'day', 'month', 'weekday']
    
    def _parse_field(self, field: str, min_val: int, max_val: int, name_map: Optional[Dict] = None) -> Set[int]:
        """解析单个cron字段"""
        result = set()
        
        if name_map:
            field = field.lower()
            for name, val in name_map.items():
                field = field.replace(name, str(val))
        
        if field == '*':
            return set(range(min_val, max_val + 1))
        
        for part in field.split(','):
            if '-' in part and '/' not in part:
                start, end = map(int, part.split('-'))
                result.update(range(start, end + 1))
            elif '/' in part:
                base, step = part.split('/')
                step = int(step)
                if base == '*':
                    start = min_val
                    end = max_val
                elif '-' in base:
                    start, end = map(int, base.split('-'))
                else:
                    start = int(base)
                    end = max_val
                result.update(range(start, end + 1, step))
            else:
                result.add(int(part))
        
        return {v for v in result if min_val <= v <= max_val}
    
    def parse(self, cron_expr: str) -> Dict[str, Set[int]]:
        """解析cron表达式，返回各字段的取值集合"""
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            raise ValueError(f"无效的Cron表达式: {cron_expr} (需要5个字段)")
        
        result = {}
        for i, (part, (min_val, max_val)) in enumerate(zip(parts, self.field_ranges)):
            name = self.field_names[i]
            name_map = self.MONTH_MAP if name == 'month' else (self.WEEKDAY_MAP if name == 'weekday' else None)
            try:
                result[name] = self._parse_field(part, min_val, max_val, name_map)
            except Exception as e:
                raise ValueError(f"解析Cron字段 '{name}' 失败: {part}, 错误: {e}")
        
        return result
    
    def get_next_runs(self, cron_expr: str, start_time: datetime, end_time: datetime) -> List[datetime]:
        """获取指定时间窗口内的所有执行时间点"""
        cron = self.parse(cron_expr)
        runs = []
        
        current = start_time.replace(second=0, microsecond=0)
        if current < start_time:
            current += timedelta(minutes=1)
            current = current.replace(second=0, microsecond=0)
        
        while current <= end_time:
            if (current.minute in cron['minute'] and
                current.hour in cron['hour'] and
                current.day in cron['day'] and
                current.month in cron['month'] and
                current.weekday() in cron['weekday']):
                runs.append(current)
            
            current += timedelta(minutes=1)
        
        return runs


class Task:
    """任务类"""
    
    def __init__(self, task_id: str, cron_expr: str, resource_tags: List[str]):
        self.task_id = task_id
        self.cron_expr = cron_expr
        self.resource_tags = set(resource_tags) if resource_tags else set()
        
        if not self.task_id:
            raise ValueError("任务ID不能为空")
        if not self.cron_expr:
            raise ValueError("Cron表达式不能为空")
    
    def to_dict(self) -> Dict:
        return {
            'task_id': self.task_id,
            'cron_expr': self.cron_expr,
            'resource_tags': list(self.resource_tags)
        }


class CollisionRecord:
    """碰撞记录"""
    
    def __init__(self, time_point: datetime, resource_tag: str, tasks: List[Task]):
        self.time_point = time_point
        self.resource_tag = resource_tag
        self.tasks = tasks
        self.risk_score = len(tasks) * 10
    
    def to_dict(self) -> Dict:
        return {
            'time_point': self.time_point.strftime('%Y-%m-%d %H:%M:%S'),
            'resource_tag': self.resource_tag,
            'task_count': len(self.tasks),
            'task_ids': [t.task_id for t in self.tasks],
            'risk_score': self.risk_score
        }


class CollisionChecker:
    """冲突检测器"""
    
    def __init__(self):
        self.parser = CronParser()
    
    def load_tasks(self, tasks_data: List[Dict]) -> Tuple[List[Task], List[Dict]]:
        """加载任务清单，返回有效任务列表和错误记录列表"""
        tasks = []
        errors = []
        
        for idx, task_data in enumerate(tasks_data):
            try:
                task = Task(
                    task_id=task_data.get('task_id', ''),
                    cron_expr=task_data.get('cron_expr', ''),
                    resource_tags=task_data.get('resource_tags', [])
                )
                tasks.append(task)
            except Exception as e:
                errors.append({
                    'index': idx,
                    'data': task_data,
                    'error': str(e)
                })
        
        return tasks, errors
    
    def expand_time_windows(self, tasks: List[Task], start_time: datetime, 
                          end_time: datetime) -> Dict[datetime, Dict[str, List[Task]]]:
        """展开时间窗口，按时间点和资源标签分组任务"""
        time_resource_map = defaultdict(lambda: defaultdict(list))
        
        for task in tasks:
            try:
                run_times = self.parser.get_next_runs(task.cron_expr, start_time, end_time)
                for run_time in run_times:
                    for tag in task.resource_tags:
                        time_resource_map[run_time][tag].append(task)
            except Exception as e:
                print(f"警告: 展开任务 {task.task_id} 时间窗口失败: {e}")
        
        return time_resource_map
    
    def detect_collisions(self, time_resource_map: Dict[datetime, Dict[str, List[Task]]],
                         min_conflict_count: int = 2) -> List[CollisionRecord]:
        """检测资源冲突"""
        collisions = []
        
        for time_point, resource_map in sorted(time_resource_map.items()):
            for resource_tag, tasks in resource_map.items():
                if len(tasks) >= min_conflict_count:
                    collision = CollisionRecord(time_point, resource_tag, tasks)
                    collisions.append(collision)
        
        return collisions
    
    def sort_by_risk(self, collisions: List[CollisionRecord]) -> List[CollisionRecord]:
        """按风险排序：优先按风险分数降序，再按时间升序"""
        return sorted(collisions, key=lambda c: (-c.risk_score, c.time_point))
    
    def run(self, tasks_data: List[Dict], start_time: str, end_time: str,
           min_conflict_count: int = 2) -> Dict:
        """完整检测流程"""
        result = {
            'summary': {},
            'valid_tasks': [],
            'errors': [],
            'collisions': [],
            'time_range': {
                'start': start_time,
                'end': end_time
            }
        }
        
        try:
            start_dt = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
            end_dt = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
        except ValueError as e:
            result['summary'] = {
                'status': 'error',
                'message': f'时间格式错误: {e} (请使用 %Y-%m-%d %H:%M:%S 格式)'
            }
            return result
        
        if start_dt >= end_dt:
            result['summary'] = {
                'status': 'error',
                'message': '开始时间必须早于结束时间'
            }
            return result
        
        tasks, errors = self.load_tasks(tasks_data)
        result['valid_tasks'] = [t.to_dict() for t in tasks]
        result['errors'] = errors
        
        if not tasks:
            result['summary'] = {
                'status': 'completed',
                'message': '没有有效任务可分析',
                'valid_task_count': 0,
                'error_count': len(errors),
                'collision_count': 0
            }
            return result
        
        time_resource_map = self.expand_time_windows(tasks, start_dt, end_dt)
        collisions = self.detect_collisions(time_resource_map, min_conflict_count)
        sorted_collisions = self.sort_by_risk(collisions)
        
        result['collisions'] = [c.to_dict() for c in sorted_collisions]
        result['summary'] = {
            'status': 'completed',
            'message': '分析完成',
            'valid_task_count': len(tasks),
            'error_count': len(errors),
            'collision_count': len(collisions),
            'total_risk_score': sum(c.risk_score for c in collisions)
        }
        
        return result


class ReportGenerator:
    """报告生成器"""
    
    @staticmethod
    def generate_json(result: Dict, output_file: str = None) -> str:
        """生成机器可读的JSON报告"""
        json_str = json.dumps(result, ensure_ascii=False, indent=2)
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(json_str)
        return json_str
    
    @staticmethod
    def generate_text(result: Dict) -> str:
        """生成人类可读的文本报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("                   Cron排期碰撞资源标签排查报告")
        lines.append("=" * 80)
        lines.append("")
        
        summary = result['summary']
        lines.append(f"【执行状态】: {summary.get('status', 'unknown')}")
        lines.append(f"【消息】: {summary.get('message', '')}")
        lines.append("")
        lines.append(f"时间范围: {result['time_range']['start']} 至 {result['time_range']['end']}")
        lines.append("")
        
        if summary.get('status') == 'error':
            return '\n'.join(lines)
        
        lines.append("-" * 80)
        lines.append("一、任务统计")
        lines.append("-" * 80)
        lines.append(f"  有效任务数: {summary.get('valid_task_count', 0)}")
        lines.append(f"  错误任务数: {summary.get('error_count', 0)}")
        lines.append(f"  碰撞记录数: {summary.get('collision_count', 0)}")
        lines.append(f"  总风险分数: {summary.get('total_risk_score', 0)}")
        lines.append("")
        
        if result['errors']:
            lines.append("-" * 80)
            lines.append("二、错误记录")
            lines.append("-" * 80)
            for i, err in enumerate(result['errors'], 1):
                lines.append(f"  {i}. 索引 #{err['index']}: {err['error']}")
                lines.append(f"     数据: {json.dumps(err['data'], ensure_ascii=False)}")
            lines.append("")
        
        if result['collisions']:
            lines.append("-" * 80)
            lines.append("三、碰撞记录（按风险排序）")
            lines.append("-" * 80)
            for i, col in enumerate(result['collisions'], 1):
                lines.append(f"  碰撞 #{i}")
                lines.append(f"    时间点: {col['time_point']}")
                lines.append(f"    资源标签: {col['resource_tag']}")
                lines.append(f"    冲突任务数: {col['task_count']}")
                lines.append(f"    风险分数: {col['risk_score']}")
                lines.append(f"    任务ID: {', '.join(col['task_ids'])}")
                lines.append("")
        else:
            lines.append("-" * 80)
            lines.append("三、碰撞记录")
            lines.append("-" * 80)
            lines.append("  未检测到资源碰撞")
            lines.append("")
        
        lines.append("=" * 80)
        return '\n'.join(lines)


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description='Cron排期碰撞资源标签排查工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本使用
  python cron_collision_checker.py --tasks tasks.json --start "2024-01-01 00:00:00" --end "2024-01-02 00:00:00"
  
  # 导出JSON报告
  python cron_collision_checker.py --tasks tasks.json --start "2024-01-01 00:00:00" --end "2024-01-02 00:00:00" --json-out report.json
  
  # 自定义最小冲突数
  python cron_collision_checker.py --tasks tasks.json --start "2024-01-01 00:00:00" --end "2024-01-02 00:00:00" --min-conflict 3
        """
    )
    
    parser.add_argument('--tasks', required=True, help='任务清单JSON文件路径')
    parser.add_argument('--start', required=True, help='开始时间 (格式: YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end', required=True, help='结束时间 (格式: YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--min-conflict', type=int, default=2, help='最小冲突任务数 (默认: 2)')
    parser.add_argument('--json-out', help='JSON报告输出文件路径')
    parser.add_argument('--text-out', help='文本报告输出文件路径')
    parser.add_argument('--no-text', action='store_true', help='不显示文本报告')
    
    args = parser.parse_args()
    
    try:
        with open(args.tasks, 'r', encoding='utf-8') as f:
            tasks_data = json.load(f)
    except Exception as e:
        print(f"错误: 无法读取任务文件 {args.tasks}: {e}")
        return 1
    
    checker = CollisionChecker()
    result = checker.run(tasks_data, args.start, args.end, args.min_conflict)
    
    if args.json_out:
        ReportGenerator.generate_json(result, args.json_out)
        print(f"JSON报告已保存到: {args.json_out}")
    
    text_report = ReportGenerator.generate_text(result)
    
    if args.text_out:
        with open(args.text_out, 'w', encoding='utf-8') as f:
            f.write(text_report)
        print(f"文本报告已保存到: {args.text_out}")
    
    if not args.no_text:
        print()
        print(text_report)
    
    return 0


if __name__ == '__main__':
    exit(main())
