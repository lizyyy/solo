"""
命令行接口模块
提供init、analyze、compare、export四个核心命令
"""

import os
import sys
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from memprofiler.config import Config
from memprofiler.models import (
    DatabaseManager,
    AnalysisResult,
    LeakSeverity,
    IssueType,
)
from memprofiler.readers import (
    ScriptReader,
    SnapshotReader,
    GCLogReader,
    RefJsonReader,
    ScriptAnalysisResult,
    GCLogAnalysisResult,
    RefJsonAnalysisResult,
)
from memprofiler.analyzer import MemoryAnalyzer, AnalysisContext
from memprofiler.exporters import MarkdownExporter, JsonExporter, export_to_file
from memprofiler.exceptions import (
    MemProfilerError,
    DataFormatError,
    FileNotFoundError,
    NoDataError,
    NoAnalysisError,
)
from memprofiler.utils import format_size, generate_timestamp


console = Console()


def get_config(ctx: click.Context) -> Config:
    """从上下文获取配置"""
    return ctx.obj.get("config", Config())


def get_db(ctx: click.Context) -> DatabaseManager:
    """从上下文获取数据库管理器"""
    config = get_config(ctx)
    return DatabaseManager(config.database_path)


def print_error(message: str):
    """打印错误消息"""
    console.print(f"[red]✗ 错误: {message}[/red]")


def print_success(message: str):
    """打印成功消息"""
    console.print(f"[green]✓ {message}[/green]")


def print_warning(message: str):
    """打印警告消息"""
    console.print(f"[yellow]⚠ {message}[/yellow]")


def print_info(message: str):
    """打印信息消息"""
    console.print(f"[blue]ℹ {message}[/blue]")


@click.group()
@click.option("--workdir", "-w", type=click.Path(exists=False), default=".",
              help="工作目录")
@click.option("--verbose", "-v", is_flag=True, default=False,
              help="详细输出模式")
@click.pass_context
def main(ctx: click.Context, workdir: str, verbose: bool):
    """
    MemProfiler - Python内存问题排查小工具
    
    用于培训目的的内存问题分析工具，支持分析tracemalloc快照、
    GC日志、对象引用关系等数据。
    """
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose
    
    config = Config(work_dir=workdir)
    ctx.obj["config"] = config
    
    if verbose:
        print_info(f"工作目录: {config.work_dir}")


@main.command()
@click.option("--seed", "-s", is_flag=True, default=False,
              help="生成样例数据用于培训")
@click.option("--force", "-f", is_flag=True, default=False,
              help="强制初始化，覆盖现有文件")
@click.pass_context
def init(ctx: click.Context, seed: bool, force: bool):
    """
    初始化分析环境
    
    创建必要的目录结构和配置文件。
    使用 --seed 选项可以生成培训用的样例数据。
    """
    config = get_config(ctx)
    verbose = ctx.obj.get("verbose", False)
    
    config_file = os.path.join(config.work_dir, ".memprofiler.json")
    if os.path.exists(config_file) and not force:
        print_warning("工作目录已初始化，使用 --force 强制重新初始化")
        return
    
    console.print(Panel.fit(
        "[bold cyan]初始化 MemProfiler 分析环境[/bold cyan]",
        border_style="cyan"
    ))
    
    if verbose:
        print_info("创建目录结构...")
    
    config.ensure_directories()
    
    if verbose:
        print_info("保存配置文件...")
    
    config.save()
    
    if seed:
        if verbose:
            print_info("生成样例数据...")
        _generate_seed_data(config)
    
    print_success("初始化完成！")
    console.print("")
    console.print("下一步:")
    console.print("  1. 将分析数据放入 samples/ 目录")
    console.print("  2. 运行 'memprofiler analyze' 进行分析")
    console.print("  3. 运行 'memprofiler export' 导出报告")


