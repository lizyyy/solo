import click
import sys
from pathlib import Path

from .engine import TraceEngine
from .data_loader import DataLoader
from .reports import ReportExporter


@click.group()
@click.version_option(version='1.0.0', prog_name='dental-trace-cli')
def cli():
    """口腔耗材批次灭菌有效期患者追溯排查工具"""
    pass


@cli.command()
@click.option('--excel', '-e', type=click.Path(exists=True), help='Excel数据文件路径')
@click.option('--batch-csv', type=click.Path(exists=True), help='耗材批次CSV文件')
@click.option('--sterilization-csv', type=click.Path(exists=True), help='灭菌记录CSV文件')
@click.option('--patient-csv', type=click.Path(exists=True), help='患者信息CSV文件')
@click.option('--treatment-csv', type=click.Path(exists=True), help='治疗项目CSV文件')
@click.option('--usage-csv', type=click.Path(exists=True), help='使用记录CSV文件')
@click.option('--output', '-o', type=click.Path(), default='./reports', help='输出目录')
@click.option('--format', '-f', type=click.Choice(['all', 'json', 'csv', 'excel', 'text']), default='all', help='输出格式')
@click.option('--batch-id', help='指定批次号追溯')
@click.option('--patient-id', help='指定患者ID追溯')
@click.option('--anomalies-only', is_flag=True, help='只显示异常记录')
def trace(excel, batch_csv, sterilization_csv, patient_csv, treatment_csv, usage_csv, output, format, batch_id, patient_id, anomalies_only):
    """执行追溯分析"""
    try:
        engine = TraceEngine()
        
        if excel:
            click.echo(f"加载Excel数据文件: {excel}")
            DataLoader.load_from_excel(excel, engine)
        else:
            if batch_csv:
                click.echo(f"加载耗材批次: {batch_csv}")
                for batch in DataLoader.load_batches_from_csv(batch_csv):
                    engine.load_batch(batch)
            
            if sterilization_csv:
                click.echo(f"加载灭菌记录: {sterilization_csv}")
                for record in DataLoader.load_sterilizations_from_csv(sterilization_csv):
                    engine.load_sterilization(record)
            
            if patient_csv:
                click.echo(f"加载患者信息: {patient_csv}")
                for patient in DataLoader.load_patients_from_csv(patient_csv):
                    engine.load_patient(patient)
            
            if treatment_csv:
                click.echo(f"加载治疗项目: {treatment_csv}")
                for treatment in DataLoader.load_treatments_from_csv(treatment_csv):
                    engine.load_treatment(treatment)
            
            if usage_csv:
                click.echo(f"加载使用记录: {usage_csv}")
                for usage in DataLoader.load_usages_from_csv(usage_csv):
                    engine.load_usage(usage)
        
        click.echo("")
        click.echo("数据加载完成，开始追溯分析...")
        
        if batch_id:
            results = engine.trace_batch(batch_id)
        elif patient_id:
            results = engine.trace_patient(patient_id)
        else:
            results = engine.trace_all()
        
        if anomalies_only:
            results = [r for r in results if not r.is_valid]
        
        if not results:
            click.echo("未找到匹配的追溯记录")
            return
        
        stats = engine.get_statistics()
        
        click.echo("")
        click.echo("=" * 60)
        click.echo("追溯统计汇总")
        click.echo("=" * 60)
        click.echo(f"总追溯记录数: {stats['total_traces']}")
        click.echo(f"有效记录数: {stats['valid_count']}")
        click.echo(f"无效记录数: {stats['invalid_count']}")
        click.echo(f"总批次数量: {stats['total_batches']}")
        click.echo(f"总灭菌记录数: {stats['total_sterilizations']}")
        click.echo(f"总患者数: {stats['total_patients']}")
        click.echo(f"总治疗项目数: {stats['total_treatments']}")
        click.echo(f"总使用记录数: {stats['total_usages']}")
        
        if stats['anomaly_counts']:
            click.echo("")
            click.echo("异常类型统计:")
            for anomaly_type, count in stats['anomaly_counts'].items():
                click.echo(f"  - {anomaly_type}: {count} 条")
        
        click.echo("")
        click.echo(f"正在导出报告到: {output}")
        Path(output).mkdir(parents=True, exist_ok=True)
        
        prefix = "trace_report"
        if batch_id:
            prefix = f"batch_{batch_id}"
        elif patient_id:
            prefix = f"patient_{patient_id}"
        if anomalies_only:
            prefix += "_anomalies"
        
        if format == 'all':
            ReportExporter.export_all_formats(results, output, stats, prefix)
            click.echo("已导出所有格式报告 (JSON, CSV, Excel, TXT)")
        elif format == 'json':
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            ReportExporter.export_json(results, f"{output}/{prefix}_{timestamp}.json")
            click.echo("已导出JSON报告")
        elif format == 'csv':
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            ReportExporter.export_csv(results, f"{output}/{prefix}_{timestamp}.csv")
            click.echo("已导出CSV报告")
        elif format == 'excel':
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            ReportExporter.export_excel(results, f"{output}/{prefix}_{timestamp}.xlsx", stats)
            click.echo("已导出Excel报告")
        elif format == 'text':
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            ReportExporter.export_text(results, f"{output}/{prefix}_{timestamp}.txt", stats)
            click.echo("已导出文本报告")
        
        click.echo("")
        click.echo("追溯完成!")
        
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--output', '-o', type=click.Path(), default='./samples', help='样例数据输出目录')
def generate_samples(output):
    """生成样例测试数据（包含正常数据、脏数据、边界冲突）"""
    import csv
    from datetime import datetime, timedelta
    
    Path(output).mkdir(parents=True, exist_ok=True)
    
    click.echo("正在生成样例测试数据...")
    
    batches = [
        ['批次号', '耗材名称', '耗材类型', '生产厂家', '生产日期', '有效期', '初始数量', '入库日期', '供应商', '备注'],
        ['B001', '一次性口腔检查包', '检查用品', 'XX医疗科技', '2024-01-15', '2026-01-14', 100, '2024-02-01', '供应商A', '正常批次'],
        ['B002', '牙科高速手机', '治疗器械', 'YY医疗器械', '2024-02-20', '2026-02-19', 50, '2024-03-01', '供应商B', '需要灭菌'],
        ['B003', '一次性注射器', '注射用品', 'ZZ医疗', '2023-12-01', '2024-12-01', 200, '2024-01-15', '供应商A', '即将过期'],
        ['B004', '拔牙钳', '手术器械', 'AA器械厂', '2024-04-01', '2029-04-01', 30, '2024-04-15', '供应商C', '边界测试'],
    ]
    
    with open(f"{output}/batches.csv", 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(batches)
    
    now = datetime.now()
    sterilizations = [
        ['灭菌记录ID', '批次号', '灭菌日期', '灭菌有效期', '灭菌方式', '操作人员', '灭菌器编号', '温度', '时长', '指示剂结果', '备注'],
        ['S001', 'B001', (now - timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S'), (now + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S'), '高压蒸汽', '张护士', 'STER-001', 134, 15, '合格', '正常灭菌'],
        ['S002', 'B002', (now - timedelta(days=60)).strftime('%Y-%m-%d %H:%M:%S'), (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'), '高压蒸汽', '李护士', 'STER-001', 134, 15, '合格', '已过期灭菌'],
        ['S003', 'B002', (now - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'), (now + timedelta(days=55)).strftime('%Y-%m-%d %H:%M:%S'), '高压蒸汽', '张护士', 'STER-002', 134, 15, '合格', '重新灭菌'],
        ['S004', 'B004', (now + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'), (now + timedelta(days=61)).strftime('%Y-%m-%d %H:%M:%S'), '环氧乙烷', '王护士', 'STER-003', 55, 360, '合格', '未来灭菌时间'],
    ]
    
    with open(f"{output}/sterilizations.csv", 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(sterilizations)
    
    patients = [
        ['患者ID', '姓名', '性别', '年龄', '电话', '身份证号', '建档日期', '备注'],
        ['P001', '张三', '男', 35, '13800138001', '110101199001010001', '2024-01-01', '无'],
        ['P002', '李四', '女', 45, '13800138002', '110101198001010002', '2024-02-15', '糖尿病'],
        ['P003', '王五', '男', 28, '13800138003', '110101199601010003', '2024-03-20', '无'],
    ]
    
    with open(f"{output}/patients.csv", 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(patients)
    
    treatments = [
        ['治疗项目ID', '患者ID', '治疗日期', '治疗类型', '主治医生', '助手', '牙椅号', '诊断', '备注'],
        ['T001', 'P001', (now - timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S'), '口腔检查', '王医生', '张护士', 'CHAIR-01', '牙龈炎', '正常治疗'],
        ['T002', 'P002', (now - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'), '拔牙', '李医生', '李护士', 'CHAIR-02', '智齿阻生', '使用过期灭菌器械'],
        ['T003', 'P003', (now + timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'), '补牙', '王医生', '张护士', 'CHAIR-03', '龋齿', '未来预约'],
    ]
    
    with open(f"{output}/treatments.csv", 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(treatments)
    
    usages = [
        ['使用记录ID', '治疗项目ID', '批次号', '使用日期', '使用数量', '使用人', '备注'],
        ['U001', 'T001', 'B001', (now - timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S'), 1, '王医生', '正常使用'],
        ['U002', 'T002', 'B002', (now - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'), 1, '李医生', '使用已过期灭菌批次'],
        ['U003', 'T003', 'B003', (now + timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'), 2, '王医生', '未来使用'],
        ['U004', 'T001', 'B004', (now - timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S'), 1, '王医生', '无有效灭菌记录'],
    ]
    
    with open(f"{output}/usages.csv", 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(usages)
    
    click.echo("样例数据已生成!")
    click.echo(f"  - batches.csv: 耗材批次")
    click.echo(f"  - sterilizations.csv: 灭菌记录")
    click.echo(f"  - patients.csv: 患者信息")
    click.echo(f"  - treatments.csv: 治疗项目")
    click.echo(f"  - usages.csv: 使用记录")
    click.echo("")
    click.echo("样例数据包含:")
    click.echo("  ✓ 正常数据: B001批次 + S001灭菌 + U001使用")
    click.echo("  ✓ 脏数据(过期灭菌): B002批次S002已过期")
    click.echo("  ✓ 边界冲突: 未来使用时间(T003)")
    click.echo("  ✓ 空结果: B004无有效灭菌记录")


@cli.command()
def validate():
    """验证环境依赖是否正确安装"""
    try:
        import click
        import pydantic
        import pandas
        import openpyxl
        click.echo("✓ 所有依赖已正确安装")
        click.echo(f"  - click: {click.__version__}")
        click.echo(f"  - pydantic: {pydantic.__version__}")
        click.echo(f"  - pandas: {pandas.__version__}")
        click.echo(f"  - openpyxl: {openpyxl.__version__}")
    except ImportError as e:
        click.echo(f"✗ 缺少依赖: {e}")
        click.echo("请运行: pip install click pydantic pandas openpyxl python-dateutil")
        sys.exit(1)


if __name__ == '__main__':
    cli()
