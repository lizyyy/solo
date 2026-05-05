import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
from rich.prompt import Prompt, Confirm
from rich.markdown import Markdown

from perf_trainer.config import Config
from perf_trainer.storage import Database
from perf_trainer.engine import TroubleshootingEngine
from perf_trainer.exceptions import (
    PerfTrainerError,
    IncidentNotFoundError,
    InvalidIncidentFormatError,
    SampleNotFoundError,
    InvalidStageError,
    SessionNotFoundError,
    DatabaseError,
    ExportError
)


console = Console()


@click.group()
@click.version_option(version=Config.APP_VERSION, prog_name='perf-trainer')
@click.option('--data-dir', type=click.Path(), help='数据存储目录 (默认: ~/.perf_trainer)')
@click.pass_context
def main(ctx, data_dir):
    """
    Linux 性能排障练习工具
    
    帮助新同事掌握 Linux 性能分析技能，通过模拟真实场景进行演练。
    """
    ctx.ensure_object(dict)
    if data_dir:
        ctx.obj['data_dir'] = Path(data_dir)
    else:
        ctx.obj['data_dir'] = Config.DEFAULT_DATA_DIR
    
    # 确保数据目录存在
    Config.ensure_data_dir(ctx.obj['data_dir'])


@main.command()
@click.argument('incident_path', type=click.Path(exists=True, file_okay=False))
@click.option('--resume', '-r', type=int, help='恢复指定 ID 的会话')
@click.pass_context
def start(ctx, incident_path, resume):
    """
    开始一次性能排障演练
    
    INCIDENT_PATH: 包含 incident.yaml 和 samples 目录的事件目录路径
    
    示例:
        perf-trainer start ./incidents/cpu-high-01
        perf-trainer start ./incidents/io-wait-01 --resume 5
    """
    incident_dir = Path(incident_path)
    
    try:
        # 初始化排障引擎
        db = Database(Config.get_db_path(ctx.obj['data_dir']))
        engine = TroubleshootingEngine(incident_dir, db)
        
        # 显示事件信息
        incident_data = engine.incident_data
        console.print(Panel(
            f"[bold green]{incident_data.get('name', '未命名事件')}[/bold green]\n\n"
            f"难度: {incident_data.get('difficulty', 'medium')}\n"
            f"阶段: {', '.join(s['name'] for s in incident_data.get('stages', []))}\n\n"
            f"{incident_data.get('description', '无描述')}",
            title="排障事件",
            expand=False
        ))
        
        # 开始或恢复会话
        if resume:
            console.print(f"\n[cyan]恢复会话 {resume}...[/cyan]")
            engine.resume_session(resume)
        else:
            session_id = engine.start_session()
            console.print(f"\n[green]新会话已开始，ID: {session_id}[/green]")
        
        # 交互式排障
        _run_interactive_troubleshooting(engine)
        
    except IncidentNotFoundError as e:
        console.print(f"[red]错误:[/red] {e}")
        console.print("\n[yellow]提示:[/yellow] 确保目录结构如下:")
        console.print("  incident_path/")
        console.print("    ├── incident.yaml")
        console.print("    └── samples/")
        console.print("        ├── top_output.txt")
        console.print("        └── ...")
        ctx.exit(1)
    except InvalidIncidentFormatError as e:
        console.print(f"[red]incident.yaml 格式错误:[/red]")
        console.print(f"  字段: {e.field if e.field else '未知'}")
        console.print(f"  问题: {e.message}")
        ctx.exit(1)
    except SampleNotFoundError as e:
        console.print(f"[red]样本文件错误:[/red] {e}")
        ctx.exit(1)
    except PerfTrainerError as e:
        console.print(f"[red]错误:[/red] {e}")
        ctx.exit(1)


