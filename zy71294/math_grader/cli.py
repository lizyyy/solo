"""CLI入口与导入导出功能"""

import click
import json
import os
from typing import List, Optional
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .core import SymbolicExpression, EquivalenceChecker
from .error_analyzer import ReportGenerator, GradeReport
from .storage import RecordStorage

console = Console()


def parse_steps(steps_str: str) -> List[str]:
    """解析步骤字符串"""
    if not steps_str:
        return []
    return [s.strip() for s in steps_str.split(";") if s.strip()]


def parse_constraints(constraints_str: str) -> List[str]:
    """解析约束字符串"""
    if not constraints_str:
        return []
    return [c.strip() for c in constraints_str.split(";") if c.strip()]


@click.group()
@click.version_option(version="0.1.0")
@click.option('--storage', '-s', default='./grading_records', help='存储目录路径')
@click.pass_context
def cli(ctx, storage):
    """符号公式批改CLI工具 - 批量检查学生代数化简过程"""
    ctx.ensure_object(dict)
    ctx.obj['storage_path'] = storage
    ctx.obj['storage'] = RecordStorage(storage)


@cli.command()
@click.argument('problem_id')
@click.argument('student_answer')
@click.argument('standard_expression')
@click.option('--steps', '-t', default='', help='变形步骤，用分号(;)分隔')
@click.option('--constraints', '-c', default='', help='变量约束，用分号(;)分隔')
@click.option('--student', '-n', default='', help='学生姓名')
@click.option('--note', '-m', default='', help='版本备注')
@click.option('--record-id', '-r', default='', help='已有记录ID，用于追加批改')
@click.option('--format', '-f', type=click.Choice(['text', 'markdown', 'json']), default='text', help='输出格式')
@click.option('--output', '-o', default='', help='输出文件路径')
@click.option('--no-save', is_flag=True, help='不保存记录')
@click.pass_context
def grade(ctx, problem_id, student_answer, standard_expression, steps, constraints, student, note, record_id, format, output, no_save):
    """执行批改: grade 题号 学生答案 标准式 [选项]
    
    示例:
      math-grader grade Q1 "(x+1)**2" "x**2+2*x+1" -t "x*x+x+x+1" -c "x!=0" -n "张三"
    """
    steps_list = parse_steps(steps)
    constraints_list = parse_constraints(constraints)
    
    report = ReportGenerator.generate_report(
        problem_id=problem_id,
        student_answer=student_answer,
        standard_expression=standard_expression,
        steps=steps_list,
        constraints=constraints_list,
        student_name=student
    )
    
    storage = ctx.obj['storage']
    
    if not no_save:
        report_dict = report.to_dict()
        if record_id:
            record = storage.update_record(record_id, report_dict, note)
            if record:
                console.print(f"[green]✓ 已追加到记录: {record_id} (版本 {len(record.reports)})[/green]")
            else:
                console.print(f"[yellow]⚠ 记录不存在，创建新记录[/yellow]")
                record = storage.create_record(problem_id, student, report_dict, note)
                console.print(f"[green]✓ 已创建记录: {record.record_id}[/green]")
        else:
            record = storage.create_record(problem_id, student, report_dict, note)
            console.print(f"[green]✓ 已创建记录: {record.record_id}[/green]")
    
    if format == 'text':
        output_text = ReportGenerator.format_text_report(report)
    elif format == 'markdown':
        output_text = ReportGenerator.format_markdown_report(report)
    else:
        output_text = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(output_text)
        console.print(f"[green]✓ 报告已保存到: {output}[/green]")
    else:
        console.print(output_text)


