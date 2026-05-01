import sys
from pathlib import Path
from typing import Optional, List

import click

from classroom_cluster import __version__
from classroom_cluster.config import (
    ProjectConfig, load_config, save_config, find_project_root,
    DEFAULT_CONFIG_NAME
)
from classroom_cluster.models import QuestionItem, Chapter, QuestionCluster
from classroom_cluster.parsers import SRTParser, ChatParser, OutlineParser
from classroom_cluster.clusterer import TFIDFClusterer, ChapterMatcher
from classroom_cluster.review import ReviewManager, ReviewSession
from classroom_cluster.storage import DataStore
from classroom_cluster.reporter import ReportGenerator, format_seconds


@click.group()
@click.version_option(__version__, "--version", "-v")
@click.pass_context
def main(ctx: click.Context):
    """课堂疑问聚类助手 - 企业内训学员问题自动聚类分析工具"""
    ctx.ensure_object(dict)
    
    project_root = find_project_root(Path.cwd())
    if project_root:
        ctx.obj["project_root"] = project_root
        ctx.obj["config"] = load_config(project_root)
    else:
        ctx.obj["project_root"] = None
        ctx.obj["config"] = None


@main.command()
@click.option("--name", "-n", default="培训项目", help="项目名称")
@click.option("--language", "-l", default="zh", help="语言 (默认: zh)")
@click.option("--force", "-f", is_flag=True, help="强制初始化，覆盖现有配置")
@click.pass_context
def init(ctx: click.Context, name: str, language: str, force: bool):
    """初始化一个新的项目目录"""
    project_root = Path.cwd()
    
    config_file = project_root / DEFAULT_CONFIG_NAME
    
    if config_file.exists() and not force:
        click.echo(f"错误: 项目已存在于 {config_file}")
        click.echo("使用 --force 选项覆盖现有配置")
        sys.exit(1)
    
    config = ProjectConfig(
        project_name=name,
        language=language,
    )
    
    save_config(project_root, config)
    
    data_dir = project_root / ".cqc_data"
    for subdir in ["raw", "processed", "clusters", "reviews", "reports"]:
        (data_dir / subdir).mkdir(parents=True, exist_ok=True)
    
    click.echo(f"✓ 项目 '{name}' 已初始化")
    click.echo(f"  配置文件: {config_file}")
    click.echo(f"  数据目录: {data_dir}")
    click.echo("")
    click.echo("下一步:")
    click.echo("  cqc import --subtitle <srt文件> --chat <csv文件> --outline <大纲文件>")


@main.command()
@click.option("--subtitle", "-s", type=click.Path(exists=True, dir_okay=False), help="SRT 字幕文件")
@click.option("--chat", "-c", type=click.Path(exists=True, dir_okay=False), help="聊天记录 CSV/TXT 文件")
@click.option("--outline", "-o", type=click.Path(exists=True, dir_okay=False), help="课程大纲 YAML/MD/TXT 文件")
@click.pass_context
def import_data(
    ctx: click.Context,
    subtitle: Optional[str],
    chat: Optional[str],
    outline: Optional[str],
):
    """导入字幕、聊天记录或课程大纲"""
    if not ctx.obj["project_root"]:
        click.echo("错误: 未找到项目配置，请先运行 'cqc init'")
        sys.exit(1)
    
    project_root = ctx.obj["project_root"]
    config = ctx.obj["config"]
    store = DataStore(project_root, config)
    
    all_questions: List[QuestionItem] = []
    chapters: List[Chapter] = []
    
    if subtitle:
        subtitle_path = Path(subtitle)
        click.echo(f"导入字幕文件: {subtitle_path.name}")
        
        parser = SRTParser(subtitle_path)
        parser.parse()
        questions = parser.extract_questions()
        
        click.echo(f"  解析到 {len(parser.get_all_blocks())} 条字幕")
        click.echo(f"  提取到 {len(questions)} 个潜在问题")
        
        all_questions.extend(questions)
        store.save_imported_file(subtitle_path, "subtitle")
    
    if chat:
        chat_path = Path(chat)
        click.echo(f"导入聊天记录: {chat_path.name}")
        
        parser = ChatParser(chat_path)
        parser.parse()
        questions = parser.extract_questions()
        
        click.echo(f"  解析到 {len(parser.get_all_messages())} 条消息")
        click.echo(f"  提取到 {len(questions)} 个潜在问题")
        
        all_questions.extend(questions)
        store.save_imported_file(chat_path, "chat")
    
    if outline:
        outline_path = Path(outline)
        click.echo(f"导入课程大纲: {outline_path.name}")
        
        parser = OutlineParser(outline_path)
        chapters = parser.parse()
        
        click.echo(f"  解析到 {len(chapters)} 个章节")
        for chapter in chapters:
            time_str = ""
            if chapter.time_range:
                start = format_seconds(chapter.time_range.start_seconds)
                end = format_seconds(chapter.time_range.end_seconds)
                time_str = f" [{start} - {end}]"
            click.echo(f"    - {chapter.title}{time_str}")
        
        store.save_chapters(chapters)
        store.save_imported_file(outline_path, "outline")
    
    if all_questions:
        if chapters:
            click.echo("\n匹配问题到章节...")
            matcher = ChapterMatcher(
                time_tolerance_seconds=config.chapter_matching.get("time_tolerance_seconds", 300),
                language=config.language,
            )
            all_questions = matcher.match_questions_to_chapters(all_questions, chapters)
            click.echo(f"  已匹配 {sum(1 for q in all_questions if q.chapter_id)} 个问题到章节")
        
        store.save_questions(all_questions)
        click.echo(f"\n✓ 共保存 {len(all_questions)} 个问题")
    elif not outline:
        click.echo("\n警告: 未导入任何数据")
    
    click.echo("\n已导入文件列表:")
    for item in store.list_imported_files():
        click.echo(f"  - {item['file_type']}: {item['original_name']}")