def _run_interactive_troubleshooting(engine: TroubleshootingEngine):
    """运行交互式排障流程"""
    
    stages_order = engine.get_stages_order()
    
    while True:
        current_stage = engine.get_current_stage()
        
        if current_stage is None:
            # 所有阶段完成
            console.print("\n[bold green]🎉 恭喜！您已完成所有排障阶段！[/bold green]")
            
            if Confirm.ask("是否结束本次演练并保存记录？", default=True):
                notes = Prompt.ask("请输入本次演练的总结（可选）", default="")
                engine.complete_session(notes)
                console.print(f"[green]会话 {engine.current_session_id} 已保存[/green]")
            break
        
        stage_index = stages_order.index(current_stage)
        
        # 显示当前阶段
        console.print(f"\n{'='*60}")
        console.print(f"[bold cyan]阶段 {stage_index + 1}/{len(stages_order)}: {_get_stage_name_cn(current_stage)}[/bold cyan]")
        console.print('='*60)
        
        # 获取此阶段的命令推荐
        recommendations = engine.get_command_recommendations(current_stage)
        
        console.print("\n[bold yellow]推荐的排查命令:[/bold yellow]")
        
        # 显示命令选项
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("#", style="dim", width=3)
        table.add_column("命令", style="green")
        table.add_column("描述")
        table.add_column("样本", style="cyan")
        
        for i, rec in enumerate(recommendations, 1):
            table.add_row(
                str(i),
                rec.command,
                rec.description,
                rec.sample_file or "无"
            )
        
        console.print(table)
        
        # 提供操作选项
        console.print("\n[bold]操作选项:[/bold]")
        console.print("  [数字] - 执行对应命令并查看输出")
        console.print("  info - 查看当前事件的更多信息")
        console.print("  stages - 查看所有阶段")
        console.print("  analysis - 输入你的分析，进入下一阶段")
        console.print("  next - 跳过此阶段（不推荐）")
        console.print("  quit - 退出演练")
        
        choice = Prompt.ask("\n请选择操作", default="1")
        
        if choice == 'quit':
            if Confirm.ask("确定要退出吗？会话将被保存，可稍后恢复。", default=True):
                console.print(f"[yellow]会话 {engine.current_session_id} 已保存，可使用 --resume 恢复[/yellow]")
                break
        
        elif choice == 'info':
            _show_incident_info(engine)
        
        elif choice == 'stages':
            _show_stages(engine)
        
        elif choice == 'next':
            if Confirm.ask("确定要跳过此阶段吗？这可能影响最终评估。", default=False):
                engine.current_stage_index += 1
                console.print(f"[yellow]已跳过 {current_stage} 阶段[/yellow]")
        
        elif choice == 'analysis':
            # 让用户输入分析
            console.print("\n[bold yellow]请输入你的分析:[/bold yellow]")
            console.print("  例如: 我发现进程 1234 的 CPU 使用率很高，可能是死循环...")
            console.print("  (输入完毕后按 Enter 两次，或输入空行结束)")
            
            lines = []
            while True:
                line = Prompt.ask("", default="", show_default=False)
                if not line:
                    break
                lines.append(line)
            
            user_analysis = '\n'.join(lines)
            
            if not user_analysis.strip():
                console.print("[red]分析内容不能为空[/red]")
                continue
            
            # 执行分析
            # 假设用户选择了第一个命令
            first_cmd = recommendations[0].command if recommendations else 'unknown'
            result = engine.analyze_choice(
                stage=current_stage,
                command_used=first_cmd,
                sample_viewed=recommendations[0].sample_file if recommendations else None,
                user_analysis=user_analysis
            )
            
            # 显示反馈
            console.print(f"\n{'='*60}")
            console.print("[bold]分析反馈:[/bold]")
            console.print('='*60)
            console.print(result.feedback)
            
            if result.is_correct:
                console.print("\n[green]✓ 分析正确！[/green]")
                engine.current_stage_index += 1
            else:
                console.print("\n[yellow]⚠ 分析需要改进，是否重试？[/yellow]")
                if not Confirm.ask("是否重新分析？", default=True):
                    engine.current_stage_index += 1
        
        else:
            # 选择执行命令
            try:
                cmd_index = int(choice) - 1
                if 0 <= cmd_index < len(recommendations):
                    rec = recommendations[cmd_index]
                    
                    console.print(f"\n[bold]执行命令: {rec.command}[/bold]")
                    console.print(f"[dim]为什么要看这个: {rec.why}[/dim]")
                    console.print(f"[dim]应该关注什么: {rec.what_to_look_for}[/dim]")
                    
                    # 获取输出
                    sample_file, output = engine.execute_command(rec.command, current_stage)
                    
                    if sample_file:
                        console.print(f"\n[cyan]样本文件: {sample_file}[/cyan]")
                    
                    # 显示输出
                    console.print(Panel(
                        Syntax(output, "text", theme="monokai", line_numbers=True),
                        title=f"{rec.command} 输出",
                        expand=False
                    ))
                    
                    # 显示异常迹象
                    if rec.anomaly_signs:
                        console.print("\n[bold yellow]⚠  可能的异常迹象:[/bold yellow]")
                        for sign in rec.anomaly_signs:
                            console.print(f"  • {sign}")
                    
                else:
                    console.print(f"[red]无效的选项: {choice}[/red]")
            except ValueError:
                console.print(f"[red]无效的输入: {choice}[/red]")


