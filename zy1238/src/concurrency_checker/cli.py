"""Python 并发方案体检 CLI 主入口"""

import click
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown

from .analyzer import PlanAnalyzer, compare_analyses
from .database import AnalysisDB
from .exporter import export_to_markdown, export_to_json


console = Console()
db = AnalysisDB()


@click.group()
@click.version_option()
def main():
    """Python 并发方案体检 CLI 工具

    帮助团队在多线程、多进程、asyncio 之间做选型和复盘。
    """
    pass


@main.command()
@click.option('--output', '-o', default='.', help='输出目录路径')
@click.option('--type', '-t', 'plan_type', 
              type=click.Choice(['threading', 'multiprocessing', 'asyncio', 'all']),
              default='all', help='生成哪种类型的样例')
def init(output, plan_type):
    """初始化并生成样例文件

    创建 concurrency-plan.yaml、runs.jsonl 和 snippets/ 目录及其示例文件。
    """
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    snippets_dir = output_path / "snippets"
    snippets_dir.mkdir(exist_ok=True)
    
    # 创建计划文件
    plan_file = output_path / "concurrency-plan.yaml"
    _create_plan_file(plan_file, plan_type)
    
    # 创建运行记录文件
    runs_file = output_path / "runs.jsonl"
    _create_runs_file(runs_file, plan_type)
    
    # 创建代码片段
    _create_snippets(snippets_dir, plan_type)
    
    console.print(Panel.fit(
        f"[green]✓ 样例文件已生成到: {output_path}[/green]\n"
        f"  - {plan_file}\n"
        f"  - {runs_file}\n"
        f"  - {snippets_dir}/\n\n"
        "[yellow]提示: 运行 'concurrency-checker analyze' 来分析这些样例[/yellow]",
        title="初始化完成"
    ))


def _create_plan_file(plan_file: Path, plan_type: str):
    """创建计划配置文件"""
    plan_content = """# 并发方案配置文件
# 用于描述当前项目的并发方案设计

# 项目基本信息
project:
  name: "示例并发项目"
  description: "用于演示 concurrency-checker 的功能"
  version: "1.0.0"

# 并发类型选择
# 可选值: threading, multiprocessing, asyncio, mixed
concurrency_type: "threading"

# 任务类型
# 可选值: cpu_bound (CPU 密集型), io_bound (I/O 密集型), mixed
task_type: "io_bound"

# 工作进程/线程数量
workers: 4

# 预期任务量
expected_tasks: 100

# 依赖的库
dependencies:
  - name: "requests"
    purpose: "HTTP 请求"
  - name: "aiohttp"
    purpose: "异步 HTTP 请求 (如使用 asyncio)"

# 已知约束
constraints:
  - "需要保持与 Python 3.8 的兼容性"
  - "内存限制: 单个进程不超过 512MB"

# 预期指标
metrics:
  expected_latency_ms: 100
  expected_throughput_qps: 50
  max_cpu_usage_percent: 80
"""
    
    if plan_type == "multiprocessing":
        plan_content = plan_content.replace('concurrency_type: "threading"', 'concurrency_type: "multiprocessing"')
        plan_content = plan_content.replace('task_type: "io_bound"', 'task_type: "cpu_bound"')
    elif plan_type == "asyncio":
        plan_content = plan_content.replace('concurrency_type: "threading"', 'concurrency_type: "asyncio"')
        plan_content = plan_content.replace('task_type: "io_bound"', 'task_type: "io_bound"')
    
    with open(plan_file, 'w', encoding='utf-8') as f:
        f.write(plan_content)


def _create_runs_file(runs_file: Path, plan_type: str):
    """创建运行记录文件"""
    runs = [
        {
            "run_id": "run_001",
            "timestamp": datetime.now().isoformat(),
            "concurrency_type": "threading",
            "workers": 4,
            "task_count": 100,
            "total_time_sec": 12.5,
            "avg_latency_ms": 450,
            "throughput_qps": 8,
            "cpu_usage": 65,
            "io_usage": 85,
            "memory_usage_mb": 120,
            "success_count": 98,
            "error_count": 2
        },
        {
            "run_id": "run_002",
            "timestamp": datetime.now().isoformat(),
            "concurrency_type": "threading",
            "workers": 8,
            "task_count": 100,
            "total_time_sec": 8.2,
            "avg_latency_ms": 520,
            "throughput_qps": 12,
            "cpu_usage": 78,
            "io_usage": 92,
            "memory_usage_mb": 180,
            "success_count": 95,
            "error_count": 5
        }
    ]
    
    with open(runs_file, 'w', encoding='utf-8') as f:
        for run in runs:
            f.write(json.dumps(run, ensure_ascii=False) + '\n')


