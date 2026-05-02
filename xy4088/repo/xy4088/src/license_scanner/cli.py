import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .models import ProjectState, RiskLevel
from .scanner import scan_project
from .parser import parse_license_file
from .matcher import match_assets_and_licenses, MatchResult
from .checker import check_risks, get_risk_summary
from .storage import ProjectStorage, save_project_state, load_project_state
from .reporter import (
    generate_markdown_report,
    export_assets_csv,
    export_risks_csv,
    export_audit_json,
)


STORAGE_FILE = ".license_scanner_state.json"


def get_project_dir(ctx: click.Context) -> Path:
    if ctx.obj and 'project_dir' in ctx.obj:
        return Path(ctx.obj['project_dir'])
    return Path.cwd()


def load_or_init_state(project_dir: Path) -> ProjectState:
    storage = ProjectStorage(str(project_dir))
    
    if storage.state_exists():
        return storage.load_state()
    
    return ProjectState(
        project_name=project_dir.name,
        scan_date=datetime.now()
    )


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.option('-p', '--project', 'project_dir', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help='项目目录路径 (默认为当前目录)')
@click.pass_context
def cli(ctx: click.Context, project_dir: Optional[str]):
    """素材授权包巡检员 - 设计外包团队素材授权管理工具
    
    用于扫描、匹配、校验和报告素材授权状态。
    """
    ctx.ensure_object(dict)
    if project_dir:
        ctx.obj['project_dir'] = Path(project_dir).resolve()
    else:
        ctx.obj['project_dir'] = Path.cwd().resolve()


@cli.command()
@click.option('--exclude', '-e', multiple=True,
              help='排除的目录或文件模式 (可多次使用)')
@click.option('--extensions', '-x', 
              help='只扫描指定扩展名 (逗号分隔, 如: .jpg,.png,.ttf)')
@click.pass_context
def scan(ctx: click.Context, exclude: tuple, extensions: Optional[str]):
    """扫描项目目录并计算文件哈希
    
    遍历项目目录，识别所有素材文件并计算 SHA-256 哈希值。
    结果会保存到项目状态文件中。
    """
    project_dir = get_project_dir(ctx)
    
    click.echo(f"📂 扫描项目目录: {project_dir}")
    click.echo("")
    
    exclude_patterns = list(exclude) if exclude else None
    include_extensions = None
    
    if extensions:
        include_extensions = [ext.strip() for ext in extensions.split(',')]
        click.echo(f"📌 只扫描扩展名: {', '.join(include_extensions)}")
    
    try:
        from .scanner import DirectoryScanner
        scanner = DirectoryScanner(
            exclude_patterns=exclude_patterns,
            include_extensions=include_extensions
        )
        assets = scanner.scan_directory(str(project_dir))
    except Exception as e:
        click.echo(f"❌ 扫描失败: {e}", err=True)
        sys.exit(1)
    
    state = load_or_init_state(project_dir)
    state.assets = assets
    state.scan_date = datetime.now()
    
    storage = ProjectStorage(str(project_dir))
    saved_path = storage.save_state(state)
    
    click.echo("")
    click.echo(f"✅ 扫描完成! 发现 {len(assets)} 个文件")
    
    by_type = {}
    for asset in assets:
        type_name = asset.asset_type.value
        by_type[type_name] = by_type.get(type_name, 0) + 1
    
    if by_type:
        click.echo("")
        click.echo("📊 文件类型统计:")
        for type_name, count in sorted(by_type.items()):
            click.echo(f"   - {type_name}: {count} 个")
    
    click.echo("")
    click.echo(f"💾 状态已保存到: {saved_path}")


@cli.command('import-license')
@click.argument('license_file', 
                type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--clear', '-c', is_flag=True,
              help='导入前清空现有授权记录')