def _get_stage_name_cn(stage: str) -> str:
    """获取阶段的中文名称"""
    names = {
        'cpu': 'CPU 分析',
        'io': 'IO 分析',
        'network': '网络分析',
        'syscall': '系统调用分析',
        'hot_function': '热点函数分析'
    }
    return names.get(stage, stage)


def _show_incident_info(engine: TroubleshootingEngine):
    """显示事件信息"""
    data = engine.incident_data
    
    console.print("\n[bold]事件详情:[/bold]")
    console.print(f"  名称: {data.get('name', 'N/A')}")
    console.print(f"  难度: {data.get('difficulty', 'N/A')}")
    console.print(f"  描述: {data.get('description', 'N/A')}")
    console.print(f"  根本原因: {data.get('root_cause', '隐藏（完成后显示）')}")
    
    if engine.current_session_id:
        console.print(f"\n  会话 ID: {engine.current_session_id}")


def _show_stages(engine: TroubleshootingEngine):
    """显示所有阶段"""
    stages = engine.incident_data.get('stages', [])
    stages_order = engine.get_stages_order()
    current_index = engine.current_stage_index
    
    console.print("\n[bold]排障阶段:[/bold]")
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("#", style="dim", width=3)
    table.add_column("状态", width=10)
    table.add_column("阶段")
    table.add_column("命令数")
    
    for i, stage in enumerate(stages):
        stage_name = stage.get('name', f'stage_{i}')
        is_current = i == current_index
        is_past = i < current_index
        
        status = ""
        if is_current:
            status = "[cyan]当前[/cyan]"
        elif is_past:
            status = "[green]已完成[/green]"
        else:
            status = "[dim]待处理[/dim]"
        
        table.add_row(
            str(i + 1),
            status,
            _get_stage_name_cn(stage_name),
            str(len(stage.get('commands', [])))
        )
    
    console.print(table)


@main.command('list')
@click.option('--limit', '-n', type=int, default=20, help='显示的会话数量 (默认: 20)')
@click.pass_context
def list_sessions(ctx, limit):
    """
    列出历史演练会话
    
    示例:
        perf-trainer list
        perf-trainer list --limit 50
    """
    try:
        db = Database(Config.get_db_path(ctx.obj['data_dir']))
        sessions = db.list_sessions(limit)
        
        if not sessions:
            console.print("[yellow]暂无历史会话[/yellow]")
            return
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("ID", style="cyan")
        table.add_column("事件名称")
        table.add_column("状态")
        table.add_column("创建时间")
        table.add_column("完成时间")
        
        for sess in sessions:
            created = datetime.fromisoformat(sess['created_at']).strftime('%Y-%m-%d %H:%M')
            completed = datetime.fromisoformat(sess['completed_at']).strftime('%Y-%m-%d %H:%M') if sess['completed_at'] else '-'
            
            status_color = {
                'in_progress': 'cyan',
                'completed': 'green',
                'aborted': 'yellow'
            }.get(sess['status'], 'dim')
            
            table.add_row(
                str(sess['id']),
                sess['incident_name'] or '-',
                f"[{status_color}]{sess['status']}[/{status_color}]",
                created,
                completed
            )
        
        console.print(table)
        
    except DatabaseError as e:
        console.print(f"[red]数据库错误:[/red] {e}")
        ctx.exit(1)


