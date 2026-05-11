import click
from tabulate import tabulate
from typing import List
from .parser import SlowQueryParser
from .config_manager import ConfigManager
from .analyzer import QueryAnalyzer
from .exporter import ReportExporter


class SlowQueryCLI:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config_manager = ConfigManager(config_path)
        self.parser = SlowQueryParser()
        self.analyzer = None
        self.queries = []

    def reload_config(self):
        click.echo(f"正在重新加载配置: {self.config_path}")
        owners, conflicts = self.config_manager.load_config()
        
        if conflicts:
            click.echo("\n⚠️  配置冲突警告:")
            for conflict in conflicts:
                click.echo(f"   - {conflict}")
        else:
            click.echo(f"✅ 配置加载成功，共 {len(owners)} 位负责人")
        
        return owners, conflicts

    def import_logs(self, log_path: str, format: str = 'simple'):
        click.echo(f"正在导入日志: {log_path} (格式: {format})")
        
        if format == 'mysql':
            queries = self.parser.parse_mysql_log(log_path)
        else:
            queries = self.parser.parse_simple_format(log_path)
        
        self.queries = queries
        click.echo(f"✅ 成功解析 {len(queries)} 条慢查询记录")
        
        parse_errors = [q for q in queries if q.error]
        if parse_errors:
            click.echo(f"\n⚠️  解析失败记录: {len(parse_errors)}")
        
        return queries

    def analyze(self):
        if not self.queries:
            click.echo("❌ 没有可分析的查询数据，请先导入日志")
            return None

        click.echo("\n开始分析慢查询...")
        self.analyzer = QueryAnalyzer(self.config_manager)
        patterns = self.analyzer.analyze(self.queries)
        
        stats = self.analyzer.get_statistics()
        click.echo(f"✅ 分析完成，发现 {stats['unique_patterns']} 个唯一模式")
        click.echo(f"   - 总查询数: {stats['total_queries']}")
        click.echo(f"   - 已分配负责人: {stats['assigned_to_owners']} 个负责人")
        click.echo(f"   - 未分配模式: {stats['unassigned_patterns']}")
        click.echo(f"   - 解析错误: {stats['parse_errors']}")
        click.echo(f"   - 重复查询: {stats['duplicates_detected']}")
        
        return patterns

    def show_owner_queries(self, owner: str):
        if not self.analyzer:
            click.echo("❌ 请先运行 analyze 命令")
            return

        patterns = self.analyzer.get_patterns_by_owner(owner)
        
        if not patterns:
            click.echo(f"ℹ️  负责人 '{owner}' 没有慢查询问题")
            return

        owner_info = self.config_manager.get_owner_info(owner)
        service = owner_info.service if owner_info else "未知服务"
        
        click.echo(f"\n📋 负责人: {owner}")
        click.echo(f"   服务: {service}")
        click.echo(f"   慢查询模式数: {len(patterns)}")
        
        table_data = []
        for i, p in enumerate(patterns, 1):
            table_data.append([
                i,
                ", ".join(p.tables) if p.tables else "(无)",
                p.database,
                p.total_count,
                f"{p.total_execution_time:.2f}",
                f"{p.avg_execution_time:.2f}",
                f"{p.max_execution_time:.2f}",
                p.first_seen.strftime("%H:%M:%S"),
                p.last_seen.strftime("%H:%M:%S"),
                "✅" if p.is_confirmed else "❌"
            ])
        
        headers = [
            "#", "表名", "数据库", "次数",
            "总耗时(s)", "平均(s)", "最大(s)",
            "首次", "最后", "已确认"
        ]
        
        click.echo("\n" + tabulate(table_data, headers=headers, tablefmt="grid"))

        click.echo("\n📝 SQL 摘要详情:")
        for i, p in enumerate(patterns, 1):
            click.echo(f"\n--- 模式 #{i} ---")
            click.echo(f"表: {', '.join(p.tables) if p.tables else '(无)'}")
            click.echo(f"数据库: {p.database}")
            click.echo(f"SQL 摘要: {p.sql_digest[:100]}...")
            if len(p.queries) > 0:
                click.echo(f"原始 SQL 示例: {p.queries[0].raw_sql[:200]}...")

    def show_all_assignments(self):
        if not self.analyzer:
            click.echo("❌ 请先运行 analyze 命令")
            return

        click.echo("\n" + "="*60)
        click.echo("📊 慢查询分派清单")
        click.echo("="*60)

        all_owners = self.config_manager.get_all_owners()
        table_data = []
        total_queries = 0
        total_patterns = 0

        for owner in all_owners:
            patterns = self.analyzer.get_patterns_by_owner(owner)
            if patterns:
                owner_info = self.config_manager.get_owner_info(owner)
                service = owner_info.service if owner_info else "未知服务"
                query_count = sum(p.total_count for p in patterns)
                total_time = sum(p.total_execution_time for p in patterns)
                
                table_data.append([
                    owner,
                    service,
                    len(patterns),
                    query_count,
                    f"{total_time:.2f}"
                ])
                total_queries += query_count
                total_patterns += len(patterns)

        if table_data:
            headers = ["负责人", "服务", "模式数", "总查询数", "总耗时(s)"]
            click.echo("\n" + tabulate(table_data, headers=headers, tablefmt="grid"))
            click.echo(f"\n总计: {len(table_data)} 位负责人, {total_patterns} 个模式, {total_queries} 条查询")
        else:
            click.echo("\nℹ️  没有已分配的慢查询")

        unassigned = self.analyzer.get_unassigned_patterns()
        if unassigned:
            click.echo("\n" + "="*60)
            click.echo("⚠️  未分配的慢查询模式")
            click.echo("="*60)
            unassigned_data = []
            for i, p in enumerate(unassigned, 1):
                unassigned_data.append([
                    i,
                    ", ".join(p.tables) if p.tables else "(无)",
                    p.database,
                    p.total_count,
                    f"{p.total_execution_time:.2f}"
                ])
            headers = ["#", "表名", "数据库", "次数", "总耗时(s)"]
            click.echo("\n" + tabulate(unassigned_data, headers=headers, tablefmt="grid"))

        unknown_tables = self.analyzer.get_unknown_tables_in_queries()
        if unknown_tables:
            click.echo("\n" + "="*60)
            click.echo("❓ 未知表 (未在配置中找到负责人)")
            click.echo("="*60)
            for table in sorted(unknown_tables):
                click.echo(f"   - {table}")

        parse_errors = self.analyzer.get_parse_errors()
        if parse_errors:
            click.echo("\n" + "="*60)
            click.echo("❌ 解析失败的记录")
            click.echo("="*60)
            for e in parse_errors[:5]:
                click.echo(f"\n时间: {e.query_time}")
                click.echo(f"错误: {e.error}")
                click.echo(f"SQL: {e.raw_sql[:100]}...")
            if len(parse_errors) > 5:
                click.echo(f"\n... 还有 {len(parse_errors) - 5} 条解析错误")

        duplicate_notes = self.analyzer.get_duplicate_notes()
        if duplicate_notes:
            click.echo("\n" + "="*60)
            click.echo("🔄 重复查询提示")
            click.echo("="*60)
            unique_duplicates = set()
            for note in duplicate_notes:
                unique_duplicates.add(note)
            for note in list(unique_duplicates)[:5]:
                click.echo(f"   - {note}")
            if len(unique_duplicates) > 5:
                click.echo(f"\n... 还有 {len(unique_duplicates) - 5} 条重复提示")

    def mark_confirmed(self, owner: str, pattern_index: int = None):
        if not self.analyzer:
            click.echo("❌ 请先运行 analyze 命令")
            return

        patterns = self.analyzer.get_patterns_by_owner(owner)
        if not patterns:
            click.echo(f"ℹ️  负责人 '{owner}' 没有慢查询问题")
            return

        if pattern_index is not None:
            if 0 < pattern_index <= len(patterns):
                pattern = patterns[pattern_index - 1]
                self.analyzer.mark_pattern_confirmed(pattern.sql_digest)
                click.echo(f"✅ 已将模式 #{pattern_index} 标记为已确认")
            else:
                click.echo(f"❌ 模式索引 #{pattern_index} 超出范围")
        else:
            for pattern in patterns:
                self.analyzer.mark_pattern_confirmed(pattern.sql_digest)
            click.echo(f"✅ 已将负责人 '{owner}' 的所有 {len(patterns)} 个模式标记为已确认")

    def export_report(self, output_path: str, format: str = 'json'):
        if not self.analyzer:
            click.echo("❌ 请先运行 analyze 命令")
            return

        try:
            ReportExporter.export_trend_report(
                self.analyzer,
                self.config_manager,
                output_path,
                format
            )
            click.echo(f"✅ 趋势报告已导出到: {output_path}")
        except Exception as e:
            click.echo(f"❌ 导出失败: {str(e)}")