@click.pass_context
def import_license(ctx: click.Context, license_file: str, clear: bool):
    """导入授权清单 CSV/PDF 文本
    
    从授权文件中提取授权信息并添加到项目状态。
    支持 CSV 和 PDF 格式。
    """
    project_dir = get_project_dir(ctx)
    license_path = Path(license_file)
    
    click.echo(f"📄 导入授权文件: {license_path}")
    click.echo("")
    
    try:
        licenses = parse_license_file(str(license_path))
    except Exception as e:
        click.echo(f"❌ 解析授权文件失败: {e}", err=True)
        sys.exit(1)
    
    if not licenses:
        click.echo("⚠️  未从文件中提取到任何授权信息")
        return
    
    state = load_or_init_state(project_dir)
    
    if clear:
        state.licenses = []
        click.echo("🧹 已清空现有授权记录")
    
    existing_ids = {lic.license_id for lic in state.licenses}
    added_count = 0
    
    for lic in licenses:
        if lic.license_id not in existing_ids:
            state.licenses.append(lic)
            existing_ids.add(lic.license_id)
            added_count += 1
    
    storage = ProjectStorage(str(project_dir))
    saved_path = storage.save_state(state)
    
    click.echo("")
    click.echo(f"✅ 导入完成! 从文件提取 {len(licenses)} 条授权")
    if added_count > 0:
        click.echo(f"📥 新增 {added_count} 条授权记录")
    
    click.echo("")
    click.echo(f"💾 状态已保存到: {saved_path}")


@cli.command()
@click.option('--min-confidence', '-m', type=float, default=0.3,
              help='最小匹配置信度 (0.0-1.0, 默认 0.3)')
@click.pass_context
def match(ctx: click.Context, min_confidence: float):
    """关联素材和授权条款
    
    根据文件名、哈希值等信息，将已扫描的素材与已导入的授权进行匹配。
    """
    project_dir = get_project_dir(ctx)
    
    storage = ProjectStorage(str(project_dir))
    if not storage.state_exists():
        click.echo("❌ 未找到项目状态，请先执行 scan 和 import-license", err=True)
        sys.exit(1)
    
    state = storage.load_state()
    
    if not state.assets:
        click.echo("⚠️  没有已扫描的素材，请先执行 scan")
        return
    
    if not state.licenses:
        click.echo("⚠️  没有已导入的授权，请先执行 import-license")
        return
    
    click.echo(f"🔗 开始匹配: {len(state.assets)} 个素材 vs {len(state.licenses)} 个授权")
    click.echo(f"   最小置信度: {min_confidence}")
    click.echo("")
    
    matches, unmatched = match_assets_and_licenses(
        state.assets, state.licenses, min_confidence
    )
    
    state.matches = [m.to_dict() for m in matches]
    
    storage.save_state(state)
    
    click.echo(f"✅ 匹配完成!")
    click.echo(f"   成功匹配: {len(matches)} 个素材")
    click.echo(f"   未匹配: {len(unmatched.get('unmatched', []))} 个素材")
    
    if unmatched.get('multiple_matches'):
        click.echo(f"   ⚠️  多个匹配: {len(unmatched['multiple_matches'])} 个素材")
    
    if matches:
        click.echo("")
        click.echo("📋 匹配详情 (前5个):")
        for m in matches[:5]:
            click.echo(f"   - {m.asset.file_name} <-> {m.license.asset_name}")
            click.echo(f"     强度: {m.strength.value}, 置信度: {m.confidence:.2f}")


@cli.command()
@click.option('--usage', '-u', multiple=True,
              help='需要的使用权限 (可多次使用, 如: --usage "商业使用")')
@click.option('--seats', '-s', type=int, default=1,
              help='需要的授权人数 (默认 1)')
@click.option('--date', '-d', 
              help='检查日期 (格式: YYYY-MM-DD, 默认今天)')
