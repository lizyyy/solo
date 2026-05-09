import click
from tabulate import tabulate
import json
from datetime import datetime
from typing import Optional
import os

from .db import init_db, get_db_path
from .models import (
    AircraftRule, FlightPlan, PassengerSpecialMeal,
    LoadingRecord, SpecialMealType
)
from .repository import (
    AircraftRuleRepo, FlightPlanRepo, PassengerSpecialMealRepo,
    LoadingRecordRepo, VerificationResultRepo, OperationHistoryRepo,
    SpecialMealTypeRepo
)
from .verification import VerificationEngine

@click.group()
def cli():
    pass

@cli.command()
def init():
    init_db()
    click.echo(f"数据库已初始化: {get_db_path()}")

@cli.group()
def rules():
    pass

@rules.command("list")
def rules_list():
    rules_list = AircraftRuleRepo.list_all()
    if not rules_list:
        click.echo("暂无机型装载规则")
        return
    table = []
    for r in rules_list:
        table.append([
            r.aircraft_type, r.economy_meals, r.business_meals,
            r.first_class_meals, r.snacks, r.beverages
        ])
    click.echo(tabulate(table,
                        headers=["机型", "经济舱餐食", "商务舱餐食", "头等舱餐食", "零食", "饮品"],
                        tablefmt="simple"))

@rules.command("import")
@click.option("--file", "-f", required=True, type=click.Path(exists=True), help="JSON文件路径")
@click.option("--operator", "-o", default="system", help="操作人")
def rules_import(file, operator):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    imported = 0
    for item in data:
        rule = AircraftRule(
            aircraft_type=item.get("aircraft_type"),
            economy_meals=item.get("economy_meals", 0),
            business_meals=item.get("business_meals", 0),
            first_class_meals=item.get("first_class_meals", 0),
            snacks=item.get("snacks", 0),
            beverages=item.get("beverages", 0),
            cutlery_sets=item.get("cutlery_sets", 0),
            blankets=item.get("blankets", 0),
            pillows=item.get("pillows", 0),
            headsets=item.get("headsets", 0),
            amenity_kits=item.get("amenity_kits", 0)
        )
        if AircraftRuleRepo.get_by_type(rule.aircraft_type):
            AircraftRuleRepo.update(rule, operator)
        else:
            AircraftRuleRepo.create(rule, operator)
        imported += 1
        click.echo(f"已导入机型规则: {rule.aircraft_type}")
    click.echo(f"共导入 {imported} 条机型规则")

@cli.group()
def flights():
    pass

@flights.command("list")
@click.option("--status", "-s", default=None, help="按状态筛选")
def flights_list(status):
    plans = FlightPlanRepo.list_all(status)
    if not plans:
        click.echo("暂无航班计划")
        return
    table = []
    for p in plans:
        prev_aircraft = f"-> {p.previous_aircraft_type}" if p.previous_aircraft_type else ""
        table.append([
            p.flight_number, p.aircraft_type, prev_aircraft,
            p.route, p.total_passengers(), p.status, p.version
        ])
    click.echo(tabulate(table,
                        headers=["航班号", "机型", "原机型", "航段", "乘客数", "状态", "版本"],
                        tablefmt="simple"))

@flights.command("import")
@click.option("--file", "-f", required=True, type=click.Path(exists=True), help="JSON文件路径")
@click.option("--operator", "-o", default="system", help="操作人")
def flights_import(file, operator):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    imported = 0
    for item in data:
        fp = FlightPlan(
            flight_number=item.get("flight_number"),
            aircraft_type=item.get("aircraft_type"),
            route=item.get("route"),
            scheduled_departure=item.get("scheduled_departure"),
            economy_passengers=item.get("economy_passengers", 0),
            business_passengers=item.get("business_passengers", 0),
            first_class_passengers=item.get("first_class_passengers", 0),
            status=item.get("status", "active")
        )
        existing = FlightPlanRepo.get_by_flight_number(fp.flight_number)
        if existing:
            updated = FlightPlanRepo.update(fp, operator)
            if existing.aircraft_type != updated.aircraft_type:
                click.echo(f"⚠️ 航班 {fp.flight_number} 换机: {existing.aircraft_type} -> {updated.aircraft_type}")
            else:
                click.echo(f"已更新航班计划: {fp.flight_number} (版本 {updated.version})")
        else:
            created = FlightPlanRepo.create(fp, operator)
            click.echo(f"已创建航班计划: {fp.flight_number}")
        
        if "special_meals" in item:
            for sm in item["special_meals"]:
                psm = PassengerSpecialMeal(
                    flight_number=fp.flight_number,
                    meal_code=sm.get("meal_code"),
                    count=sm.get("count", 0),
                    passenger_names=sm.get("passenger_names")
                )
                PassengerSpecialMealRepo.create_or_update(psm, operator)
                click.echo(f"  特殊餐 {sm.get('meal_code')}: {sm.get('count')}份")
        
        imported += 1
    click.echo(f"共处理 {imported} 条航班计划")