def _create_snippets(snippets_dir: Path, plan_type: str):
    """创建代码片段"""
    
    # 多线程示例
    threading_code = '''"""多线程示例 - I/O 密集型任务"""

import threading
import requests
import time
from concurrent.futures import ThreadPoolExecutor


def fetch_url(url: str) -> dict:
    """获取 URL 内容"""
    try:
        # 使用阻塞的 requests 库（在多线程中是允许的）
        response = requests.get(url, timeout=10)
        return {
            "url": url,
            "status": response.status_code,
            "length": len(response.text)
        }
    except Exception as e:
        return {
            "url": url,
            "error": str(e)
        }


def main_threading():
    """使用线程池"""
    urls = [
        "https://example.com/page1",
        "https://example.com/page2",
        "https://example.com/page3",
    ]
    
    # 使用 ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(fetch_url, urls))
    
    for result in results:
        print(result)
    
    return results


if __name__ == "__main__":
    main_threading()
'''
    
    # 多进程示例（包含一些问题）
    multiprocessing_code = '''"""多进程示例 - CPU 密集型任务"""

import multiprocessing
from multiprocessing import Pool
import time

# 问题：在多进程中使用全局变量
counter = 0


def process_data(data: int) -> int:
    """处理数据（CPU 密集型）"""
    global counter
    counter += 1  # 问题：全局变量在多进程中不会正确共享
    
    result = 0
    for i in range(10000):
        result += (data * i) % 1000
    
    return result


# 问题：使用 lambda 函数（无法被 pickle）
bad_lambda = lambda x: x * 2


def bad_process_data(data):
    """另一个问题函数"""
    return bad_lambda(data)


def main_multiprocessing():
    """主函数"""
    data_list = list(range(100))
    
    # 问题：使用 Pool 但没有设置 chunksize
    with Pool(processes=4) as pool:
        # 问题：尝试使用 lambda
        # results = pool.map(lambda x: x * 2, data_list)  # 这会失败
        results = pool.map(process_data, data_list)
    
    print(f"处理了 {len(results)} 个数据项")
    print(f"counter: {counter}")  # 这会显示 0，因为进程间不共享内存
    
    return results


if __name__ == "__main__":
    main_multiprocessing()
'''
    
    # asyncio 示例（包含一些问题）
    asyncio_code = '''"""asyncio 示例 - 包含一些问题"""

import asyncio
import time
import requests


async def good_async_task():
    """正确的异步任务"""
    await asyncio.sleep(0.1)  # 正确：使用 asyncio.sleep
    return "done"


async def bad_async_task():
    """有问题的异步任务"""
    # 问题：在 asyncio 中使用阻塞的 time.sleep
    time.sleep(0.1)  # 这会阻塞整个事件循环！
    return "bad"


async def fetch_with_requests():
    """使用阻塞的 HTTP 请求"""
    # 问题：在 asyncio 中使用 requests（阻塞）
    response = requests.get("https://example.com")  # 阻塞调用！
    return response.status_code


async def long_running_task():
    """长期运行的任务，没有超时"""
    # 问题：没有设置超时
    while True:
        await asyncio.sleep(1)


async def main_asyncio():
    """主异步函数"""
    # 问题：创建任务但没有设置超时
    task1 = asyncio.create_task(long_running_task())
    task2 = asyncio.create_task(bad_async_task())
    
    # 问题：gather 没有超时
    results = await asyncio.gather(task1, task2, return_exceptions=True)
    
    print(results)
    return results


if __name__ == "__main__":
    asyncio.run(main_asyncio())
'''
    
    # 共享状态示例
    shared_state_code = '''"""共享状态示例 - 包含锁竞争问题"""

import threading
import multiprocessing
from multiprocessing import Manager, Value, Array


# 问题：多进程中使用普通的 Lock
lock = threading.Lock()  # 这在多进程中不起作用！

shared_value = 0


def increment_bad():
    """错误的共享变量更新方式"""
    global shared_value
    # 问题：没有锁保护
    for _ in range(1000):
        shared_value += 1  # 竞态条件！


def increment_with_lock_bad():
    """使用错误的锁"""
    global shared_value
    with lock:  # threading.Lock 在多进程中无效
        for _ in range(1000):
            shared_value += 1


def increment_with_manager(shared_dict, lock):
    """使用 Manager（正确的方式）"""
    for _ in range(1000):
        with lock:
            shared_dict['count'] += 1


class Counter:
    """计数器类"""
    
    def __init__(self):
        self.value = 0
        self.lock = threading.Lock()  # 问题：threading.Lock
    
    def increment(self):
        with self.lock:
            self.value += 1
    
    # 问题：实例方法不能被 multiprocessing.Pool 直接 pickle
    def process_item(self, item):
        return item * 2


def main_shared_state():
    """主函数"""
    # 演示多线程中的锁问题
    threads = []
    for _ in range(10):
        t = threading.Thread(target=increment_bad)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    print(f"最终值 (预期 10000): {shared_value}")  # 可能小于 10000
    
    # 演示多进程
    with Manager() as manager:
        shared_dict = manager.dict({'count': 0})
        lock = manager.Lock()
        
        processes = []
        for _ in range(10):
            p = multiprocessing.Process(
                target=increment_with_manager,
                args=(shared_dict, lock)
            )
            processes.append(p)
            p.start()
        
        for p in processes:
            p.join()
        
        print(f"Manager 共享字典值: {shared_dict['count']}")


if __name__ == "__main__":
    main_shared_state()
'''
    
    # 队列示例
    queue_code = '''"""队列示例 - 包含背压问题"""

import queue
import threading
import asyncio


def producer_bad(q: queue.Queue, items: int):
    """问题：无界队列，生产者远快于消费者"""
    for i in range(items):
        # 问题：无界队列，可能导致内存耗尽
        q.put(i)  # 永远不会阻塞
    
    # 问题：没有发送结束信号


def consumer_bad(q: queue.Queue):
    """有问题的消费者"""
    while True:
        item = q.get()
        # 问题：没有调用 task_done()
        # q.task_done()  # 缺失！
        print(f"处理: {item}")
        # 问题：没有退出条件


async def async_producer_bad(q: asyncio.Queue):
    """异步生产者问题"""
    # 问题：无界队列
    for i in range(10000):
        await q.put(i)  # 无界队列，不会阻塞


async def async_consumer_bad(q: asyncio.Queue):
    """异步消费者"""
    while True:
        item = await q.get()
        # 问题：没有处理异常
        # 问题：没有调用 q.task_done()
        print(f"处理: {item}")


def main_queue():
    """主函数"""
    # 问题：无界队列
    q = queue.Queue()  # 没有设置 maxsize！
    
    # 启动生产者
    producer_thread = threading.Thread(
        target=producer_bad,
        args=(q, 100000)
    )
    producer_thread.start()
    
    # 启动消费者
    consumer_thread = threading.Thread(
        target=consumer_bad,
        args=(q,)
    )
    consumer_thread.start()
    
    # 问题：没有 join 队列
    # q.join()  # 不会完成，因为没有 task_done
    
    print("程序可能永远运行...")


if __name__ == "__main__":
    main_queue()
'''
    
    # 写入文件
    with open(snippets_dir / "01_threading_good.py", 'w', encoding='utf-8') as f:
        f.write(threading_code)
    
    with open(snippets_dir / "02_multiprocessing_bad.py", 'w', encoding='utf-8') as f:
        f.write(multiprocessing_code)
    
    with open(snippets_dir / "03_asyncio_bad.py", 'w', encoding='utf-8') as f:
        f.write(asyncio_code)
    
    with open(snippets_dir / "04_shared_state.py", 'w', encoding='utf-8') as f:
        f.write(shared_state_code)
    
    with open(snippets_dir / "05_queue_backpressure.py", 'w', encoding='utf-8') as f:
        f.write(queue_code)