@main.command()
@click.argument('session1', type=int)
@click.argument('session2', type=int)
@click.option('--output', '-o', type=click.Path(), help='导出对比结果到文件')
@click.pass_context
def compare(ctx, session1, session2, output):
    """
    对比两次排障路径
    
    SESSION1: 第一个会话 ID
    SESSION2: 第二个会话 ID
    
    示例:
        perf-trainer compare 5 7
        perf-trainer compare 5 7 --output comparison.md
    """
    try:
        db = Database(Config.get_db_path(ctx.obj['data_dir']))
        
        # 获取两个会话
        sess1 = db.get_session(session1)
        sess2 = db.get_session(session2)
        
        if not sess1:
            raise SessionNotFoundError(session1)
        if not sess2:
            raise SessionNotFoundError(session2)
        
        # 获取步骤
        steps1 = db.get_session_steps(session1)
        steps2 = db.get_session_steps(session2)
        
        console.print(f"\n[bold]对比会话 {session1} vs {session2}[/bold]")
        console.print('='*60)
        
        # 基本信息对比
        console.print("\n[bold]基本信息:[/bold]")
        table = Table(show_header=True)
        table.add_column("属性", style="dim")
        table.add_column(f"会话 {session1}")
        table.add_column(f"会话 {session2}")
        
        table.add_row("事件名称", sess1.get('incident_name', '-'), sess2.get('incident_name', '-'))
        table.add_row("状态", sess1.get('status', '-'), sess2.get('status', '-'))
        table.add_row("步骤数", str(len(steps1)), str(len(steps2)))
        table.add_row("正确率", 
            f"{sum(1 for s in steps1 if s['is_correct'])}/{len(steps1)}" if steps1 else "-",
            f"{sum(1 for s in steps2 if s['is_correct'])}/{len(steps2)}" if steps2 else "-"
        )
        
        console.print(table)
        
        # 详细步骤对比
        console.print("\n[bold]步骤详情对比:[/bold]")
        
        max_steps = max(len(steps1), len(steps2))
        
        for i in range(max_steps):
            step1 = steps1[i] if i < len(steps1) else None
            step2 = steps2[i] if i < len(steps2) else None
            
            stage = step1['stage'] if step1 else (step2['stage'] if step2 else f'step_{i+1}')
            
            console.print(f"\n  [bold]步骤 {i+1}: {_get_stage_name_cn(stage)}[/bold]")
            
            if step1:
                correct1 = "[green]✓[/green]" if step1['is_correct'] else "[red]✗[/red]"
                console.print(f"    会话 {session1}: {correct1} 使用了 {step1['command']}")
                if step1['feedback']:
                    console.print(f"      反馈: {step1['feedback'][:100]}..." if len(step1['feedback']) > 100 else f"      反馈: {step1['feedback']}")
            
            if step2:
                correct2 = "[green]✓[/green]" if step2['is_correct'] else "[red]✗[/red]"
                console.print(f"    会话 {session2}: {correct2} 使用了 {step2['command']}")
                if step2['feedback']:
                    console.print(f"      反馈: {step2['feedback'][:100]}..." if len(step2['feedback']) > 100 else f"      反馈: {step2['feedback']}")
        
        # 保存对比记录
        comparison_data = {
            'session1': {'id': session1, 'data': sess1, 'steps': steps1},
            'session2': {'id': session2, 'data': sess2, 'steps': steps2},
            'compared_at': datetime.now().isoformat()
        }
        
        db.save_comparison(session1, session2, json.dumps(comparison_data, default=str, ensure_ascii=False))
        
        # 导出到文件
        if output:
            output_path = Path(output)
            if output_path.suffix == '.json':
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(comparison_data, f, indent=2, default=str, ensure_ascii=False)
            else:
                # 默认 Markdown
                md_content = _generate_comparison_markdown(comparison_data)
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(md_content)
            
            console.print(f"\n[green]对比结果已导出到: {output_path}[/green]")
        
    except SessionNotFoundError as e:
        console.print(f"[red]错误:[/red] {e}")
        ctx.exit(1)
    except DatabaseError as e:
        console.print(f"[red]数据库错误:[/red] {e}")
        ctx.exit(1)


