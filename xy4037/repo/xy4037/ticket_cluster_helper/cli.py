"""
投诉工单相似簇助手 - CLI入口
提供所有命令行接口：init, import, check, fit, detect, review, export, history
"""

import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional

import click


CONTEXT_SETTINGS = dict(help_option_names=['-h', '--help'])


def get_project_path(ctx: click.Context) -> Path:
    project_path = ctx.obj.get('project_path', Path.cwd())
    return Path(project_path)


def ensure_project_initialized(ctx: click.Context):
    from .config import is_project_initialized
    project_path = get_project_path(ctx)
    if not is_project_initialized(project_path):
        click.echo(f"错误: 项目未初始化，请先运行 'ticket-cluster init' 命令", err=True)
        click.echo(f"项目路径: {project_path}", err=True)
        sys.exit(1)


@click.group(context_settings=CONTEXT_SETTINGS)
@click.option('--project', '-p', 'project_path', type=click.Path(exists=False),
              help='项目路径 (默认: 当前目录)')
@click.pass_context
def cli(ctx, project_path):
    """投诉工单相似簇助手 - 客服质检专用工具
    
    用于分析客服工单，自动聚类相似问题，检测新问题和重复投诉。
    """
    ctx.ensure_object(dict)
    if project_path:
        ctx.obj['project_path'] = Path(project_path)
    else:
        ctx.obj['project_path'] = Path.cwd()


@cli.command()
@click.option('--force', '-f', is_flag=True, help='强制覆盖现有配置')
@click.pass_context
def init(ctx, force):
    """初始化项目配置
    
    创建项目目录结构和配置文件。
    """
    from .config import init_config, is_project_initialized
    
    project_path = get_project_path(ctx)
    
    if is_project_initialized(project_path) and not force:
        click.echo(f"项目已在 {project_path} 初始化")
        click.echo("使用 --force 选项覆盖现有配置")
        return
    
    if force and project_path.exists():
        click.confirm(f"确定要覆盖 {project_path} 的现有配置吗？", abort=True)
    
    config = init_config(project_path)
    
    click.echo(f"✓ 项目已成功初始化: {project_path}")
    click.echo("")
    click.echo("创建的目录结构:")
    click.echo(f"  {config.data_dir}/      - 数据存储目录")
    click.echo(f"  {config.output_dir}/    - 输出目录")
    click.echo(f"  {config.model_dir}/     - 模型和聚类结果目录")
    click.echo("")
    click.echo("接下来可以:")
    click.echo("  1. 编辑 config.json 配置停用词、渠道、产品线等")
    click.echo("  2. 使用 'ticket-cluster import <csv文件>' 导入工单数据")


