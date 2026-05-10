#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict, field
from enum import Enum
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table
from rich import print as rprint

app = typer.Typer(help="直播样品寄送跟进 CLI 工具")
console = Console()

DATA_DIR = Path(__file__).parent / ".sample_tracker_data"
DATA_DIR.mkdir(exist_ok=True)

INFLUENCERS_FILE = DATA_DIR / "influencers.json"
SAMPLES_FILE = DATA_DIR / "samples.json"
SHIPPINGS_FILE = DATA_DIR / "shippings.json"
FEEDBACKS_FILE = DATA_DIR / "feedbacks.json"


class SampleStatus(str, Enum):
    PENDING = "待寄出"
    SHIPPED = "已寄出"
    DELIVERED = "已签收"
    IN_USE = "试用中"
    FEEDBACK_RECEIVED = "已反馈"
    RETURN_REQUESTED = "待退样"
    RETURNED = "已退样"
    RETURN_DAMAGED = "退样损坏"
    EXPIRED = "样品过期"
    COMPLETED = "已完成"


class FeedbackConclusion(str, Enum):
    KEEP = "自留"
    RETURN = "需退样"
    NEED_MORE = "需补寄"
    NOT_SUITABLE = "不适合"


def load_json(filepath: Path) -> List[Dict[str, Any]]:
    if not filepath.exists():
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filepath: Path, data: List[Dict[str, Any]]) -> None:
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_today() -> date:
    return date.today()


def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def generate_id() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


@app.command("import-influencers")
def import_influencers(
    name: str = typer.Option(..., help="达人姓名"),
    phone: str = typer.Option(..., help="联系电话"),
    platform: str = typer.Option(..., help="平台（抖音/快手/淘宝等"),
    followers: int = typer.Option(0, help="粉丝数"),
    address: str = typer.Option(..., help="收货地址"),
    note: str = typer.Option("", help="备注"),
):
    influencers = load_json(INFLUENCERS_FILE)
    influencer_id = f"INF{generate_id()}"
    
    existing = [i for i in influencers if i["phone"] == phone]
    if existing:
        typer.echo(f"⚠️  已存在相同电话的达人: {existing[0]['name']}")
        confirm = typer.confirm("是否继续添加？", default=False)
        if not confirm:
            typer.echo("已取消")
            return
    
    influencer = {
        "id": influencer_id,
        "name": name,
        "phone": phone,
        "platform": platform,
        "followers": followers,
        "address": address,
        "note": note,
        "created_at": format_date(get_today()),
    }
    influencers.append(influencer)
    save_json(INFLUENCERS_FILE, influencers)
    typer.echo(f"✅ 已添加达人: {name} (ID: {influencer_id})")


@app.command("import-sample")
def import_sample(
    name: str = typer.Option(..., help="样品名称"),
    category: str = typer.Option(..., help="样品类别"),
    sku: str = typer.Option(..., help="SKU编号"),
    value: float = typer.Option(0.0, help="样品价值"),
    expiration_days: int = typer.Option(30, help="试用有效期（天）"),
    batch_no: str = typer.Option(..., help="批次号"),
):
    samples = load_json(SAMPLES_FILE)
    sample_id = f"SMP{generate_id()}"
    
    sample = {
        "id": sample_id,
        "name": name,
        "category": category,
        "sku": sku,
        "value": value,
        "expiration_days": expiration_days,
        "batch_no": batch_no,
        "created_at": format_date(get_today()),
    }
    samples.append(sample)
    save_json(SAMPLES_FILE, samples)
    typer.echo(f"✅ 已添加样品: {name} (ID: {sample_id})")