@click.group()
@click.option('--config', '-c', default='config/owners.yaml', help='负责人配置文件路径')
@click.pass_context
def cli(ctx, config):
    """数据库慢查询分派 CLI 工具"""
    ctx.obj = SlowQueryCLI(config)


@cli.command()
@click.pass_obj
def reload(cli_obj):
    """重新加载负责人配置"""
    cli_obj.reload_config()


@cli.command()
@click.argument('log_path')
@click.option('--format', '-f', default='simple', type=click.Choice(['simple', 'mysql']),
              help='日志格式: simple(简单格式) 或 mysql(MySQL慢查询日志)')
@click.pass_obj
def import_logs(cli_obj, log_path, format):
    """导入慢查询日志文件"""
    cli_obj.import_logs(log_path, format)
    cli_obj.analyze()


@cli.command()
@click.pass_obj
def analyze(cli_obj):
    """分析已导入的慢查询"""
    cli_obj.analyze()
    cli_obj.show_all_assignments()


@cli.command()
@click.argument('owner')
@click.pass_obj
def show(cli_obj, owner):
    """查看指定负责人的慢查询问题"""
    cli_obj.show_owner_queries(owner)


@cli.command()
@click.argument('owner')
@click.option('--pattern', '-p', type=int, help='指定模式编号 (可选，不指定则标记所有)')
@click.pass_obj
def confirm(cli_obj, owner, pattern):
    """标记负责人的慢查询为已确认"""
    cli_obj.mark_confirmed(owner, pattern)