@cli.command('import')
@click.argument('csv_files', nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option('--import-id', '-i', help='指定导入ID (默认: 时间戳)')
@click.pass_context
def import_csv(ctx, csv_files, import_id):
    """导入CSV工单文件
    
    支持一次导入多个CSV文件，自动进行脱敏处理。
    """
    from .config import load_config
    from .csv_parser import TicketParser
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    if not csv_files:
        click.echo("错误: 请指定至少一个CSV文件", err=True)
        sys.exit(1)
    
    parser = TicketParser(config)
    
    all_tickets = []
    for csv_file in csv_files:
        csv_path = Path(csv_file)
        click.echo(f"正在导入: {csv_path.name}")
        
        if import_id:
            current_import_id = f"{import_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        else:
            current_import_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        try:
            tickets = parser.import_csv(csv_path, current_import_id)
            all_tickets.extend(tickets)
            click.echo(f"  ✓ 导入了 {len(tickets)} 条工单 (ID: {current_import_id})")
            parser.save_tickets(tickets, current_import_id)
        except Exception as e:
            click.echo(f"  ✗ 导入失败: {e}", err=True)
    
    click.echo("")
    click.echo(f"总共导入: {len(all_tickets)} 条工单")
    click.echo(f"原始文件已保存到: {config.get_data_path() / 'raw'}")
    
    click.echo("")
    click.echo("下一步建议:")
    click.echo("  使用 'ticket-cluster check' 校验数据质量")


@cli.command()
@click.option('--import-id', '-i', help='指定要校验的导入ID (默认: 最新导入)')
@click.pass_context
def check(ctx, import_id):
    """校验工单数据质量
    
    检查必填字段缺失、时间格式错误、重复工单号、空文本等问题。
    """
    from .config import load_config
    from .csv_parser import TicketParser
    from .validator import TicketValidator, validate_tickets
    from .history import HistoryManager
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    parser = TicketParser(config)
    validator = TicketValidator(config)
    history = HistoryManager(config)
    
    if import_id:
        try:
            tickets = parser.load_tickets(import_id)
        except Exception as e:
            click.echo(f"错误: 无法加载导入ID '{import_id}': {e}", err=True)
            sys.exit(1)
    else:
        imports = parser.list_imports()
        if not imports:
            click.echo("错误: 没有找到已导入的数据，请先运行 'ticket-cluster import'", err=True)
            sys.exit(1)
        
        latest_import = imports[0]
        import_id = latest_import["import_id"]
        tickets = parser.load_tickets(import_id)
        click.echo(f"使用最新导入: {import_id} ({latest_import['source_file']})")
    
    click.echo(f"正在校验 {len(tickets)} 条工单...")
    
    result, quarantine_path = validate_tickets(config, tickets, import_id)
    
    click.echo("")
    click.echo("校验结果:")
    click.echo(f"  ✓ 有效工单: {result.valid_count}")
    click.echo(f"  ✗ 无效工单: {result.invalid_count}")
    
    if result.invalid_count > 0:
        click.echo("")
        click.echo("错误详情:")
        summary = result.get_error_summary()
        for error_type, count in summary.items():
            click.echo(f"  - {error_type}: {count}")
        
        click.echo("")
        click.echo(f"详细错误记录已保存到: {quarantine_path}")
    
    product_lines = set()
    channels = set()
    for ticket in result.valid_tickets:
        pl = ticket.sanitized_data.get("产品线", "")
        ch = ticket.sanitized_data.get("渠道", "")
        if pl:
            product_lines.add(pl)
        if ch:
            channels.add(ch)
    
    history.add_import_record(
        import_id=import_id,
        source_file=tickets[0].source_file if tickets else "unknown",
        import_time=datetime.now(),
        ticket_count=len(tickets),
        valid_count=result.valid_count,
        invalid_count=result.invalid_count,
        product_lines=list(product_lines),
        channels=list(channels)
    )
    
    click.echo("")
    if result.valid_count > 0:
        click.echo("下一步建议:")
        click.echo("  使用 'ticket-cluster fit' 进行聚类分析")
    else:
        click.echo("警告: 没有有效工单，请检查数据源或配置")


@cli.command()
@click.option('--algorithm', '-a', type=click.Choice(['kmeans', 'dbscan']),
              help='聚类算法 (默认: kmeans)')
@click.option('--clusters', '-n', type=int, help='目标聚类数量 (kmeans专用)')
@click.pass_context
def fit(ctx, algorithm, clusters):
    """执行工单聚类分析
    
    使用TF-IDF和聚类算法将相似工单聚合成簇。
    """
    from .config import load_config
    from .csv_parser import load_all_tickets
    from .text_features import TextProcessor
    from .clustering import TicketClusterer, build_features_map
    from .history import HistoryManager
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    history = HistoryManager(config)
    
    click.echo("加载工单数据...")
    all_tickets, _ = load_all_tickets(config)
    
    if not all_tickets:
        click.echo("错误: 没有找到工单数据，请先运行 'ticket-cluster import'", err=True)
        sys.exit(1)
    
    click.echo(f"加载了 {len(all_tickets)} 条工单")
    
    click.echo("处理文本特征...")
    text_processor = TextProcessor(config)
    features_list = text_processor.process_tickets(all_tickets)
    
    if not features_list:
        click.echo("错误: 无法提取文本特征", err=True)
        sys.exit(1)
    
    click.echo("计算TF-IDF向量...")
    try:
        text_processor.fit_tfidf(features_list)
    except Exception as e:
        click.echo(f"错误: TF-IDF计算失败: {e}", err=True)
        sys.exit(1)
    
    click.echo("执行聚类...")
    clusterer = TicketClusterer(config)
    
    if clusters:
        config.clustering_params['n_clusters'] = clusters
    
    try:
        result = clusterer.fit(
            features_list=features_list,
            tickets=all_tickets,
            algorithm=algorithm
        )
    except Exception as e:
        click.echo(f"错误: 聚类失败: {e}", err=True)
        sys.exit(1)
    
    clusterer.save_result(result)
    
    product_lines = set()
    for ticket in all_tickets:
        pl = ticket.sanitized_data.get("产品线", "")
        if pl:
            product_lines.add(pl)
    
    cluster_tags = {}
    for cluster in result.clusters:
        if cluster.tags:
            cluster_tags[cluster.cluster_id] = cluster.tags
    
    training_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    history.add_training_record(
        training_id=training_id,
        training_time=datetime.now(),
        n_clusters=result.n_clusters,
        total_tickets=result.total_tickets,
        algorithm=result.algorithm,
        silhouette_score=result.silhouette_score,
        cluster_tags=cluster_tags,
        product_lines_covered=list(product_lines)
    )
    
    click.echo("")
    click.echo("聚类结果:")
    click.echo(f"  聚类数量: {result.n_clusters}")
    click.echo(f"  总工单: {result.total_tickets}")
    click.echo(f"  算法: {result.algorithm}")
    if result.silhouette_score is not None:
        click.echo(f"  轮廓系数: {result.silhouette_score:.4f}")
    
    click.echo("")
    click.echo("簇分布:")
    for i, cluster in enumerate(result.clusters[:10]):
        keywords = ", ".join(cluster.keywords[:3]) if cluster.keywords else "无关键词"
        click.echo(f"  簇 #{cluster.cluster_id}: {cluster.size} 条工单 - {keywords} (置信度: {cluster.confidence:.2%})")
    
    if len(result.clusters) > 10:
        click.echo(f"  ... 还有 {len(result.clusters) - 10} 个簇")
    
    click.echo("")
    click.echo(f"聚类结果已保存到: {config.get_clusters_path()}")
    
    click.echo("")
    click.echo("下一步建议:")
    click.echo("  使用 'ticket-cluster detect' 检测新工单中的异常")
    click.echo("  使用 'ticket-cluster export' 导出报告")


@cli.command()
@click.option('--import-id', '-i', help='指定要检测的导入ID (默认: 最新导入)')
@click.pass_context
def detect(ctx, import_id):
    """检测新工单中的异常
    
    识别旧簇问题、疑似新问题、重复用户投诉和结论矛盾。
    """
    from .config import load_config
    from .csv_parser import TicketParser, load_all_tickets
    from .detector import run_detection
    from .clustering import TicketClusterer
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    parser = TicketParser(config)
    clusterer = TicketClusterer(config)
    
    clusters_path = config.get_clusters_path()
    if not clusters_path.exists():
        click.echo("错误: 没有找到聚类结果，请先运行 'ticket-cluster fit'", err=True)
        sys.exit(1)
    
    try:
        clusters = clusterer.load_result()
    except Exception as e:
        click.echo(f"错误: 加载聚类结果失败: {e}", err=True)
        sys.exit(1)
    
    if import_id:
        try:
            new_tickets = parser.load_tickets(import_id)
        except Exception as e:
            click.echo(f"错误: 无法加载导入ID '{import_id}': {e}", err=True)
            sys.exit(1)
    else:
        imports = parser.list_imports()
        if not imports:
            click.echo("错误: 没有找到已导入的数据", err=True)
            sys.exit(1)
        
        if len(imports) < 2:
            click.echo("警告: 只有一个导入批次，无法检测历史对比")
            click.echo("建议导入更多数据后再运行检测")
        
        latest_import = imports[0]
        import_id = latest_import["import_id"]
        new_tickets = parser.load_tickets(import_id)
        click.echo(f"使用最新导入: {import_id} ({latest_import['source_file']})")
    
    click.echo(f"检测 {len(new_tickets)} 条工单...")
    
    try:
        report, report_path = run_detection(config, new_tickets, import_id)
    except Exception as e:
        click.echo(f"错误: 检测失败: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    click.echo("")
    click.echo("检测结果:")
    click.echo(f"  属于旧簇: {report.old_cluster_count}")
    click.echo(f"  疑似新问题: {report.new_issue_count}")
    click.echo(f"  重复用户投诉: {report.duplicate_user_count}")
    click.echo(f"  结论矛盾: {report.conflicting_count}")
    
    if report.new_issue_count > 0:
        click.echo("")
        click.echo(f"发现 {report.new_issue_count} 个疑似新问题，建议人工复核")
    
    click.echo("")
    click.echo(f"检测报告已保存到: {report_path}")
    
    click.echo("")
    click.echo("下一步建议:")
    click.echo("  使用 'ticket-cluster review' 进行人工复核")
    click.echo("  使用 'ticket-cluster export' 导出完整报告")


@cli.command()
@click.option('--list', '-l', 'list_mode', is_flag=True, help='列出所有待复核项')
@click.option('--ticket-id', '-t', help='指定工单ID进行操作')
@click.option('--action', '-a', type=click.Choice(['move', 'tag', 'ignore', 'false-positive']),
              help='操作类型')
@click.option('--to-cluster', type=int, help='目标簇ID (用于move操作)')
@click.option('--tag', '-T', 'tags', multiple=True, help='标签 (用于tag操作)')
@click.option('--reason', '-r', help='操作原因说明')
@click.pass_context
def review(ctx, list_mode, ticket_id, action, to_cluster, tags, reason):
    """人工复核检测结果
    
    支持合并簇、拆分簇、打标签、标记误报等操作。
    """
    from .config import load_config
    from .feedback_store import FeedbackStore
    from .clustering import TicketClusterer
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    feedback_store = FeedbackStore(config)
    clusterer = TicketClusterer(config)
    
    if list_mode:
        clusters_path = config.get_clusters_path()
        if clusters_path.exists():
            try:
                clusters = clusterer.load_result()
                click.echo("当前簇列表:")
                for cluster in clusters.clusters[:15]:
                    keywords = ", ".join(cluster.keywords[:3]) if cluster.keywords else "无"
                    click.echo(f"  簇 #{cluster.cluster_id}: {cluster.size} 条 - {keywords}")
                if len(clusters.clusters) > 15:
                    click.echo(f"  ... 共 {len(clusters.clusters)} 个簇")
            except Exception:
                pass
        
        recent_feedback = feedback_store.get_recent_feedbacks(limit=20)
        if recent_feedback:
            click.echo("")
            click.echo("最近的复核记录:")
            for fb in recent_feedback:
                click.echo(f"  [{fb.feedback_type.value}] {fb.ticket_id or '簇'} - {fb.reason[:50] if fb.reason else '无原因'}")
        
        return
    
    if not ticket_id or not action:
        click.echo("请使用 --ticket-id 和 --action 指定操作")
        click.echo("")
        click.echo("示例:")
        click.echo("  ticket-cluster review --ticket-id TK001 --action move --to-cluster 3")
        click.echo("  ticket-cluster review --ticket-id TK001 --action tag --tag 重要 --tag 紧急")
        click.echo("  ticket-cluster review --ticket-id TK001 --action false-positive")
        return
    
    if action == 'move':
        if to_cluster is None:
            click.echo("错误: move操作需要指定 --to-cluster", err=True)
            sys.exit(1)
        
        clusters_path = config.get_clusters_path()
        if clusters_path.exists():
            try:
                clusters = clusterer.load_result()
                from_cluster = clusters.get_cluster_for_ticket(ticket_id)
                from_cluster_id = from_cluster.cluster_id if from_cluster else -1
                
                feedback_store.move_ticket(
                    ticket_id=ticket_id,
                    from_cluster_id=from_cluster_id,
                    to_cluster_id=to_cluster,
                    reason=reason or f"从簇{from_cluster_id}移动到簇{to_cluster}"
                )
                click.echo(f"✓ 工单 {ticket_id} 已移动到簇 {to_cluster}")
            except Exception as e:
                click.echo(f"错误: 移动失败: {e}", err=True)
        else:
            click.echo("错误: 没有找到聚类结果", err=True)
    
    elif action == 'tag':
        if not tags:
            click.echo("错误: tag操作需要指定至少一个 --tag", err=True)
            sys.exit(1)
        
        clusters_path = config.get_clusters_path()
        if clusters_path.exists():
            try:
                clusters = clusterer.load_result()
                cluster = clusters.get_cluster_for_ticket(ticket_id)
                cluster_id = cluster.cluster_id if cluster else -1
                
                feedback_store.tag_cluster(
                    cluster_id=cluster_id,
                    tags=list(tags),
                    reason=reason or f"添加标签: {', '.join(tags)}"
                )
                click.echo(f"✓ 工单 {ticket_id} 所在簇已添加标签: {', '.join(tags)}")
            except Exception as e:
                click.echo(f"错误: 打标签失败: {e}", err=True)
        else:
            click.echo("错误: 没有找到聚类结果", err=True)
    
    elif action == 'false-positive':
        clusters_path = config.get_clusters_path()
        if clusters_path.exists():
            try:
                clusters = clusterer.load_result()
                cluster = clusters.get_cluster_for_ticket(ticket_id)
                cluster_id = cluster.cluster_id if cluster else -1
                
                feedback_store.mark_false_positive(
                    ticket_id=ticket_id,
                    cluster_id=cluster_id,
                    reason=reason or "标记为误报"
                )
                click.echo(f"✓ 工单 {ticket_id} 已标记为误报")
            except Exception as e:
                click.echo(f"错误: 标记失败: {e}", err=True)
        else:
            click.echo("错误: 没有找到聚类结果", err=True)
    
    elif action == 'ignore':
        click.echo("ignore操作已整合到false-positive中，请使用 --action false-positive")


@cli.command()
@click.option('--format', '-f', 'export_format', 
              type=click.Choice(['all', 'markdown', 'csv', 'json']),
              default='all', help='导出格式 (默认: all)')
@click.option('--output', '-o', 'output_path', type=click.Path(), help='输出路径')
@click.pass_context
def export(ctx, export_format, output_path):
    """导出分析报告
    
    支持Markdown周报、簇明细CSV、疑似新问题JSON等格式。
    """
    from .config import load_config
    from .clustering import TicketClusterer
    from .exporter import ReportExporter, run_export_all
    from .csv_parser import load_all_tickets
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    clusterer = TicketClusterer(config)
    exporter = ReportExporter(config)
    
    clusters_path = config.get_clusters_path()
    if not clusters_path.exists():
        click.echo("错误: 没有找到聚类结果，请先运行 'ticket-cluster fit'", err=True)
        sys.exit(1)
    
    try:
        clusters = clusterer.load_result()
    except Exception as e:
        click.echo(f"错误: 加载聚类结果失败: {e}", err=True)
        sys.exit(1)
    
    all_tickets, _ = load_all_tickets(config)
    tickets_map = {t.ticket_id: t for t in all_tickets}
    
    click.echo(f"导出 {clusters.n_clusters} 个簇的数据...")
    
    results = []
    
    if export_format in ['all', 'markdown']:
        md_result = exporter.export_markdown_weekly(
            clusters=clusters,
            tickets_map=tickets_map,
            output_path=Path(output_path) / "weekly_report.md" if output_path else None
        )
        results.append(md_result)
        click.echo(f"  ✓ Markdown周报: {md_result.path}")
    
    if export_format in ['all', 'csv']:
        csv_result = exporter.export_clusters_csv(
            clusters=clusters,
            tickets_map=tickets_map,
            output_path=Path(output_path) / "clusters.csv" if output_path else None
        )
        results.append(csv_result)
        click.echo(f"  ✓ 簇明细CSV: {csv_result.path}")
    
    click.echo("")
    click.echo(f"共导出 {len(results)} 个文件")
    click.echo(f"输出目录: {config.get_output_path()}")


@cli.command()
@click.option('--type', '-t', 'query_type', 
              type=click.Choice(['imports', 'training', 'stats']),
              default='imports', help='查询类型')
@click.option('--start-date', '-s', help='开始日期 (格式: YYYY-MM-DD)')
@click.option('--end-date', '-e', help='结束日期 (格式: YYYY-MM-DD)')
@click.option('--product-line', '-p', help='筛选产品线')
@click.option('--channel', '-c', help='筛选渠道')
@click.option('--limit', '-n', type=int, default=50, help='显示数量限制')
@click.pass_context
def history(ctx, query_type, start_date, end_date, product_line, channel, limit):
    """查询历史记录
    
    按日期、产品线、渠道等查询历次导入和训练结果。
    """
    from .config import load_config
    from .history import HistoryManager
    
    ensure_project_initialized(ctx)
    project_path = get_project_path(ctx)
    config = load_config(project_path)
    
    history_manager = HistoryManager(config)
    
    start_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            click.echo(f"错误: 日期格式无效 '{start_date}'，请使用 YYYY-MM-DD", err=True)
            sys.exit(1)
    
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            click.echo(f"错误: 日期格式无效 '{end_date}'，请使用 YYYY-MM-DD", err=True)
            sys.exit(1)
    
    if query_type == 'stats':
        stats = history_manager.get_statistics()
        click.echo("项目统计:")
        click.echo(f"  总导入次数: {stats['total_imports']}")
        click.echo(f"  总工单数量: {stats['total_tickets_imported']}")
        click.echo(f"  有效工单: {stats['total_valid_tickets']}")
        click.echo(f"  无效工单: {stats['total_invalid_tickets']}")
        click.echo(f"  训练次数: {stats['total_training_runs']}")
        click.echo(f"  平均簇数: {stats['average_clusters_per_training']}")
        if stats['product_lines_used']:
            click.echo(f"  产品线: {', '.join(stats['product_lines_used'])}")
        if stats['channels_used']:
            click.echo(f"  渠道: {', '.join(stats['channels_used'])}")
        return
    
    if query_type == 'imports':
        records = history_manager.query_imports(
            start_date=start_dt,
            end_date=end_dt,
            product_line=product_line,
            channel=channel,
            limit=limit
        )
        
        if not records:
            click.echo("没有找到导入记录")
            return
        
        click.echo(f"找到 {len(records)} 条导入记录:")
        click.echo("-" * 80)
        for record in records:
            click.echo(f"ID: {record.import_id}")
            click.echo(f"  来源: {record.source_file}")
            click.echo(f"  时间: {record.import_time.strftime('%Y-%m-%d %H:%M:%S')}")
            click.echo(f"  工单: {record.ticket_count} (有效: {record.valid_count}, 无效: {record.invalid_count})")
            if record.product_lines:
                click.echo(f"  产品线: {', '.join(record.product_lines)}")
            if record.channels:
                click.echo(f"  渠道: {', '.join(record.channels)}")
            click.echo("")
    
    elif query_type == 'training':
        records = history_manager.query_training(
            start_date=start_dt,
            end_date=end_dt,
            product_line=product_line,
            limit=limit
        )
        
        if not records:
            click.echo("没有找到训练记录")
            return
        
        click.echo(f"找到 {len(records)} 条训练记录:")
        click.echo("-" * 80)
        for record in records:
            click.echo(f"ID: {record.training_id}")
            click.echo(f"  时间: {record.training_time.strftime('%Y-%m-%d %H:%M:%S')}")
            click.echo(f"  算法: {record.algorithm}")
            click.echo(f"  簇数: {record.n_clusters}")
            click.echo(f"  工单: {record.total_tickets}")
            if record.silhouette_score is not None:
                click.echo(f"  轮廓系数: {record.silhouette_score:.4f}")
            if record.product_lines_covered:
                click.echo(f"  产品线: {', '.join(record.product_lines_covered)}")
            click.echo("")


def main():
    cli(obj={})


if __name__ == '__main__':
    main()
