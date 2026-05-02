#!/usr/bin/env python3
"""
危化品库位相容性预检CLI工具
用于高校实验室安全员在试剂入库前进行安全检查
"""
import os
import sys
from pathlib import Path
import click

# 添加当前目录到模块搜索路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chemical_compatibility_checker.parsers import (
    parse_chemicals,
    parse_storage,
    parse_compatibility,
    parse_inbound,
    validate_data_integrity,
    ValidationError
)
from chemical_compatibility_checker.rules import (
    Normalizer,
    run_all_checks,
    check_inbound_conflicts,
    Severity
)
from chemical_compatibility_checker.placement import (
    generate_placement_plan
)
from chemical_compatibility_checker.reports import (
    generate_audit_report,
    export_violations,
    export_placement_plan
)


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """
    危化品库位相容性预检系统
    
    用于高校实验室安全员在试剂入库前进行安全检查，
    包括库位容量检查、危险类别禁混检查、标签缺失检查等。
    """
    pass


@cli.command()
@click.option('--chemicals', '-c', required=True, type=click.Path(exists=True),
              help='化学品信息CSV文件路径')
@click.option('--storage', '-s', required=True, type=click.Path(exists=True),
              help='库位信息YAML文件路径')
@click.option('--compatibility', '-comp', required=True, type=click.Path(exists=True),
              help='相容性规则JSON文件路径')
@click.option('--inbound', '-i', required=True, type=click.Path(exists=True),
              help='入库申请CSV文件路径')
@click.option('--output-dir', '-o', default='.', type=click.Path(),
              help='输出文件目录（默认：当前目录）')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
