"""
CLI 主程序

数据库迁移前置检查工具的命令行入口。
"""

import os
import json
from typing import Optional, List
import click

from .config import ConfigManager
from .migration_parser import MigrationParser
from .risk_analyzer import RiskAnalyzer, RiskLevel
from .waiver_manager import WaiverManager
from .report_generator import ReportGenerator


class MigrationChecker:
    """迁移检查器主类"""
    
    def __init__(
        self,
        migration_dir: str,
        table_scale_config: Optional[str] = None,
        deployment_window_config: Optional[str] = None,
        waiver_file: Optional[str] = None,
        history_file: Optional[str] = None
    ):
        self.migration_dir = migration_dir
        self.config_manager = ConfigManager()
        self.waiver_manager = WaiverManager(waiver_file)
        self.report_generator = ReportGenerator(history_file)
        self.parser = None
        self.analyzer = None
        self.analysis_result = None
        
        # 加载配置
        if table_scale_config:
            self.config_manager.load_table_scale_config(table_scale_config)
        if deployment_window_config:
            self.config_manager.load_deployment_window(deployment_window_config)
    
    def run_analysis(self) -> int:
        """运行分析"""
        # 解析迁移脚本
        self.parser = MigrationParser(self.migration_dir)
        _, parse_errors = self.parser.parse_directory()
        
        if parse_errors:
            click.echo("解析错误:")
            for error in parse_errors:
                click.echo(f"  - {error}")
        
        # 分析风险
        self.analyzer = RiskAnalyzer(self.config_manager)
        self.analysis_result = self.analyzer.analyze_migrations(self.parser)
        
        # 计算活跃的阻断风险
        filtered = self.waiver_manager.filter_risks(self.analysis_result.risks)
        active_blockers = [r for r in filtered['not_waived'] + filtered['expired'] 
                         if r.level == RiskLevel.BLOCKER]
        
        return 1 if active_blockers else 0
    
    def generate_report(self, output_format: str = 'console', output_file: Optional[str] = None) -> None:
        """生成报告"""
        if not self.analysis_result:
            raise RuntimeError("请先运行分析")
        
        # 与上次扫描对比
        comparison = self.report_generator.compare_with_last_scan(
            self.migration_dir,
            self.analysis_result.risks
        )
        
        if output_format == 'json':
            report = self.report_generator.generate_json_report(
                self.analysis_result,
                self.waiver_manager,
                comparison
            )
            output = json.dumps(report, indent=2, ensure_ascii=False)
        else:
            output = self.report_generator.generate_console_report(
                self.analysis_result,
                self.waiver_manager,
                comparison
            )
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output)
            click.echo(f"报告已保存到: {output_file}")
        else:
            click.echo(output)
    
    def save_scan_history(self) -> None:
        """保存扫描历史"""
        if not self.analysis_result:
            raise RuntimeError("请先运行分析")
        
        self.report_generator.add_scan_result(
            self.migration_dir,
            self.analysis_result.risks
        )
    
    def add_waiver(
        self,
        risk_hash: str,
        reason: str,
        approved_by: str,
        days_valid: int = 7
    ) -> bool:
        """添加豁免"""
        # 确保已运行分析
        if not self.analysis_result:
            self.run_analysis()
        
        # 查找风险
        for risk in self.analysis_result.risks:
            if risk.hash == risk_hash or risk.hash.startswith(risk_hash):
                waiver = self.waiver_manager.add_waiver(
                    risk, reason, approved_by, days_valid
                )
                click.echo(f"已添加豁免:")
                click.echo(f"  风险: {risk.description}")
                click.echo(f"  原因: {reason}")
                click.echo(f"  审批人: {approved_by}")
                click.echo(f"  到期时间: {waiver.expires_at}")
                return True
        
        click.echo(f"未找到风险 ID: {risk_hash}")
        return False
    
    def list_risks(self) -> None:
        """列出所有风险"""
        if not self.analysis_result:
            self.run_analysis()
        
        for i, risk in enumerate(self.analysis_result.risks, 1):
            click.echo(f"{i}. [{risk.hash[:8]}] [{risk.level.value}] {risk.description}")
            click.echo(f"   脚本: {risk.script_filename}")
            if risk.table_name:
                click.echo(f"   表名: {risk.table_name}")
            click.echo(f"   服务: {risk.service}")
            click.echo("")


@click.group()
@click.option('--migration-dir', '-d', required=True, 
              help='迁移脚本目录')
@click.option('--table-scale-config', '-t', default='table_scale.yaml',
              help='表规模配置文件 (默认: table_scale.yaml)')
