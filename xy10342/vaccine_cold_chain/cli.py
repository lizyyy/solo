#!/usr/bin/env python3
"""诊所疫苗冷链日志 CLI 工具"""

import click
import sys
import os
from datetime import datetime
from tabulate import tabulate

from .database import (
    init_database, get_stats, ManualReview, insert_manual_review,
    get_manual_reviews, get_vaccine_batch, get_all_vaccine_batches,
    get_vaccination_records
)
from .importer import (
    import_temperature_logs_from_csv, import_temperature_logs_from_json,
    import_door_events_from_csv, import_door_events_from_json,
    import_vaccine_batches_from_csv, import_vaccine_batches_from_json,
    import_vaccination_records_from_csv, import_vaccination_records_from_json
)
from .anomaly_detector import (
    scan_all_anomalies, get_affected_batch_details,
    ANOMALY_TYPE_NAMES, SEVERITY_CRITICAL, SEVERITY_HIGH
)
from .reporter import (
    export_report_json, export_report_csv, export_report_text
)


def now_str() -> str:
    return datetime.now().isoformat()


@click.group()
@click.version_option("1.0.0")
def cli():
    """诊所疫苗冷链日志 CLI 工具 - 管理和分析疫苗冷链数据"""
    init_database()


@cli.group()
def import_data():
    """导入各类数据文件"""
    pass


@import_data.command("temperature")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--format", "file_format", type=click.Choice(['csv', 'json']), default='csv', help="文件格式")
def import_temperature(file_path, file_format):
    """导入冰箱温度日志"""
    click.echo(f"导入温度日志: {file_path}")
    
    if file_format == 'csv':
        inserted, duplicates = import_temperature_logs_from_csv(file_path)
    else:
        inserted, duplicates = import_temperature_logs_from_json(file_path)
    
    click.echo(f"  成功导入: {inserted} 条")
    click.echo(f"  重复跳过: {duplicates} 条")


@import_data.command("door")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--format", "file_format", type=click.Choice(['csv', 'json']), default='csv', help="文件格式")
def import_door(file_path, file_format):
    """导入开门事件"""
    click.echo(f"导入开门事件: {file_path}")
    
    if file_format == 'csv':
        inserted, duplicates = import_door_events_from_csv(file_path)
    else:
        inserted, duplicates = import_door_events_from_json(file_path)
    
    click.echo(f"  成功导入: {inserted} 条")
    click.echo(f"  重复跳过: {duplicates} 条")


@import_data.command("batch")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--format", "file_format", type=click.Choice(['csv', 'json']), default='csv', help="文件格式")
def import_batch(file_path, file_format):
    """导入疫苗批号"""
    click.echo(f"导入疫苗批号: {file_path}")
    
    if file_format == 'csv':
        inserted, duplicates = import_vaccine_batches_from_csv(file_path)
    else:
        inserted, duplicates = import_vaccine_batches_from_json(file_path)
    
    click.echo(f"  成功导入: {inserted} 条")
    click.echo(f"  重复跳过: {duplicates} 条")


@import_data.command("vaccination")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--format", "file_format", type=click.Choice(['csv', 'json']), default='csv', help="文件格式")
def import_vaccination(file_path, file_format):
    """导入接种记录"""
    click.echo(f"导入接种记录: {file_path}")
    
    if file_format == 'csv':
        inserted, duplicates = import_vaccination_records_from_csv(file_path)
    else:
        inserted, duplicates = import_vaccination_records_from_json(file_path)
    
    click.echo(f"  成功导入: {inserted} 条")
    click.echo(f"  重复跳过: {duplicates} 条")