@app.command("import-shipping")
def import_shipping(
    influencer_id: str = typer.Option(..., help="达人ID"),
    sample_id: str = typer.Option(..., help="样品ID"),
    shipping_no: str = typer.Option(..., help="物流单号"),
    shipping_date: str = typer.Option(..., help="发货日期 YYYY-MM-DD"),
    shipping_company: str = typer.Option("顺丰", help="物流公司"),
):
    influencers = load_json(INFLUENCERS_FILE)
    samples = load_json(SAMPLES_FILE)
    shippings = load_json(SHIPPINGS_FILE)
    
    influencer = next((i for i in influencers if i["id"] == influencer_id), None)
    if not influencer:
        typer.echo(f"❌ 未找到达人ID: {influencer_id}")
        raise typer.Exit(1)
    
    sample = next((s for s in samples if s["id"] == sample_id), None)
    if not sample:
        typer.echo(f"❌ 未找到样品ID: {sample_id}")
        raise typer.Exit(1)
    
    duplicate_check = [
        s for s in shippings
        if s["influencer_id"] == influencer_id
        and s["sample_id"] == sample_id
        and s["status"] in ["已寄出", "已签收", "试用中", "已反馈", "待退样"]
    ]
    if duplicate_check:
        typer.echo(f"⚠️  检测到该达人已有未完成的同一样品寄送记录:")
        for d in duplicate_check:
            typer.echo(f"  - 物流单号: {d['shipping_no']}, 状态: {d['status']}")
        confirm = typer.confirm("是否继续添加（重复寄送）？", default=False)
        if not confirm:
            typer.echo("已取消")
            return
    
    shipping_id = f"SHP{generate_id()}"
    shipping = {
        "id": shipping_id,
        "influencer_id": influencer_id,
        "influencer_name": influencer["name"],
        "sample_id": sample_id,
        "sample_name": sample["name"],
        "shipping_no": shipping_no,
        "shipping_company": shipping_company,
        "shipping_date": shipping_date,
        "delivered_date": None,
        "status": SampleStatus.SHIPPED.value,
        "is_duplicate": len(duplicate_check) > 0,
        "created_at": format_date(get_today()),
    }
    shippings.append(shipping)
    save_json(SHIPPINGS_FILE, shippings)
    typer.echo(f"✅ 已添加物流记录 (ID: {shipping_id})")
    if shipping["is_duplicate"]:
        typer.echo(f"⚠️  已标记为重复寄送")


@app.command("update-delivery")
def update_delivery(
    shipping_id: str = typer.Option(..., help="物流记录ID"),
    delivered_date: str = typer.Option(..., help="签收日期 YYYY-MM-DD"),
):
    shippings = load_json(SHIPPINGS_FILE)
    
    shipping = next((s for s in shippings if s["id"] == shipping_id), None)
    if not shipping:
        typer.echo(f"❌ 未找到物流记录ID: {shipping_id}")
        raise typer.Exit(1)
    
    shipping["delivered_date"] = delivered_date
    shipping["status"] = SampleStatus.DELIVERED.value
    save_json(SHIPPINGS_FILE, shippings)
    typer.echo(f"✅ 已更新为已签收: {shipping['influencer_name']} - {shipping['sample_name']}")


@app.command("add-feedback")
def add_feedback(
    shipping_id: str = typer.Option(..., help="物流记录ID"),
    conclusion: FeedbackConclusion = typer.Option(..., help="反馈结论"),
    rating: int = typer.Option(3, help="评分 1-5"),
    comment: str = typer.Option("", help="详细评价"),
    feedback_date: str = typer.Option(None, help="反馈日期 YYYY-MM-DD"),
):
    shippings = load_json(SHIPPINGS_FILE)
    feedbacks = load_json(FEEDBACKS_FILE)
    
    shipping = next((s for s in shippings if s["id"] == shipping_id), None)
    if not shipping:
        typer.echo(f"❌ 未找到物流记录ID: {shipping_id}")
        raise typer.Exit(1)
    
    if shipping["status"] not in [SampleStatus.DELIVERED.value, SampleStatus.IN_USE.value, SampleStatus.FEEDBACK_RECEIVED.value]:
        typer.echo(f"⚠️  当前状态为[{shipping['status']}]，是否确认添加反馈？")
        confirm = typer.confirm("继续？", default=False)
        if not confirm:
            typer.echo("已取消")
            return
    
    if feedback_date is None:
        feedback_date = format_date(get_today())
    
    existing_feedback = next((f for f in feedbacks if f["shipping_id"] == shipping_id), None)
    
    if existing_feedback:
        typer.echo(f"⚠️  已存在该记录的反馈，将覆盖更新")
        existing_feedback["conclusion"] = conclusion.value
        existing_feedback["rating"] = rating
        existing_feedback["comment"] = comment
        existing_feedback["feedback_date"] = feedback_date
        existing_feedback["updated_at"] = format_date(get_today())
    else:
        feedback = {
            "id": f"FBK{generate_id()}",
            "shipping_id": shipping_id,
            "influencer_id": shipping["influencer_id"],
            "influencer_name": shipping["influencer_name"],
            "sample_id": shipping["sample_id"],
            "sample_name": shipping["sample_name"],
            "conclusion": conclusion.value,
            "rating": rating,
            "comment": comment,
            "feedback_date": feedback_date,
            "created_at": format_date(get_today()),
            "updated_at": format_date(get_today()),
        }
        feedbacks.append(feedback)
    
    if conclusion == FeedbackConclusion.RETURN.value:
        shipping["status"] = SampleStatus.RETURN_REQUESTED.value
    elif conclusion == FeedbackConclusion.NEED_MORE.value:
        shipping["status"] = SampleStatus.FEEDBACK_RECEIVED.value
    elif conclusion == FeedbackConclusion.KEEP.value or conclusion == FeedbackConclusion.NOT_SUITABLE.value:
        shipping["status"] = SampleStatus.COMPLETED.value
    else:
        shipping["status"] = SampleStatus.FEEDBACK_RECEIVED.value
    
    save_json(FEEDBACKS_FILE, feedbacks)
    save_json(SHIPPINGS_FILE, shippings)
    typer.echo(f"✅ 已添加反馈: {conclusion.value}")
    if conclusion == FeedbackConclusion.RETURN.value:
        typer.echo(f"📦 请跟进退样流程")
    elif conclusion == FeedbackConclusion.NEED_MORE.value:
        typer.echo(f"🔄 请安排补寄")


