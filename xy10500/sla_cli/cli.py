import click
import json
from pathlib import Path
from tabulate import tabulate
from datetime import datetime

from .models import init_database, db
from .sla_engine import (
    analyze_ticket,
    check_all_tickets,
    apply_correction,
    get_ticket_details,
    get_queue_ownership,
    parse_datetime
)
from .sample_data import create_sample_data, create_holidays


def print_success(message):
    click.secho(f"[成功] {message}", fg="green")


def print_error(message):
    click.secho(f"[错误] {message}", fg="red")


def print_warning(message):
    click.secho(f"[警告] {message}", fg="yellow")


def print_info(message):
    click.secho(f"[信息] {message}", fg="cyan")


@click.group()
def cli():
    """
    工单 SLA 违约归因 CLI 工具
    
    覆盖客服工单跨队列流转后的承诺时限、暂停原因和升级动作分析。
    """
    pass


@cli.command()
@click.option("--sample", is_flag=True, help="同时创建样例数据")
def init(sample):
    """
    初始化本地数据库和环境
    
    创建必要的数据表，可选择同时创建样例数据。
    """
    print_info("开始初始化数据库...")
    
    init_database()
    print_success("数据库初始化完成")
    
    if sample:
        print_info("正在创建样例数据...")
        result = create_sample_data()
        create_holidays()
        print_success(f"样例数据创建完成: {result['tickets']} 个工单, {result['transitions']} 个流转, {result['pauses']} 个暂停, {result['escalations']} 个升级")
    
    print_info("环境初始化完成。可使用 'sla --help' 查看所有命令。")


@cli.group()
def import_():
    """
    从CSV/JSON文件导入数据
    
    支持导入工单基础表、状态流转表、暂停说明和升级记录。
    重复导入同一ID的记录会被忽略（幂等性保证）。
    """
    pass