@cli.command("scan")
@click.option("--batch", "batch_number", help="指定批号扫描")
def scan(batch_number):
    """扫描日志，检测温度异常"""
    click.echo("=" * 60)
    click.echo("扫描冷链异常")
    click.echo("=" * 60)
    
    result = scan_all_anomalies()
    
    if batch_number:
        batch = get_vaccine_batch(batch_number)
        if not batch:
            click.echo(f"错误: 未找到批号 {batch_number}")
            sys.exit(1)
        
        batch_details = get_affected_batch_details(batch_number)
        if batch_details:
            detail = batch_details[0]
            click.echo(f"\n批号: {batch_number} ({detail['vaccine_name']})")
            click.echo(f"  厂家: {detail['manufacturer']}")
            click.echo(f"  入库: {detail['receive_time']}")
            click.echo(f"  到期: {detail['expiry_date']}")
            click.echo(f"  异常数: {len(detail['anomalies'])}")
            
            for anomaly in detail['anomalies']:
                status = " [已复核]" if anomaly['has_been_reviewed'] else ""
                click.echo(f"\n  [{anomaly['severity']}] {anomaly['type']}{status}")
                click.echo(f"     时间段: {anomaly['start_time']} ~ {anomaly['end_time']}")
                click.echo(f"     描述: {anomaly['description']}")
                if anomaly['review_result']:
                    click.echo(f"     复核结果: {anomaly['review_result']}")
                
                if anomaly.get('affected_vaccinations'):
                    click.echo(f"     影响接种: {len(anomaly['affected_vaccinations'])}人")
        else:
            click.echo(f"\n批号 {batch_number} 无异常记录")
        return
    
    click.echo(f"\n异常统计:")
    click.echo(f"  总异常数: {result['total_anomalies']}")
    click.echo(f"  受影响批号: {len(result['affected_batches'])}")
    click.echo(f"  影响接种人数: {result['total_affected_vaccinations']}")
    
    click.echo(f"\n按类型:")
    for type_name, count in result['by_type'].items():
        display_name = ANOMALY_TYPE_NAMES.get(type_name, type_name)
        click.echo(f"  {display_name}: {count}")
    
    click.echo(f"\n按严重程度:")
    for severity, count in result['by_severity'].items():
        click.echo(f"  {severity}: {count}")
    
    if result['anomalies']:
        click.echo(f"\n异常详情 (按严重程度排序):")
        click.echo("-" * 60)
        
        table_data = []
        for i, anomaly in enumerate(result['anomalies'], 1):
            type_display = ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type)
            reviewed = "✓" if anomaly.has_been_reviewed else " "
            vac_count = len(anomaly.affected_vaccinations)
            table_data.append([
                i,
                anomaly.severity,
                type_display,
                anomaly.batch_number or "-",
                anomaly.start_time[:16] if len(anomaly.start_time) > 16 else anomaly.start_time,
                reviewed,
                vac_count
            ])
        
        headers = ["#", "严重程度", "类型", "批号", "开始时间", "已复核", "影响接种"]
        click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))
        
        critical_anomalies = [a for a in result['anomalies'] if a.severity in [SEVERITY_CRITICAL, SEVERITY_HIGH]]
        if critical_anomalies:
            click.echo(f"\n【紧急】严重异常详情:")
            click.echo("-" * 60)
            for anomaly in critical_anomalies[:5]:
                click.echo(f"\n[{anomaly.severity}] {anomaly.anomaly_id[:8]}")
                click.echo(f"  类型: {ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type)}")
                click.echo(f"  批号: {anomaly.batch_number}")
                click.echo(f"  时间段: {anomaly.start_time} ~ {anomaly.end_time}")
                click.echo(f"  描述: {anomaly.description}")
                if anomaly.affected_vaccinations:
                    click.echo(f"  影响接种 {len(anomaly.affected_vaccinations)} 人:")
                    for vac in anomaly.affected_vaccinations[:3]:
                        click.echo(f"    - {vac['patient_name']} ({vac['patient_phone']})")
                    if len(anomaly.affected_vaccinations) > 3:
                        click.echo(f"    ... 还有 {len(anomaly.affected_vaccinations) - 3} 人")