@cli.command()
@click.argument('output_path')
@click.option('--format', '-f', default='json', type=click.Choice(['json', 'csv']),
              help='导出格式: json 或 csv')
@click.pass_obj
def export(cli_obj, output_path, format):
    """导出趋势报告"""
    cli_obj.export_report(output_path, format)


@cli.command()
@click.argument('log_path')
@click.option('--config', '-c', default='config/owners.yaml', help='负责人配置文件路径')
@click.option('--format', '-f', default='simple', type=click.Choice(['simple', 'mysql']),
              help='日志格式')
@click.pass_context
def full_analysis(ctx, log_path, config, format):
    """完整分析流程：加载配置 -> 导入日志 -> 分析 -> 展示分派清单"""
    cli_obj = SlowQueryCLI(config)
    
    click.echo("="*60)
    click.echo("📦 数据库慢查询分派 CLI - 完整分析")
    click.echo("="*60)
    
    click.echo("\n[1/4] 加载配置...")
    cli_obj.reload_config()
    
    click.echo("\n[2/4] 导入日志...")
    cli_obj.import_logs(log_path, format)
    
    click.echo("\n[3/4] 分析查询...")
    cli_obj.analyze()
    
    click.echo("\n[4/4] 展示分派清单...")
    cli_obj.show_all_assignments()
    
    ctx.obj = cli_obj


if __name__ == '__main__':
    cli()