@cli.command('list')
@click.option('--problem', '-p', default='', help='按题号过滤')
@click.option('--student', '-n', default='', help='按学生姓名过滤')
@click.option('--limit', '-l', type=int, default=50, help='显示数量限制')
@click.pass_context
def list_records(ctx, problem, student, limit):
    """列出所有批改记录"""
    storage = ctx.obj['storage']
    
    if problem or student:
        records = storage.find_records(problem_id=problem or None, student_name=student or None)
    else:
        records = storage.list_all_records(limit)
    
    if not records:
        console.print("[yellow]没有找到记录[/yellow]")
        return
    
    table = Table(title="批改记录列表", show_lines=True)
    table.add_column("记录ID", style="cyan")
    table.add_column("题号", style="magenta")
    table.add_column("学生", style="green")
    table.add_column("版本数", justify="center")
    table.add_column("最新得分", justify="center")
    table.add_column("更新时间", style="dim")
    
    for r in records[:limit]:
        score_style = "green" if r.get("last_score", 0) >= 80 else "yellow" if r.get("last_score", 0) >= 60 else "red"
        table.add_row(
            r["record_id"],
            r["problem_id"],
            r["student_name"] or "-",
            str(r.get("report_count", 0)),
            f"[{score_style}]{r.get('last_score', 0):.1f}[/]",
            r["updated_at"][:19]
        )
    
    console.print(table)


@cli.command()
@click.argument('record_id')
@click.option('--version', '-v', type=int, default=-1, help='查看指定版本，-1表示最新')
@click.option('--format', '-f', type=click.Choice(['text', 'markdown', 'json', 'history']), default='text', help='输出格式')
@click.option('--output', '-o', default='', help='输出文件路径')
@click.pass_context
def show(ctx, record_id, version, format, output):
    """查看记录详情: show 记录ID"""
    storage = ctx.obj['storage']
    record = storage.load_record(record_id)
    
    if not record:
        console.print(f"[red]✗ 记录不存在: {record_id}[/red]")
        return
    
    if format == 'history':
        history = record.get_report_history()
        table = Table(title=f"记录 {record_id} 版本历史")
        table.add_column("版本", justify="center")
        table.add_column("得分", justify="center")
        table.add_column("结果", justify="center")
        table.add_column("时间", style="dim")
        table.add_column("备注")
        
        for h in history:
            status = "✓" if h["is_correct"] else "✗"
            table.add_row(
                str(h["version"]),
                f"{h['score']:.1f}",
                status,
                h["graded_at"][:19],
                h["note"]
            )
        console.print(table)
        return
    
    reports = record.reports
    if not reports:
        console.print("[yellow]该记录没有批改报告[/yellow]")
        return
    
    if version < 0:
        version = len(reports) - 1
    
    if version >= len(reports):
        console.print(f"[red]版本不存在: {version} (共 {len(reports)} 个版本)[/red]")
        return
    
    report_data = reports[version]
    
    if format == 'json':
        output_text = json.dumps(report_data, ensure_ascii=False, indent=2)
    else:
        class SimpleReport:
            pass
        
        report = GradeReport.__new__(GradeReport)
        report.problem_id = report_data['problem_id']
        report.student_name = report_data.get('student_name', '')
        report.timestamp = report_data.get('graded_at', report_data.get('timestamp', ''))
        report.steps = report_data['steps']
        report.standard_expression = report_data['standard_expression']
        report.student_answer = report_data['student_answer']
        report.constraints = report_data['constraints']
        report.step_results = []
        report.errors = []
        report.overall_score = report_data['overall_score']
        report.is_correct = report_data['is_correct']
        report.summary = report_data['summary']
        report.details = report_data.get('details', {})
        
        from .step_checker import StepCheckResult, StepStatus
        for sr in report_data['step_results']:
            step_result = StepCheckResult(
                step_index=sr['step_index'],
                from_expr=sr['from_expr'],
                to_expr=sr['to_expr'],
                status=StepStatus(sr['status']),
                is_equivalent=sr['is_equivalent'],
                equivalence_reason=sr['equivalence_reason'],
                domain_violations=sr['domain_violations'],
                constraint_violations=sr['constraint_violations'],
                error_messages=sr['error_messages'],
                details=sr['details']
            )
            report.step_results.append(step_result)
        
        from .error_analyzer import ErrorAnalysis, ErrorType
        for e in report_data['errors']:
            error = ErrorAnalysis(
                error_type=ErrorType(e['error_type']),
                severity=e['severity'],
                description=e['description'],
                suggestion=e['suggestion'],
                location=e.get('location', '')
            )
            report.errors.append(error)
        
        if format == 'markdown':
            output_text = ReportGenerator.format_markdown_report(report)
        else:
            output_text = ReportGenerator.format_text_report(report)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(output_text)
        console.print(f"[green]✓ 报告已保存到: {output}[/green]")
    else:
        console.print(output_text)


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.pass_context
def import_json(ctx, input_file):
    """从JSON文件导入记录"""
    storage = ctx.obj['storage']
    record = storage.import_record_from_json(input_file)
    
    if record:
        console.print(f"[green]✓ 成功导入记录: {record.record_id}[/green]")
        console.print(f"  题号: {record.problem_id}")
        console.print(f"  学生: {record.student_name}")
        console.print(f"  版本数: {len(record.reports)}")
    else:
        console.print(f"[red]✗ 导入失败[/red]")


