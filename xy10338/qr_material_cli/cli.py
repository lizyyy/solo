import click
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional

from .services import (
    load_materials_ledger, load_scan_records, load_return_records,
    deduplicate_scan_records, merge_offline_records, validate_return_records,
    check_inventory_discrepancies, generate_sample_qr_codes
)
from .reports import export_usage_report, generate_text_summary


@click.group()
def cli():
    """二维码物料领用 CLI 工具 - 管理展会物料的领用、归还和库存核对"""
    pass


@cli.command()
@click.option("--project", "-p", required=True, help="展会项目名称")
@click.option("--output-dir", "-o", default=".", help="输出目录，默认为当前目录")
@click.option("--with-sample-data", is_flag=True, help="同时生成样例扫码、离线补录和归还数据")
def generate_samples(project: str, output_dir: str, with_sample_data: bool):
    """生成样例二维码编号和物料台账"""
    click.echo(f"🔄 正在为项目 '{project}' 生成样例数据...")
    
    output_path = Path(output_dir)
    samples = generate_sample_qr_codes(project, output_path)
    
    click.echo("✅ 物料台账生成完成:")
    for material_type, codes in samples.items():
        click.echo(f"  📦 {material_type}: {len(codes)} 个")
        for code in codes:
            click.echo(f"     - {code}")
    
    if with_sample_data:
        _generate_sample_records(project, output_path, samples)
        click.echo("✅ 样例扫码、离线补录和归还记录已生成")
    
    click.echo(f"\n📁 输出目录: {output_path.absolute()}")


def _generate_sample_records(project: str, output_dir: Path, samples: dict):
    now = datetime.now()
    
    scan_data = []
    offline_data = []
    return_data = []
    
    truss_codes = samples["桁架"]
    light_codes = samples["灯具"]
    furn_codes = samples["桌椅"]
    
    scan_data.append({
        "二维码编号": truss_codes[0],
        "扫码时间": now.strftime("%Y-%m-%d 09:00:00"),
        "领用人": "张三",
        "领用部门": "搭建组",
        "展会项目": project,
        "来源": "扫码",
        "领用数量": 1,
    })
    scan_data.append({
        "二维码编号": truss_codes[0],
        "扫码时间": now.strftime("%Y-%m-%d 09:05:00"),
        "领用人": "张三",
        "领用部门": "搭建组",
        "展会项目": project,
        "来源": "扫码",
        "领用数量": 1,
    })
    scan_data.append({
        "二维码编号": light_codes[0],
        "扫码时间": now.strftime("%Y-%m-%d 10:00:00"),
        "领用人": "李四",
        "领用部门": "灯光组",
        "展会项目": project,
        "来源": "扫码",
        "领用数量": 1,
    })
    scan_data.append({
        "二维码编号": light_codes[1],
        "扫码时间": now.strftime("%Y-%m-%d 10:30:00"),
        "领用人": "李四",
        "领用部门": "灯光组",
        "展会项目": project,
        "来源": "扫码",
        "领用数量": 1,
    })
    scan_data.append({
        "二维码编号": furn_codes[0],
        "扫码时间": now.strftime("%Y-%m-%d 11:00:00"),
        "领用人": "王五",
        "领用部门": "会务组",
        "展会项目": project,
        "来源": "扫码",
        "领用数量": 1,
    })
    
    offline_data.append({
        "二维码编号": truss_codes[1],
        "扫码时间": now.strftime("%Y-%m-%d 09:15:00"),
        "领用人": "张三",
        "领用部门": "搭建组",
        "展会项目": project,
        "来源": "离线补录",
        "领用数量": 1,
    })
    offline_data.append({
        "二维码编号": light_codes[0],
        "扫码时间": now.strftime("%Y-%m-%d 10:00:00"),
        "领用人": "李四",
        "领用部门": "灯光组",
        "展会项目": project,
        "来源": "离线补录",
        "领用数量": 1,
    })
    offline_data.append({
        "二维码编号": furn_codes[1],
        "扫码时间": now.strftime("%Y-%m-%d 11:30:00"),
        "领用人": "赵六",
        "领用部门": "会务组",
        "展会项目": project,
        "来源": "离线补录",
        "领用数量": 1,
    })
    
    return_data.append({
        "二维码编号": light_codes[0],
        "归还时间": now.strftime("%Y-%m-%d 18:00:00"),
        "归还人": "李四",
        "归还部门": "灯光组",
        "展会项目": project,
        "归还数量": 1,
    })
    return_data.append({
        "二维码编号": furn_codes[0],
        "归还时间": now.strftime("%Y-%m-%d 19:00:00"),
        "归还人": "王五",
        "归还部门": "会务组",
        "展会项目": project,
        "归还数量": 1,
    })
    return_data.append({
        "二维码编号": light_codes[0],
        "归还时间": now.strftime("%Y-%m-%d 19:30:00"),
        "归还人": "李四",
        "归还部门": "灯光组",
        "展会项目": project,
        "归还数量": 1,
    })
    
    pd.DataFrame(scan_data).to_excel(output_dir / f"扫码记录_{project}.xlsx", index=False)
    pd.DataFrame(offline_data).to_excel(output_dir / f"离线补录_{project}.xlsx", index=False)
    pd.DataFrame(return_data).to_excel(output_dir / f"归还记录_{project}.xlsx", index=False)