def _generate_comparison_markdown(data: Dict) -> str:
    """生成 Markdown 格式的对比报告"""
    s1 = data['session1']
    s2 = data['session2']
    
    lines = [
        "# 排障路径对比报告",
        "",
        f"**对比时间**: {data['compared_at']}",
        "",
        "## 基本信息",
        "",
        "| 属性 | 会话 {s1['id']} | 会话 {s2['id']} |",
        "|------|----------------|----------------|",
        f"| 事件名称 | {s1['data'].get('incident_name', '-')} | {s2['data'].get('incident_name', '-')} |",
        f"| 状态 | {s1['data'].get('status', '-')} | {s2['data'].get('status', '-')} |",
        f"| 步骤数 | {len(s1['steps'])} | {len(s2['steps'])} |",
        "",
        "## 步骤详情",
        ""
    ]
    
    max_steps = max(len(s1['steps']), len(s2['steps']))
    
    for i in range(max_steps):
        step1 = s1['steps'][i] if i < len(s1['steps']) else None
        step2 = s2['steps'][i] if i < len(s2['steps']) else None
        
        stage = step1['stage'] if step1 else (step2['stage'] if step2 else f'step_{i+1}')
        
        lines.extend([
            f"### 步骤 {i+1}: {_get_stage_name_cn(stage)}",
            ""
        ])
        
        if step1:
            status1 = "✓ 正确" if step1['is_correct'] else "✗ 需改进"
            lines.extend([
                f"**会话 {s1['id']}**: {status1}",
                f"- 使用命令: {step1['command']}",
                f"- 分析: {step1.get('user_choice', '无')[:200]}",
                f"- 反馈: {step1.get('feedback', '无')[:200]}",
                ""
            ])
        
        if step2:
            status2 = "✓ 正确" if step2['is_correct'] else "✗ 需改进"
            lines.extend([
                f"**会话 {s2['id']}**: {status2}",
                f"- 使用命令: {step2['command']}",
                f"- 分析: {step2.get('user_choice', '无')[:200]}",
                f"- 反馈: {step2.get('feedback', '无')[:200]}",
                ""
            ])
    
    return '\n'.join(lines)


@main.command()
@click.argument('session_id', type=int)
@click.option('--format', '-f', type=click.Choice(['markdown', 'json']), default='markdown',
              help='导出格式 (默认: markdown)')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.pass_context
def export(ctx, session_id, format, output):
    """
    导出排障复盘报告
    
    SESSION_ID: 要导出的会话 ID
    
    示例:
        perf-trainer export 5
        perf-trainer export 5 --format json
        perf-trainer export 5 --output report.md
    """
    try:
        db = Database(Config.get_db_path(ctx.obj['data_dir']))
        
        session = db.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)
        
        steps = db.get_session_steps(session_id)
        
        # 准备导出数据
        export_data = {
            'session_id': session_id,
            'incident_name': session.get('incident_name'),
            'incident_path': session.get('incident_path'),
            'status': session.get('status'),
            'created_at': session.get('created_at'),
            'completed_at': session.get('completed_at'),
            'notes': session.get('notes'),
            'steps': steps,
            'statistics': {
                'total_steps': len(steps),
                'correct_steps': sum(1 for s in steps if s['is_correct']),
                'stages_completed': list(set(s['stage'] for s in steps))
            }
        }
        
        # 生成内容
        if format == 'json':
            content = json.dumps(export_data, indent=2, default=str, ensure_ascii=False)
            default_ext = '.json'
        else:
            content = _generate_export_markdown(export_data)
            default_ext = '.md'
        
        # 输出
        if output:
            output_path = Path(output)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            console.print(f"[green]报告已导出到: {output_path}[/green]")
        else:
            # 显示到控制台
            if format == 'json':
                console.print(Syntax(content, "json", theme="monokai"))
            else:
                console.print(Markdown(content))
        
    except SessionNotFoundError as e:
        console.print(f"[red]错误:[/red] {e}")
        ctx.exit(1)
    except DatabaseError as e:
        console.print(f"[red]数据库错误:[/red] {e}")
        ctx.exit(1)


