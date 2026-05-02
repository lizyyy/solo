"""命令行接口模块"""

import click
from pathlib import Path
from typing import Optional

from .metadata_parser import MetadataParser
from .models import (
    ScanRecord,
    MedicationExpiry,
    MaintenanceBorrow,
    LedgerManager,
)
from .rules import RuleEngine, CheckResult
from .storage import ReviewStorage
from .report import ReportGenerator


@click.group()
@click.version_option()
def cli():
    """抢救车封签巡检员 - 急诊科设备护士自动化巡检工具"""
    pass


@cli.command()
@click.option("--photos", "-p", type=click.Path(exists=True, file_okay=False), required=True, help="封签照片目录")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径（JSON格式）")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def scan(photos: str, output: Optional[str], verbose: bool):
    """导入照片和文件并计算哈希

    扫描指定目录中的封签照片，解析元数据并计算文件哈希。
    """
    photos_path = Path(photos)
    
    if verbose:
        click.echo(f"正在扫描照片目录: {photos_path}")
    
    parser = MetadataParser()
    photo_metadata = parser.parse_photos(photos_path)
    
    if verbose:
        click.echo(f"共处理 {len(photo_metadata)} 张照片")
        for meta in photo_metadata[:5]:  # 只显示前5个
            click.echo(f"  - {meta.filename}: 拍摄时间={meta.capture_time}, 哈希={meta.file_hash[:16]}...")
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        parser.save_metadata(photo_metadata, output_path)
        click.echo(f"元数据已保存到: {output_path}")
    else:
        import json
        result = [m.to_dict() for m in photo_metadata]
        click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))


@cli.command()
@click.option("--scan-csv", "-s", type=click.Path(exists=True, dir_okay=False), help="扫码记录 CSV 文件")
@click.option("--medication-csv", "-m", type=click.Path(exists=True, dir_okay=False), help="药品效期表 CSV 文件")
@click.option("--maintenance-csv", "-t", type=click.Path(exists=True, dir_okay=False), help="维修借用单 CSV 文件")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径（JSON格式）")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def import_data(scan_csv: Optional[str], medication_csv: Optional[str], maintenance_csv: Optional[str], output: Optional[str], verbose: bool):
    """导入台账数据

    从 CSV 文件导入扫码记录、药品效期表和维修借用单数据。
    """
    manager = LedgerManager()
    
    if scan_csv:
        if verbose:
            click.echo(f"正在导入扫码记录: {scan_csv}")
        scan_records = ScanRecord.from_csv(Path(scan_csv))
        manager.scan_records = scan_records
        if verbose:
            click.echo(f"  共导入 {len(scan_records)} 条扫码记录")
    
    if medication_csv:
        if verbose:
            click.echo(f"正在导入药品效期表: {medication_csv}")
        medications = MedicationExpiry.from_csv(Path(medication_csv))
        manager.medications = medications
        if verbose:
            click.echo(f"  共导入 {len(medications)} 条药品记录")
    
    if maintenance_csv:
        if verbose:
            click.echo(f"正在导入维修借用单: {maintenance_csv}")
        maintenances = MaintenanceBorrow.from_csv(Path(maintenance_csv))
        manager.maintenances = maintenances
        if verbose:
            click.echo(f"  共导入 {len(maintenances)} 条维修借用记录")
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        manager.save(output_path)
        click.echo(f"台账数据已保存到: {output_path}")
    else:
        import json
        result = manager.to_dict()
        click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))


@cli.command()
@click.option("--ledger", "-l", type=click.Path(exists=True, dir_okay=False), required=True, help="台账数据文件（JSON格式）")
@click.option("--photos-meta", "-p", type=click.Path(exists=True, dir_okay=False), required=True, help="照片元数据文件（JSON格式）")
@click.option("--shift", "-s", type=str, help="班次名称（可选）")
@click.option("--near-expiry-days", "-n", type=int, default=30, help="近效期天数阈值，默认30天")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径（JSON格式）")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def check(ledger: str, photos_meta: str, shift: Optional[str], near_expiry_days: int, output: Optional[str], verbose: bool):
    """按班次校验封签连续性、药品缺失/近效、设备借还冲突和照片时间异常

    执行完整的巡检规则检查，生成检查结果。
    """
    from .metadata_parser import PhotoMetadata
    
    ledger_path = Path(ledger)
    photos_meta_path = Path(photos_meta)
    
    if verbose:
        click.echo("加载台账数据...")
    manager = LedgerManager.load(ledger_path)
    
    if verbose:
        click.echo("加载照片元数据...")
    import json
    with open(photos_meta_path, 'r', encoding='utf-8') as f:
        photo_data = json.load(f)
    photo_metadata = [PhotoMetadata.from_dict(d) for d in photo_data]
    
    if verbose:
        click.echo(f"加载了 {len(photo_metadata)} 条照片元数据")
        click.echo(f"配置: 近效期阈值={near_expiry_days}天")
        if shift:
            click.echo(f"指定班次: {shift}")
    
    engine = RuleEngine(near_expiry_days=near_expiry_days)
    
    if verbose:
        click.echo("\n开始执行规则检查...")
    
    all_results = engine.check_all(manager, photo_metadata, shift)
    
    if verbose:
        click.echo("\n检查结果统计:")
        for result_type, results in all_results.items():
            click.echo(f"  {result_type}: {len(results)} 项")
            for r in results[:3]:  # 只显示前3个
                click.echo(f"    - [{r.severity}] {r.description}")
            if len(results) > 3:
                click.echo(f"    ... 还有 {len(results) - 3} 项")
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result_dict = {k: [r.to_dict() for r in v] for k, v in all_results.items()}
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_dict, f, indent=2, ensure_ascii=False, default=str)
        click.echo(f"\n检查结果已保存到: {output_path}")
    else:
        import json
        result_dict = {k: [r.to_dict() for r in v] for k, v in all_results.items()}
        click.echo(json.dumps(result_dict, indent=2, ensure_ascii=False, default=str))