@flights.command("change-aircraft")
@click.option("--flight-number", "-fn", required=True, help="航班号")
@click.option("--new-aircraft", "-na", required=True, help="新机型")
@click.option("--operator", "-o", default="system", help="操作人")
def flights_change_aircraft(flight_number, new_aircraft, operator):
    existing = FlightPlanRepo.get_by_flight_number(flight_number)
    if not existing:
        click.echo(f"错误: 未找到航班 {flight_number}")
        return
    click.echo(f"航班 {flight_number}: {existing.aircraft_type} -> {new_aircraft}")
    existing.aircraft_type = new_aircraft
    updated = FlightPlanRepo.update(existing, operator)
    click.echo(f"换机完成，版本 {updated.version}")
    if updated.previous_aircraft_type:
        click.echo(f"⚠️ 请重新检查该航班的装载记录！")

@cli.group()
def loading():
    pass

@loading.command("list")
@click.option("--flight-number", "-fn", default=None, help="按航班号筛选")
def loading_list(flight_number):
    if flight_number:
        records = LoadingRecordRepo.get_by_flight(flight_number)
    else:
        records = LoadingRecordRepo.list_all()
    if not records:
        click.echo("暂无装载记录")
        return
    table = []
    for r in records:
        sp_counts = sum(sm["loaded_count"] for sm in r.special_meals)
        table.append([
            r.id, r.flight_number, r.aircraft_type, r.plan_version,
            r.economy_meals_loaded + r.business_meals_loaded + r.first_class_meals_loaded,
            sp_counts, r.status
        ])
    click.echo(tabulate(table,
                        headers=["ID", "航班号", "机型", "计划版本", "普通餐", "特殊餐", "状态"],
                        tablefmt="simple"))

@loading.command("import")
@click.option("--file", "-f", required=True, type=click.Path(exists=True), help="JSON文件路径")
@click.option("--operator", "-o", default="system", help="操作人")
def loading_import(file, operator):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    imported = 0
    for item in data:
        fp = FlightPlanRepo.get_by_flight_number(item.get("flight_number"))
        plan_version = fp.version if fp else 1
        record = LoadingRecord(
            flight_number=item.get("flight_number"),
            aircraft_type=item.get("aircraft_type"),
            plan_version=plan_version,
            economy_meals_loaded=item.get("economy_meals_loaded", 0),
            business_meals_loaded=item.get("business_meals_loaded", 0),
            first_class_meals_loaded=item.get("first_class_meals_loaded", 0),
            snacks_loaded=item.get("snacks_loaded", 0),
            beverages_loaded=item.get("beverages_loaded", 0),
            cutlery_sets_loaded=item.get("cutlery_sets_loaded", 0),
            blankets_loaded=item.get("blankets_loaded", 0),
            pillows_loaded=item.get("pillows_loaded", 0),
            headsets_loaded=item.get("headsets_loaded", 0),
            amenity_kits_loaded=item.get("amenity_kits_loaded", 0),
            loader_name=item.get("loader_name"),
            load_time=item.get("load_time"),
            status=item.get("status", "pending"),
            special_meals=item.get("special_meals", [])
        )
        created = LoadingRecordRepo.create(record, operator)
        click.echo(f"已导入装载记录 #{created.id}: {created.flight_number} ({created.aircraft_type})")
        for sm in created.special_meals:
            click.echo(f"  特殊餐 {sm['meal_code']}: {sm['loaded_count']}份")
        imported += 1
    click.echo(f"共导入 {imported} 条装载记录")

@cli.group()
def check():
    pass

@check.command("run")
@click.option("--flight-number", "-fn", default=None, help="指定航班号（留空检查全部）")
@click.option("--operator", "-o", default="system", help="操作人")
def check_run(flight_number, operator):
    engine = VerificationEngine()
    if flight_number:
        result = engine.run_verification_for_flight(flight_number, operator)
        print_verification_result(result)
    else:
        result = engine.run_verification_all(operator)
        print_verification_summary(result)