def _generate_export_markdown(data: Dict) -> str:
    """生成 Markdown 格式的复盘报告"""
    lines = [
        "# 性能排障复盘报告",
        "",
        f"**事件名称**: {data.get('incident_name', '未命名')}",
        f"**会话 ID**: {data.get('session_id')}",
        f"**状态**: {data.get('status', '未知')}",
        f"**创建时间**: {data.get('created_at', '-')}",
        f"**完成时间**: {data.get('completed_at', '-')}",
        "",
        "## 统计信息",
        "",
        f"- 总步骤数: {data['statistics']['total_steps']}",
        f"- 正确步骤数: {data['statistics']['correct_steps']}",
        f"- 正确率: {data['statistics']['correct_steps']}/{data['statistics']['total_steps']} ({data['statistics']['correct_steps']/data['statistics']['total_steps']*100:.1f}%)" if data['statistics']['total_steps'] > 0 else "- 正确率: N/A",
        f"- 完成阶段: {', '.join(data['statistics']['stages_completed'])}",
        "",
        "## 排障过程",
        ""
    ]
    
    for i, step in enumerate(data.get('steps', []), 1):
        status = "✓ 正确" if step['is_correct'] else "✗ 需改进"
        
        lines.extend([
            f"### 步骤 {i}: {_get_stage_name_cn(step['stage'])}",
            "",
            f"- **状态**: {status}",
            f"- **使用命令**: {step['command']}",
            f"- **查看样本**: {step.get('sample_viewed', '无')}",
            ""
        ])
        
        if step.get('user_choice'):
            lines.extend([
                f"- **你的分析**:",
                f"```",
                f"{step['user_choice']}",
                f"```",
                ""
            ])
        
        if step.get('feedback'):
            lines.extend([
                f"- **系统反馈**:",
                f"```",
                f"{step['feedback']}",
                f"```",
                ""
            ])
    
    if data.get('notes'):
        lines.extend([
            "## 总结",
            "",
            data['notes'],
            ""
        ])
    
    return '\n'.join(lines)


@main.command()
@click.argument('target_dir', type=click.Path(file_okay=False, writable=True))
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的目录')
@click.pass_context
def seed(ctx, target_dir, force):
    """
    创建样例事件目录结构
    
    TARGET_DIR: 目标目录路径
    
    示例:
        perf-trainer seed ./sample-incident
        perf-trainer seed ./sample-incident --force
    """
    target = Path(target_dir)
    
    if target.exists() and not force:
        console.print(f"[red]目录已存在: {target}[/red]")
        console.print("使用 --force 选项覆盖")
        ctx.exit(1)
    
    try:
        # 创建目录结构
        samples_dir = target / 'samples'
        samples_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建 incident.yaml
        incident_yaml = _create_sample_incident_yaml()
        with open(target / 'incident.yaml', 'w', encoding='utf-8') as f:
            f.write(incident_yaml)
        
        # 创建样本文件
        sample_files = _create_sample_files()
        for name, content in sample_files.items():
            with open(samples_dir / name, 'w', encoding='utf-8') as f:
                f.write(content)
        
        console.print(f"\n[green]样例事件已创建: {target}[/green]")
        console.print("\n[cyan]目录结构:[/cyan]")
        console.print(f"  {target}/")
        console.print(f"  ├── incident.yaml")
        console.print(f"  └── samples/")
        for name in sample_files.keys():
            console.print(f"      ├── {name}")
        
        console.print("\n[yellow]使用方法:[/yellow]")
        console.print(f"  perf-trainer start {target}")
        
    except Exception as e:
        console.print(f"[red]创建失败:[/red] {e}")
        ctx.exit(1)