@cli.command()
@click.option("--scan-file", "-s", required=True, help="扫码记录文件路径 (Excel或CSV)")
@click.option("--output", "-o", help="处理后的输出文件路径")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，不显示详细信息")
def import_scans(scan_file: str, output: Optional[str], quiet: bool):
    """导入并处理扫码日志（检测重复扫码）"""
    click.echo(f"🔄 正在导入扫码记录: {scan_file}")
    
    scan_path = Path(scan_file)
    if not scan_path.exists():
        click.echo(f"❌ 文件不存在: {scan_file}")
        return
    
    scan_records = load_scan_records(scan_path)
    click.echo(f"📊 共导入 {len(scan_records)} 条扫码记录")
    
    scan_records, duplicates = deduplicate_scan_records(scan_records)
    click.echo(f"🔍 检测到 {len(duplicates)} 条重复记录")
    
    if not quiet and duplicates:
        click.echo("\n📋 重复记录详情:")
        for i, dup in enumerate(duplicates, 1):
            original = dup["original"]
            click.echo(f"  {i}. {original['二维码编号']} - {original['领用人']}")
            click.echo(f"     原始: {original['扫码时间']}")
            click.echo(f"     重复: {dup['duplicate']['扫码时间']}")
    
    if output:
        df = pd.DataFrame([r.to_dict() for r in scan_records])
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if str(output).endswith('.xlsx'):
            df.to_excel(output_path, index=False)
        else:
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        click.echo(f"\n✅ 处理后的记录已保存到: {output_path.absolute()}")
    
    return scan_records, duplicates


@cli.command()
@click.option("--scan-file", "-s", required=True, help="扫码记录文件路径")
@click.option("--offline-file", "-f", required=True, help="离线补录文件路径")
@click.option("--output", "-o", help="合并后的输出文件路径")
@click.option("--quiet", "-q", is_flag=True, help="静默模式")
def merge_offline(scan_file: str, offline_file: str, output: Optional[str], quiet: bool):
    """合并离线补录记录（避免与扫码记录重复）"""
    click.echo(f"🔄 正在合并记录...")
    
    scan_path = Path(scan_file)
    offline_path = Path(offline_file)
    
    if not scan_path.exists():
        click.echo(f"❌ 扫码记录文件不存在: {scan_file}")
        return
    if not offline_path.exists():
        click.echo(f"❌ 离线补录文件不存在: {offline_file}")
        return
    
    scan_records = load_scan_records(scan_path)
    scan_records, _ = deduplicate_scan_records(scan_records)
    
    offline_records = load_scan_records(offline_path)
    
    click.echo(f"📊 扫码记录: {len(scan_records)} 条")
    click.echo(f"📊 离线补录: {len(offline_records)} 条")
    
    merged_records, merged_info = merge_offline_records(scan_records, offline_records)
    
    merged = [m for m in merged_info if m["action"] == "合并"]
    skipped = [m for m in merged_info if m["action"] == "跳过"]
    
    click.echo(f"\n✅ 合并完成:")
    click.echo(f"   成功合并: {len(merged)} 条")
    click.echo(f"   被跳过: {len(skipped)} 条")
    
    if not quiet and merged_info:
        click.echo("\n📋 详细信息:")
        for i, info in enumerate(merged_info, 1):
            record = info["record"]
            click.echo(f"  {i}. [{info['action']}] {record['二维码编号']} - {record['领用人']}")
            click.echo(f"     原因: {info['reason']}")
    
    if output:
        df = pd.DataFrame([r.to_dict() for r in merged_records])
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if str(output).endswith('.xlsx'):
            df.to_excel(output_path, index=False)
        else:
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        click.echo(f"\n✅ 合并后的记录已保存到: {output_path.absolute()}")
    
    return merged_records, merged_info