@app.command("update-return")
def update_return(
    shipping_id: str = typer.Option(..., help="物流记录ID"),
    return_date: str = typer.Option(..., help="退样日期 YYYY-MM-DD"),
    damaged: bool = typer.Option(False, help="是否损坏"),
    damaged_note: str = typer.Option("", help="损坏说明"),
):
    shippings = load_json(SHIPPINGS_FILE)
    feedbacks = load_json(FEEDBACKS_FILE)
    
    shipping = next((s for s in shippings if s["id"] == shipping_id), None)
    if not shipping:
        typer.echo(f"❌ 未找到物流记录ID: {shipping_id}")
        raise typer.Exit(1)
    
    feedback = next((f for f in feedbacks if f["shipping_id"] == shipping_id), None)
    
    if feedback and feedback["conclusion"] != FeedbackConclusion.RETURN.value:
        typer.echo(f"⚠️  反馈结论为[{feedback['conclusion']}]，与退样状态冲突！")
        confirm = typer.confirm("是否仍要更新为退样状态？", default=False)
        if not confirm:
            typer.echo("已取消")
            return
    
    shipping["return_date"] = return_date
    shipping["return_damaged"] = damaged
    shipping["return_damaged_note"] = damaged_note
    shipping["status"] = SampleStatus.RETURN_DAMAGED.value if damaged else SampleStatus.RETURNED.value
    
    if damaged:
        typer.echo(f"⚠️  退样损坏，请联系达人确认并记录")
    
    save_json(SHIPPINGS_FILE, shippings)
    typer.echo(f"✅ 已更新退样状态: {shipping['status']}")