@main.command()
@click.option('--plan', '-p', default='concurrency-plan.yaml',
              help='计划文件路径 (默认: concurrency-plan.yaml)')
@click.option('--runs', '-r', default='runs.jsonl',
              help='运行记录文件路径 (默认: runs.jsonl)')
@click.option('--snippets', '-s', default='snippets',
              help='代码片段目录路径 (默认: snippets)')
@click.option('--save', is_flag=True, help='保存分析结果到数据库')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def analyze(plan, runs, snippets, save, verbose):
    """分析并发方案

    读取 concurrency-plan.yaml、runs.jsonl 和 snippets/*.py，
    判断 CPU/I/O 占比、共享状态、pickle/IPC 成本、锁竞争、
    进程池 chunk、async 阻塞调用、取消超时和队列背压问题。
    """
    plan_path = Path(plan)
    runs_path = Path(runs)
    snippets_path = Path(snippets)
    
    # 检查文件是否存在
    if not plan_path.exists():
        console.print(f"[red]错误: 计划文件不存在: {plan_path}[/red]")
        console.print("[yellow]提示: 运行 'concurrency-checker init' 生成样例文件[/yellow]")
        return
    
    analyzer = PlanAnalyzer()
    
    with console.status("[cyan]正在分析并发方案..."):
        result = analyzer.analyze_plan(
            plan_file=plan_path,
            runs_file=runs_path if runs_path.exists() else None,
            snippets_dir=snippets_path if snippets_path.exists() else None
        )
    
    # 显示结果
    _display_analysis_result(result, verbose)
    
    # 保存到数据库
    if save:
        analysis_id = db.save_analysis(result)
        console.print(f"\n[green]✓ 分析结果已保存，ID: {analysis_id}[/green]")