@click.option('--deployment-window-config', '-w', default='deployment_window.yaml',
              help='上线窗口配置文件 (默认: deployment_window.yaml)')
@click.option('--waiver-file', default='.migration_waivers.json',
              help='豁免文件路径')
@click.option('--history-file', default='.migration_scan_history.json',
              help='扫描历史文件路径')
@click.pass_context
def cli(ctx, migration_dir, table_scale_config, deployment_window_config, 
        waiver_file, history_file):
    """数据库迁移前置检查工具"""
    ctx.obj = {
        'checker': MigrationChecker(
            migration_dir=migration_dir,
            table_scale_config=table_scale_config if os.path.exists(table_scale_config) else None,
            deployment_window_config=deployment_window_config if os.path.exists(deployment_window_config) else None,
            waiver_file=waiver_file,
            history_file=history_file
        )
    }


@cli.command()
@click.option('--output-format', '-f', type=click.Choice(['console', 'json']), 
              default='console', help='输出格式')
@click.option('--output-file', '-o', help='输出文件路径')
@click.option('--save-history/--no-save-history', default=True,
              help='是否保存扫描历史')
@click.pass_context
def check(ctx, output_format, output_file, save_history):
    """运行迁移检查"""
    checker = ctx.obj['checker']
    
    click.echo(f"开始检查迁移目录: {checker.migration_dir}")
    click.echo("")
    
    exit_code = checker.run_analysis()
    checker.generate_report(output_format, output_file)
    
    if save_history:
        checker.save_scan_history()
    
    ctx.exit(exit_code)


@cli.command('list-risks')
@click.pass_context
def list_risks(ctx):
    """列出所有风险（用于添加豁免前查看）"""
    checker = ctx.obj['checker']
    checker.list_risks()


@cli.command('add-waiver')
@click.option('--risk-hash', '-r', required=True, help='风险ID（完整或前8位）')
@click.option('--reason', '-m', required=True, help='豁免原因')
@click.option('--approved-by', '-a', required=True, help='审批人')
@click.option('--days', '-d', default=7, help='有效天数 (默认: 7)')
@click.pass_context
def add_waiver(ctx, risk_hash, reason, approved_by, days):
    """添加人工豁免"""
    checker = ctx.obj['checker']
    success = checker.add_waiver(risk_hash, reason, approved_by, days)
    ctx.exit(0 if success else 1)


@cli.command('list-waivers')
@click.pass_context
def list_waivers(ctx):
    """列出所有豁免"""
    checker = ctx.obj['checker']
    waivers = checker.waiver_manager.get_all_waivers()
    
    if not waivers:
        click.echo("暂无豁免记录")
        return
    
    click.echo("豁免列表:")
    for i, waiver in enumerate(waivers, 1):
        status = "已过期" if waiver.is_expired() else "有效"
        click.echo(f"{i}. [{waiver.risk_hash[:8]}] [{status}]")
        click.echo(f"   类型: {waiver.risk_type.value if hasattr(waiver.risk_type, 'value') else waiver.risk_type}")
        click.echo(f"   版本: {waiver.script_version}")
        click.echo(f"   原因: {waiver.reason}")
        click.echo(f"   审批人: {waiver.approved_by}")
        click.echo(f"   到期: {waiver.expires_at}")
        click.echo("")


@cli.command('recheck')
@click.option('--output-format', '-f', type=click.Choice(['console', 'json']), 
              default='console', help='输出格式')
@click.option('--output-file', '-o', help='输出文件路径')
@click.pass_context
def recheck(ctx, output_format, output_file):
    """重新检查（不会修改豁免状态）"""
    checker = ctx.obj['checker']
    
    click.echo("重新检查中...")
    click.echo("")
    
    exit_code = checker.run_analysis()
    checker.generate_report(output_format, output_file)
    
    ctx.exit(exit_code)


@cli.command('generate-report')
@click.option('--output-format', '-f', type=click.Choice(['console', 'json']), 
              default='console', help='输出格式')
@click.option('--output-file', '-o', required=True, help='输出文件路径')
@click.pass_context
def generate_report(ctx, output_format, output_file):
    """生成上线报告"""
    checker = ctx.obj['checker']
    
    if not checker.analysis_result:
        checker.run_analysis()
    
    checker.generate_report(output_format, output_file)
    checker.save_scan_history()
    
    click.echo(f"报告已生成: {output_file}")


def main():
    """主入口"""
    cli()


if __name__ == '__main__':
    main()