def print_verification_result(result):
    click.echo("\n" + "=" * 60)
    click.echo(f"航班装载核验结果: {result.get('flight_number')}")
    click.echo("=" * 60)
    
    if result.get("status") == "ERROR":
        click.echo(f"❌ 错误: {result.get('message')}")
        return
    
    fp = result.get("flight_plan", {})
    lr = result.get("loading_record", {})
    
    click.echo(f"航班机型: {fp.get('aircraft_type')} (v{fp.get('version')})")
    if fp.get('previous_aircraft_type'):
        click.echo(f"⚠️  换机历史: {fp.get('previous_aircraft_type')} -> {fp.get('aircraft_type')}")
    click.echo(f"装载机型: {lr.get('aircraft_type')} (计划版本 {lr.get('plan_version')})")
    click.echo("")
    
    status_map = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️ "}
    summary = result
    click.echo(f"综合状态: {status_map.get(summary.get('status'), '?')} {summary.get('status')}")
    click.echo(f"通过: {summary.get('pass_count', 0)} | 警告: {summary.get('warn_count', 0)} | 失败: {summary.get('fail_count', 0)}")
    click.echo("-" * 60)
    
    for item in summary.get("results", []):
        details = item.get("details", {})
        status_char = status_map.get(item.get("status"), "?")
        check_type = item.get("check_type")
        click.echo(f"\n{status_char} {check_type}")
        
        if item.get("status") == "FAIL":
            if "deficit" in details:
                click.echo(f"   缺装: {details.get('deficit')} 份 (需{details.get('required_quantity')}, 实装{details.get('loaded_quantity')})")
            elif "message" in details:
                click.echo(f"   {details.get('message')}")
        elif item.get("status") == "WARN":
            if "message" in details:
                click.echo(f"   {details.get('message')}")
    click.echo("=" * 60)

def print_verification_summary(result):
    click.echo("\n" + "=" * 60)
    click.echo("航班装载核验汇总")
    click.echo("=" * 60)
    status_map = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️ "}
    click.echo(f"综合状态: {status_map.get(result.get('status'), '?')} {result.get('status')}")
    click.echo(f"总航班数: {result.get('total_flights')}")
    click.echo(f"通过: {result.get('pass_count')} | 警告: {result.get('warn_count')} | 失败: {result.get('fail_count')}")
    click.echo("-" * 60)
    
    table = []
    for fr in result.get("flights", []):
        status_char = status_map.get(fr.get("status"), "?")
        fp = fr.get("flight_plan", {})
        prev_aircraft = f"-> {fp.get('previous_aircraft_type')}" if fp.get("previous_aircraft_type") else ""
        table.append([
            status_char, fr.get("flight_number"),
            f"{fp.get('aircraft_type')} {prev_aircraft}",
            fr.get("pass_count", 0), fr.get("warn_count", 0), fr.get("fail_count", 0)
        ])
    if table:
        click.echo(tabulate(table, headers=["状态", "航班", "机型", "通过", "警告", "失败"], tablefmt="simple"))
    click.echo("=" * 60)

@check.command("anomalies")
@click.option("--flight-number", "-fn", default=None, help="指定航班号")
def check_anomalies(flight_number):
    if flight_number:
        results = VerificationResultRepo.get_by_flight(flight_number)
    else:
        results = VerificationResultRepo.list_all()
    
    anomalies = [r for r in results if r.status in ["FAIL", "WARN"]]
    if not anomalies:
        click.echo("✅ 未发现异常记录")
        return
    
    click.echo(f"共发现 {len(anomalies)} 条异常记录")
    click.echo("-" * 60)
    
    status_map = {"FAIL": "❌", "WARN": "⚠️ "}
    for a in anomalies:
        details = json.loads(a.details) if a.details else {}
        msg = details.get("message", f"{a.check_type}")
        click.echo(f"{status_map.get(a.status, '?')} [{a.status}] {a.flight_number} - {msg}")
        if "deficit" in details:
            click.echo(f"   缺装: {details['deficit']} (需{details['required_quantity']}, 实装{details['loaded_quantity']})")

@check.command("history")
@click.option("--flight-number", "-fn", default=None, help="指定航班号")
def check_history(flight_number):
    if flight_number:
        results = VerificationResultRepo.get_by_flight(flight_number)
    else:
        results = VerificationResultRepo.list_all()
    
    if not results:
        click.echo("暂无核验历史")
        return
    
    table = []
    status_map = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️ "}
    for r in results:
        table.append([
            status_map.get(r.status, "?"), r.flight_number,
            r.check_type, r.status, r.created_at
        ])
    click.echo(tabulate(table, headers=["", "航班", "检查项", "状态", "时间"], tablefmt="simple"))

@cli.group()
def history():
    pass

