import sys
from pathlib import Path
CORE_DIR = Path(__file__).resolve().parent
ROOT_DIR = CORE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from typing import Dict, List, Optional
from core.models import (
    TaskDefinition, GraphAnalysis, ImpactAnalysis,
    RerunPlan, TaskStatus, FailureRecord, SkipRecord
)
from core.dependency_graph import DependencyGraph


class TerminalPrinter:
    def __init__(self):
        self.colors = {
            'reset': '\033[0m',
            'bold': '\033[1m',
            'red': '\033[31m',
            'green': '\033[32m',
            'yellow': '\033[33m',
            'blue': '\033[34m',
            'magenta': '\033[35m',
            'cyan': '\033[36m',
            'gray': '\033[90m',
            'bg_red': '\033[41m',
            'bg_green': '\033[42m',
            'bg_yellow': '\033[43m',
        }
    
    def color(self, text: str, color: str, bold: bool = False) -> str:
        if bold:
            return f"{self.colors['bold']}{self.colors[color]}{text}{self.colors['reset']}"
        return f"{self.colors[color]}{text}{self.colors['reset']}"
    
    def header(self, title: str):
        print()
        print(self.color(f"{'=' * 60}", 'cyan'))
        print(self.color(f"  {title}", 'cyan', bold=True))
        print(self.color(f"{'=' * 60}", 'cyan'))
        print()
    
    def section(self, title: str):
        print()
        print(self.color(f"  {title}", 'yellow', bold=True))
        print(self.color(f"  {'-' * 50}", 'gray'))
    
    def _status_label(self, status: TaskStatus) -> str:
        mapping = {
            TaskStatus.SUCCESS: ('SUCCESS', 'bg_green'),
            TaskStatus.FAILED: ('FAILED', 'bg_red'),
            TaskStatus.SKIPPED: ('SKIPPED', 'bg_yellow'),
            TaskStatus.PENDING: ('PENDING', 'gray'),
            TaskStatus.BLOCKED: ('BLOCKED', 'red'),
        }
        label, color = mapping.get(status, (status.value, 'gray'))
        return self.color(f"[{label:^10}]", color)
    
    def _action_label(self, action: str) -> str:
        mapping = {
            'RERUN': ('RERUN', 'bg_yellow'),
            'SKIP': ('SKIP', 'gray'),
            'BLOCKED': ('BLOCKED', 'bg_red'),
            'SKIPPED': ('SKIPPED', 'bg_yellow'),
        }
        label, color = mapping.get(action, (action, 'gray'))
        return self.color(f"[{label:^10}]", color)
    
    def print_graph(self, graph: DependencyGraph, analysis: GraphAnalysis):
        self.header("任务依赖拓扑图")
        
        tasks = graph.tasks
        for task_id in graph.analyze_graph().topological_order:
            if task_id not in tasks:
                continue
            task = tasks[task_id]
            deps = task.dependencies
            if deps:
                dep_str = " -> ".join(self.color(d, 'blue') for d in deps)
                print(f"    {dep_str}")
                print(f"      {self.color('|', 'gray')}")
                print(f"      {self.color('v', 'gray')}")
            print(f"    {self.color(task_id, 'cyan', bold=True)} - {task.name}")
            if task.description:
                print(f"      {self.color(task.description, 'gray')}")
            print()
        
        self.section("图结构分析")
        
        if analysis.missing_dependencies:
            print(f"    {self.color('缺失依赖:', 'red', bold=True)}")
            for dep in analysis.missing_dependencies:
                print(f"      - {self.color(dep, 'red')}")
            print()
        
        if analysis.cycles:
            print(f"    {self.color('检测到环:', 'red', bold=True)}")
            for i, cycle in enumerate(analysis.cycles, 1):
                cycle_str = " -> ".join(self.color(n, 'magenta') for n in cycle)
                print(f"      环 {i}: {cycle_str}")
            print()
        
        if analysis.orphan_tasks:
            print(f"    {self.color('孤立任务:', 'yellow', bold=True)}")
            for tid in analysis.orphan_tasks:
                print(f"      - {tid}")
            print()
        
        if not analysis.missing_dependencies and not analysis.cycles and not analysis.orphan_tasks:
            print(f"    {self.color('拓扑正常 - 无缺失依赖、无环', 'green', bold=True)}")
            print(f"    拓扑顺序: {' -> '.join(self.color(t, 'green') for t in analysis.topological_order)}")
    
    def print_impact(self, analysis: ImpactAnalysis,
                     failures: Dict[str, FailureRecord],
                     tasks: Dict[str, TaskDefinition]):
        self.header("影响分析")
        
        if not analysis.failed_tasks:
            print(f"    {self.color('当前无失败任务', 'green', bold=True)}")
            return
        
        self.section("失败任务列表")
        for task_id in analysis.failed_tasks:
            task = tasks.get(task_id)
            name = task.name if task else task_id
            failure = failures.get(task_id)
            reason = failure.reason if failure else "未知原因"
            print(f"    {self.color('[FAILED]', 'bg_red', bold=True)} {self.color(task_id, 'red')} - {name}")
            print(f"      原因: {self.color(reason, 'gray')}")
            if failure:
                print(f"      时间: {failure.failure_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print()
        
        if analysis.affected_downstream:
            self.section("受影响的下游任务")
            print(f"    共 {len(analysis.affected_downstream)} 个任务受到影响")
            for task_id in analysis.affected_downstream:
                task = tasks.get(task_id)
                name = task.name if task else task_id
                status_char = self.color('!', 'yellow')
                print(f"      {status_char} {self.color(task_id, 'yellow')} - {name}")
            print()
        
        if analysis.blocked_tasks:
            self.section("必须阻断的任务")
            print(f"    这些任务的上游仍有失败，不能重跑:")
            for task_id in analysis.blocked_tasks:
                task = tasks.get(task_id)
                name = task.name if task else task_id
                print(f"      {self.color('[BLOCKED]', 'red')} {task_id} - {name}")
            print()
        
        if analysis.safe_to_rerun:
            self.section("可安全重跑的任务")
            print(f"    这些任务无上游失败，可直接重跑:")
            for task_id in analysis.safe_to_rerun:
                task = tasks.get(task_id)
                name = task.name if task else task_id
                print(f"      {self.color('[SAFE]', 'green')} {task_id} - {name}")
        else:
            print(f"    {self.color('暂无可安全重跑的任务', 'yellow')}")
    
    def print_plan(self, plan: List[RerunPlan],
                   tasks: Dict[str, TaskDefinition],
                   skips: Dict[str, SkipRecord]):
        self.header("重跑计划")
        
        total = len(plan)
        rerun_count = sum(1 for p in plan if p.suggested_action == 'RERUN')
        blocked_count = sum(1 for p in plan if p.suggested_action == 'BLOCKED')
        skip_count = sum(1 for p in plan if p.suggested_action == 'SKIP')
        skipped_manual = sum(1 for p in plan if p.suggested_action == 'SKIPPED')
        
        self.section("计划概览")
        print(f"    总任务数: {total}")
        print(f"    建议重跑: {self.color(str(rerun_count), 'yellow', bold=True)}")
        print(f"    必须阻断: {self.color(str(blocked_count), 'red', bold=True)}")
        print(f"    可跳过: {self.color(str(skip_count), 'gray')}")
        if skipped_manual:
            print(f"    已手工跳过: {self.color(str(skipped_manual), 'magenta', bold=True)}")
        print()
        
        self.section("详细计划")
        print(f"    {'任务ID':<30} {'动作':<14} {'技术':<6} {'业务':<6} 依赖")
        print(f"    {'-' * 80}")
        
        for item in plan:
            task = tasks.get(item.task_id)
            name = task.name if task else item.task_id
            
            tech_str = self.color('YES', 'green') if item.technical_safe else self.color('NO ', 'red')
            biz_str = self.color('YES', 'yellow') if item.business_recommended else self.color('NO ', 'gray')
            action_str = self._action_label(item.suggested_action)
            
            deps_str = ", ".join(item.depends_on) if item.depends_on else "-"
            if item.blocked_by:
                deps_str = f"{self.color('BLOCKED by: ', 'red')}{', '.join(item.blocked_by)}"
            
            print(f"    {item.task_id:<30} {action_str} {tech_str}   {biz_str}   {deps_str}")
            
            if item.skip_reason:
                print(f"      {self.color('>>> 跳过原因: ', 'magenta')}{item.skip_reason}")
            elif item.suggested_action == 'RERUN' and not item.technical_safe:
                print(f"      {self.color('>>> 上游仍有失败，请先处理上游', 'yellow')}")
        
        print()
        self.section("图例说明")
        print(f"    技术上可重跑: {self.color('YES', 'green')} = 无上游失败，可立即执行")
        print(f"    业务建议重跑: {self.color('YES', 'yellow')} = 业务数据可能不完整，建议重跑")
        print(f"    {self.color('[RERUN]', 'bg_yellow')} 满足技术条件，建议重跑")
        print(f"    {self.color('[BLOCKED]', 'bg_red')} 上游失败，必须阻断")
        print(f"    {self.color('[SKIPPED]', 'bg_yellow')} 已手工标记跳过（保留原因）")
    
    def print_report(self, run_date: str,
                     statuses: Dict,
                     failures: Dict,
                     skips: Dict,
                     tasks: Dict[str, TaskDefinition]):
        self.header(f"运行状态报告 - {run_date}")
        
        total = len(statuses)
        success = sum(1 for s in statuses.values() if s.status == TaskStatus.SUCCESS)
        failed = len(failures)
        skipped = len(skips)
        pending = sum(1 for s in statuses.values() if s.status == TaskStatus.PENDING)
        blocked = sum(1 for s in statuses.values() if s.status == TaskStatus.BLOCKED)
        
        self.section("状态统计")
        print(f"    成功:  {self.color(f'{success}', 'green', bold=True)}")
        print(f"    失败:  {self.color(f'{failed}', 'red', bold=True)}")
        print(f"    跳过:  {self.color(f'{skipped}', 'yellow', bold=True)}")
        print(f"    阻塞:  {self.color(f'{blocked}', 'magenta', bold=True)}")
        print(f"    待处理:{self.color(f'{pending}', 'cyan', bold=True)}")
        print(f"    总计:  {total}")
        print()
        
        if failures:
            self.section("失败详情")
            for task_id, failure in failures.items():
                task = tasks.get(task_id)
                name = task.name if task else task_id
                print(f"    {self.color(task_id, 'red')} - {name}")
                print(f"      时间: {failure.failure_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"      原因: {self.color(failure.reason, 'gray')}")
                print()
        
        if skips:
            self.section("手工跳过任务")
            for task_id, skip in skips.items():
                task = tasks.get(task_id)
                name = task.name if task else task_id
                print(f"    {self.color(task_id, 'magenta')} - {name}")
                print(f"      时间: {skip.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"      原因: {skip.reason}")
                print()
        
        success_tasks = [t for t, s in statuses.items() if s.status == TaskStatus.SUCCESS]
        if success_tasks:
            self.section("成功任务")
            for task_id in sorted(success_tasks):
                task = tasks.get(task_id)
                name = task.name if task else task_id
                print(f"    {self.color('[OK]', 'green')} {task_id} - {name}")