def check(chemicals, storage, compatibility, inbound, output_dir, verbose):
    """
    执行危化品库位相容性预检
    
    输入文件：
    - chemicals.csv: 化学品目录信息
    - storage.yaml: 库位配置和当前存储状态
    - compatibility.json: 危险类别相容性规则
    - inbound.csv: 待入库申请
    
    输出文件：
    - audit.md: 完整的审计报告
    - violations.csv: 违规详情列表
    - placement_plan.csv: 建议的放置计划
    """
    click.echo(click.style('=== 危化品库位相容性预检系统 ===', fg='blue', bold=True))
    click.echo(f'开始时间: {click.style(os.popen("date +%Y-%m-%d %H:%M:%S").read().strip(), fg="cyan")}')
    click.echo('')
    
    try:
        # 1. 解析输入文件
        if verbose:
            click.echo(click.style('正在解析输入文件...', fg='yellow'))
        
        chemicals_data = parse_chemicals(chemicals)
        if verbose:
            click.echo(f'  ✓ 已加载 {len(chemicals_data)} 种化学品')
        
        storage_data = parse_storage(storage)
        if verbose:
            click.echo(f'  ✓ 已加载 {len(storage_data)} 个库位')
        
        compatibility_data = parse_compatibility(compatibility)
        if verbose:
            click.echo(f'  ✓ 已加载相容性规则')
        
        inbound_data = parse_inbound(inbound)
        if verbose:
            click.echo(f'  ✓ 已加载 {len(inbound_data)} 项入库申请')
        
        # 2. 验证数据完整性
        if verbose:
            click.echo('')
            click.echo(click.style('正在验证数据完整性...', fg='yellow'))
        
        warnings = validate_data_integrity(chemicals_data, storage_data, inbound_data)
        for warning in warnings:
            click.echo(click.style(f'  ⚠️ 警告: {warning}', fg='yellow'))
        
        # 3. 初始化归一化器
        normalizer = Normalizer(compatibility_data.get('normalization', {}))
        if verbose:
            click.echo('')
            click.echo(click.style('已初始化危险类别归一化器', fg='green'))
        
        # 4. 执行规则检查
        if verbose:
            click.echo('')
            click.echo(click.style('正在执行规则检查...', fg='yellow'))
        
        all_violations = []
        
        # 对每个入库申请执行检查
        for request in inbound_data:
            violations = run_all_checks(
                request, inbound_data, storage_data,
                chemicals_data, compatibility_data, normalizer
            )
            all_violations.extend(violations)
        
        # 检查入库申请之间的冲突
        conflict_violations = check_inbound_conflicts(
            inbound_data, storage_data, chemicals_data, normalizer
        )
        all_violations.extend(conflict_violations)
        
        # 统计违规
        severity_counts = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 0,
            Severity.MEDIUM: 0,
            Severity.LOW: 0
        }
        for v in all_violations:
            if v.severity in severity_counts:
                severity_counts[v.severity] += 1
        
        click.echo('')
        click.echo(click.style('检查结果:', fg='blue', bold=True))
        click.echo(f'  严重违规: {click.style(str(severity_counts[Severity.CRITICAL]), fg="red")} 项')
        click.echo(f'  高优先级: {click.style(str(severity_counts[Severity.HIGH]), fg="bright_red")} 项')
        click.echo(f'  中优先级: {click.style(str(severity_counts[Severity.MEDIUM]), fg="yellow")} 项')
        click.echo(f'  低优先级: {click.style(str(severity_counts[Severity.LOW]), fg="green")} 项')
        
        # 5. 生成放置计划
        if verbose:
            click.echo('')
            click.echo(click.style('正在生成放置计划...', fg='yellow'))
        
        storage_before = {loc_id: loc.copy() for loc_id, loc in storage_data.items()}
        placement_items, storage_after = generate_placement_plan(
            inbound_data, storage_data, chemicals_data,
            compatibility_data, normalizer, all_violations
        )
        
        # 统计放置计划
        approved = sum(1 for item in placement_items if item.status == 'approved')
        needs_review = sum(1 for item in placement_items if item.status == 'needs_review')
        rejected = sum(1 for item in placement_items if item.status == 'rejected')
        
        click.echo('')
        click.echo(click.style('放置计划:', fg='blue', bold=True))
        click.echo(f'  通过: {click.style(str(approved), fg="green")} 项')
        click.echo(f'  需审核: {click.style(str(needs_review), fg="yellow")} 项')
        click.echo(f'  拒绝: {click.style(str(rejected), fg="red")} 项')
        
        # 6. 确保输出目录存在
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # 7. 导出报告
        if verbose:
            click.echo('')
            click.echo(click.style('正在导出报告...', fg='yellow'))
        
        audit_path = output_path / 'audit.md'
        violations_path = output_path / 'violations.csv'
        placement_path = output_path / 'placement_plan.csv'
        
        generate_audit_report(
            all_violations, placement_items,
            storage_before, storage_after,
            warnings, str(audit_path)
        )
        
        export_violations(all_violations, str(violations_path))
        export_placement_plan(placement_items, str(placement_path))
        
        click.echo('')
        click.echo(click.style('报告已生成:', fg='green', bold=True))
        click.echo(f'  📄 {audit_path}')
        click.echo(f'  📊 {violations_path}')
        click.echo(f'  📋 {placement_path}')
        
        # 8. 总结
        click.echo('')
        click.echo(click.style('=== 预检完成 ===', fg='blue', bold=True))
        
        if severity_counts[Severity.CRITICAL] > 0:
            click.echo(click.style(
                f'⚠️ 发现 {severity_counts[Severity.CRITICAL]} 项严重违规，请立即处理！',
                fg='red', bold=True
            ))
        elif severity_counts[Severity.HIGH] > 0:
            click.echo(click.style(
                f'⚠️ 发现 {severity_counts[Severity.HIGH]} 项高优先级违规，建议人工审核。',
                fg='yellow'
            ))
        else:
            click.echo(click.style('✅ 未发现严重违规，入库申请可正常处理。', fg='green'))
        
        click.echo(f'结束时间: {click.style(os.popen("date +%Y-%m-%d %H:%M:%S").read().strip(), fg="cyan")}')
        
    except ValidationError as e:
        click.echo(click.style(f'错误: {e}', fg='red', bold=True), err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(click.style(f'发生意外错误: {e}', fg='red', bold=True), err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('sample_dir', type=click.Path(), default='sample_data')
def init_sample(sample_dir):
    """
    创建示例数据目录
    
    生成用于演示的示例输入文件，包括：
    - chemicals.csv: 示例化学品数据
    - storage.yaml: 示例库位配置
    - compatibility.json: 示例相容性规则
    - inbound.csv: 示例入库申请
    """
    sample_path = Path(sample_dir)
    
    if sample_path.exists():
        click.confirm(
            f'目录 {sample_dir} 已存在，是否覆盖？',
            abort=True
        )
    
    sample_path.mkdir(parents=True, exist_ok=True)
    
    # 生成示例数据
    chemicals_csv = """chemical_id,name,dangerous_categories,volume,unit
CHEM-001,浓硫酸,强酸,500,ml
CHEM-002,氢氧化钠,强碱,1000,ml
CHEM-003,乙醇,易燃液体,2000,ml
CHEM-004,过氧化氢,氧化剂,500,ml
CHEM-005,盐酸,酸类,1000,ml
"""
    
    storage_yaml = """locations:
  - id: A-01
    name: 强酸存储区
    capacity: 100
    unit: L
    allowed_categories:
      - 强酸
      - 酸类
    forbidden_categories:
      - 强碱
      - 易燃液体
    current_chemicals:
      - chemical_id: CHEM-005
        volume: 10

  - id: A-02
    name: 强碱存储区
    capacity: 100
    unit: L
    allowed_categories:
      - 强碱
      - 碱类
    forbidden_categories:
      - 强酸
      - 酸类
    current_chemicals: []

  - id: B-01
    name: 易燃液体存储区
    capacity: 200
    unit: L
    allowed_categories:
      - 易燃液体
    forbidden_categories:
      - 氧化剂
      - 强酸
    current_chemicals:
      - chemical_id: CHEM-003
        volume: 50

  - id: C-01
    name: 氧化剂存储区
    capacity: 50
    unit: L
    allowed_categories:
      - 氧化剂
    forbidden_categories:
      - 易燃液体
      - 还原剂
    current_chemicals: []
"""
    
    compatibility_json = """{
  "normalization": {
    "强酸": ["酸类", "强酸性物质", "腐蚀性酸"],
    "强碱": ["碱类", "强碱性物质", "腐蚀性碱"],
    "氧化剂": ["氧化性物质", "强氧化剂"],
    "易燃液体": ["可燃液体", "有机溶剂"]
  },
  "incompatible_pairs": [
    {"category1": "强酸", "category2": "强碱", "severity": "critical"},
    {"category1": "强酸", "category2": "易燃液体", "severity": "high"},
    {"category1": "强碱", "category2": "易燃液体", "severity": "medium"},
    {"category1": "氧化剂", "category2": "易燃液体", "severity": "critical"},
    {"category1": "氧化剂", "category2": "强酸", "severity": "medium"}
  ],
  "storage_rules": [
    {
      "category": "强酸",
      "requirements": ["通风", "防腐蚀", "远离水源"],
      "notes": "应单独存放，避免与碱类接触"
    },
    {
      "category": "易燃液体",
      "requirements": ["防爆", "通风", "远离火源", "防静电"],
      "notes": "存储温度不应超过30℃"
    }
  ]
}
"""
    
    inbound_csv = """request_id,chemical_id,requested_location,volume
REQ-001,CHEM-001,A-01,20
REQ-002,CHEM-002,A-01,15
REQ-003,CHEM-003,B-01,100
REQ-004,CHEM-004,B-01,10
REQ-005,CHEM-005,A-01,80
"""
    
    # 写入文件
    (sample_path / 'chemicals.csv').write_text(chemicals_csv, encoding='utf-8')
    (sample_path / 'storage.yaml').write_text(storage_yaml, encoding='utf-8')
    (sample_path / 'compatibility.json').write_text(compatibility_json, encoding='utf-8')
    (sample_path / 'inbound.csv').write_text(inbound_csv, encoding='utf-8')
    
    click.echo(click.style(f'示例数据已创建在: {sample_dir}/', fg='green', bold=True))
    click.echo('')
    click.echo('使用以下命令运行预检:')
    click.echo(f'  python cli.py check -c {sample_dir}/chemicals.csv -s {sample_dir}/storage.yaml -comp {sample_dir}/compatibility.json -i {sample_dir}/inbound.csv')


if __name__ == '__main__':
    cli()