@history.command("show")
@click.option("--entity-type", "-t", default=None, help="实体类型: flight_plan, loading_record, aircraft_rule")
@click.option("--entity-id", "-i", default=None, help="实体ID")
@click.option("--limit", "-n", default=50, help="显示条数")
def history_show(entity_type, entity_id, limit):
    if entity_type or entity_id:
        records = OperationHistoryRepo.list_by_entity(entity_type, entity_id)
    else:
        records = OperationHistoryRepo.list_recent(limit)
    
    if not records:
        click.echo("暂无操作历史")
        return
    
    table = []
    for r in records[:limit]:
        before = json.loads(r.before_data) if r.before_data else {}
        after = json.loads(r.after_data) if r.after_data else {}
        
        change_summary = ""
        if r.operation == "UPDATE":
            changes = []
            for key in set(list(before.keys()) + list(after.keys())):
                bv = before.get(key)
                av = after.get(key)
                if bv != av:
                    changes.append(f"{key}: {bv}->{av}")
            change_summary = ", ".join(changes[:3])
        elif r.operation == "CREATE":
            change_summary = str(after.get("aircraft_type", after.get("flight_number", "")))
        
        table.append([
            r.timestamp[:19], r.operation, r.entity_type, r.entity_id,
            r.operator, change_summary[:50]
        ])
    click.echo(tabulate(table,
                        headers=["时间", "操作", "实体类型", "实体ID", "操作人", "变更摘要"],
                        tablefmt="simple"))

@cli.command()
@click.option("--output", "-o", default="verification_report.html", help="输出文件路径")
@click.option("--title", "-t", default="民航机供品装载核验报告", help="报告标题")
def report(output, title):
    engine = VerificationEngine()
    result = engine.run_verification_all()
    gen_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #333; }}
        h1 {{ border-bottom: 2px solid #0066cc; padding-bottom: 10px; }}
        .summary-box {{ padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .pass {{ background: #d4edda; border: 1px solid #28a745; }}
        .warn {{ background: #fff3cd; border: 1px solid #ffc107; }}
        .fail {{ background: #f8d7da; border: 1px solid #dc3545; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background: #f5f5f5; }}
        .status-pass {{ color: #28a745; font-weight: bold; }}
        .status-warn {{ color: #ffc107; font-weight: bold; }}
        .status-fail {{ color: #dc3545; font-weight: bold; }}
        .aircraft-change {{ background: #fff3cd; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <p>生成时间: {gen_time}</p>
    
    <div class="summary-box {result.get('status', '').lower()}">
        <h2>核验总览</h2>
        <p>总航班数: <strong>{result.get('total_flights', 0)}</strong></p>
        <p>通过: <span class="status-pass">{result.get('pass_count', 0)}</span> | 
           警告: <span class="status-warn">{result.get('warn_count', 0)}</span> | 
           失败: <span class="status-fail">{result.get('fail_count', 0)}</span></p>
        <p>综合状态: <strong class="status-{result.get('status', '').lower()}">{result.get('status')}</strong></p>
    </div>
    
    <h2>明细</h2>
    <table>
        <thead>
            <tr>
                <th>状态</th>
                <th>航班</th>
                <th>机型</th>
                <th>通过</th>
                <th>警告</th>
                <th>失败</th>
            </tr>
        </thead>
        <tbody>
"""
    
    for fr in result.get("flights", []):
        fp = fr.get("flight_plan", {})
        prev_aircraft = f"→ {fp.get('previous_aircraft_type')}" if fp.get("previous_aircraft_type") else ""
        aircraft_display = f"{fp.get('aircraft_type')} {prev_aircraft}"
        row_class = "aircraft-change" if fp.get("previous_aircraft_type") else ""
        status_class = f"status-{fr.get('status', '').lower()}"
        html_content += f"""
            <tr class="{row_class}">
                <td class="{status_class}">{fr.get('status')}</td>
                <td>{fr.get('flight_number')}</td>
                <td>{aircraft_display}</td>
                <td>{fr.get('pass_count', 0)}</td>
                <td>{fr.get('warn_count', 0)}</td>
                <td>{fr.get('fail_count', 0)}</td>
            </tr>
"""
    
    html_content += """
        </tbody>
    </table>
    
    <h2>异常详情</h2>
"""
    
    has_anomaly = False
    for fr in result.get("flights", []):
        anomalies = [r for r in fr.get("results", []) if r.get("status") in ["FAIL", "WARN"]]
        if anomalies:
            has_anomaly = True
            fp = fr.get("flight_plan", {})
            html_content += f"<h3>航班 {fr.get('flight_number')} ({fp.get('aircraft_type')})</h3>"
            html_content += "<ul>"
            for a in anomalies:
                details = a.get("details", {})
                msg = details.get("message", a.get("check_type"))
                status_class = f"status-{a.get('status', '').lower()}"
                html_content += f"<li class='{status_class}'>[{a.get('status')}] {msg}"
                if "deficit" in details:
                    html_content += f" - 缺装 {details['deficit']} 份 (需{details['required_quantity']}, 实装{details['loaded_quantity']})"
                html_content += "</li>"
            html_content += "</ul>"
    
    if not has_anomaly:
        html_content += "<p>✅ 所有航班检查通过</p>"
    
    html_content += """
</body>
</html>
"""
    
    with open(output, "w", encoding="utf-8") as f:
        f.write(html_content)
    click.echo(f"报告已生成: {os.path.abspath(output)}")

if __name__ == "__main__":
    cli()