@cli.command()
@click.option("--check-result", "-c", type=click.Path(exists=True, dir_okay=False), required=True, help="检查结果文件（JSON格式）")
@click.option("--review-id", "-i", type=str, help="复核项ID（可选，不指定则交互模式）")
@click.option("--status", "-s", type=click.Choice(['pending', 'confirmed', 'resolved', 'dismissed']), help="复核状态")
@click.option("--comment", "-m", type=str, help="处理意见")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径（JSON格式）")
@click.option("--list", "-l", "list_all", is_flag=True, help="列出所有复核项")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def review(check_result: str, review_id: Optional[str], status: Optional[str], comment: Optional[str], output: Optional[str], list_all: bool, verbose: bool):
    """保存处理意见

    对检查结果进行复核，记录处理意见。
    """
    from .rules import CheckResult
    
    check_path = Path(check_result)
    
    if verbose:
        click.echo(f"加载检查结果: {check_path}")
    
    storage = ReviewStorage()
    
    if check_path.exists():
        import json
        with open(check_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for result_type, results in data.items():
            for r in results:
                check_r = CheckResult.from_dict(r)
                if not storage.has_review(check_r.rid):
                    storage.add_review(check_r)
    
    if list_all:
        reviews = storage.get_all_reviews()
        click.echo(f"共 {len(reviews)} 个复核项:")
        for rev in reviews:
            click.echo(f"  - [{rev['id']}] {rev['status']}: {rev['description'][:50]}...")
        return
    
    if review_id:
        if verbose:
            click.echo(f"处理复核项: {review_id}")
        
        current = storage.get_review(review_id)
        if not current:
            click.echo(f"错误: 未找到复核项 {review_id}")
            return
        
        updates = {}
        if status:
            updates['status'] = status
        if comment:
            updates['comment'] = comment
        
        if updates:
            storage.update_review(review_id, **updates)
            click.echo(f"复核项 {review_id} 已更新")
            
            if output:
                output_path = Path(output)
                storage.save(output_path)
                click.echo(f"复核数据已保存到: {output_path}")
        else:
            click.echo("当前复核项信息:")
            import json
            click.echo(json.dumps(current, indent=2, ensure_ascii=False))
    else:
        click.echo("使用 --review-id 指定要处理的复核项，或使用 --list 查看所有复核项")


@cli.command()
@click.option("--check-result", "-c", type=click.Path(exists=True, dir_okay=False), required=True, help="检查结果文件（JSON格式）")
@click.option("--review-data", "-r", type=click.Path(exists=True, dir_okay=False), help="复核数据文件（JSON格式）")
@click.option("--format", "-f", "fmt", type=click.Choice(['markdown', 'csv', 'json', 'all']), default='markdown', help="输出格式")
@click.option("--output", "-o", type=click.Path(), required=True, help="输出文件路径或目录")
@click.option("--title", "-t", type=str, default="抢救车巡检报告", help="报告标题")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def report(check_result: str, review_data: Optional[str], fmt: str, output: str, title: str, verbose: bool):
    """导出 Markdown、CSV、JSON 格式报告

    根据检查结果和复核数据生成巡检报告。
    """
    from .rules import CheckResult
    
    check_path = Path(check_result)
    output_path = Path(output)
    
    if verbose:
        click.echo(f"加载检查结果: {check_path}")
    
    import json
    with open(check_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    check_results = {}
    for result_type, results in data.items():
        check_results[result_type] = [CheckResult.from_dict(r) for r in results]
    
    generator = ReportGenerator(title=title)
    
    if review_data:
        review_path = Path(review_data)
        if verbose:
            click.echo(f"加载复核数据: {review_path}")
        storage = ReviewStorage.load(review_path)
        generator.set_review_storage(storage)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if fmt == 'markdown' or fmt == 'all':
        md_path = output_path if output_path.suffix == '.md' else output_path.with_suffix('.md')
        md_content = generator.generate_markdown(check_results)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        click.echo(f"Markdown 报告已保存到: {md_path}")
    
    if fmt == 'csv' or fmt == 'all':
        csv_path = output_path if output_path.suffix == '.csv' else output_path.with_suffix('.csv')
        generator.generate_csv(check_results, csv_path)
        click.echo(f"CSV 报告已保存到: {csv_path}")
    
    if fmt == 'json' or fmt == 'all':
        json_path = output_path if output_path.suffix == '.json' else output_path.with_suffix('.json')
        generator.generate_json(check_results, json_path)
        click.echo(f"JSON 报告已保存到: {json_path}")
    
    if verbose:
        click.echo("\n报告统计:")
        total = sum(len(r) for r in check_results.values())
        click.echo(f"  总计检查项: {total}")
        for cat, results in check_results.items():
            click.echo(f"  {cat}: {len(results)} 项")


if __name__ == "__main__":
    cli()