def _display_analysis_result(result: dict, verbose: bool):
    """显示分析结果"""
    
    # 摘要
    console.print(Panel.fit(
        result["summary"],
        title="分析摘要",
        style="cyan"
    ))
    
    # 指标表格
    if result.get("metrics"):
        table = Table(title="关键指标")
        table.add_column("指标名称", style="cyan")
        table.add_column("值", style="green")
        table.add_column("单位", style="yellow")
        
        for metric in result["metrics"]:
            table.add_row(
                metric["name"],
                str(metric["value"]),
                metric["unit"]
            )
        
        console.print(table)
    
    # 风险展示
    if result.get("risks"):
        console.print("\n[bold red]⚠️  风险检测:[/bold red]")
        
        # 按严重程度分组
        critical_risks = [r for r in result["risks"] if r.level.value == "critical"]
        high_risks = [r for r in result["risks"] if r.level.value == "high"]
        medium_risks = [r for r in result["risks"] if r.level.value == "medium"]
        low_risks = [r for r in result["risks"] if r.level.value == "low"]
        
        # 显示严重风险
        if critical_risks:
            console.print(f"\n[bold bright_red]🔥 严重风险 ({len(critical_risks)} 项):[/bold bright_red]")
            for risk in critical_risks:
                console.print(f"  [bright_red]•[/bright_red] {risk.message}")
                console.print(f"    [yellow]建议: {risk.suggestion}[/yellow]")
        
        # 显示高风险
        if high_risks:
            console.print(f"\n[bold red]❌ 高风险 ({len(high_risks)} 项):[/bold red]")
            for risk in high_risks:
                console.print(f"  [red]•[/red] {risk.message}")
                console.print(f"    [yellow]建议: {risk.suggestion}[/yellow]")
        
        # 显示中等风险
        if medium_risks:
            console.print(f"\n[bold yellow]⚠️  中等风险 ({len(medium_risks)} 项):[/bold yellow]")
            for risk in medium_risks:
                console.print(f"  [yellow]•[/yellow] {risk.message}")
                console.print(f"    [dim]建议: {risk.suggestion}[/dim]")
        
        # 显示低风险
        if low_risks and verbose:
            console.print(f"\n[dim]ℹ️  低风险 ({len(low_risks)} 项):[/dim]")
            for risk in low_risks:
                console.print(f"  [dim]• {risk.message}[/dim]")
                console.print(f"    [dim]建议: {risk.suggestion}[/dim]")
    else:
        console.print("\n[green]✓ 未检测到风险[/green]")
    
    # 详细信息
    if verbose:
        console.print("\n[bold cyan]📊 详细分析:[/bold cyan]")
        
        if result.get("snippets_analysis"):
            console.print(f"\n代码片段分析 ({result['snippet_count']} 个):")
            for snippet in result["snippets_analysis"]:
                ctype = snippet.get("concurrency_type")
                if hasattr(ctype, "value"):
                    ctype = ctype.value
                
                console.print(f"  • {snippet['file_name']}: {ctype}")
                console.print(f"    CPU 占比: {snippet['cpu_intensity']:.1%}, I/O 占比: {snippet['io_intensity']:.1%}")
                if snippet.get("patterns"):
                    console.print(f"    检测到的模式: {', '.join(snippet['patterns'])}")