@main.command()
@click.option("--threshold", "-t", type=float, default=None, help="相似度阈值 (0.0-1.0)")
@click.option("--min-size", "-m", type=int, default=None, help="最小聚类大小")
@click.option("--output", "-o", type=click.Path(), help="输出聚类结果文件")
@click.pass_context
def analyze(
    ctx: click.Context,
    threshold: Optional[float],
    min_size: Optional[int],
    output: Optional[str],
):
    """使用 TF-IDF 聚类分析问题"""
    if not ctx.obj["project_root"]:
        click.echo("错误: 未找到项目配置，请先运行 'cqc init'")
        sys.exit(1)
    
    project_root = ctx.obj["project_root"]
    config = ctx.obj["config"]
    store = DataStore(project_root, config)
    
    questions = store.load_questions()
    if not questions:
        click.echo("错误: 没有找到问题数据，请先运行 'cqc import'")
        sys.exit(1)
    
    chapters = store.load_chapters()
    
    click.echo(f"加载 {len(questions)} 个问题")
    if chapters:
        click.echo(f"加载 {len(chapters)} 个章节")
    
    similarity_threshold = threshold or config.clustering.get("similarity_threshold", 0.6)
    min_cluster_size = min_size or config.clustering.get("min_cluster_size", 2)
    
    click.echo(f"\n聚类参数:")
    click.echo(f"  相似度阈值: {similarity_threshold}")
    click.echo(f"  最小聚类大小: {min_cluster_size}")
    
    clusterer = TFIDFClusterer(
        similarity_threshold=similarity_threshold,
        min_cluster_size=min_cluster_size,
        max_features=config.clustering.get("max_features", 10000),
        ngram_range=tuple(config.clustering.get("ngram_range", (1, 2))),
        language=config.language,
    )
    
    click.echo("\n正在分析...")
    result = clusterer.cluster(questions, chapters)
    
    click.echo(f"\n✓ 聚类完成!")
    click.echo(f"  总聚类数: {result.metrics.get('num_clusters', 0)}")
    click.echo(f"  已聚类问题: {result.metrics.get('clustered_questions', 0)}")
    click.echo(f"  未聚类问题: {result.metrics.get('unclustered_questions', 0)}")
    click.echo(f"  平均聚类大小: {result.metrics.get('avg_cluster_size', 0):.1f}")
    
    if result.clusters:
        click.echo(f"\n聚类详情:")
        for i, cluster in enumerate(result.clusters[:10], 1):
            confidence = f"{cluster.confidence:.1%}"
            chapter = cluster.chapter_title or "未匹配章节"
            time_str = format_seconds(cluster.avg_time_start) if cluster.avg_time_start else "--:--:--"
            click.echo(f"  {i}. [{confidence}] {cluster.representative_question[:40]}...")
            click.echo(f"     章节: {chapter} | 时间: {time_str} | 问题数: {len(cluster.questions)}")
        
        if len(result.clusters) > 10:
            click.echo(f"  ... 还有 {len(result.clusters) - 10} 个聚类")
    
    saved_path = store.save_clusters(result.clusters, result.metrics)
    click.echo(f"\n✓ 聚类结果已保存到: {saved_path}")
    
    click.echo("\n下一步:")
    click.echo("  cqc review              交互式复核聚类")
    click.echo("  cqc report              生成报告")