@click.pass_context
def check(ctx: click.Context, usage: tuple, seats: int, date: Optional[str]):
    """标出缺证、过期、用途不匹配、同名不同哈希和重复素材
    
    执行全面的风险检查，包括：
    - 缺少授权的素材
    - 过期或即将过期的授权
    - 用途不匹配
    - 授权人数不足
    - 同名但哈希不同的文件
    - 重复素材
    """
    project_dir = get_project_dir(ctx)
    
    storage = ProjectStorage(str(project_dir))
    if not storage.state_exists():
        click.echo("❌ 未找到项目状态，请先执行 scan 和 import-license", err=True)
        sys.exit(1)
    
    state = storage.load_state()
    
    if not state.assets:
        click.echo("⚠️  没有已扫描的素材，请先执行 scan")
        return
    
    check_date = None
    if date:
        try:
            check_date = datetime.strptime(date, '%Y-%m-%d')
            click.echo(f"📅 使用检查日期: {check_date.strftime('%Y-%m-%d')}")
        except ValueError:
            click.echo(f"❌ 无效的日期格式: {date}, 使用 YYYY-MM-DD", err=True)
            sys.exit(1)
    
    required_usage = list(usage) if usage else None
    
    click.echo(f"🔍 执行风险检查...")
    click.echo(f"   素材数量: {len(state.assets)}")
    click.echo(f"   授权数量: {len(state.licenses)}")
    if required_usage:
        click.echo(f"   需要用途: {', '.join(required_usage)}")
    click.echo(f"   需要人数: {seats} 人")
    click.echo("")
    
    risks = check_risks(
        state.assets,
        state.licenses,
        state.matches,
        current_date=check_date,
        required_usage=required_usage,
        min_required_seats=seats
    )
    
    state.risks = risks
    storage.save_state(state)
    
    summary = get_risk_summary(risks)
    
    click.echo(f"✅ 检查完成! 发现 {len(risks)} 个风险")
    click.echo("")
    
    if summary['by_level']:
        click.echo("📊 按严重程度:")
        for level in ['critical', 'high', 'medium', 'low']:
            count = summary['by_level'].get(level, 0)
            if count > 0:
                if level == 'critical':
                    icon = '🔴'
                elif level == 'high':
                    icon = '🟠'
                elif level == 'medium':
                    icon = '🟡'
                else:
                    icon = '🔵'
                click.echo(f"   {icon} {level.upper()}: {count} 个")
    
    click.echo("")
    
    if risks:
        click.echo("📋 风险详情 (严重级别优先):")
        
        sorted_risks = sorted(
            risks, 
            key=lambda r: {
                RiskLevel.CRITICAL: 0,
                RiskLevel.HIGH: 1,
                RiskLevel.MEDIUM: 2,
                RiskLevel.LOW: 3
            }.get(r.risk_level, 4)
        )
        
        for risk in sorted_risks[:10]:
            if risk.risk_level == RiskLevel.CRITICAL:
                icon = '🔴'
            elif risk.risk_level == RiskLevel.HIGH:
                icon = '🟠'
            elif risk.risk_level == RiskLevel.MEDIUM:
                icon = '🟡'
            else:
                icon = '🔵'
            
            click.echo(f"   {icon} [{risk.risk_type.value}] {risk.message}")
        
        if len(risks) > 10:
            click.echo(f"   ... 还有 {len(risks) - 10} 个风险")
    
    click.echo("")
    click.echo(f"💾 风险数据已保存到项目状态")


@cli.command()
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='输出目录 (默认为项目目录下的 reports 子目录)')
@click.option('--format', '-f', 
              type=click.Choice(['all', 'markdown', 'csv', 'json']),
              default='all',
              help='导出格式 (默认: all)')