@import_.command("tickets")
@click.argument("file_path", type=click.Path(exists=True))
def import_tickets(file_path):
    """
    导入工单基础表
    
    必需字段: ticket_id, customer_id, created_at
    可选字段: customer_type, priority, current_queue, current_status
    """
    import pandas as pd
    conn = db.conn
    
    print_info(f"正在读取文件: {file_path}")
    
    df = pd.read_csv(file_path)
    records_count = len(df)
    success_count = 0
    failed_count = 0
    error_details = []
    
    for idx, row in df.iterrows():
        try:
            required = ["ticket_id", "customer_id", "created_at"]
            for field in required:
                if pd.isna(row.get(field)):
                    raise ValueError(f"缺少必填字段: {field}")
            
            ticket_id = str(row["ticket_id"])
            customer_type = str(row.get("customer_type", "NORMAL")).upper()
            if customer_type not in ["NORMAL", "VIP", "URGENT"]:
                customer_type = "NORMAL"
            
            conn.execute("""
                INSERT OR IGNORE INTO tickets 
                (ticket_id, customer_id, customer_type, created_at, 
                 priority, current_queue, current_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                ticket_id,
                str(row["customer_id"]),
                customer_type,
                str(row["created_at"]),
                str(row.get("priority", "NORMAL")),
                str(row.get("current_queue", "")) if pd.notna(row.get("current_queue")) else None,
                str(row.get("current_status", "")) if pd.notna(row.get("current_status")) else None
            ))
            success_count += 1
        except Exception as e:
            failed_count += 1
            error_details.append(f"行 {idx+1}: {str(e)}")
    
    conn.commit()
    
    log_entry = {
        "source_type": "tickets",
        "file_path": file_path,
        "records_count": records_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "error_details": "\n".join(error_details) if error_details else None
    }
    
    conn.execute("""
        INSERT INTO import_logs 
        (source_type, file_path, records_count, success_count, failed_count, error_details)
        VALUES (?, ?, ?, ?, ?, ?)
    """, tuple(log_entry.values()))
    conn.commit()
    
    print_success(f"导入完成: 总计 {records_count} 条, 成功 {success_count} 条, 失败 {failed_count} 条")
    
    if error_details:
        print_warning("失败详情:")
        for err in error_details[:10]:
            print_error(err)
        if len(error_details) > 10:
            print_warning(f"... 还有 {len(error_details) - 10} 条错误")


@import_.command("transitions")
@click.argument("file_path", type=click.Path(exists=True))
def import_transitions(file_path):
    """
    导入状态流转表
    
    必需字段: ticket_id, to_queue, to_status, transition_time, transition_id
    可选字段: from_queue, from_status, operator
    """
    import pandas as pd
    conn = db.conn
    
    print_info(f"正在读取文件: {file_path}")
    
    df = pd.read_csv(file_path)
    records_count = len(df)
    success_count = 0
    failed_count = 0
    error_details = []
    
    for idx, row in df.iterrows():
        try:
            required = ["ticket_id", "to_queue", "to_status", "transition_time", "transition_id"]
            for field in required:
                if pd.isna(row.get(field)):
                    raise ValueError(f"缺少必填字段: {field}")
            
            conn.execute("""
                INSERT OR IGNORE INTO status_transitions 
                (ticket_id, from_queue, to_queue, from_status, to_status, 
                 transition_time, operator, transition_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(row["ticket_id"]),
                str(row.get("from_queue", "")) if pd.notna(row.get("from_queue")) else None,
                str(row["to_queue"]),
                str(row.get("from_status", "")) if pd.notna(row.get("from_status")) else None,
                str(row["to_status"]),
                str(row["transition_time"]),
                str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                str(row["transition_id"])
            ))
            success_count += 1
        except Exception as e:
            failed_count += 1
            error_details.append(f"行 {idx+1}: {str(e)}")
    
    conn.commit()
    
    log_entry = {
        "source_type": "status_transitions",
        "file_path": file_path,
        "records_count": records_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "error_details": "\n".join(error_details) if error_details else None
    }
    
    conn.execute("""
        INSERT INTO import_logs 
        (source_type, file_path, records_count, success_count, failed_count, error_details)
        VALUES (?, ?, ?, ?, ?, ?)
    """, tuple(log_entry.values()))
    conn.commit()
    
    print_success(f"导入完成: 总计 {records_count} 条, 成功 {success_count} 条, 失败 {failed_count} 条")
    
    if error_details:
        print_warning("失败详情:")
        for err in error_details[:10]:
            print_error(err)