def _create_sample_incident_yaml() -> str:
    """创建样例 incident.yaml"""
    return """name: CPU 使用率过高事件
description: |
  某 Web 服务器在高峰期响应缓慢，用户报告页面加载时间过长。
  初步观察发现 CPU 使用率持续在 90% 以上。

root_cause: |
  应用代码中存在一个无限循环的 bug，导致某个后台进程持续占用 CPU。
  同时，该进程还产生了大量的系统调用。

difficulty: medium

stages:
  - name: cpu
    description: 分析 CPU 使用情况
    commands:
      - name: top
        description: 实时显示进程活动
        sample: top_output.txt
        why: 最快速地定位高 CPU 进程
        what_to_look_for: 查看 %CPU 列，寻找持续高 CPU 的进程
        anomaly_signs:
          - 单个进程 CPU > 80%
          - 整体 us + sy > 90%
      
      - name: vmstat
        description: 系统整体统计
        sample: vmstat_output.txt
        why: 查看 CPU 使用趋势和上下文切换
        what_to_look_for: us, sy, cs 列
        anomaly_signs:
          - us > 80% 持续
          - cs > 100000 每秒
    
    expected_analysis: |
      应该发现 rogue_app.py 进程的 CPU 使用率异常高，
      同时注意到 vmstat 中用户态 CPU 占比很高。
    
    success_criteria: 识别出高 CPU 进程，判断可能是用户态代码问题

  - name: syscall
    description: 分析系统调用
    commands:
      - name: strace
        description: 跟踪系统调用
        sample: strace_output.txt
        why: 查看进程在执行哪些系统调用
        what_to_look_for: 高频系统调用和错误返回
        anomaly_signs:
          - 大量重复的 read/write 调用
          - 返回 -1 的错误调用
      
      - name: lsof
        description: 查看打开的文件
        sample: lsof_output.txt
        why: 确认进程打开的资源
        what_to_look_for: 文件描述符数量
        anomaly_signs:
          - 打开的文件数过多
    
    expected_analysis: |
      strace 显示进程在循环执行相同的系统调用，
      没有实际进展，这是无限循环的典型特征。
    
    success_criteria: 从系统调用模式推断出可能的代码问题

  - name: hot_function
    description: 定位热点函数
    commands:
      - name: perf top
        description: 实时性能分析
        sample: perf_top_output.txt
        why: 直接看到哪个函数在占用 CPU
        what_to_look_for: Overhead 高的函数
        anomaly_signs:
          - 单个函数 Overhead > 30%
      
      - name: perf record
        description: 记录性能数据
        sample: perf_report_output.txt
        why: 详细分析调用链
        what_to_look_for: 调用栈和热点
        anomaly_signs:
          - 热点函数调用路径异常
    
    expected_analysis: |
      perf 显示 process_data 函数占比很高，
      结合调用栈可以推断出是处理逻辑的问题。
    
    success_criteria: 定位到具体的热点函数

samples:
  - name: top_output
    type: cpu
    file: top_output.txt
    description: top 命令输出，显示高 CPU 进程
  
  - name: vmstat_output
    type: cpu
    file: vmstat_output.txt
    description: vmstat 每秒采样输出
  
  - name: strace_output
    type: syscall
    file: strace_output.txt
    description: strace 跟踪输出
  
  - name: lsof_output
    type: syscall
    file: lsof_output.txt
    description: lsof 输出
  
  - name: perf_top_output
    type: hot_function
    file: perf_top_output.txt
    description: perf top 输出
  
  - name: perf_report_output
    type: hot_function
    file: perf_report_output.txt
    description: perf report 输出
"""


