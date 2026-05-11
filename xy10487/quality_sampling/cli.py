import click
import os
import csv
from tabulate import tabulate
from typing import List, Dict
from datetime import datetime
from .storage import Storage
from .importer import CSVImporter
from .sampling import SamplingEngine
from .models import Agent, Call, QCInspector, CallStatus


DB_PATH = os.environ.get("QC_DB_PATH", "qc_sampling.db")


def get_storage():
    return Storage(DB_PATH)


@click.group()
def cli():
    """呼叫中心质检抽样 CLI 工具"""
    pass


@cli.group()
def import_data():
    """导入数据"""
    pass


@import_data.command("agents")
@click.argument("csv_path", type=click.Path(exists=True))
def import_agents(csv_path):
    """导入坐席信息 CSV"""
    storage = get_storage()
    importer = CSVImporter(storage)
    added, updated = importer.import_agents(csv_path)
    storage.close()
    click.echo(f"坐席导入完成：新增 {added} 条，更新 {updated} 条")


@import_data.command("calls")
@click.argument("csv_path", type=click.Path(exists=True))
def import_calls(csv_path):
    """导入通话清单 CSV（自动去重）"""
    storage = get_storage()
    importer = CSVImporter(storage)
    added, skipped = importer.import_calls(csv_path)
    storage.close()
    click.echo(f"通话导入完成：新增 {added} 条，跳过重复/已质检 {skipped} 条")


@import_data.command("inspectors")
@click.argument("csv_path", type=click.Path(exists=True))
def import_inspectors(csv_path):
    """导入质检员信息 CSV"""
    storage = get_storage()
    importer = CSVImporter(storage)
    added, updated = importer.import_inspectors(csv_path)
    storage.close()
    click.echo(f"质检员导入完成：新增 {added} 条，更新 {updated} 条")


@cli.command("sample")
@click.option("--count", "-n", type=int, default=10, help="抽样数量")
def do_sample(count):
    """按规则抽样生成质检任务"""
    storage = get_storage()
    engine = SamplingEngine(storage)

    try:
        results = engine.generate_sample(count)
    except RuntimeError as e:
        click.echo(f"错误: {e}")
        storage.close()
        return

    storage.close()

    if not results:
        click.echo("没有可抽样的通话")
        return

    table_data = []
    for r in results:
        table_data.append([
            r["task_id"],
            r["call_id"],
            r["agent_name"],
            "是" if r["is_complaint"] else "否",
            r["inspector_name"],
            f"{r['weight']:.1f}",
            r["sampling_reason"]
        ])

    click.echo(f"\n成功生成 {len(results)} 个质检任务：")
    click.echo(tabulate(
        table_data,
        headers=["任务ID", "通话ID", "坐席", "投诉", "质检员", "权重", "抽样原因"],
        tablefmt="grid"
    ))


@cli.command("view-tasks")
@click.option("--task-id", "-t", type=str, help="查看特定任务详情")
def view_tasks(task_id):
    """查看质检任务及抽样原因"""
    storage = get_storage()
    engine = SamplingEngine(storage)

    if task_id:
        details = engine.get_sampling_details(task_id)
        if not details:
            click.echo(f"未找到任务: {task_id}")
            storage.close()
            return

        task = details["task"]
        call = details["call"]
        agent = details["agent"]
        inspector = details["inspector"]

        click.echo(f"\n=== 任务详情: {task_id} ===")
        click.echo(f"任务ID: {task.task_id}")
        click.echo(f"通话ID: {task.call_id}")
        click.echo(f"通话时间: {call.call_time if call else 'N/A'}")
        click.echo(f"业务类型: {task.business_type}")
        click.echo(f"是否投诉: {'是' if task.is_complaint else '否'}")
        if agent:
            click.echo(f"坐席: {agent.name} ({agent.agent_id})")
            click.echo(f"  团队: {agent.team}")
            click.echo(f"  当前风险分: {agent.risk_score:.1f}")
            click.echo(f"  历史均分: {agent.historical_avg_score:.1f}")
        if inspector:
            click.echo(f"质检员: {inspector.name} ({inspector.inspector_id})")
        click.echo(f"抽样原因: {task.sampling_reason}")
        click.echo(f"创建时间: {task.created_at}")
        if task.completed_at:
            click.echo(f"完成时间: {task.completed_at}")
            click.echo(f"质检分数: {task.score}")
            click.echo(f"质检结果: {'通过' if task.result == 'pass' else '不通过'}")
    else:
        tasks = storage.get_all_tasks()
        if not tasks:
            click.echo("没有质检任务")
            storage.close()
            return

        table_data = []
        for t in tasks:
            agent = storage.get_agent(t.agent_id)
            inspector = storage.get_inspector(t.qc_assigned_to)
            table_data.append([
                t.task_id,
                t.call_id,
                agent.name if agent else "未知",
                "是" if t.is_complaint else "否",
                inspector.name if inspector else "未知",
                t.sampling_reason[:30] + "..." if len(t.sampling_reason) > 30 else t.sampling_reason,
                t.score if t.score else "-",
                "通过" if t.result == "pass" else ("不通过" if t.result == "fail" else "待质检"),
            ])

        click.echo(tabulate(
            table_data,
            headers=["任务ID", "通话ID", "坐席", "投诉", "质检员", "抽样原因", "分数", "状态"],
            tablefmt="grid"
        ))

    storage.close()