@app.command("pending")
def list_pending(
    days_without_feedback: int = typer.Option(7, help="签收后无反馈的天数阈值"),
):
    shippings = load_json(SHIPPINGS_FILE)
    samples = load_json(SAMPLES_FILE)
    today = get_today()
    
    pending_items = []
    expired_items = []
    no_feedback_items = []
    return_items = []
    replenish_items = []
    duplicate_items = []
    
    for s in shippings:
        status = s["status"]
        sample = next((sp for sp in samples if sp["id"] == s["sample_id"]), {})
        expiration_days = sample.get("expiration_days", 30)
        
        if s.get("is_duplicate") and status not in [SampleStatus.COMPLETED.value, SampleStatus.RETURNED.value]:
            duplicate_items.append(s)
        
        if s["delivered_date"]:
            delivered = parse_date(s["delivered_date"])
            days_since_delivered = (today - delivered).days
            
            if days_since_delivered >= expiration_days and status not in [SampleStatus.COMPLETED.value, SampleStatus.RETURNED.value, SampleStatus.RETURN_DAMAGED.value]:
                s_copy = dict(s)
                s_copy["days_since_delivered"] = days_since_delivered
                s_copy["expiration_days"] = expiration_days
                expired_items.append(s_copy)
            
            if days_since_delivered >= days_without_feedback and status in [SampleStatus.DELIVERED.value, SampleStatus.IN_USE.value]:
                s_copy = dict(s)
                s_copy["days_since_delivered"] = days_since_delivered
                no_feedback_items.append(s_copy)
        
        if status == SampleStatus.RETURN_REQUESTED.value:
            return_items.append(s)
        
        if status == SampleStatus.FEEDBACK_RECEIVED.value:
            feedbacks = load_json(FEEDBACKS_FILE)
            fb = next((f for f in feedbacks if f["shipping_id"] == s["id"]), None)
            if fb and fb["conclusion"] == FeedbackConclusion.NEED_MORE.value:
                replenish_items.append(s)
    
    console.print("\n[bold red]══════════════════════════════════════════════[/bold red]")
    console.print("[bold red]🔥 当前待跟进列表[/bold red]")
    console.print("[bold red]══════════════════════════════════════════════[/bold red]\n")
    
    if duplicate_items:
        console.print("[bold yellow]⚠️  重复寄送（未完成）:[/bold yellow]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("达人")
        table.add_column("样品")
        table.add_column("物流单号")
        table.add_column("状态")
        for item in duplicate_items:
            table.add_row(
                item["influencer_name"],
                item["sample_name"],
                item["shipping_no"],
                item["status"],
            )
        console.print(table)
        console.print()
    
    if expired_items:
        console.print("[bold red]⏰ 样品已过期:[/bold red]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("达人")
        table.add_column("样品")
        table.add_column("签收天数")
        table.add_column("有效期")
        table.add_column("状态")
        for item in expired_items:
            table.add_row(
                item["influencer_name"],
                item["sample_name"],
                f"{item['days_since_delivered']}天",
                f"{item['expiration_days']}天",
                item["status"],
            )
        console.print(table)
        console.print()
    
    if no_feedback_items:
        console.print(f"[bold orange]📢 签收超过{days_without_feedback}天无反馈:[/bold orange]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("达人")
        table.add_column("样品")
        table.add_column("签收日期")
        table.add_column("天数")
        table.add_column("状态")
        for item in no_feedback_items:
            table.add_row(
                item["influencer_name"],
                item["sample_name"],
                item["delivered_date"],
                f"{item['days_since_delivered']}天",
                item["status"],
            )
        console.print(table)
        console.print()
    
    if return_items:
        console.print("[bold blue]📦 待退样:[/bold blue]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("达人")
        table.add_column("样品")
        table.add_column("物流单号")
        for item in return_items:
            table.add_row(
                item["influencer_name"],
                item["sample_name"],
                item["shipping_no"],
            )
        console.print(table)
        console.print()
    
    if replenish_items:
        console.print("[bold green]🔄 需补寄:[/bold green]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("达人")
        table.add_column("样品")
        for item in replenish_items:
            table.add_row(
                item["influencer_name"],
                item["sample_name"],
            )
        console.print(table)
        console.print()
    
    total_pending = len(duplicate_items) + len(expired_items) + len(no_feedback_items) + len(return_items) + len(replenish_items)
    if total_pending == 0:
        console.print("[green]✅ 暂无待跟进事项[/green]")
    else:
        console.print(f"[bold]总计待跟进: {total_pending} 项[/bold]")


@app.command("query-by-influencer")
def query_by_influencer(
    name_or_id: str = typer.Option(..., help="达人姓名或ID"),
):
    influencers = load_json(INFLUENCERS_FILE)
    shippings = load_json(SHIPPINGS_FILE)
    feedbacks = load_json(FEEDBACKS_FILE)
    
    influencer = next((i for i in influencers if i["name"] == name_or_id or i["id"] == name_or_id), None)
    if not influencer:
        typer.echo(f"❌ 未找到达人: {name_or_id}")
        raise typer.Exit(1)
    
    console.print(f"\n[bold cyan]📋 达人信息[/bold cyan]")
    console.print(f"  ID: {influencer['id']}")
    console.print(f"  姓名: {influencer['name']}")
    console.print(f"  平台: {influencer['platform']}")
    console.print(f"  粉丝数: {influencer['followers']:,}")
    console.print(f"  地址: {influencer['address']}")
    if influencer['note']:
        console.print(f"  备注: {influencer['note']}")
    
    influencer_shippings = [s for s in shippings if s["influencer_id"] == influencer["id"]]
    
    if not influencer_shippings:
        console.print("\n[yellow]该达人暂无寄样记录[/yellow]")
        return
    
    console.print(f"\n[bold magenta]📦 寄样历史 ({len(influencer_shippings)}条):[/bold magenta]")
    for idx, s in enumerate(influencer_shippings, 1):
        console.print(f"\n--- 记录 {idx} ---")
        console.print(f"  物流ID: {s['id']}")
        console.print(f"  样品: {s['sample_name']}")
        console.print(f"  物流单号: {s['shipping_no']} ({s['shipping_company']})")
        console.print(f"  发货日期: {s['shipping_date']}")
        if s['delivered_date']:
            console.print(f"  签收日期: {s['delivered_date']}")
        console.print(f"  状态: [bold]{s['status']}[/bold]")
        if s.get('is_duplicate'):
            console.print(f"  [yellow]⚠️ 重复寄送[/yellow]")
        
        fb = next((f for f in feedbacks if f["shipping_id"] == s["id"]), None)
        if fb:
            console.print(f"  反馈:")
            console.print(f"    结论: {fb['conclusion']}")
            console.print(f"    评分: {'⭐' * fb['rating']}")
            if fb['comment']:
                console.print(f"    评价: {fb['comment']}")
            console.print(f"    反馈日期: {fb['feedback_date']}")
        
        if s.get('return_date'):
            console.print(f"  退样日期: {s['return_date']}")
            if s.get('return_damaged'):
                console.print(f"  [red]退样损坏: {s.get('return_damaged_note', '是')}[/red]")


@app.command("query-by-sample")
def query_by_sample(
    name_or_id: str = typer.Option(..., help="样品名称或ID"),
):
    samples = load_json(SAMPLES_FILE)
    shippings = load_json(SHIPPINGS_FILE)
    feedbacks = load_json(FEEDBACKS_FILE)
    
    sample = next((s for s in samples if s["name"] == name_or_id or s["id"] == name_or_id), None)
    if not sample:
        typer.echo(f"❌ 未找到样品: {name_or_id}")
        raise typer.Exit(1)
    
    console.print(f"\n[bold cyan]📋 样品信息[/bold cyan]")
    console.print(f"  ID: {sample['id']}")
    console.print(f"  名称: {sample['name']}")
    console.print(f"  类别: {sample['category']}")
    console.print(f"  SKU: {sample['sku']}")
    console.print(f"  价值: ¥{sample['value']:.2f}")
    console.print(f"  试用有效期: {sample['expiration_days']}天")
    console.print(f"  批次: {sample['batch_no']}")
    
    sample_shippings = [s for s in shippings if s["sample_id"] == sample["id"]]
    
    if not sample_shippings:
        console.print("\n[yellow]该样品暂无寄送记录[/yellow]")
        return
    
    console.print(f"\n[bold magenta]📦 寄送历史 ({len(sample_shippings)}条):[/bold magenta]")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("达人")
    table.add_column("物流单号")
    table.add_column("发货日期")
    table.add_column("签收日期")
    table.add_column("状态")
    table.add_column("反馈")
    table.add_column("备注")
    
    for s in sample_shippings:
        fb = next((f for f in feedbacks if f["shipping_id"] == s["id"]), None)
        feedback_str = fb["conclusion"] if fb else "-"
        remarks = []
        if s.get("is_duplicate"):
            remarks.append("重复寄送")
        if s.get("return_damaged"):
            remarks.append("退样损坏")
        
        table.add_row(
            s["influencer_name"],
            s["shipping_no"],
            s["shipping_date"],
            s["delivered_date"] or "-",
            s["status"],
            feedback_str,
            ", ".join(remarks) if remarks else "-",
        )
    console.print(table)


@app.command("report")
def generate_report(
    output: str = typer.Option("sample_report.md", help="输出文件名"),
):
    influencers = load_json(INFLUENCERS_FILE)
    samples = load_json(SAMPLES_FILE)
    shippings = load_json(SHIPPINGS_FILE)
    feedbacks = load_json(FEEDBACKS_FILE)
    today = get_today()
    
    total_shippings = len(shippings)
    completed = len([s for s in shippings if s["status"] in [SampleStatus.COMPLETED.value, SampleStatus.RETURNED.value]])
    pending = total_shippings - completed
    
    status_counts = {}
    for s in shippings:
        status_counts[s["status"]] = status_counts.get(s["status"], 0) + 1
    
    duplicate_count = len([s for s in shippings if s.get("is_duplicate")])
    damaged_count = len([s for s in shippings if s.get("return_damaged")])
    
    no_feedback_count = 0
    expired_count = 0
    for s in shippings:
        if s["delivered_date"]:
            sample = next((sp for sp in samples if sp["id"] == s["sample_id"]), {})
            expiration_days = sample.get("expiration_days", 30)
            delivered = parse_date(s["delivered_date"])
            days_since_delivered = (today - delivered).days
            
            if days_since_delivered >= 7 and s["status"] in [SampleStatus.DELIVERED.value, SampleStatus.IN_USE.value]:
                no_feedback_count += 1
            
            if days_since_delivered >= expiration_days and s["status"] not in [SampleStatus.COMPLETED.value, SampleStatus.RETURNED.value, SampleStatus.RETURN_DAMAGED.value]:
                expired_count += 1
    
    conclusion_counts = {}
    total_rating = 0
    rating_count = 0
    for fb in feedbacks:
        conclusion_counts[fb["conclusion"]] = conclusion_counts.get(fb["conclusion"], 0) + 1
        total_rating += fb["rating"]
        rating_count += 1
    
    avg_rating = round(total_rating / rating_count, 2) if rating_count > 0 else 0
    
    report_lines = []
    report_lines.append("# 直播样品寄送跟进报告")
    report_lines.append("")
    report_lines.append(f"**生成日期**: {format_date(today)}")
    report_lines.append(f"**统计范围**: 全部记录")
    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    
    report_lines.append("## 一、总体概览")
    report_lines.append("")
    report_lines.append("| 指标 | 数值 |")
    report_lines.append("|------|------|")
    report_lines.append(f"| 达人总数 | {len(influencers)} |")
    report_lines.append(f"| 样品总数 | {len(samples)} |")
    report_lines.append(f"| 寄送总记录 | {total_shippings} |")
    report_lines.append(f"| 已完成 | {completed} |")
    report_lines.append(f"| 进行中 | {pending} |")
    report_lines.append(f"| 重复寄送记录 | {duplicate_count} |")
    report_lines.append(f"| 退样损坏 | {damaged_count} |")
    report_lines.append(f"| 签收7天+无反馈 | {no_feedback_count} |")
    report_lines.append(f"| 样品过期 | {expired_count} |")
    report_lines.append(f"| 平均评分 | {avg_rating} ⭐ |")
    report_lines.append("")
    
    report_lines.append("## 二、状态分布")
    report_lines.append("")
    report_lines.append("| 状态 | 数量 |")
    report_lines.append("|------|------|")
    for status, count in sorted(status_counts.items()):
        report_lines.append(f"| {status} | {count} |")
    report_lines.append("")
    
    if conclusion_counts:
        report_lines.append("## 三、反馈结论分布")
        report_lines.append("")
        report_lines.append("| 结论 | 数量 |")
        report_lines.append("|------|------|")
        for conclusion, count in sorted(conclusion_counts.items()):
            report_lines.append(f"| {conclusion} | {count} |")
        report_lines.append("")
    
    pending_shippings = [s for s in shippings if s["status"] not in [SampleStatus.COMPLETED.value, SampleStatus.RETURNED.value]]
    if pending_shippings:
        report_lines.append("## 四、待跟进明细")
        report_lines.append("")
        report_lines.append("| 达人 | 样品 | 物流单号 | 发货日期 | 签收日期 | 当前状态 | 风险标记 |")
        report_lines.append("|------|------|----------|----------|----------|----------|----------|")
        
        for s in pending_shippings:
            risks = []
            if s.get("is_duplicate"):
                risks.append("重复寄送")
            
            if s["delivered_date"]:
                sample = next((sp for sp in samples if sp["id"] == s["sample_id"]), {})
                expiration_days = sample.get("expiration_days", 30)
                delivered = parse_date(s["delivered_date"])
                days_since_delivered = (today - delivered).days
                
                if days_since_delivered >= 7 and s["status"] in [SampleStatus.DELIVERED.value, SampleStatus.IN_USE.value]:
                    risks.append("无反馈超时")
                if days_since_delivered >= expiration_days:
                    risks.append("样品过期")
            
            fb = next((f for f in feedbacks if f["shipping_id"] == s["id"]), None)
            if fb and fb["conclusion"] == FeedbackConclusion.NEED_MORE.value:
                risks.append("需补寄")
            
            report_lines.append(
                f"| {s['influencer_name']} | {s['sample_name']} | {s['shipping_no']} | "
                f"{s['shipping_date']} | {s['delivered_date'] or '-'} | {s['status']} | "
                f"{', '.join(risks) if risks else '-'} |"
            )
        report_lines.append("")
    
    if damaged_count > 0 or duplicate_count > 0 or no_feedback_count > 0:
        report_lines.append("## 五、问题复盘")
        report_lines.append("")
        
        if duplicate_count > 0:
            report_lines.append("### 5.1 重复寄送问题")
            report_lines.append("")
            report_lines.append(f"- 发现 {duplicate_count} 条重复寄送记录")
            report_lines.append("- 建议：优化寄样前校验流程，确保同一达人同一样品不会重复寄出")
            report_lines.append("")
        
        if no_feedback_count > 0:
            report_lines.append("### 5.2 反馈超时问题")
            report_lines.append("")
            report_lines.append(f"- {no_feedback_count} 位达人签收超过7天未反馈")
            report_lines.append("- 建议：设置3天、7天、15天三级提醒机制")
            report_lines.append("")
        
        if damaged_count > 0:
            report_lines.append("### 5.3 退样损坏问题")
            report_lines.append("")
            report_lines.append(f"- {damaged_count} 件样品退样时损坏")
            report_lines.append("- 建议：明确退样包装要求，考虑购买物流保险")
            report_lines.append("")
    
    report_lines.append("## 六、下一步行动计划")
    report_lines.append("")
    report_lines.append("1. **立即处理**：联系签收超过7天未反馈的达人催反馈")
    report_lines.append("2. **重点跟进**：退样损坏的样品需要与达人确认责任")
    report_lines.append("3. **优化流程**：检查重复寄送原因，完善寄样审批流程")
    report_lines.append("4. **定期复盘**：建议每周生成此报告进行跟进")
    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    report_lines.append("*报告由直播样品寄送跟进 CLI 工具自动生成*")
    
    with open(output, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    
    typer.echo(f"✅ 报告已生成: {output}")


@app.command("seed-data")
def seed_data():
    typer.echo("🚀 正在生成样例数据...")
    
    influencers = [
        {
            "id": "INF001",
            "name": "美妆达人小美",
            "phone": "13800138001",
            "platform": "抖音",
            "followers": 1500000,
            "address": "北京市朝阳区XX路XX号",
            "note": "头部美妆博主，合作优先级高",
            "created_at": "2026-01-01",
        },
        {
            "id": "INF002",
            "name": "穿搭博主阿杰",
            "phone": "13800138002",
            "platform": "快手",
            "followers": 800000,
            "address": "上海市静安区XX路XX号",
            "note": "",
            "created_at": "2026-01-05",
        },
        {
            "id": "INF003",
            "name": "美食主播小丽",
            "phone": "13800138003",
            "platform": "淘宝直播",
            "followers": 2200000,
            "address": "广州市天河区XX路XX号",
            "note": "食品类目TOP主播",
            "created_at": "2026-01-10",
        },
        {
            "id": "INF004",
            "name": "数码达人老王",
            "phone": "13800138004",
            "platform": "B站",
            "followers": 500000,
            "address": "深圳市南山区XX路XX号",
            "note": "",
            "created_at": "2026-01-15",
        },
    ]
    
    samples = [
        {
            "id": "SMP001",
            "name": "水润保湿精华液",
            "category": "护肤",
            "sku": "SKU-HF-001",
            "value": 299.00,
            "expiration_days": 14,
            "batch_no": "BATCH-2026-001",
            "created_at": "2026-01-01",
        },
        {
            "id": "SMP002",
            "name": "春季新款连衣裙",
            "category": "服装",
            "sku": "SKU-CL-002",
            "value": 399.00,
            "expiration_days": 21,
            "batch_no": "BATCH-2026-002",
            "created_at": "2026-01-05",
        },
        {
            "id": "SMP003",
            "name": "有机坚果礼盒",
            "category": "食品",
            "sku": "SKU-FD-003",
            "value": 168.00,
            "expiration_days": 30,
            "batch_no": "BATCH-2026-003",
            "created_at": "2026-01-10",
        },
        {
            "id": "SMP004",
            "name": "无线蓝牙耳机",
            "category": "数码",
            "sku": "SKU-DG-004",
            "value": 599.00,
            "expiration_days": 30,
            "batch_no": "BATCH-2026-004",
            "created_at": "2026-01-15",
        },
    ]
    
    shippings = [
        {
            "id": "SHP001",
            "influencer_id": "INF001",
            "influencer_name": "美妆达人小美",
            "sample_id": "SMP001",
            "sample_name": "水润保湿精华液",
            "shipping_no": "SF1234567890001",
            "shipping_company": "顺丰",
            "shipping_date": "2026-04-20",
            "delivered_date": "2026-04-22",
            "status": SampleStatus.COMPLETED.value,
            "is_duplicate": False,
            "created_at": "2026-04-20",
        },
        {
            "id": "SHP002",
            "influencer_id": "INF002",
            "influencer_name": "穿搭博主阿杰",
            "sample_id": "SMP002",
            "sample_name": "春季新款连衣裙",
            "shipping_no": "SF1234567890002",
            "shipping_company": "顺丰",
            "shipping_date": "2026-04-25",
            "delivered_date": "2026-04-27",
            "status": SampleStatus.DELIVERED.value,
            "is_duplicate": False,
            "created_at": "2026-04-25",
        },
        {
            "id": "SHP003",
            "influencer_id": "INF003",
            "influencer_name": "美食主播小丽",
            "sample_id": "SMP003",
            "sample_name": "有机坚果礼盒",
            "shipping_no": "SF1234567890003",
            "shipping_company": "顺丰",
            "shipping_date": "2026-04-15",
            "delivered_date": "2026-04-17",
            "status": SampleStatus.RETURN_DAMAGED.value,
            "is_duplicate": False,
            "return_date": "2026-05-01",
            "return_damaged": True,
            "return_damaged_note": "外包装破损，部分产品受潮",
            "created_at": "2026-04-15",
        },
        {
            "id": "SHP004",
            "influencer_id": "INF001",
            "influencer_name": "美妆达人小美",
            "sample_id": "SMP001",
            "sample_name": "水润保湿精华液",
            "shipping_no": "SF1234567890004",
            "shipping_company": "顺丰",
            "shipping_date": "2026-04-28",
            "delivered_date": "2026-04-30",
            "status": SampleStatus.IN_USE.value,
            "is_duplicate": True,
            "created_at": "2026-04-28",
        },
        {
            "id": "SHP005",
            "influencer_id": "INF004",
            "influencer_name": "数码达人老王",
            "sample_id": "SMP004",
            "sample_name": "无线蓝牙耳机",
            "shipping_no": "SF1234567890005",
            "shipping_company": "顺丰",
            "shipping_date": "2026-04-10",
            "delivered_date": "2026-04-12",
            "status": SampleStatus.RETURN_REQUESTED.value,
            "is_duplicate": False,
            "created_at": "2026-04-10",
        },
    ]
    
    feedbacks = [
        {
            "id": "FBK001",
            "shipping_id": "SHP001",
            "influencer_id": "INF001",
            "influencer_name": "美妆达人小美",
            "sample_id": "SMP001",
            "sample_name": "水润保湿精华液",
            "conclusion": FeedbackConclusion.KEEP.value,
            "rating": 5,
            "comment": "质地轻盈，吸收快，保湿效果好，适合直播带货",
            "feedback_date": "2026-04-28",
            "created_at": "2026-04-28",
            "updated_at": "2026-04-28",
        },
        {
            "id": "FBK003",
            "shipping_id": "SHP003",
            "influencer_id": "INF003",
            "influencer_name": "美食主播小丽",
            "sample_id": "SMP003",
            "sample_name": "有机坚果礼盒",
            "conclusion": FeedbackConclusion.RETURN.value,
            "rating": 2,
            "comment": "包装不够精美，直播展示效果一般",
            "feedback_date": "2026-04-25",
            "created_at": "2026-04-25",
            "updated_at": "2026-04-25",
        },
        {
            "id": "FBK005",
            "shipping_id": "SHP005",
            "influencer_id": "INF004",
            "influencer_name": "数码达人老王",
            "sample_id": "SMP004",
            "sample_name": "无线蓝牙耳机",
            "conclusion": FeedbackConclusion.RETURN.value,
            "rating": 3,
            "comment": "音质尚可，但延迟略高，需要进一步测试",
            "feedback_date": "2026-04-20",
            "created_at": "2026-04-20",
            "updated_at": "2026-04-20",
        },
    ]
    
    save_json(INFLUENCERS_FILE, influencers)
    save_json(SAMPLES_FILE, samples)
    save_json(SHIPPINGS_FILE, shippings)
    save_json(FEEDBACKS_FILE, feedbacks)
    
    typer.echo("✅ 样例数据已生成！")
    typer.echo("")
    typer.echo("📊 数据包含:")
    typer.echo("  - 4位达人")
    typer.echo("  - 4款样品")
    typer.echo("  - 5条物流记录（覆盖各种场景）")
    typer.echo("  - 3条反馈记录")
    typer.echo("")
    typer.echo("🎯 覆盖场景:")
    typer.echo("  1. SHP001: 正常签收 + 自留反馈 + 已完成")
    typer.echo("  2. SHP002: 签收超过7天无反馈")
    typer.echo("  3. SHP003: 退样损坏")
    typer.echo("  4. SHP004: 重复寄送（同一达人同一样品）")
    typer.echo("  5. SHP005: 待退样")
    typer.echo("")
    typer.echo("💡 下一步:")
    typer.echo("  python sample_tracker.py pending  # 查看待跟进列表")


@app.command("list-influencers")
def list_influencers():
    influencers = load_json(INFLUENCERS_FILE)
    if not influencers:
        typer.echo("暂无达人数据")
        return
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("ID")
    table.add_column("姓名")
    table.add_column("平台")
    table.add_column("粉丝数")
    table.add_column("电话")
    
    for i in influencers:
        table.add_row(
            i["id"],
            i["name"],
            i["platform"],
            f"{i['followers']:,}",
            i["phone"],
        )
    console.print(table)


@app.command("list-samples")
def list_samples():
    samples = load_json(SAMPLES_FILE)
    if not samples:
        typer.echo("暂无样品数据")
        return
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("ID")
    table.add_column("名称")
    table.add_column("类别")
    table.add_column("SKU")
    table.add_column("价值")
    table.add_column("有效期")
    
    for s in samples:
        table.add_row(
            s["id"],
            s["name"],
            s["category"],
            s["sku"],
            f"¥{s['value']:.2f}",
            f"{s['expiration_days']}天",
        )
    console.print(table)


@app.command("list-shippings")
def list_shippings():
    shippings = load_json(SHIPPINGS_FILE)
    if not shippings:
        typer.echo("暂无物流数据")
        return
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("ID")
    table.add_column("达人")
    table.add_column("样品")
    table.add_column("物流单号")
    table.add_column("发货日期")
    table.add_column("状态")
    table.add_column("备注")
    
    for s in shippings:
        remarks = []
        if s.get("is_duplicate"):
            remarks.append("重复")
        if s.get("return_damaged"):
            remarks.append("损坏")
        table.add_row(
            s["id"],
            s["influencer_name"],
            s["sample_name"],
            s["shipping_no"],
            s["shipping_date"],
            s["status"],
            ", ".join(remarks) if remarks else "-",
        )
    console.print(table)


if __name__ == "__main__":
    app()