def _generate_seed_data(config: Config):
    """生成seed样例数据"""
    
    scripts_dir = config.scripts_dir
    
    cycle_ref_script = '''"""
循环引用示例
这是一个典型的循环引用场景，可能导致内存泄漏
"""

class Node:
    """链表节点"""
    
    def __init__(self, name):
        self.name = name
        self.next = None
        self.prev = None
    
    def __del__(self):
        """
        警告：在循环引用中使用 __del__ 会导致对象不可回收！
        """
        print(f"节点 {self.name} 被销毁")


def create_circular_linked_list():
    """创建循环链表"""
    head = Node("head")
    node1 = Node("node1")
    node2 = Node("node2")
    
    # 形成循环引用
    head.next = node1
    node1.prev = head
    node1.next = node2
    node2.prev = node1
    node2.next = head  # 循环引用点
    head.prev = node2
    
    return head


if __name__ == "__main__":
    import gc
    
    # 启用GC调试
    gc.set_debug(gc.DEBUG_LEAK)
    
    # 创建循环引用
    circular_list = create_circular_linked_list()
    
    # 删除引用，但循环引用仍然存在
    del circular_list
    
    # 尝试回收
    gc.collect()
    
    # 检查不可回收对象
    print(f"不可回收对象: {gc.garbage}")
'''
    
    with open(os.path.join(scripts_dir, "01_cycle_reference.py"), "w", encoding="utf-8") as f:
        f.write(cycle_ref_script)
    
    cache_script = '''"""
缓存容器残留示例
使用全局dict作为缓存可能导致内存泄漏
"""

import weakref

# 危险：全局缓存，永远不会释放
_global_cache = {}

def dangerous_cache(key, value):
    """
    危险的缓存实现
    没有过期机制，内存会无限增长
    """
    _global_cache[key] = value
    return value


# 安全：使用WeakKeyDictionary
_safe_cache = weakref.WeakKeyDictionary()

def safe_cache(obj, value):
    """
    安全的缓存实现
    当对象被回收时，缓存条目自动删除
    """
    _safe_cache[obj] = value
    return value


class DataObject:
    """数据对象"""
    
    def __init__(self, data):
        self.data = data
        self._cached_result = None
    
    @property
    def expensive_computation(self):
        """
        耗时计算，使用缓存
        但如果对象不被释放，缓存也不会释放
        """
        if self._cached_result is None:
            # 模拟耗时计算
            self._cached_result = sum(range(1000000))
        return self._cached_result


def demonstrate_cache_issue():
    """演示缓存残留问题"""
    objects = []
    
    for i in range(100):
        obj = DataObject(f"data_{i}")
        # 访问属性触发缓存
        _ = obj.expensive_computation
        objects.append(obj)
        
        # 危险：添加到全局缓存
        dangerous_cache(f"key_{i}", obj)
    
    # 删除列表引用
    del objects
    
    # 但全局缓存仍然持有引用！
    print(f"全局缓存大小: {len(_global_cache)}")
    print("这些对象无法被回收！")
'''
    
    with open(os.path.join(scripts_dir, "02_cache_residue.py"), "w", encoding="utf-8") as f:
        f.write(cache_script)
    
    del_method_script = '''"""
__del__ 方法问题示例
在循环引用中使用 __del__ 会导致对象不可回收
"""

import gc

class Resource:
    """
    包含 __del__ 的资源类
    这是一个危险的模式！
    """
    
    def __init__(self, name):
        self.name = name
        self.other = None  # 用于形成循环引用
    
    def __del__(self):
        """
        析构函数
        警告：如果存在循环引用，这个方法会阻止对象回收！
        """
        print(f"释放资源: {self.name}")
        # 尝试清理
        if self.other:
            self.other = None


class SafeResource:
    """
    安全的资源类
    使用显式的 close() 方法替代 __del__
    """
    
    def __init__(self, name):
        self.name = name
        self.other = None
        self._closed = False
    
    def close(self):
        """显式关闭资源"""
        if not self._closed:
            print(f"释放资源: {self.name}")
            self.other = None
            self._closed = True
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


def demonstrate_del_problem():
    """演示 __del__ 导致的问题"""
    
    print("=== 危险示例：循环引用 + __del__ ===")
    
    # 创建两个对象
    a = Resource("A")
    b = Resource("B")
    
    # 形成循环引用
    a.other = b
    b.other = a
    
    # 删除引用
    del a
    del b
    
    # 启用GC调试
    gc.set_debug(gc.DEBUG_LEAK)
    
    # 尝试回收
    collected = gc.collect()
    print(f"回收对象数: {collected}")
    print(f"不可回收对象: {gc.garbage}")
    
    if gc.garbage:
        print("\\n警告：存在不可回收对象！")
        print("这是因为循环引用中包含 __del__ 方法")
    
    # 清理
    gc.garbage.clear()


def demonstrate_safe_pattern():
    """演示安全模式"""
    
    print("\\n=== 安全示例：使用上下文管理器 ===")
    
    with SafeResource("A") as a, SafeResource("B") as b:
        # 即使形成循环引用
        a.other = b
        b.other = a
        print("使用资源中...")
    
    # 退出上下文管理器时自动关闭
    print("资源已安全释放")
'''
    
    with open(os.path.join(scripts_dir, "03_del_method.py"), "w", encoding="utf-8") as f:
        f.write(del_method_script)
    
    gc_logs_dir = config.gc_logs_dir
    
    gc_log_content = '''gc: collecting generation 2...
gc: objects in each generation: 1000 200 50
gc: done, 0.001s elapsed.
gc: uncollectable <Resource at 0x7f8b1c2d3a90>
gc: uncollectable <Resource at 0x7f8b1c2d3b38>
gc: uncollectable <dict 0x7f8b1c2c8f40>
gc: has __del__ <Resource at 0x7f8b1c2d3a90>
gc: has __del__ <Resource at 0x7f8b1c2d3b38>
gc: cycle detected (3 objects):
gc:   <Resource at 0x7f8b1c2d3a90> -> <Resource at 0x7f8b1c2d3b38>
gc:   <Resource at 0x7f8b1c2d3b38> -> <Resource at 0x7f8b1c2d3a90>
gc:   <dict 0x7f8b1c2c8f40> -> ...
gc: collecting generation 2...
gc: objects in each generation: 1500 300 100
gc: done, 0.002s elapsed.
gc: uncollectable <Node at 0x7f8b1c2e1234>
gc: uncollectable <Node at 0x7f8b1c2e12d8>
gc: uncollectable <Node at 0x7f8b1c2e137c>
gc: cycle detected (4 objects):
gc:   <Node at 0x7f8b1c2e1234> -> <Node at 0x7f8b1c2e12d8>
gc:   <Node at 0x7f8b1c2e12d8> -> <Node at 0x7f8b1c2e137c>
gc:   <Node at 0x7f8b1c2e137c> -> <Node at 0x7f8b1c2e1234>
'''
    
    with open(os.path.join(gc_logs_dir, "gc_debug.log"), "w", encoding="utf-8") as f:
        f.write(gc_log_content)
    
    ref_json_dir = config.ref_json_dir
    
    ref_json_content = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "generator": "memprofiler_seed",
            "version": "0.1.0"
        },
        "objects": [
            {
                "id": "obj_001",
                "type": "Resource",
                "size": 1024,
                "ref_count": 2,
                "address": "0x7f8b1c2d3a90",
                "module": "__main__",
                "attributes": {
                    "name": "A",
                    "has_del": True
                },
                "references": [
                    {"to": "obj_002", "type": "strong", "attribute": "other"}
                ]
            },
            {
                "id": "obj_002",
                "type": "Resource",
                "size": 1024,
                "ref_count": 2,
                "address": "0x7f8b1c2d3b38",
                "module": "__main__",
                "attributes": {
                    "name": "B",
                    "has_del": True
                },
                "references": [
                    {"to": "obj_001", "type": "strong", "attribute": "other"}
                ]
            },
            {
                "id": "obj_003",
                "type": "dict",
                "size": 5242880,
                "ref_count": 1,
                "address": "0x7f8b1c2c8f40",
                "module": "builtins",
                "attributes": {
                    "is_cache": True,
                    "num_entries": 1000
                },
                "references": [
                    {"to": "obj_004", "type": "strong", "attribute": "data_0"},
                    {"to": "obj_005", "type": "strong", "attribute": "data_1"}
                ]
            },
            {
                "id": "obj_004",
                "type": "DataObject",
                "size": 2097152,
                "ref_count": 1,
                "address": "0x7f8b1c2e1000",
                "module": "__main__",
                "attributes": {},
                "references": []
            },
            {
                "id": "obj_005",
                "type": "DataObject",
                "size": 1048576,
                "ref_count": 1,
                "address": "0x7f8b1c2e1100",
                "module": "__main__",
                "attributes": {},
                "references": []
            },
            {
                "id": "obj_006",
                "type": "list",
                "size": 10485760,
                "ref_count": 3,
                "address": "0x7f8b1c2f0000",
                "module": "builtins",
                "attributes": {
                    "length": 10000
                },
                "references": []
            },
            {
                "id": "obj_007",
                "type": "Node",
                "size": 512,
                "ref_count": 2,
                "address": "0x7f8b1c2e1234",
                "module": "__main__",
                "attributes": {
                    "name": "head",
                    "has_del": True
                },
                "references": [
                    {"to": "obj_008", "type": "strong", "attribute": "next"},
                    {"to": "obj_009", "type": "strong", "attribute": "prev"}
                ]
            },
            {
                "id": "obj_008",
                "type": "Node",
                "size": 512,
                "ref_count": 2,
                "address": "0x7f8b1c2e12d8",
                "module": "__main__",
                "attributes": {
                    "name": "node1",
                    "has_del": True
                },
                "references": [
                    {"to": "obj_009", "type": "strong", "attribute": "next"},
                    {"to": "obj_007", "type": "strong", "attribute": "prev"}
                ]
            },
            {
                "id": "obj_009",
                "type": "Node",
                "size": 512,
                "ref_count": 2,
                "address": "0x7f8b1c2e137c",
                "module": "__main__",
                "attributes": {
                    "name": "node2",
                    "has_del": True
                },
                "references": [
                    {"to": "obj_007", "type": "strong", "attribute": "next"},
                    {"to": "obj_008", "type": "strong", "attribute": "prev"}
                ]
            }
        ],
        "references": [
            {"from": "obj_001", "to": "obj_002", "type": "strong", "attribute": "other"},
            {"from": "obj_002", "to": "obj_001", "type": "strong", "attribute": "other"},
            {"from": "obj_007", "to": "obj_008", "type": "strong", "attribute": "next"},
            {"from": "obj_008", "to": "obj_009", "type": "strong", "attribute": "next"},
            {"from": "obj_009", "to": "obj_007", "type": "strong", "attribute": "next"},
            {"from": "obj_007", "to": "obj_009", "type": "strong", "attribute": "prev"},
            {"from": "obj_009", "to": "obj_008", "type": "strong", "attribute": "prev"},
            {"from": "obj_008", "to": "obj_007", "type": "strong", "attribute": "prev"}
        ]
    }
    
    with open(os.path.join(ref_json_dir, "ref_relations.json"), "w", encoding="utf-8") as f:
        json.dump(ref_json_content, f, indent=2, ensure_ascii=False)
    
    print_info("样例数据已生成:")
    print_info(f"  - 脚本: {scripts_dir}/")
    print_info(f"  - GC日志: {gc_logs_dir}/gc_debug.log")
    print_info(f"  - 引用关系: {ref_json_dir}/ref_relations.json")