@click.pass_context
def export(ctx: click.Context, output_dir: Optional[str], format: str):
    """导出 Markdown 风险报告、CSV 素材台账和 JSON 审计包
    
    支持三种导出格式：
    - markdown: 人类可读的风险报告
    - csv: 素材台账和风险清单
    - json: 完整的审计数据包
    """
    project_dir = get_project_dir(ctx)
    
    storage = ProjectStorage(str(project_dir))
    if not storage.state_exists():
        click.echo("❌ 未找到项目状态，请先执行 scan、import-license、match 和 check", err=True)
        sys.exit(1)
    
    state = storage.load_state()
    
    if output_dir:
        out_dir = Path(output_dir)
    else:
        out_dir = project_dir / 'reports'
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"📤 导出报告到: {out_dir}")
    click.echo(f"   格式: {format}")
    click.echo("")
    
    exported_files: List[str] = []
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format in ['all', 'markdown']:
        md_path = out_dir / f"license_risk_report_{timestamp}.md"
        try:
            generate_markdown_report(state, str(md_path))
            exported_files.append(str(md_path))
            click.echo(f"✅ Markdown 报告: {md_path}")
        except Exception as e:
            click.echo(f"❌ 生成 Markdown 报告失败: {e}", err=True)
    
    if format in ['all', 'csv']:
        assets_csv = out_dir / f"asset_ledger_{timestamp}.csv"
        risks_csv = out_dir / f"risk_list_{timestamp}.csv"
        
        try:
            export_assets_csv(state, str(assets_csv))
            exported_files.append(str(assets_csv))
            click.echo(f"✅ 素材台账 CSV: {assets_csv}")
        except Exception as e:
            click.echo(f"❌ 生成素材台账失败: {e}", err=True)
        
        try:
            export_risks_csv(state, str(risks_csv))
            exported_files.append(str(risks_csv))
            click.echo(f"✅ 风险清单 CSV: {risks_csv}")
        except Exception as e:
            click.echo(f"❌ 生成风险清单失败: {e}", err=True)
    
    if format in ['all', 'json']:
        json_path = out_dir / f"audit_package_{timestamp}.json"
        try:
            export_audit_json(state, str(json_path))
            exported_files.append(str(json_path))
            click.echo(f"✅ 审计包 JSON: {json_path}")
        except Exception as e:
            click.echo(f"❌ 生成审计包失败: {e}", err=True)
    
    click.echo("")
    click.echo(f"📊 导出完成! 共 {len(exported_files)} 个文件")


@cli.command('status')
@click.pass_context
def show_status(ctx: click.Context):
    """显示当前项目状态摘要"""
    project_dir = get_project_dir(ctx)
    
    storage = ProjectStorage(str(project_dir))
    
    if not storage.state_exists():
        click.echo(f"📂 项目目录: {project_dir}")
        click.echo("")
        click.echo("⚠️  未找到项目状态文件")
        click.echo("")
        click.echo("请按以下顺序执行命令:")
        click.echo("  1. license-scanner scan          - 扫描素材")
        click.echo("  2. license-scanner import-license - 导入授权")
        click.echo("  3. license-scanner match         - 匹配关联")
        click.echo("  4. license-scanner check         - 风险检查")
        click.echo("  5. license-scanner export        - 导出报告")
        return
    
    state = storage.load_state()
    
    click.echo(f"📂 项目目录: {project_dir}")
    click.echo(f"📅 最后扫描: {state.scan_date.strftime('%Y-%m-%d %H:%M:%S') if state.scan_date else '未知'}")
    click.echo("")
    click.echo("📊 当前状态:")
    click.echo(f"   素材数量: {len(state.assets)}")
    click.echo(f"   授权数量: {len(state.licenses)}")
    click.echo(f"   匹配数量: {len(state.matches)}")
    click.echo(f"   风险数量: {len(state.risks)}")
    
    if state.risks:
        from .checker import group_risks_by_level
        by_level = group_risks_by_level(state.risks)
        click.echo("")
        click.echo("⚠️  风险分布:")
        for level in ['critical', 'high', 'medium', 'low']:
            enum_level = RiskLevel(level)
            count = len(by_level.get(enum_level, []))
            if count > 0:
                click.echo(f"   {level.upper()}: {count} 个")


if __name__ == '__main__':
    cli()