def _create_sample_files() -> Dict[str, str]:
    """创建样例样本文件"""
    return {
        'top_output.txt': """top - 14:32:01 up 15 days,  3:45,  2 users,  load average: 8.50, 7.80, 6.90
Tasks: 185 total,   2 running, 183 sleeping,   0 stopped,   0 zombie
%Cpu(s): 92.1 us,  5.3 sy,  0.0 ni,  1.5 id,  0.8 wa,  0.2 hi,  0.1 si,  0.0 st
MiB Mem :  32107.8 total,   4521.3 free,  19876.5 used,   7710.0 buff/cache
MiB Swap:  16384.0 total,  15892.1 free,    491.9 used.  10987.6 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 28456 appuser   20   0  892340 156780   8765 R  95.2   0.5  45:23.45 rogue_app.py
  1567 mysql     20   0 2345678 987654  45678 S   8.3   3.1 123:45.67 mysqld
  2345 nginx     20   0   56780  12345   8765 S   2.1   0.0   5:23.45 nginx
  8901 redis     20   0  123456  34567   9876 S   1.5   0.1  12:34.56 redis-server
  4567 node      20   0  567890 234567  34567 S   0.8   0.7  34:56.78 node
""",

        'vmstat_output.txt': """procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 5  0 503720 4521320  78900 7631100    0    0    12   345 1234 98765 92  5  1  1  0
 4  0 503720 4519876  78901 7632340    0    0     0    12 1876 123450 94  4  1  0  0
 5  0 503720 4518765  78902 7633567    0    0    34   567 2012 156789 93  5  1  0  0
 6  0 503720 4517654  78903 7634789    0    0     0     0 1654 112345 91  6  2  0  0
 4  0 503720 4516543  78904 7635901    0    0   123   890 1987 145678 95  3  1  0  0
""",

        'strace_output.txt': """strace: Process 28456 attached
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
... (same pattern repeats 10000+ times)

--- SIGALRM {si_signo=SIGALRM, si_code=SI_TIMER, si_timerid=0, si_overrun=0, si_value={int=0, ptr=0x0}} ---
rt_sigreturn({mask=[]})                 = 0
read(3, "data_chunk_001", 1024)       = 12
write(4, "processed: data_chunk_001", 26) = 26
""",

        'lsof_output.txt': """COMMAND     PID    USER   FD   TYPE DEVICE  SIZE/OFF       NODE NAME
rogue_app 28456 appuser  cwd    DIR  253,0      4096   1234567 /home/appuser
rogue_app 28456 appuser  txt    REG  253,0     15678   2345678 /usr/bin/python3.10
rogue_app 28456 appuser  mem    REG  253,0   1897654   3456789 /usr/lib/x86_64-linux-gnu/libc-2.31.so
rogue_app 28456 appuser    0u   CHR  136,0       0t0         3 /dev/pts/0
rogue_app 28456 appuser    1u   CHR  136,0       0t0         3 /dev/pts/0
rogue_app 28456 appuser    2u   CHR  136,0       0t0         3 /dev/pts/0
rogue_app 28456 appuser    3r   REG  253,0      1024   4567890 /tmp/input.txt
rogue_app 28456 appuser    4w   REG  253,0  56789012   5678901 /tmp/output.txt
rogue_app 28456 appuser    5u  IPv4 123456       0t0       TCP 192.168.1.100:45678->10.0.0.1:3306 (ESTABLISHED)
""",

        'perf_top_output.txt': """Samples: 20K of event 'cycles:ppp', Event count (approx.): 10000000000
  Overhead  Command          Shared Object                  Symbol
   65.23%  rogue_app.py     python3.10                     [.] PyEval_EvalFrameEx
   18.45%  rogue_app.py     python3.10                     [.] _PyEval_EvalCodeWithName
    8.76%  rogue_app.py     rogue_app.py                   [.] process_data
    4.56%  rogue_app.py     libc-2.31.so                   [.] __strlen_avx2
    2.34%  rogue_app.py     python3.10                     [.] PyDict_GetItem
    0.66%  [kernel]         [k] entry_SYSCALL_64_after_hwframe
""",

        'perf_report_output.txt': """# ========
# captured on: Tue May  5 14:35:00 2026
# hostname : server01
# os release : 5.15.0-56-generic
# perf version : 5.15.30
# arch : x86_64
# nrcpus online : 8
# ========

#
# Total Lost Samples: 0
#
# Samples: 20K of event 'cycles:ppp'
# Event count (approx.): 10000000000
#
# Children      Self  Command          Shared Object                  Symbol
# ........  ........  ...............  .............................  ..................................
#
    98.76%    65.23%  rogue_app.py     python3.10                     [.] PyEval_EvalFrameEx
            |
            --- PyEval_EvalFrameEx
               _PyEval_EvalCodeWithName
               |
               |--92.34%-- PyEval_EvalFrameEx
               |          |
               |          |--78.56%-- PyEval_EvalFrameEx
               |          |          process_data (rogue_app.py:45)
               |          |          |
               |          |          |--45.23%-- __strlen_avx2
               |          |          |--34.56%-- PyDict_GetItem
               |          |          --20.21%-- other
               |          |
               |          --13.78%-- other
               |
               --6.42%-- other

     8.76%     8.76%  rogue_app.py     rogue_app.py                   [.] process_data
            |
            --- process_data
               PyEval_EvalFrameEx
               _PyEval_EvalCodeWithName
               PyEval_EvalFrameEx
"""
    }


if __name__ == '__main__':
    main()