@main.command("review")
@click.option("--interactive", "-i", is_flag=True, default=True, help="交互式模式")
@click.option("--list", "-l", "list_mode", is_flag=True, help="列出所有聚类")
@click.option("--cluster-id", "-c", help="指定聚类ID进行操作")
@click.option("--action", "-a", type=click.Choice(["confirm", "resolve", "discard", "note"]), help="执行操作")
@click.option("--merge", "-m", multiple=True, help="合并多个聚类ID (逗号分隔)")
@click.option("--note", "-n", help="备注内容")
@click.pass_context
def review_command(
    ctx: click.Context,
    interactive: bool,
    list_mode: bool,
    cluster_id: Optional[str],
    action: Optional[str],
    merge: tuple,
    note: Optional[str],
):
    """复核聚类结果 (确认/合并/拆分/标记)"""
    if not ctx.obj["project_root"]:
        click.echo("错误: 未找到项目配置，请先运行 'cqc init'")
        sys.exit(1)
    
    project_root = ctx.obj["project_root"]
    config = ctx.obj["config"]
    store = DataStore(project_root, config)
    
    clusters, metrics = store.load_clusters()
    if not clusters:
        click.echo("错误: 没有找到聚类结果，请先运行 'cqc analyze'")
        sys.exit(1)
    
    questions = store.load_questions()
    question_map = {q.id: q for q in questions}
    
    manager = ReviewManager()
    manager.load_clusters(clusters)
    
    existing_session = store.load_review_session()
    if existing_session:
        manager.load_session(existing_session)
    
    if list_mode:
        _list_clusters(manager, question_map)
        return
    
    if merge:
        cluster_ids = []
        for item in merge:
            cluster_ids.extend([cid.strip() for cid in item.split(",")])
        
        if len(cluster_ids) < 2:
            click.echo("错误: 合并需要至少2个聚类ID")
            sys.exit(1)
        
        result = manager.merge_clusters(cluster_ids, note or "")
        if result:
            click.echo(f"✓ 已合并 {len(cluster_ids)} 个聚类为: {result.id}")
            store.save_clusters(manager.get_clusters())
            store.save_review_session(manager.get_session())
        else:
            click.echo("错误: 合并失败，请检查聚类ID是否正确")
        return
    
    if cluster_id and action:
        cluster = manager.get_cluster(cluster_id)
        if not cluster:
            click.echo(f"错误: 未找到聚类 {cluster_id}")
            sys.exit(1)
        
        if action == "confirm":
            manager.confirm_cluster(cluster_id, note or "")
            click.echo(f"✓ 已确认聚类 {cluster_id}")
        elif action == "resolve":
            manager.resolve_cluster(cluster_id, note or "")
            click.echo(f"✓ 已标记聚类 {cluster_id} 为已解决")
        elif action == "discard":
            manager.discard_cluster(cluster_id, note or "")
            click.echo(f"✓ 已废弃聚类 {cluster_id}")
        elif action == "note":
            if not note:
                click.echo("错误: 添加备注需要 --note 参数")
                sys.exit(1)
            manager.add_note(cluster_id, note)
            click.echo(f"✓ 已添加备注到聚类 {cluster_id}")
        
        store.save_clusters(manager.get_clusters())
        store.save_review_session(manager.get_session())
        return
    
    if interactive:
        _interactive_review(manager, question_map, store)


def _list_clusters(manager: ReviewManager, question_map: dict):
    clusters = manager.get_clusters()
    
    click.echo(f"共 {len(clusters)} 个聚类:\n")
    
    for i, cluster in enumerate(clusters, 1):
        status_icon = {
            "pending": "⏳",
            "confirmed": "✅",
            "merged": "🔗",
            "split": "✂️",
            "resolved": "🎯",
            "discarded": "❌",
        }.get(cluster.review_status.value, "❓")
        
        click.echo(f"{status_icon} 聚类 #{i} (ID: {cluster.id})")
        click.echo(f"   状态: {cluster.review_status.value}")
        click.echo(f"   置信度: {cluster.confidence:.1%}")
        click.echo(f"   问题数: {len(cluster.questions)}")
        click.echo(f"   代表问题: {cluster.representative_question[:50]}...")
        if cluster.chapter_title:
            click.echo(f"   章节: {cluster.chapter_title}")
        click.echo("")