@cli.command("batches")
@click.option("--batch", "batch_number", help="查看特定批号详情")
def view_batches(batch_number):
    """查看受影响批次详情"""
    click.echo("=" * 60)
    click.echo("受影响批次")
    click.echo("=" * 60)
    
    batch_details = get_affected_batch_details(batch_number)
    
    if not batch_details:
        click.echo("\n暂无受影响批次")
        return
    
    if batch_number:
        detail = batch_details[0]
        click.echo(f"\n【{detail['batch_number']}】 {detail['vaccine_name']}")
        click.echo(f"  厂家: {detail['manufacturer']}")
        click.echo(f"  入库: {detail['receive_time']}")
        click.echo(f"  到期: {detail['expiry_date']}")
        
        click.echo(f"\n  异常记录 ({len(detail['anomalies'])} 条):")
        for i, anomaly in enumerate(detail['anomalies'], 1):
            status = " [已复核]" if anomaly['has_been_reviewed'] else ""
            click.echo(f"    {i}. [{anomaly['severity']}] {anomaly['type']}{status}")
            click.echo(f"       时间段: {anomaly['start_time']} ~ {anomaly['end_time']}")
            click.echo(f"       描述: {anomaly['description']}")
            if anomaly['review_result']:
                click.echo(f"       复核结果: {anomaly['review_result']}")
        
        if detail['affected_vaccinations']:
            click.echo(f"\n  受影响接种 ({len(detail['affected_vaccinations'])} 人):")
            table_data = [[
                i + 1,
                vac['patient_name'],
                vac['patient_phone'],
                vac['vaccination_time']
            ] for i, vac in enumerate(detail['affected_vaccinations'])]
            headers = ["#", "姓名", "电话", "接种时间"]
            click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))
    else:
        click.echo(f"\n共 {len(batch_details)} 个受影响批次:")
        click.echo("-" * 60)
        
        table_data = []
        for i, detail in enumerate(batch_details, 1):
            table_data.append([
                i,
                detail['batch_number'],
                detail['vaccine_name'],
                len(detail['anomalies']),
                len(detail['affected_vaccinations'])
            ])
        
        headers = ["#", "批号", "疫苗名称", "异常数", "影响接种"]
        click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))
        
        click.echo(f"\n使用 'cold-chain batches --batch <批号>' 查看详情")


@cli.command("review")
@click.argument("anomaly_id")
@click.option("--reviewer", required=True, help="复核人姓名")
@click.option("--result", "final_result", 
              type=click.Choice(['CONFIRMED_ABNORMAL', 'CONFIRMED_SAFE', 'NEED_MORE_INFO']),
              required=True, help="复核结果")
@click.option("--reason", required=True, help="复核原因")
@click.option("--impact", default="影响范围无变化", help="影响范围变更说明")
def add_review(anomaly_id, reviewer, final_result, reason, impact):
    """登记人工复核"""
    click.echo("=" * 60)
    click.echo("登记人工复核")
    click.echo("=" * 60)
    
    result = scan_all_anomalies()
    anomaly_found = None
    
    for anomaly in result['anomalies']:
        if anomaly.anomaly_id == anomaly_id or anomaly.anomaly_id.startswith(anomaly_id):
            anomaly_found = anomaly
            break
    
    if not anomaly_found:
        click.echo(f"错误: 未找到异常 ID {anomaly_id}")
        click.echo(f"可用异常 ID 请使用 'cold-chain scan' 查看")
        sys.exit(1)
    
    result_names = {
        'CONFIRMED_ABNORMAL': '确认异常',
        'CONFIRMED_SAFE': '确认安全',
        'NEED_MORE_INFO': '需进一步确认'
    }
    
    click.echo(f"\n异常详情:")
    click.echo(f"  ID: {anomaly_found.anomaly_id}")
    click.echo(f"  类型: {ANOMALY_TYPE_NAMES.get(anomaly_found.anomaly_type, anomaly_found.anomaly_type)}")
    click.echo(f"  严重程度: {anomaly_found.severity}")
    click.echo(f"  批号: {anomaly_found.batch_number}")
    click.echo(f"  时间段: {anomaly_found.start_time} ~ {anomaly_found.end_time}")
    click.echo(f"  描述: {anomaly_found.description}")
    
    click.echo(f"\n复核信息:")
    click.echo(f"  复核人: {reviewer}")
    click.echo(f"  最终结果: {result_names[final_result]}")
    click.echo(f"  复核原因: {reason}")
    click.echo(f"  影响范围变更: {impact}")
    
    review = ManualReview(
        id=None,
        anomaly_id=anomaly_found.anomaly_id,
        reviewer=reviewer,
        review_time=now_str(),
        original_result=f"[{anomaly_found.severity}] {anomaly_found.description}",
        review_reason=reason,
        final_result=final_result,
        impact_change=impact,
        created_at=now_str()
    )
    
    if insert_manual_review(review):
        click.echo(f"\n✓ 复核记录已保存")
    else:
        click.echo(f"\n✗ 保存失败")