@main.command()
@click.argument('id1', type=int)
@click.argument('id2', type=int)
@click.option('--save', is_flag=True, help='保存对比结果')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def compare(id1, id2, save, verbose):
    """对比两套方案

    对比数据库中两次分析记录的差异和优劣。
    
    ID1: 第一次分析的 ID
    ID2: 第二次分析的 ID
    """
    # 获取两次分析
    analysis1 = db.get_analysis(id1)
    analysis2 = db.get_analysis(id2)
    
    if analysis1 is None:
        console.print(f"[red]错误: 分析记录不存在: {id1}[/red]")
        return
    
    if analysis2 is None:
        console.print(f"[red]错误: 分析记录不存在: {id2}[/red]")
        return
    
    # 进行对比
    comparison = compare_analyses(
        analysis1.get("raw_data", analysis1),
        analysis2.get("raw_data", analysis2)
    )
    
    # 显示对比结果
    _display_comparison(analysis1, analysis2, comparison, verbose)


def _display_comparison(a1: dict, a2: dict, comparison: dict, verbose: bool):
    """显示对比结果"""
    
    console.print(Panel.fit(
        f"方案 1 (ID: {a1.get('id')}) vs 方案 2 (ID: {a2.get('id')})",
        title="方案对比",
        style="cyan"
    ))
    
    # 基本信息对比表
    table = Table(title="基本信息对比")
    table.add_column("属性", style="cyan")
    table.add_column("方案 1", style="blue")
    table.add_column("方案 2", style="green")
    
    table.add_row("ID", str(a1.get("id")), str(a2.get("id")))
    table.add_row("并发类型", a1.get("concurrency_type", "N/A"), a2.get("concurrency_type", "N/A"))
    table.add_row("CPU 占比", f"{a1.get('cpu_percent', 0)*100:.1f}%", f"{a2.get('cpu_percent', 0)*100:.1f}%")
    table.add_row("I/O 占比", f"{a1.get('io_percent', 0)*100:.1f}%", f"{a2.get('io_percent', 0)*100:.1f}%")
    table.add_row("风险分数", str(a1.get("risk_score", 0)), str(a2.get("risk_score", 0)))
    table.add_row("运行记录数", str(a1.get("run_count", 0)), str(a2.get("run_count", 0)))
    table.add_row("代码片段数", str(a1.get("snippet_count", 0)), str(a2.get("snippet_count", 0)))
    
    console.print(table)
    
    # 改进点
    if comparison.get("improvements"):
        console.print("\n[bold green]✅ 改进点:[/bold green]")
        for imp in comparison["improvements"]:
            console.print(f"  • {imp['metric']}: {imp['from']} → {imp['to']} (改进 {imp['improvement']})")
    
    # 退步点
    if comparison.get("regressions"):
        console.print("\n[bold red]❌ 退步点:[/bold red]")
        for reg in comparison["regressions"]:
            console.print(f"  • {reg['metric']}: {reg['from']} → {reg['to']} (退步 {reg['regression']})")
    
    # 差异点
    if comparison.get("differences"):
        console.print("\n[bold yellow]📊 差异点:[/bold yellow]")
        for diff in comparison["differences"]:
            val1 = diff.get("value1", "N/A")
            val2 = diff.get("value2", "N/A")
            console.print(f"  • {diff['metric']}: {val1} → {val2}")
    
    # 推荐
    if comparison.get("recommendation"):
        console.print(f"\n[bold magenta]💡 推荐: {comparison['recommendation']}[/bold magenta]")