@cli.command()
@click.argument('record_id')
@click.argument('output_file')
@click.pass_context
def export(ctx, record_id, output_file):
    """导出记录: export 记录ID 输出文件路径"""
    storage = ctx.obj['storage']
    success = storage.export_record_to_json(record_id, output_file)
    
    if success:
        console.print(f"[green]✓ 成功导出记录到: {output_file}[/green]")
    else:
        console.print(f"[red]✗ 导出失败，记录不存在[/red]")


@cli.command()
@click.argument('record_id')
@click.argument('student_answer')
@click.argument('standard_expression')
@click.option('--steps', '-t', default='', help='变形步骤，用分号(;)分隔')
@click.option('--constraints', '-c', default='', help='变量约束，用分号(;)分隔')
@click.option('--note', '-m', default='', help='版本备注')
@click.option('--format', '-f', type=click.Choice(['text', 'markdown', 'json']), default='text', help='输出格式')
@click.pass_context
def regrade(ctx, record_id, student_answer, standard_expression, steps, constraints, note, format):
    """重新批改并追加新版本"""
    storage = ctx.obj['storage']
    record = storage.load_record(record_id)
    
    if not record:
        console.print(f"[red]✗ 记录不存在: {record_id}[/red]")
        return
    
    steps_list = parse_steps(steps)
    constraints_list = parse_constraints(constraints)
    
    student = record.student_name
    problem_id = record.problem_id
    
    report = ReportGenerator.generate_report(
        problem_id=problem_id,
        student_answer=student_answer,
        standard_expression=standard_expression,
        steps=steps_list,
        constraints=constraints_list,
        student_name=student
    )
    
    record = storage.update_record(record_id, report.to_dict(), note)
    
    console.print(f"[green]✓ 已添加新版本: {len(record.reports)}[/green]")
    
    if format == 'text':
        output_text = ReportGenerator.format_text_report(report)
    elif format == 'markdown':
        output_text = ReportGenerator.format_markdown_report(report)
    else:
        output_text = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
    
    console.print(output_text)