@cli.command("record-result")
@click.argument("task_id")
@click.option("--score", "-s", type=float, required=True, help="质检分数 (0-100)")
@click.option("--result", "-r", type=click.Choice(["pass", "fail"]), required=True, help="质检结果")
@click.option("--notes", "-n", type=str, default="", help="质检备注")
def record_result(task_id, score, result, notes):
    """录入质检结果"""
    storage = get_storage()

    task = storage.get_task(task_id)
    if not task:
        click.echo(f"未找到任务: {task_id}")
        storage.close()
        return

    if task.completed_at:
        click.echo(f"该任务已完成，分数: {task.score}, 结果: {'通过' if task.result == 'pass' else '不通过'}")
        storage.close()
        return

    storage.update_task_result(task_id, score, result, notes)

    click.echo(f"\n质检结果已录入：")
    click.echo(f"  任务ID: {task_id}")
    click.echo(f"  分数: {score}")
    click.echo(f"  结果: {'通过' if result == 'pass' else '不通过'}")
    if notes:
        click.echo(f"  备注: {notes}")

    storage.close()


@cli.command("recalculate-risk")
@click.option("--agent-id", "-a", type=str, help="指定坐席工号（不指定则全部重算）")
def recalculate_risk(agent_id):
    """重新计算坐席风险分"""
    storage = get_storage()

    if agent_id:
        agent = storage.get_agent(agent_id)
        if not agent:
            click.echo(f"未找到坐席: {agent_id}")
            storage.close()
            return
        old_risk = agent.risk_score
        old_avg = agent.historical_avg_score
        storage.recalculate_agent_risk(agent_id)
        agent = storage.get_agent(agent_id)
        click.echo(f"\n坐席 {agent.name} ({agent_id}) 风险更新：")
        click.echo(f"  旧风险分: {old_risk:.1f} -> 新风险分: {agent.risk_score:.1f}")
        click.echo(f"  历史均分: {old_avg:.1f} -> {agent.historical_avg_score:.1f}")
        click.echo(f"  已质检次数: {agent.total_qc_calls}")
    else:
        agents = storage.get_all_agents()
        table_data = []
        for a in agents:
            old_risk = a.risk_score
            old_avg = a.historical_avg_score
            storage.recalculate_agent_risk(a.agent_id)
            updated = storage.get_agent(a.agent_id)
            table_data.append([
                a.agent_id,
                a.name,
                f"{old_risk:.1f} -> {updated.risk_score:.1f}",
                f"{old_avg:.1f} -> {updated.historical_avg_score:.1f}",
                updated.total_qc_calls
            ])

        click.echo(f"\n已重新计算 {len(table_data)} 名坐席的风险分：")
        click.echo(tabulate(
            table_data,
            headers=["工号", "姓名", "风险分变化", "均分变化", "质检次数"],
            tablefmt="grid"
        ))

    storage.close()


@cli.command("agents")
@click.option("--sort-by-risk", is_flag=True, help="按风险分降序")
def list_agents(sort_by_risk):
    """查看坐席列表"""
    storage = get_storage()
    agents = storage.get_all_agents()
    storage.close()

    if sort_by_risk:
        agents = sorted(agents, key=lambda a: a.risk_score, reverse=True)

    table_data = []
    for a in agents:
        risk_level = "高" if a.risk_score >= 70 else ("中" if a.risk_score >= 50 else "低")
        table_data.append([
            a.agent_id,
            a.name,
            a.team,
            f"{a.risk_score:.1f}",
            risk_level,
            f"{a.historical_avg_score:.1f}",
            a.total_qc_calls
        ])

    click.echo(tabulate(
        table_data,
        headers=["工号", "姓名", "团队", "风险分", "等级", "均分", "质检次数"],
        tablefmt="grid"
    ))