@import_.command("pauses")
@click.argument("file_path", type=click.Path(exists=True))
def import_pauses(file_path):
    """
    导入暂停说明表
    
    必需字段: ticket_id, pause_start, pause_reason, pause_id
    可选字段: pause_end, pause_reason_category, operator
    """
    import pandas as pd
    conn = db.conn
    
    print_info(f"正在读取文件: {file_path}")
    
    df = pd.read_csv(file_path)
    records_count = len(df)
    success_count = 0
    failed_count = 0
    error_details = []
    
    for idx, row in df.iterrows():
        try:
            required = ["ticket_id", "pause_start", "pause_reason", "pause_id"]
            for field in required:
                if pd.isna(row.get(field)):
                    raise ValueError(f"缺少必填字段: {field}")
            
            pause_start = str(row["pause_start"])
            pause_end = str(row["pause_end"]) if pd.notna(row.get("pause_end")) else None
            
            if pause_end:
                try:
                    start_dt = parse_datetime(pause_start)
                    end_dt = parse_datetime(pause_end)
                    if end_dt < start_dt:
                        raise ValueError("暂停结束时间早于开始时间")
                except Exception as e:
                    raise ValueError(f"时间格式错误: {e}")
            
            conn.execute("""
                INSERT OR IGNORE INTO pauses 
                (ticket_id, pause_start, pause_end, pause_reason, 
                 pause_reason_category, operator, pause_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(row["ticket_id"]),
                pause_start,
                pause_end,
                str(row["pause_reason"]),
                str(row.get("pause_reason_category", "")) if pd.notna(row.get("pause_reason_category")) else None,
                str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                str(row["pause_id"])
            ))
            success_count += 1
        except Exception as e:
            failed_count += 1
            error_details.append(f"行 {idx+1}: {str(e)}")
    
    conn.commit()
    
    log_entry = {
        "source_type": "pauses",
        "file_path": file_path,
        "records_count": records_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "error_details": "\n".join(error_details) if error_details else None
    }
    
    conn.execute("""
        INSERT INTO import_logs 
        (source_type, file_path, records_count, success_count, failed_count, error_details)
        VALUES (?, ?, ?, ?, ?, ?)
    """, tuple(log_entry.values()))
    conn.commit()
    
    print_success(f"导入完成: 总计 {records_count} 条, 成功 {success_count} 条, 失败 {failed_count} 条")
    
    if error_details:
        print_warning("失败详情:")
        for err in error_details[:10]:
            print_error(err)


@import_.command("escalations")
@click.argument("file_path", type=click.Path(exists=True))
def import_escalations(file_path):
    """
    导入升级记录表
    
    必需字段: ticket_id, escalation_time, to_level, escalation_id
    可选字段: from_level, from_queue, to_queue, escalation_reason, operator
    """
    import pandas as pd
    conn = db.conn
    
    print_info(f"正在读取文件: {file_path}")
    
    df = pd.read_csv(file_path)
    records_count = len(df)
    success_count = 0
    failed_count = 0
    error_details = []
    
    for idx, row in df.iterrows():
        try:
            required = ["ticket_id", "escalation_time", "to_level", "escalation_id"]
            for field in required:
                if pd.isna(row.get(field)):
                    raise ValueError(f"缺少必填字段: {field}")
            
            conn.execute("""
                INSERT OR IGNORE INTO escalations 
                (ticket_id, escalation_time, from_level, to_level, 
                 from_queue, to_queue, escalation_reason, operator, escalation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(row["ticket_id"]),
                str(row["escalation_time"]),
                str(row.get("from_level", "")) if pd.notna(row.get("from_level")) else None,
                str(row["to_level"]),
                str(row.get("from_queue", "")) if pd.notna(row.get("from_queue")) else None,
                str(row.get("to_queue", "")) if pd.notna(row.get("to_queue")) else None,
                str(row.get("escalation_reason", "")) if pd.notna(row.get("escalation_reason")) else None,
                str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                str(row["escalation_id"])
            ))
            success_count += 1
        except Exception as e:
            failed_count += 1
            error_details.append(f"行 {idx+1}: {str(e)}")
    
    conn.commit()
    
    log_entry = {
        "source_type": "escalations",
        "file_path": file_path,
        "records_count": records_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "error_details": "\n".join(error_details) if error_details else None
    }
    
    conn.execute("""
        INSERT INTO import_logs 
        (source_type, file_path, records_count, success_count, failed_count, error_details)
        VALUES (?, ?, ?, ?, ?, ?)
    """, tuple(log_entry.values()))
    conn.commit()
    
    print_success(f"导入完成: 总计 {records_count} 条, 成功 {success_count} 条, 失败 {failed_count} 条")
    
    if error_details:
        print_warning("失败详情:")
        for err in error_details[:10]:
            print_error(err)