def _interactive_review(manager: ReviewManager, question_map: dict, store: DataStore):
    click.echo("=== 交互式复核模式 ===")
    click.echo("输入 'help' 查看帮助, 'q' 退出\n")
    
    while True:
        pending = manager.get_pending_clusters()
        click.echo(f"待处理聚类: {len(pending)} 个")
        
        if not pending:
            click.echo("\n✓ 所有聚类均已处理!")
            break
        
        cluster = pending[0]
        
        click.echo(f"\n--- 当前聚类 (ID: {cluster.id}) ---")
        click.echo(f"置信度: {cluster.confidence:.1%}")
        click.echo(f"问题数: {len(cluster.questions)}")
        if cluster.chapter_title:
            click.echo(f"章节: {cluster.chapter_title}")
        if cluster.avg_time_start:
            click.echo(f"平均时间: {format_seconds(cluster.avg_time_start)}")
        
        click.echo(f"\n代表问题: {cluster.representative_question}")
        
        click.echo("\n所有问题:")
        for j, qid in enumerate(cluster.questions, 1):
            q = question_map.get(qid)
            if q:
                time_str = format_seconds(q.time_range.start_seconds if q.time_range else None)
                speaker = q.speaker or "未知用户"
                click.echo(f"  {j}. [{time_str}] {speaker}: {q.content[:60]}")
        
        click.echo("\n操作: [c]确认 [r]解决 [d]废弃 [m]合并 [n]添加备注 [s]跳过 [q]退出 [h]帮助")
        
        choice = click.prompt("选择操作", default="s").lower().strip()
        
        if choice == "q":
            click.echo("\n保存进度并退出...")
            store.save_clusters(manager.get_clusters())
            store.save_review_session(manager.get_session())
            break
        
        elif choice == "h":
            click.echo("""
操作说明:
  c / confirm  - 确认此聚类
  r / resolve  - 标记为已解决
  d / discard  - 标记为废弃
  m / merge    - 合并此聚类到其他聚类
  n / note     - 添加备注
  s / skip     - 跳过，处理下一个
  l / list     - 列出所有待处理聚类
  q / quit     - 保存并退出
  h / help     - 显示此帮助
""")
        
        elif choice == "c" or choice == "confirm":
            note = click.prompt("备注 (可选)", default="", show_default=False)
            manager.confirm_cluster(cluster.id, note)
            click.echo("✓ 已确认")
        
        elif choice == "r" or choice == "resolve":
            note = click.prompt("解决方案说明 (可选)", default="", show_default=False)
            manager.resolve_cluster(cluster.id, note)
            click.echo("✓ 已标记为已解决")
        
        elif choice == "d" or choice == "discard":
            note = click.prompt("废弃原因 (可选)", default="", show_default=False)
            manager.discard_cluster(cluster.id, note)
            click.echo("✓ 已标记为废弃")
        
        elif choice == "m" or choice == "merge":
            click.echo("\n其他待处理聚类:")
            for i, c in enumerate(manager.get_pending_clusters(), 1):
                if c.id != cluster.id:
                    click.echo(f"  {i}. [{c.confidence:.1%}] {c.representative_question[:40]}... (ID: {c.id})")
            
            target_ids = click.prompt("输入要合并的聚类ID (多个用逗号分隔)")
            target_list = [tid.strip() for tid in target_ids.split(",")]
            target_list = [tid for tid in target_list if tid]
            
            if target_list:
                all_to_merge = [cluster.id] + target_list
                note = click.prompt("合并备注 (可选)", default="", show_default=False)
                result = manager.merge_clusters(all_to_merge, note)
                if result:
                    click.echo(f"✓ 已合并为聚类 {result.id}")
                else:
                    click.echo("✗ 合并失败")
            else:
                click.echo("跳过合并")
        
        elif choice == "n" or choice == "note":
            note = click.prompt("输入备注")
            if note:
                manager.add_note(cluster.id, note)
                click.echo("✓ 已添加备注")
        
        elif choice == "l" or choice == "list":
            _list_clusters(manager, question_map)
        
        elif choice == "s" or choice == "skip":
            click.echo("跳过此聚类")
        
        else:
            click.echo(f"未知操作: {choice}，输入 'h' 查看帮助")