@main.command()
@click.option("--snapshot", "-s", type=click.Path(exists=True),
              help="指定要分析的快照文件")
@click.option("--gc-log", "-g", type=click.Path(exists=True),
              help="指定GC日志文件")
@click.option("--ref-json", "-r", type=click.Path(exists=True),
              help="指定引用关系JSON文件")
@click.option("--script", "-c", type=click.Path(exists=True),
              help="指定脚本片段文件")
@click.option("--output", "-o", type=click.Path(),
              help="输出结果到文件")
@click.pass_context
def analyze(ctx: click.Context, snapshot: Optional[str], gc_log: Optional[str],
            ref_json: Optional[str], script: Optional[str], output: Optional[str]):
    """
    分析内存数据
    
    分析收集到的内存数据，包括：
    - 循环引用检测
    - __del__ 方法问题分析
    - 引用计数异常检测
    - 大对象和缓存残留分析
    """
    config = get_config(ctx)
    verbose = ctx.obj.get("verbose", False)
    db = get_db(ctx)
    
    console.print(Panel.fit(
        "[bold cyan]执行内存分析[/bold cyan]",
        border_style="cyan"
    ))
    
    analysis_id = db.create_analysis()
    
    if verbose:
        print_info(f"分析ID: {analysis_id}")
    
    script_results: List[ScriptAnalysisResult] = []
    gc_log_results: List[GCLogAnalysisResult] = []
    ref_json_results: List[RefJsonAnalysisResult] = []
    snapshots = []
    
    try:
        if script:
            if verbose:
                print_info(f"分析指定脚本: {script}")
            reader = ScriptReader(script)
            script_results.append(reader.read())
        else:
            script_files = config.get_scripts_files()
            for sf in script_files:
                try:
                    if verbose:
                        print_info(f"分析脚本: {sf}")
                    reader = ScriptReader(sf)
                    script_results.append(reader.read())
                except DataFormatError as e:
                    print_warning(f"跳过无效脚本 {sf}: {e}")
        
        if gc_log:
            if verbose:
                print_info(f"分析指定GC日志: {gc_log}")
            reader = GCLogReader(gc_log)
            gc_log_results.append(reader.read())
        else:
            gc_files = config.get_gc_logs_files()
            for gf in gc_files:
                try:
                    if verbose:
                        print_info(f"分析GC日志: {gf}")
                    reader = GCLogReader(gf)
                    gc_log_results.append(reader.read())
                except DataFormatError as e:
                    print_warning(f"跳过无效GC日志 {gf}: {e}")
        
        if ref_json:
            if verbose:
                print_info(f"分析指定引用关系JSON: {ref_json}")
            reader = RefJsonReader(ref_json)
            ref_json_results.append(reader.read())
        else:
            ref_files = config.get_ref_json_files()
            for rf in ref_files:
                try:
                    if verbose:
                        print_info(f"分析引用关系JSON: {rf}")
                    reader = RefJsonReader(rf)
                    ref_json_results.append(reader.read())
                except DataFormatError as e:
                    print_warning(f"跳过无效JSON {rf}: {e}")
        
        if snapshot:
            if verbose:
                print_info(f"分析指定快照: {snapshot}")
            reader = SnapshotReader(snapshot)
            snap_info = reader.read()
            snapshots.append(snap_info)
        else:
            snap_files = config.get_snapshots_files()
            for sf in snap_files:
                try:
                    if verbose:
                        print_info(f"分析快照: {sf}")
                    reader = SnapshotReader(sf)
                    snap_info = reader.read()
                    snapshots.append(snap_info)
                except DataFormatError as e:
                    print_warning(f"跳过无效快照 {sf}: {e}")
        
        if not any([script_results, gc_log_results, ref_json_results, snapshots]):
            raise NoDataError("没有找到任何可分析的数据")
        
        analysis_context = AnalysisContext(
            config=config,
            script_results=script_results,
            gc_log_results=gc_log_results,
            ref_json_results=ref_json_results,
            snapshots=snapshots,
        )
        
        analyzer = MemoryAnalyzer(analysis_context)
        
        if verbose:
            print_info("执行分析...")
        
        result = analyzer.analyze()
        result.analysis_id = analysis_id
        
        summary = result.summary or {}
        
        db.update_analysis(
            analysis_id=analysis_id,
            status=result.status,
            summary=summary,
            error_message=result.error_message
        )
        
        for suspect in result.suspects:
            db.save_suspect(analysis_id, suspect)
        
        for cycle in result.cycles:
            db.save_cycle(analysis_id, cycle)
        
        for obj in result.objects[:1000]:
            db.save_object(analysis_id, obj)
        
        for snap in snapshots:
            db.save_snapshot(analysis_id, snap)
        
        _display_analysis_result(result, verbose)
        
        if output:
            if verbose:
                print_info(f"导出报告到: {output}")
            if output.endswith(".json"):
                export_to_file(result, output, "json")
            else:
                export_to_file(result, output, "markdown")
            print_success(f"报告已保存到: {output}")
        
        console.print("")
        console.print("下一步:")
        console.print(f"  运行 'memprofiler export --latest' 导出完整报告")
        console.print(f"  运行 'memprofiler compare' 比较快照")
        
    except MemProfilerError as e:
        db.update_analysis(
            analysis_id=analysis_id,
            status="failed",
            error_message=str(e)
        )
        print_error(str(e))
        sys.exit(1)
    except Exception as e:
        db.update_analysis(
            analysis_id=analysis_id,
            status="failed",
            error_message=str(e)
        )
        print_error(f"分析失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


def _display_analysis_result(result: AnalysisResult, verbose: bool):
    """显示分析结果"""
    summary = result.summary or {}
    
    console.print("")
    console.print(Panel.fit(
        "[bold green]分析完成[/bold green]",
        border_style="green"
    ))
    
    risk_level = summary.get("risk_level", "未知")
    risk_color = "green"
    if risk_level == "严重":
        risk_color = "red"
    elif risk_level == "高":
        risk_color = "yellow"
    elif risk_level == "中":
        risk_color = "blue"
    
    console.print(f"风险等级: [{risk_color}]{risk_level}[/{risk_color}]")
    console.print(f"嫌疑对象: {summary.get('total_suspects', 0)} 个")
    console.print(f"循环引用: {summary.get('total_cycles', 0)} 个")
    console.print(f"嫌疑总大小: {summary.get('total_suspect_size_formatted', '0 B')}")
    
    if result.suspects:
        console.print("")
        console.print("[bold]泄漏嫌疑排行 (Top 10):[/bold]")
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("#", style="dim", width=3)
        table.add_column("严重程度")
        table.add_column("问题类型")
        table.add_column("对象类型")
        table.add_column("大小")
        
        for i, suspect in enumerate(result.suspects[:10], 1):
            severity_emoji = "🔴" if suspect.severity == LeakSeverity.CRITICAL else \
                             "🟠" if suspect.severity == LeakSeverity.HIGH else \
                             "🟡" if suspect.severity == LeakSeverity.MEDIUM else \
                             "🟢"
            
            severity_text = {
                LeakSeverity.CRITICAL: "严重",
                LeakSeverity.HIGH: "高",
                LeakSeverity.MEDIUM: "中",
                LeakSeverity.LOW: "低",
                LeakSeverity.INFO: "信息",
            }.get(suspect.severity, "未知")
            
            issue_text = {
                IssueType.CYCLE_REFERENCE: "循环引用",
                IssueType.DEL_METHOD: "__del__问题",
                IssueType.REF_COUNT_LEAK: "引用计数",
                IssueType.WEAKREF_INVALID: "弱引用",
                IssueType.CACHE_RESIDUE: "缓存残留",
                IssueType.LARGE_OBJECT: "大对象",
                IssueType.UNCOLLECTABLE: "不可回收",
            }.get(suspect.issue_type, "未知")
            
            table.add_row(
                str(i),
                f"{severity_emoji} {severity_text}",
                issue_text,
                suspect.obj_type,
                format_size(suspect.size)
            )
        
        console.print(table)
        
        if verbose and result.suspects:
            console.print("")
            console.print("[bold]详细信息:[/bold]")
            for i, suspect in enumerate(result.suspects[:3], 1):
                console.print("")
                console.print(f"[cyan]--- 嫌疑对象 #{i} ---[/cyan]")
                console.print(f"问题类型: {suspect.issue_type.value}")
                console.print(f"严重程度: {suspect.severity.value}")
                
                if suspect.evidence:
                    console.print("证据:")
                    for ev in suspect.evidence:
                        console.print(f"  - {ev}")
                
                if suspect.suggestions:
                    console.print("建议:")
                    for sug in suspect.suggestions:
                        console.print(f"  - {sug}")


@main.command()
@click.option("--before", "-b", type=click.Path(exists=True), required=True,
              help="之前的快照文件")
@click.option("--after", "-a", type=click.Path(exists=True), required=True,
              help="之后的快照文件")
@click.option("--top", "-t", type=int, default=10,
              help="显示前N个增长最多的类型 (默认: 10)")
@click.pass_context
def compare(ctx: click.Context, before: str, after: str, top: int):
    """
    比较两个内存快照
    
    分析两个快照之间的内存变化，找出增长最多的对象类型。
    """
    verbose = ctx.obj.get("verbose", False)
    
    console.print(Panel.fit(
        "[bold cyan]比较内存快照[/bold cyan]",
        border_style="cyan"
    ))
    
    try:
        if verbose:
            print_info(f"读取快照1: {before}")
        reader1 = SnapshotReader(before)
        
        if verbose:
            print_info(f"读取快照2: {after}")
        reader2 = SnapshotReader(after)
        
        comparison = reader1.compare_with(reader2)
        
        console.print("")
        console.print("[bold]快照比较结果:[/bold]")
        console.print("")
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("指标")
        table.add_column("快照1 (之前)")
        table.add_column("快照2 (之后)")
        table.add_column("变化")
        
        size_change = comparison["diff"]["size_change"]
        size_color = "red" if size_change == "增长" else "green" if size_change == "减少" else "white"
        
        obj_change = comparison["diff"]["objects_change"]
        obj_color = "red" if obj_change == "增长" else "green" if obj_change == "减少" else "white"
        
        table.add_row(
            "内存大小",
            comparison["before"]["size_formatted"],
            comparison["after"]["size_formatted"],
            f"[{size_color}]{comparison['diff']['size_formatted']} {size_change}[/{size_color}]"
        )
        
        table.add_row(
            "对象数量",
            str(comparison["before"]["objects"]),
            str(comparison["after"]["objects"]),
            f"[{obj_color}]{comparison['diff']['objects']:+d} {obj_change}[/{obj_color}]"
        )
        
        console.print(table)
        
        console.print("")
        console.print("[bold]内存变化摘要:[/bold]")
        
        diff_size = comparison["diff"]["size"]
        diff_objects = comparison["diff"]["objects"]
        
        if diff_size > 0:
            print_warning(f"内存增长了 {format_size(diff_size)} ({diff_objects:+d} 个对象)")
        elif diff_size < 0:
            print_success(f"内存减少了 {format_size(abs(diff_size))} ({diff_objects:+d} 个对象)")
        else:
            print_info("内存大小没有变化")
        
    except DataFormatError as e:
        print_error(str(e))
        sys.exit(1)
    except Exception as e:
        print_error(f"比较失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option("--format", "-f", type=click.Choice(["markdown", "json"]),
              default="markdown",
              help="输出格式 (默认: markdown)")
@click.option("--output", "-o", type=click.Path(),
              help="输出文件路径")
@click.option("--latest", "-l", is_flag=True, default=False,
              help="使用最近一次分析结果")
@click.option("--analysis-id", "-a", type=str,
              help="指定分析ID")
@click.pass_context
def export(ctx: click.Context, format: str, output: Optional[str],
           latest: bool, analysis_id: Optional[str]):
    """
    导出分析报告
    
    将分析结果导出为Markdown或JSON格式的报告。
    使用 --latest 导出最近一次分析的结果。
    """
    config = get_config(ctx)
    verbose = ctx.obj.get("verbose", False)
    db = get_db(ctx)
    
    console.print(Panel.fit(
        f"[bold cyan]导出分析报告 ({format})[/bold cyan]",
        border_style="cyan"
    ))
    
    try:
        target_analysis_id = None
        
        if analysis_id:
            if verbose:
                print_info(f"使用指定的分析ID: {analysis_id}")
            analysis_data = db.get_analysis(analysis_id)
            if not analysis_data:
                raise NoAnalysisError(analysis_id)
            target_analysis_id = analysis_id
        elif latest:
            if verbose:
                print_info("获取最近一次分析结果...")
            analysis_data = db.get_latest_analysis()
            if not analysis_data:
                raise NoAnalysisError()
            target_analysis_id = analysis_data["id"]
        else:
            analyses = db.get_all_analyses()
            if not analyses:
                raise NoAnalysisError()
            
            console.print("")
            console.print("[bold]可用的分析记录:[/bold]")
            console.print("")
            
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("#", style="dim", width=3)
            table.add_column("分析ID", style="cyan")
            table.add_column("时间")
            table.add_column("状态")
            
            for i, analysis in enumerate(analyses[:10], 1):
                table.add_row(
                    str(i),
                    analysis["id"][:8] + "...",
                    analysis.get("timestamp", "未知"),
                    analysis.get("status", "unknown")
                )
            
            console.print(table)
            
            console.print("")
            console.print("使用 --analysis-id 指定要导出的分析，或使用 --latest 导出最近一次")
            return
        
        if verbose:
            print_info(f"加载分析数据: {target_analysis_id}")
        
        suspects_data = db.get_suspects(target_analysis_id)
        cycles_data = db.get_cycles(target_analysis_id)
        analysis_data = db.get_analysis(target_analysis_id) or {}
        
        suspects = []
        for sd in suspects_data:
            try:
                severity = LeakSeverity(sd["severity"])
            except ValueError:
                severity = LeakSeverity.INFO
            
            try:
                issue_type = IssueType(sd["issue_type"])
            except ValueError:
                issue_type = IssueType.LARGE_OBJECT
            
            suspect = LeakSuspect(
                suspect_id=sd["id"],
                obj_id=sd["obj_id"],
                obj_type=sd["obj_type"],
                issue_type=issue_type,
                severity=severity,
                size=sd["size"] or 0,
                evidence=json.loads(sd["evidence"]) if sd.get("evidence") else [],
                suggestions=json.loads(sd["suggestions"]) if sd.get("suggestions") else [],
                reference_chain=json.loads(sd["reference_chain"]) if sd.get("reference_chain") else [],
            )
            suspects.append(suspect)
        
        cycles = []
        for cd in cycles_data:
            cycle = CycleReference(
                cycle_id=cd["id"],
                objects=json.loads(cd["objects"]) if cd.get("objects") else [],
                size=cd["size"] or 0,
                has_del=bool(cd["has_del"]),
                is_uncollectable=bool(cd["is_uncollectable"]),
                evidence=cd.get("evidence") or "",
            )
            cycles.append(cycle)
        
        summary = json.loads(analysis_data.get("summary") or "{}")
        
        result = AnalysisResult(
            analysis_id=target_analysis_id,
            timestamp=datetime.fromisoformat(analysis_data["timestamp"]) if analysis_data.get("timestamp") else datetime.now(),
            status=analysis_data.get("status", "unknown"),
            summary=summary,
            suspects=suspects,
            cycles=cycles,
            error_message=analysis_data.get("error_message") or "",
        )
        
        if format == "json":
            exporter = JsonExporter(result)
            content = exporter.export()
        else:
            exporter = MarkdownExporter(result)
            content = exporter.export()
        
        if output:
            output_path = output
        else:
            timestamp = generate_timestamp()
            ext = ".json" if format == "json" else ".md"
            output_path = os.path.join(
                config.output_dir,
                f"memory_report_{timestamp}{ext}"
            )
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        print_success(f"报告已导出到: {output_path}")
        
        if verbose:
            summary = result.summary or {}
            console.print("")
            console.print("[bold]报告摘要:[/bold]")
            console.print(f"  - 嫌疑对象: {summary.get('total_suspects', 0)} 个")
            console.print(f"  - 循环引用: {summary.get('total_cycles', 0)} 个")
            console.print(f"  - 风险等级: {summary.get('risk_level', '未知')}")
        
    except NoAnalysisError as e:
        print_error(str(e))
        console.print("提示: 请先运行 'memprofiler analyze' 进行分析")
        sys.exit(1)
    except Exception as e:
        print_error(f"导出失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