@cli.command("export")
@click.argument("output_path", type=click.Path())
@click.option("--type", "-t", type=click.Choice(["tasks", "agents", "calls"]), default="tasks")
def export_report(output_path, type):
    """导出报告 CSV"""
    storage = get_storage()

    with open(output_path, mode='w', encoding='utf-8-sig', newline='') as f:
        if type == "tasks":
            tasks = storage.get_all_tasks()
            writer = csv.writer(f)
            writer.writerow([
                "任务ID", "通话ID", "坐席工号", "坐席姓名", "团队",
                "业务类型", "是否投诉", "抽样原因",
                "质检员工号", "质检员姓名", "创建时间", "完成时间",
                "分数", "结果"
            ])
            for t in tasks:
                agent = storage.get_agent(t.agent_id)
                inspector = storage.get_inspector(t.qc_assigned_to)
                writer.writerow([
                    t.task_id, t.call_id, t.agent_id,
                    agent.name if agent else "", agent.team if agent else "",
                    t.business_type,
                    "是" if t.is_complaint else "否",
                    t.sampling_reason,
                    t.qc_assigned_to,
                    inspector.name if inspector else "",
                    t.created_at,
                    t.completed_at or "",
                    t.score or "",
                    "通过" if t.result == "pass" else ("不通过" if t.result == "fail" else "")
                ])

        elif type == "agents":
            agents = storage.get_all_agents()
            writer = csv.writer(f)
            writer.writerow(["工号", "姓名", "团队", "风险分", "等级", "历史均分", "质检次数"])
            for a in agents:
                level = "高" if a.risk_score >= 70 else ("中" if a.risk_score >= 50 else "低")
                writer.writerow([
                    a.agent_id, a.name, a.team,
                    f"{a.risk_score:.1f}", level,
                    f"{a.historical_avg_score:.1f}", a.total_qc_calls
                ])

        elif type == "calls":
            calls = storage.get_all_calls()
            writer = csv.writer(f)
            writer.writerow([
                "通话ID", "坐席工号", "通话时间", "时长(秒)",
                "业务类型", "是否投诉", "状态",
                "质检员工号", "分数", "抽样原因"
            ])
            for c in calls:
                status_map = {
                    "pending": "待抽样",
                    "sampled": "待质检",
                    "qc_pass": "质检通过",
                    "qc_fail": "质检不通过"
                }
                writer.writerow([
                    c.call_id, c.agent_id, c.call_time, c.duration_sec,
                    c.business_type,
                    "是" if c.is_complaint else "否",
                    status_map.get(c.status.value, c.status.value),
                    c.qc_assigned_to or "",
                    c.qc_score if c.qc_score is not None else "",
                    c.sampling_reason
                ])

    storage.close()
    click.echo(f"已导出 {type} 报告到: {output_path}")


@cli.command("stats")
def show_stats():
    """查看统计概览"""
    storage = get_storage()

    total_calls = len(storage.get_all_calls())
    pending = len(storage.get_all_calls(CallStatus.PENDING))
    sampled = len(storage.get_all_calls(CallStatus.SAMPLED))
    passed = len(storage.get_all_calls(CallStatus.QC_PASS))
    failed = len(storage.get_all_calls(CallStatus.QC_FAIL))
    agents = storage.get_all_agents()
    inspectors = storage.get_all_inspectors(active_only=True)

    high_risk = sum(1 for a in agents if a.risk_score >= 70)
    medium_risk = sum(1 for a in agents if 50 <= a.risk_score < 70)
    low_risk = sum(1 for a in agents if a.risk_score < 50)

    click.echo("\n=== 质检抽样统计概览 ===")
    click.echo(f"\n通话统计:")
    click.echo(f"  总计: {total_calls}")
    click.echo(f"  待抽样: {pending}")
    click.echo(f"  待质检: {sampled}")
    click.echo(f"  质检通过: {passed}")
    click.echo(f"  质检不通过: {failed}")

    click.echo(f"\n坐席统计 ({len(agents)} 人):")
    click.echo(f"  高风险: {high_risk}")
    click.echo(f"  中风险: {medium_risk}")
    click.echo(f"  低风险: {low_risk}")

    click.echo(f"\n质检员: {len(inspectors)} 人")
    for ins in inspectors:
        pending_tasks = storage.get_inspector_task_count(ins.inspector_id)
        click.echo(f"  {ins.name} (当前任务: {pending_tasks})")

    storage.close()


if __name__ == "__main__":
    cli()