@cli.command()
@click.argument("ticket_id", required=False)
@click.option("--all", is_flag=True, help="检查所有工单")
@click.option("--json", "output_json", is_flag=True, help="以JSON格式输出")
def check(ticket_id, all, output_json):
    """
    检查工单SLA违约情况
    
    可检查单个工单或所有工单，输出归因结果。
    """
    if not ticket_id and not all:
        print_error("请指定工单ID或使用 --all 参数")
        return
    
    if all:
        print_info("正在检查所有工单...")
        results = check_all_tickets()
        
        if output_json:
            click.echo(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            breaches = [r for r in results if r.get("is_breached") and "error" not in r]
            errors = [r for r in results if "error" in r]
            normal = [r for r in results if not r.get("is_breached") and "error" not in r]
            
            print_success(f"检查完成: 总计 {len(results)} 个工单")
            click.echo(f"  - 正常: {len(normal)} 个")
            click.echo(f"  - 违约: {len(breaches)} 个")
            click.echo(f"  - 数据错误: {len(errors)} 个")
            
            if breaches:
                click.echo()
                print_warning("===== 违约工单列表 =====")
                table_data = []
                for r in breaches:
                    table_data.append([
                        r["ticket_id"],
                        r["customer_type"],
                        r["created_at"],
                        r["sla_deadline"],
                        r.get("blame_queue", "-"),
                        r.get("breach_category", "-")
                    ])
                
                click.echo(tabulate(
                    table_data,
                    headers=["工单ID", "客户类型", "创建时间", "SLA截止", "责任队列", "违约类型"],
                    tablefmt="simple"
                ))
            
            if errors:
                click.echo()
                print_error("===== 数据错误列表 =====")
                for r in errors:
                    print_error(f"{r.get('ticket_id', '未知')}: {r['error']}")
    else:
        print_info(f"正在检查工单 {ticket_id}...")
        result = analyze_ticket(ticket_id)
        
        if output_json:
            click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            if "error" in result:
                print_error(result["error"])
            else:
                click.echo(f"\n{'='*60}")
                click.echo(f"工单ID: {result['ticket_id']}")
                click.echo(f"客户类型: {result['customer_type']}")
                click.echo(f"创建时间: {result['created_at']}")
                click.echo(f"SLA截止: {result['sla_deadline']}")
                click.echo(f"{'='*60}")
                
                if result["is_breached"]:
                    print_error(f"状态: 已违约")
                else:
                    print_success(f"状态: 正常")
                
                if result.get("issues"):
                    click.echo()
                    print_warning("检测到的数据问题:")
                    for issue in result["issues"]:
                        if issue["severity"] == "error":
                            print_error(f"  [错误] {issue['message']}")
                        else:
                            print_warning(f"  [警告] {issue['message']}")
                
                if result.get("is_breached") and result.get("blame_queue"):
                    click.echo()
                    print_error(f"责任判定:")
                    click.echo(f"  责任队列: {result['blame_queue']}")
                    click.echo(f"  判定原因: {result['blame_reason'] or '-'}")
                    click.echo(f"  违约类型: {result['breach_category'] or '-'}")
                    
                    owner = get_queue_ownership(result['blame_queue'])
                    if owner:
                        click.echo(f"  队列负责人: {owner}")
                
                if result["queue_time_allocations"]:
                    click.echo()
                    print_info("各队列入场时间分配:")
                    for queue, hours in result["queue_time_allocations"].items():
                        click.echo(f"  {queue}: {hours:.2f} 工时")


@cli.command()
@click.argument("ticket_id")
@click.option("--history", is_flag=True, help="显示历史处理记录")
@click.option("--timeline", is_flag=True, help="显示完整时间线")
def detail(ticket_id, history, timeline):
    """
    查看工单详情
    
    展示工单的完整信息，包括流转、暂停、升级、修正历史等。
    """
    print_info(f"正在加载工单 {ticket_id} 的详情...")
    
    details = get_ticket_details(ticket_id)
    analysis = analyze_ticket(ticket_id)
    
    if not details or "error" in analysis:
        print_error(f"工单 {ticket_id} 不存在")
        return
    
    ticket = details["ticket"]
    transitions = details["transitions"]
    pauses = details["pauses"]
    escalations = details["escalations"]
    corrections = details["corrections"]
    
    click.echo(f"\n{'='*70}")
    click.echo("工单基础信息")
    click.echo(f"{'='*70}")
    
    base_info = [
        ["工单ID", ticket["ticket_id"]],
        ["客户ID", ticket["customer_id"]],
        ["客户类型", ticket["customer_type"]],
        ["优先级", ticket["priority"]],
        ["创建时间", ticket["created_at"]],
        ["当前队列", ticket["current_queue"] or "-"],
        ["当前状态", ticket["current_status"] or "-"],
        ["SLA截止", analysis.get("sla_deadline", "-")],
        ["状态", "已违约" if analysis.get("is_breached") else "正常"]
    ]
    click.echo(tabulate(base_info, tablefmt="plain"))
    
    if analysis.get("is_breached"):
        click.echo()
        print_error("违约信息:")
        click.echo(f"  责任队列: {analysis.get('blame_queue', '-')}")
        click.echo(f"  违约类型: {analysis.get('breach_category', '-')}")
        owner = get_queue_ownership(analysis.get('blame_queue', ''))
        if owner:
            click.echo(f"  队列负责人: {owner}")
    
    if transitions:
        click.echo(f"\n{'='*70}")
        click.echo("状态流转记录")
        click.echo(f"{'='*70}")
        
        trans_data = []
        for t in transitions:
            trans_data.append([
                t["transition_time"],
                t.get("from_queue") or "-",
                t["to_queue"],
                t.get("from_status") or "-",
                t["to_status"],
                t.get("operator") or "-"
            ])
        
        click.echo(tabulate(
            trans_data,
            headers=["时间", "来源队列", "目标队列", "来源状态", "目标状态", "操作人"],
            tablefmt="simple"
        ))
    
    if pauses:
        click.echo(f"\n{'='*70}")
        click.echo("暂停记录")
        click.echo(f"{'='*70}")
        
        pause_data = []
        for p in pauses:
            pause_data.append([
                p["pause_start"],
                p["pause_end"] or "未结束",
                p["pause_reason"],
                p.get("pause_reason_category") or "-",
                p.get("operator") or "-"
            ])
        
        click.echo(tabulate(
            pause_data,
            headers=["开始时间", "结束时间", "暂停原因", "原因分类", "操作人"],
            tablefmt="simple"
        ))
        
        incomplete = [p for p in pauses if not p["pause_end"]]
        if incomplete:
            print_warning(f"\n警告: {len(incomplete)} 条暂停记录缺少结束时间")
    
    if escalations:
        click.echo(f"\n{'='*70}")
        click.echo("升级记录")
        click.echo(f"{'='*70}")
        
        esc_data = []
        for e in escalations:
            esc_data.append([
                e["escalation_time"],
                e.get("from_level") or "-",
                e["to_level"],
                e.get("from_queue") or "-",
                e.get("to_queue") or "-",
                e.get("escalation_reason") or "-",
                e.get("operator") or "-"
            ])
        
        click.echo(tabulate(
            esc_data,
            headers=["时间", "原级别", "目标级别", "来源队列", "目标队列", "升级原因", "操作人"],
            tablefmt="simple"
        ))
    
    if corrections:
        click.echo(f"\n{'='*70}")
        click.echo("人工修正记录")
        click.echo(f"{'='*70}")
        
        corr_data = []
        for c in corrections:
            corr_data.append([
                c["correction_time"],
                c["field_name"],
                c["old_value"] or "-",
                c["new_value"],
                c["operator"],
                c.get("notes") or "-"
            ])
        
        click.echo(tabulate(
            corr_data,
            headers=["时间", "字段", "原值", "新值", "操作人", "备注"],
            tablefmt="simple"
        ))
    
    if timeline and analysis.get("processing_timeline"):
        click.echo(f"\n{'='*70}")
        click.echo("完整处理时间线")
        click.echo(f"{'='*70}")
        
        tl_data = []
        for item in analysis["processing_timeline"]:
            tl_data.append([
                item["time"],
                item["event"],
                item.get("queue") or item.get("to_queue") or "-",
                item["action"],
                "是" if item.get("excluded") else "否"
            ])
        
        click.echo(tabulate(
            tl_data,
            headers=["时间", "事件类型", "队列", "动作", "排除SLA"],
            tablefmt="simple"
        ))


@cli.command()
@click.option("--format", "fmt", default="summary", type=click.Choice(["summary", "detail", "queue"]))
@click.option("--output", type=click.Path(), help="输出文件路径（JSON格式）")
def report(fmt, output):
    """
    生成SLA复盘报告
    
    支持汇总报告、详细报告和按队列统计。
    """
    print_info("正在生成SLA报告...")
    
    results = check_all_tickets()
    
    if not results:
        print_warning("没有找到任何工单数据")
        return
    
    total = len(results)
    normal = len([r for r in results if not r.get("is_breached") and "error" not in r])
    breaches = [r for r in results if r.get("is_breached") and "error" not in r]
    errors = [r for r in results if "error" in r]
    
    breach_count = len(breaches)
    error_count = len(errors)
    
    report_data = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total_tickets": total,
            "normal": normal,
            "breached": breach_count,
            "errors": error_count,
            "breach_rate": f"{(breach_count/total*100):.1f}%" if total > 0 else "0%"
        },
        "breaches": breaches,
        "errors": errors
    }
    
    queue_stats = {}
    for r in results:
        if "error" in r:
            continue
        for queue, hours in r.get("queue_time_allocations", {}).items():
            if queue not in queue_stats:
                queue_stats[queue] = {"count": 0, "total_hours": 0.0, "breached": 0}
            queue_stats[queue]["count"] += 1
            queue_stats[queue]["total_hours"] += hours
            if r.get("is_breached") and r.get("blame_queue") == queue:
                queue_stats[queue]["breached"] += 1
    
    report_data["queue_stats"] = queue_stats
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        print_success(f"报告已保存到: {output}")
    
    if fmt == "summary":
        click.echo(f"\n{'='*60}")
        click.echo("SLA 复盘汇总报告")
        click.echo(f"{'='*60}")
        click.echo(f"生成时间: {report_data['generated_at']}")
        click.echo(f"\n总工单数量: {total}")
        click.echo(f"  正常处理: {normal}")
        click.echo(f"  SLA违约: {breach_count}")
        click.echo(f"  数据错误: {error_count}")
        click.echo(f"  违约率: {report_data['summary']['breach_rate']}")
        
        if breaches:
            click.echo(f"\n{'='*60}")
            print_warning("违约工单概览:")
            table_data = []
            for b in breaches:
                owner = get_queue_ownership(b.get('blame_queue', ''))
                table_data.append([
                    b["ticket_id"],
                    b["customer_type"],
                    b["breach_category"] or "-",
                    b.get("blame_queue", "-"),
                    owner or "-"
                ])
            
            click.echo(tabulate(
                table_data,
                headers=["工单ID", "客户类型", "违约类型", "责任队列", "负责人"],
                tablefmt="simple"
            ))
    
    elif fmt == "queue":
        click.echo(f"\n{'='*70}")
        click.echo("各队列SLA统计")
        click.echo(f"{'='*70}")
        
        queue_data = []
        for queue, stats in queue_stats.items():
            owner = get_queue_ownership(queue)
            queue_data.append([
                queue,
                owner or "-",
                stats["count"],
                f"{stats['total_hours']:.2f}",
                stats["breached"],
                f"{(stats['breached']/stats['count']*100):.1f}%" if stats["count"] > 0 else "0%"
            ])
        
        click.echo(tabulate(
            queue_data,
            headers=["队列", "负责人", "工单数量", "总工时", "违约数量", "违约率"],
            tablefmt="simple"
        ))
    
    else:
        click.echo(json.dumps(report_data, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("ticket_id")
@click.argument("field_name")
@click.argument("new_value")
@click.option("--operator", required=True, help="操作人姓名/ID")
@click.option("--notes", default="", help="修正原因说明")
def correct(ticket_id, field_name, new_value, operator, notes):
    """
    人工修正工单数据
    
    会记录原值、新值、操作人和修改时间，保证可追溯。
    可修正字段: current_queue, current_status, customer_type, priority
    """
    allowed_fields = ["current_queue", "current_status", "customer_type", "priority"]
    
    if field_name not in allowed_fields:
        print_error(f"不允许修改字段 {field_name}。允许的字段: {', '.join(allowed_fields)}")
        return
    
    print_warning(f"即将修正工单 {ticket_id} 的 {field_name} 字段")
    
    details = get_ticket_details(ticket_id)
    if not details:
        print_error(f"工单 {ticket_id} 不存在")
        return
    
    old_value = details["ticket"].get(field_name) or ""
    click.echo(f"  原值: {old_value}")
    click.echo(f"  新值: {new_value}")
    click.echo(f"  操作人: {operator}")
    
    if not click.confirm("确认执行此修改?"):
        print_info("操作已取消")
        return
    
    result = apply_correction(ticket_id, field_name, new_value, operator, notes)
    
    if result.get("success"):
        print_success("修正已应用，记录已保存")
        click.echo(f"  工单ID: {result['ticket_id']}")
        click.echo(f"  字段: {result['field_name']}")
        click.echo(f"  原值: {result['old_value']}")
        click.echo(f"  新值: {result['new_value']}")
    else:
        print_error(result.get("error", "未知错误"))


@cli.command()
@click.argument("ticket_id")
def validate(ticket_id):
    """
    验证工单数据完整性
    
    检查数据错误、时间线冲突、升级异常等。
    """
    print_info(f"正在验证工单 {ticket_id}...")
    
    result = analyze_ticket(ticket_id)
    
    if "error" in result:
        print_error(f"验证失败: {result['error']}")
        return
    
    issues = result.get("issues", [])
    
    if not issues:
        print_success("数据验证通过，未发现异常")
    else:
        print_warning(f"发现 {len(issues)} 个问题:")
        for issue in issues:
            if issue["severity"] == "error":
                print_error(f"  [错误] {issue['type']}: {issue['message']}")
            else:
                print_warning(f"  [警告] {issue['type']}: {issue['message']}")


@cli.group()
def sample():
    """
    样例数据管理
    """
    pass


@sample.command("create")
def create_sample():
    """
    创建内置样例数据
    
    样例包括: 普通客户、VIP、跨夜暂停、误升级等场景
    """
    print_info("正在创建样例数据...")
    
    create_holidays()
    result = create_sample_data()
    
    print_success(f"样例数据创建完成:")
    click.echo(f"  - 工单: {result['tickets']} 个")
    click.echo(f"  - 流转记录: {result['transitions']} 条")
    click.echo(f"  - 暂停记录: {result['pauses']} 条")
    click.echo(f"  - 升级记录: {result['escalations']} 条")
    
    click.echo()
    print_info("样例工单说明:")
    click.echo("  T-2026-001: 普通客户工单 - 正常处理流程")
    click.echo("  T-2026-002: VIP客户工单 - 有等待客户暂停")
    click.echo("  T-2026-003: 普通客户工单 - 跨夜暂停场景")
    click.echo("  T-2026-004: VIP客户工单 - 误升级（升级时间早于创建时间）")
    click.echo("  T-2026-005: 紧急工单 - 数据异常（缺少暂停结束时间）")


@sample.command("list")
def list_sample():
    """
    列出所有样例工单
    """
    conn = db.conn
    
    tickets = conn.execute("""
        SELECT ticket_id, customer_id, customer_type, created_at, current_status
        FROM tickets
        ORDER BY ticket_id
    """).fetchall()
    
    if not tickets:
        print_warning("没有找到工单数据。请先运行 'sla sample create' 创建样例。")
        return
    
    table_data = []
    for t in tickets:
        table_data.append([
            t["ticket_id"],
            t["customer_id"],
            t["customer_type"],
            t["created_at"],
            t["current_status"] or "-"
        ])
    
    click.echo(tabulate(
        table_data,
        headers=["工单ID", "客户ID", "客户类型", "创建时间", "当前状态"],
        tablefmt="simple"
    ))


if __name__ == "__main__":
    cli()