@main.command()
@click.argument('analysis_id', type=int, required=False)
@click.option('--format', '-f', 'export_format',
              type=click.Choice(['markdown', 'json']),
              default='markdown', help='导出格式 (默认: markdown)')
@click.option('--output', '-o', help='输出文件路径')
@click.option('--list', '-l', 'list_analyses', is_flag=True, help='列出所有分析记录')
@click.option('--limit', '-n', default=10, help='列出记录的数量 (默认: 10)')
def export(analysis_id, export_format, output, list_analyses, limit):
    """导出分析报告

    将分析结果导出为 Markdown 或 JSON 格式。
    
    用法:
      concurrency-checker export --list          # 列出所有分析记录
      concurrency-checker export 1                # 导出 ID 为 1 的分析为 Markdown
      concurrency-checker export 1 -f json        # 导出为 JSON 格式
      concurrency-checker export 1 -o report.md   # 导出到指定文件
    """
    # 列出分析记录
    if list_analyses:
        analyses = db.list_analyses(limit)
        
        if not analyses:
            console.print("[yellow]数据库中没有分析记录[/yellow]")
            console.print("[dim]提示: 运行 'concurrency-checker analyze --save' 来保存分析[/dim]")
            return
        
        table = Table(title="分析记录列表")
        table.add_column("ID", style="cyan")
        table.add_column("时间", style="green")
        table.add_column("并发类型", style="yellow")
        table.add_column("风险分数", style="red")
        table.add_column("运行记录", style="blue")
        table.add_column("代码片段", style="magenta")
        
        for a in analyses:
            table.add_row(
                str(a["id"]),
                a["timestamp"][:19],  # 截断日期时间
                a["concurrency_type"],
                str(a["risk_score"]),
                str(a["run_count"]),
                str(a["snippet_count"])
            )
        
        console.print(table)
        return
    
    # 导出指定分析
    if analysis_id is None:
        console.print("[red]错误: 请指定要导出的分析 ID[/red]")
        console.print("[yellow]提示: 使用 '--list' 查看所有分析记录[/yellow]")
        return
    
    analysis = db.get_analysis(analysis_id)
    
    if analysis is None:
        console.print(f"[red]错误: 分析记录不存在: {analysis_id}[/red]")
        return
    
    # 生成输出
    if export_format == "markdown":
        content = export_to_markdown(analysis)
        default_ext = ".md"
    else:
        content = export_to_json(analysis)
        default_ext = ".json"
    
    # 确定输出路径
    if output is None:
        output = f"analysis_{analysis_id}{default_ext}"
    
    # 写入文件
    with open(output, 'w', encoding='utf-8') as f:
        f.write(content)
    
    console.print(f"[green]✓ 报告已导出到: {output}[/green]")
    
    # 显示 Markdown 预览
    if export_format == "markdown":
        console.print("\n[bold cyan]报告预览:[/bold cyan]")
        console.print(Markdown(content[:2000]))


@main.command()
@click.argument('analysis_id', type=int)
def delete(analysis_id):
    """删除分析记录

    从数据库中删除指定的分析记录。
    """
    if db.delete_analysis(analysis_id):
        console.print(f"[green]✓ 分析记录 {analysis_id} 已删除[/green]")
    else:
        console.print(f"[red]错误: 分析记录不存在: {analysis_id}[/red]")


@main.command()
@click.argument('analysis_id', type=int)
def show(analysis_id):
    """显示分析记录详情

    显示指定分析记录的完整信息。
    """
    analysis = db.get_analysis(analysis_id)
    
    if analysis is None:
        console.print(f"[red]错误: 分析记录不存在: {analysis_id}[/red]")
        return
    
    # 使用 analyze 命令的显示逻辑
    _display_analysis_result(analysis.get("raw_data", analysis), verbose=True)


if __name__ == "__main__":
    main()