@cli.command("reviews")
@click.option("--anomaly-id", help="按异常ID过滤")
def list_reviews(anomaly_id):
    """查看人工复核记录"""
    click.echo("=" * 60)
    click.echo("人工复核记录")
    click.echo("=" * 60)
    
    reviews = get_manual_reviews(anomaly_id)
    
    if not reviews:
        click.echo("\n暂无复核记录")
        return
    
    click.echo(f"\n共 {len(reviews)} 条复核记录:")
    click.echo("-" * 60)
    
    result_names = {
        'CONFIRMED_ABNORMAL': '确认异常',
        'CONFIRMED_SAFE': '确认安全',
        'NEED_MORE_INFO': '需进一步确认'
    }
    
    for i, review in enumerate(reviews, 1):
        click.echo(f"\n{i}. 异常ID: {review.anomaly_id}")
        click.echo(f"   复核人: {review.reviewer}")
        click.echo(f"   复核时间: {review.review_time}")
        click.echo(f"   原始结果: {review.original_result}")
        click.echo(f"   复核原因: {review.review_reason}")
        click.echo(f"   最终结果: {result_names.get(review.final_result, review.final_result)}")
        click.echo(f"   影响范围变更: {review.impact_change}")


@cli.command("export")
@click.argument("output_path")
@click.option("--format", "export_format", 
              type=click.Choice(['json', 'csv', 'txt']),
              default='json', help="导出格式")
def export_report(output_path, export_format):
    """导出冷链报告"""
    click.echo("=" * 60)
    click.echo("导出冷链报告")
    click.echo("=" * 60)
    
    if export_format == 'json':
        export_report_json(output_path)
    elif export_format == 'csv':
        export_report_csv(output_path)
    else:
        export_report_text(output_path)
    
    click.echo(f"\n✓ 报告已导出: {output_path}")
    click.echo(f"  格式: {export_format.upper()}")


@cli.command("status")
def show_status():
    """显示数据库统计信息"""
    click.echo("=" * 60)
    click.echo("数据库状态")
    click.echo("=" * 60)
    
    stats = get_stats()
    
    table_data = [
        ["温度日志", stats['temperature_logs']],
        ["开门事件", stats['door_events']],
        ["疫苗批号", stats['vaccine_batches']],
        ["接种记录", stats['vaccination_records']],
        ["人工复核", stats['manual_reviews']]
    ]
    
    click.echo()
    click.echo(tabulate(table_data, headers=["数据类型", "记录数"], tablefmt="simple"))
    
    batches = get_all_vaccine_batches()
    if batches:
        click.echo(f"\n疫苗批号列表:")
        table_data = [[
            i + 1,
            b.batch_number,
            b.vaccine_name,
            b.manufacturer,
            b.receive_time[:10]
        ] for i, b in enumerate(batches)]
        click.echo(tabulate(table_data, headers=["#", "批号", "名称", "厂家", "入库日期"], tablefmt="simple"))


def main():
    cli()


if __name__ == '__main__':
    main()