@cli.command()
@click.option("--ledger", "-l", required=True, help="物料台账文件路径")
@click.option("--scan-file", "-s", required=True, help="扫码记录文件路径")
@click.option("--return-file", "-r", required=True, help="归还记录文件路径")
@click.option("--offline-file", "-f", help="离线补录文件路径（可选）")
@click.option("--output", "-o", default="领用报告.xlsx", help="报告输出路径")
@click.option("--text-summary", "-t", is_flag=True, help="同时生成文本摘要")
def check_diff(
    ledger: str,
    scan_file: str,
    return_file: str,
    offline_file: Optional[str],
    output: str,
    text_summary: bool
):
    """检查库存差异并生成报告"""
    click.echo("🔄 正在分析数据...")
    
    ledger_path = Path(ledger)
    scan_path = Path(scan_file)
    return_path = Path(return_file)
    
    if not ledger_path.exists():
        click.echo(f"❌ 物料台账不存在: {ledger}")
        return
    if not scan_path.exists():
        click.echo(f"❌ 扫码记录不存在: {scan_file}")
        return
    if not return_path.exists():
        click.echo(f"❌ 归还记录不存在: {return_file}")
        return
    
    materials = load_materials_ledger(ledger_path)
    click.echo(f"📊 物料台账: {len(materials)} 种物料")
    
    scan_records = load_scan_records(scan_path)
    scan_records, duplicates = deduplicate_scan_records(scan_records)
    click.echo(f"📊 扫码记录: {len(scan_records)} 条 (重复: {len(duplicates)})")
    
    merged_info = None
    if offline_file:
        offline_path = Path(offline_file)
        if offline_path.exists():
            offline_records = load_scan_records(offline_path)
            scan_records, merged_info = merge_offline_records(scan_records, offline_records)
            click.echo(f"📊 合并离线补录: {len(offline_records)} 条")
    
    return_records = load_return_records(return_path)
    return_records, return_issues = validate_return_records(scan_records, return_records)
    click.echo(f"📊 归还记录: {len(return_records)} 条 (异常: {len(return_issues)})")
    
    click.echo("\n🔍 正在检查差异...")
    reports = check_inventory_discrepancies(materials, scan_records, return_records)
    
    total_projects = len(reports)
    total_deficit = sum(r.total_deficit for r in reports.values())
    
    click.echo(f"\n📈 差异分析结果:")
    click.echo(f"   项目数: {total_projects}")
    click.echo(f"   总差异数量: {total_deficit}")
    
    for project_name, report in reports.items():
        click.echo(f"\n  【{project_name}】")
        click.echo(f"     物料数: {len(report.materials)}")
        click.echo(f"     差异数量: {report.total_deficit}")
        
        deficit_materials = [m for m in report.materials.values() if m.has_deficit]
        if deficit_materials:
            click.echo(f"     未归还物料: {len(deficit_materials)} 种")
            for usage in deficit_materials:
                receivers = set(r.receiver for r in usage.get_active_scan_records())
                click.echo(f"       - {usage.material.name} ({usage.qr_code}): 差{usage.deficit}, 领用人: {', '.join(receivers)}")
    
    output_path = Path(output)
    export_usage_report(reports, output_path, duplicates, merged_info, return_issues)
    click.echo(f"\n✅ 报告已生成: {output_path.absolute()}")
    
    if text_summary:
        summary = generate_text_summary(reports, duplicates, merged_info, return_issues)
        summary_path = output_path.with_suffix('.txt')
        summary_path.write_text(summary, encoding='utf-8')
        click.echo(f"✅ 文本摘要已生成: {summary_path.absolute()}")
        click.echo("\n" + "=" * 60)
        click.echo(summary)
    
    return reports