@main.command()
@click.option("--markdown", "-m", is_flag=True, help="生成 Markdown 复盘报告")
@click.option("--csv", "-c", is_flag=True, help="生成 CSV 问题清单")
@click.option("--json", "-j", is_flag=True, help="生成 JSON 审计记录")
@click.option("--all", "-a", "all_formats", is_flag=True, help="生成所有格式的报告")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), help="输出目录")
@click.pass_context
def report(
    ctx: click.Context,
    markdown: bool,
    csv: bool,
    json: bool,
    all_formats: bool,
    output_dir: Optional[str],
):
    """生成报告 (Markdown/CSV/JSON)"""
    if not ctx.obj["project_root"]:
        click.echo("错误: 未找到项目配置，请先运行 'cqc init'")
        sys.exit(1)
    
    project_root = ctx.obj["project_root"]
    config = ctx.obj["config"]
    store = DataStore(project_root, config)
    
    clusters, metrics = store.load_clusters()
    if not clusters:
        click.echo("错误: 没有找到聚类结果，请先运行 'cqc analyze'")
        sys.exit(1)
    
    questions = store.load_questions()
    chapters = store.load_chapters()
    review_session = store.load_review_session()
    
    if all_formats:
        markdown = csv = json = True
    
    if not any([markdown, csv, json]):
        markdown = True
    
    generator = ReportGenerator(
        clusters=clusters,
        questions=questions,
        chapters=chapters,
        review_session=review_session,
    )
    
    project_name = config.project_name if config else "培训项目"
    
    saved_files = []
    
    if markdown:
        click.echo("生成 Markdown 复盘报告...")
        md_content = generator.generate_markdown_report(project_name)
        path = store.save_report(md_content, "review", "md")
        saved_files.append(("Markdown 报告", path))
        click.echo(f"  ✓ {path}")
    
    if csv:
        click.echo("生成 CSV 问题清单...")
        csv_content = generator.generate_csv_question_list()
        path = store.save_report(csv_content, "questions", "csv")
        saved_files.append(("CSV 问题清单", path))
        click.echo(f"  ✓ {path}")
    
    if json:
        click.echo("生成 JSON 审计记录...")
        json_content = generator.generate_json_audit_record(project_name)
        path = store.save_report(json_content, "audit", "json")
        saved_files.append(("JSON 审计记录", path))
        click.echo(f"  ✓ {path}")
    
    click.echo(f"\n✓ 共生成 {len(saved_files)} 个报告文件:")
    for name, path in saved_files:
        click.echo(f"  - {name}: {path}")


@main.command()
@click.pass_context
def status(ctx: click.Context):
    """显示项目状态"""
    if not ctx.obj["project_root"]:
        click.echo("当前目录不是一个课堂疑问聚类助手项目")
        click.echo("使用 'cqc init' 初始化一个新项目")
        return
    
    project_root = ctx.obj["project_root"]
    config = ctx.obj["config"]
    store = DataStore(project_root, config)
    
    info = store.get_project_info()
    
    click.echo("=== 项目状态 ===\n")
    click.echo(f"项目名称: {config.project_name if config else '未命名'}")
    click.echo(f"项目目录: {project_root}")
    click.echo("")
    
    click.echo("--- 导入数据 ---")
    imported_files = info.get("imported_files", [])
    if imported_files:
        for item in imported_files:
            click.echo(f"  - {item['file_type']}: {item['original_name']} (导入于 {item['imported_at'][:19]})")
    else:
        click.echo("  暂无导入数据")
    
    click.echo("")
    click.echo("--- 处理状态 ---")
    click.echo(f"  问题数: {info.get('questions_count', 0)}")
    click.echo(f"  章节数: {info.get('chapters_count', 0)}")
    click.echo(f"  聚类数: {info.get('clusters_count', 0)}")
    
    cluster_files = info.get("cluster_files", [])
    if cluster_files:
        click.echo("")
        click.echo("--- 聚类历史 ---")
        for item in cluster_files:
            click.echo(f"  - {item['file_name']}: {item['num_clusters']} 个聚类")


if __name__ == "__main__":
    main()