@cli.command()
@click.argument('expr1')
@click.argument('expr2')
def check(expr1, expr2):
    """快速检查两个表达式是否等价"""
    e1 = SymbolicExpression(expr1)
    e2 = SymbolicExpression(expr2)
    
    if not e1.is_valid():
        console.print(f"[red]表达式1无效: {e1.error}[/red]")
        return
    if not e2.is_valid():
        console.print(f"[red]表达式2无效: {e2.error}[/red]")
        return
    
    is_equiv, reason = EquivalenceChecker.are_equivalent(e1, e2)
    
    console.print(f"表达式1: {expr1}")
    console.print(f"表达式2: {expr2}")
    console.print(f"等价: [{'green' if is_equiv else 'red'}]{is_equiv}[/]")
    console.print(f"原因: {reason}")
    
    console.print(f"\n化简后:")
    console.print(f"  expr1 = {e1.simplify()}")
    console.print(f"  expr2 = {e2.simplify()}")


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--format', '-f', type=click.Choice(['text', 'markdown', 'json']), default='text', help='输出格式')
@click.option('--output-dir', '-o', default='./reports', help='输出目录')
@click.option('--no-save', is_flag=True, help='不保存记录')
@click.pass_context
def batch(ctx, input_file, format, output_dir, no_save):
    """批量批改: batch 输入文件.json
    
    输入文件格式示例:
    [
      {
        "problem_id": "Q1",
        "student_name": "张三",
        "student_answer": "x**2 + 2*x + 1",
        "standard_expression": "(x+1)**2",
        "steps": ["x*x + x + x + 1"],
        "constraints": ["x != 0"]
      }
    ]
    """
    storage = ctx.obj['storage']
    
    with open(input_file, 'r', encoding='utf-8') as f:
        items = json.load(f)
    
    if not isinstance(items, list):
        console.print("[red]输入文件必须是JSON数组[/red]")
        return
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    results = []
    
    for item in items:
        report = ReportGenerator.generate_report(
            problem_id=item.get('problem_id', 'unknown'),
            student_answer=item.get('student_answer', ''),
            standard_expression=item.get('standard_expression', ''),
            steps=item.get('steps', []),
            constraints=item.get('constraints', []),
            student_name=item.get('student_name', '')
        )
        
        record_id = ""
        if not no_save:
            record = storage.create_record(
                problem_id=report.problem_id,
                student_name=report.student_name,
                initial_report=report.to_dict(),
                note=item.get('note', '批量导入')
            )
            record_id = record.record_id
        
        if format == 'text':
            report_text = ReportGenerator.format_text_report(report)
            ext = 'txt'
        elif format == 'markdown':
            report_text = ReportGenerator.format_markdown_report(report)
            ext = 'md'
        else:
            report_text = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
            ext = 'json'
        
        filename = f"{report.problem_id}_{report.student_name or 'anon'}.{ext}"
        filename = filename.replace('/', '_').replace('\\', '_')
        filepath = output_path / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_text)
        
        results.append({
            'problem_id': report.problem_id,
            'student_name': report.student_name,
            'score': report.overall_score,
            'is_correct': report.is_correct,
            'record_id': record_id,
            'file': str(filepath)
        })
    
    table = Table(title="批量批改结果", show_lines=True)
    table.add_column("题号", style="magenta")
    table.add_column("学生", style="green")
    table.add_column("得分", justify="center")
    table.add_column("结果", justify="center")
    table.add_column("记录ID", style="cyan")
    
    for r in results:
        score_style = "green" if r['score'] >= 80 else "yellow" if r['score'] >= 60 else "red"
        status = "✓" if r['is_correct'] else "✗"
        table.add_row(
            r['problem_id'],
            r['student_name'] or '-',
            f"[{score_style}]{r['score']:.1f}[/]",
            status,
            r['record_id'] or '-'
        )
    
    console.print(table)
    console.print(f"\n[green]✓ 共处理 {len(results)} 份作业，报告已输出到: {output_dir}[/green]")


@cli.command()
def example():
    """显示使用示例"""
    examples = Panel(Text.from_markup("""
[b]使用示例:[/b]

1. 单次批改:
   [cyan]math-grader grade Q1 "x**2+2*x+1" "(x+1)**2" -n "张三"[/cyan]

2. 带步骤批改:
   [cyan]math-grader grade Q2 "1/x" "x**(-1)" -t "1/x" -c "x!=0"[/cyan]

3. 追加批改版本:
   [cyan]math-grader grade Q3 "x+1" "x+2" -r "abc123" -m "学生修正后重批"[/cyan]

4. 查看记录:
   [cyan]math-grader show abc123[/cyan]
   [cyan]math-grader show abc123 -f history[/cyan]

5. 批量批改:
   [cyan]math-grader batch students.json -o ./reports -f markdown[/cyan]

6. 快速检查表达式等价性:
   [cyan]math-grader check "x**2-1" "(x-1)*(x+1)"[/cyan]

7. 导入/导出:
   [cyan]math-grader export abc123 ./record_abc123.json[/cyan]
   [cyan]math-grader import ./record_abc123.json[/cyan]
    """), title="符号公式批改CLI - 使用示例")
    
    console.print(examples)


def main():
    cli(obj={})


if __name__ == '__main__':
    main()