@cli.command()
@click.option("--ledger", "-l", required=True, help="物料台账文件路径")
@click.option("--scan-file", "-s", required=True, help="扫码记录文件路径")
@click.option("--return-file", "-r", required=True, help="归还记录文件路径")
@click.option("--offline-file", "-f", help="离线补录文件路径（可选）")
@click.option("--output", "-o", default="领用报告.xlsx", help="报告输出路径")
@click.option("--format", "-f", "format_type", default="excel", type=click.Choice(["excel", "csv", "both"]), help="输出格式")
def export_report(
    ledger: str,
    scan_file: str,
    return_file: str,
    offline_file: Optional[str],
    output: str,
    format_type: str
):
    """导出领用报告（Excel或CSV格式）"""
    click.echo("🔄 正在生成报告...")
    
    ledger_path = Path(ledger)
    scan_path = Path(scan_file)
    return_path = Path(return_file)
    
    if not ledger_path.exists():
        click.echo(f"❌ 物料台账不存在: {ledger}")
        return
    if not scan_path.exists():
        click.echo(f"❌ 扫码记录不存在: {scan_file}")
        return
    if not return_path.exists():
        click.echo(f"❌ 归还记录不存在: {return_file}")
        return
    
    materials = load_materials_ledger(ledger_path)
    scan_records = load_scan_records(scan_path)
    scan_records, duplicates = deduplicate_scan_records(scan_records)
    
    merged_info = None
    if offline_file:
        offline_path = Path(offline_file)
        if offline_path.exists():
            offline_records = load_scan_records(offline_path)
            scan_records, merged_info = merge_offline_records(scan_records, offline_records)
    
    return_records = load_return_records(return_path)
    return_records, return_issues = validate_return_records(scan_records, return_records)
    
    reports = check_inventory_discrepancies(materials, scan_records, return_records)
    
    output_path = Path(output)
    
    if format_type in ["excel", "both"]:
        export_usage_report(reports, output_path, duplicates, merged_info, return_issues)
        click.echo(f"✅ Excel报告已生成: {output_path.absolute()}")
    
    if format_type in ["csv", "both"]:
        csv_dir = output_path.parent / (output_path.stem + "_csv")
        csv_dir.mkdir(parents=True, exist_ok=True)
        
        for project_name, report in reports.items():
            detailed_data = []
            for usage in report.materials.values():
                detailed_data.append({
                    "展会项目": project_name,
                    "二维码编号": usage.qr_code,
                    "物料名称": usage.material.name,
                    "物料类型": usage.material.material_type.value,
                    "规格型号": usage.material.specification,
                    "初始数量": usage.material.initial_quantity,
                    "领用数量": usage.total_received,
                    "归还数量": usage.total_returned,
                    "差异数量": usage.deficit,
                    "状态": "有差异" if usage.has_deficit else "正常",
                })
            
            if detailed_data:
                pd.DataFrame(detailed_data).to_csv(
                    csv_dir / f"物料明细_{project_name}.csv",
                    index=False,
                    encoding='utf-8-sig'
                )
        
        click.echo(f"✅ CSV报告已生成: {csv_dir.absolute()}")
    
    summary = generate_text_summary(reports, duplicates, merged_info, return_issues)
    click.echo("\n" + summary)


def main():
    cli()


if __name__ == "__main__":
    main()
