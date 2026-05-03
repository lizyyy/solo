"""
CLI 入口模块：阅读包推荐质检员命令行工具
"""
import click
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import asdict
import json

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .__init__ import __version__
from .parser_validator import Parser, DataValidator
from .rules_engine import RulesEngine, RiskLevel, CheckResult
from .profile_recommender import ProfileBuilder, SimpleRecommender, Recommendation
from .review_storage import ReviewStorage, ReviewAction
from .exporter import Exporter
from .sample_data import SampleDataGenerator


console = Console()


class AppContext:
    """应用上下文"""
    
    def __init__(self, data_dir: Path = None):
        self.data_dir = data_dir or Path.cwd() / "data"
        self.output_dir = self.data_dir / "output"
        self.review_dir = self.data_dir / "reviews"
        
        self.books: Dict = {}
        self.borrow_records: List = []
        self.activity_registrations: List = []
        self.feedbacks: List = []
        self.forbidden_themes: List = []
        
        self.parser = Parser()
        self.rules_engine: Optional[RulesEngine] = None
        self.profile_builder: Optional[ProfileBuilder] = None
        self.recommender: Optional[SimpleRecommender] = None
        self.review_storage: Optional[ReviewStorage] = None
        self.exporter: Optional[Exporter] = None
    
    def load_data(self):
        """加载所有数据文件"""
        books_file = self.data_dir / "books.csv"
        if books_file.exists():
            self.books = self.parser.parse_books_csv(books_file)
            if self.parser.get_errors():
                for err in self.parser.get_errors():
                    console.print(f"[red]错误: {err}[/red]")
        
        borrow_file = self.data_dir / "borrow_records.csv"
        if borrow_file.exists():
            self.borrow_records = self.parser.parse_borrow_csv(borrow_file)
        
        activity_file = self.data_dir / "activity_registrations.jsonl"
        if activity_file.exists():
            self.activity_registrations = self.parser.parse_activity_jsonl(activity_file)
        
        feedback_file = self.data_dir / "feedbacks.csv"
        if feedback_file.exists():
            self.feedbacks = self.parser.parse_feedback_csv(feedback_file)
        
        forbidden_file = self.data_dir / "forbidden_themes.yaml"
        if forbidden_file.exists():
            self.forbidden_themes = self.parser.parse_forbidden_yaml(forbidden_file)
        
        self.rules_engine = RulesEngine(
            books=self.books,
            forbidden_themes=self.forbidden_themes,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
        
        self.profile_builder = ProfileBuilder(
            books=self.books,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
        
        self.recommender = SimpleRecommender(
            books=self.books,
            profile_builder=self.profile_builder,
            rules_engine=self.rules_engine
        )
        
        self.review_storage = ReviewStorage(self.review_dir)
        self.exporter = Exporter(self.output_dir)
    
    def get_all_child_ids(self) -> List[str]:
        """获取所有孩子ID"""
        child_ids = set()
        
        for record in self.borrow_records:
            child_ids.add(record.child_id)
        for reg in self.activity_registrations:
            child_ids.add(reg.child_id)
        for feedback in self.feedbacks:
            child_ids.add(feedback.child_id)
        
        return sorted(child_ids)


pass_app_context = click.make_pass_decorator(AppContext)


@click.group()
@click.option("--data-dir", "-d", type=click.Path(exists=False, path_type=Path), default=None,
              help="数据目录路径（默认为当前目录下的 data 文件夹）")
@click.version_option(__version__, "--version", "-v")
@click.pass_context
def cli(ctx: click.Context, data_dir: Optional[Path]):
    """
    阅读包推荐质检员 - 县图书馆少儿阅读活动推荐系统
    
    用于处理匿名借阅记录、活动报名、家长反馈和禁推主题，
    自动生成阅读包推荐并进行质量检查。
    """
    ctx.obj = AppContext(data_dir)


@cli.command()
@pass_app_context
def init(app: AppContext):
    """
    初始化项目：生成样例数据文件
    
    在数据目录下生成以下样例文件：
    - books.csv: 图书目录
    - borrow_records.csv: 借阅记录
    - activity_registrations.jsonl: 活动报名
    - feedbacks.csv: 家长反馈
    - forbidden_themes.yaml: 禁推主题
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 初始化[/bold blue]",
        subtitle="生成样例数据"
    ))
    
    app.data_dir.mkdir(parents=True, exist_ok=True)
    
    generator = SampleDataGenerator(app.data_dir)
    files = generator.write_all_files()
    
    console.print("\n[green]✓ 样例数据已生成：[/green]")
    for name, filepath in files.items():
        console.print(f"  - {name}: {filepath}")
    
    console.print("\n[yellow]提示：[/yellow]")
    console.print("  请根据实际情况修改这些样例数据文件，")
    console.print("  然后运行 'reading_recommender train' 进行画像构建。")


@cli.command("train")
@pass_app_context
def train(app: AppContext):
    """
    构建兴趣画像：基于借阅历史、活动记录和家长反馈
    
    分析数据并为每个孩子构建兴趣画像，包括：
    - 年龄段分类
    - 主题偏好（基于借阅历史）
    - 活动兴趣
    - 家长反馈的喜好
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 训练[/bold blue]",
        subtitle="构建兴趣画像"
    ))
    
    app.load_data()
    
    if not app.books:
        console.print("[red]错误：未找到图书数据，请先运行 'reading_recommender init' 或准备数据文件[/red]")
        return
    
    profiles = app.profile_builder.get_all_profiles()
    
    if not profiles:
        console.print("[yellow]警告：没有找到任何孩子的记录，将基于年龄段进行冷启动推荐[/yellow]")
        return
    
    console.print(f"\n[green]✓ 已为 {len(profiles)} 个孩子构建兴趣画像[/green]")
    
    cold_start = app.profile_builder.get_cold_start_children()
    if cold_start:
        console.print(f"[yellow]  其中 {len(cold_start)} 个孩子为冷启动用户（无历史数据）[/yellow]")
    
    table = Table(title="孩子画像摘要")
    table.add_column("孩子ID", style="cyan")
    table.add_column("姓名", style="magenta")
    table.add_column("年龄", style="green")
    table.add_column("年龄段", style="yellow")
    table.add_column("借阅数", style="blue")
    table.add_column("冷启动", style="red")
    table.add_column("主要兴趣", style="white")
    
    for child_id, profile in profiles.items():
        top_interests = ", ".join([t for t, s in profile.top_interests[:3]]) if profile.top_interests else "无"
        table.add_row(
            child_id,
            profile.name or "-",
            str(profile.age) if profile.age > 0 else "-",
            profile.age_group or "-",
            str(profile.borrow_count),
            "是" if profile.is_cold_start else "否",
            top_interests[:30] + ("..." if len(top_interests) > 30 else "")
        )
    
    console.print(table)
    
    stats = app.rules_engine.get_statistics()
    console.print(f"\n[bold]统计信息：[/bold]")
    console.print(f"  - 总图书数：{stats['total_books']}")
    console.print(f"  - 总借阅记录：{stats['total_borrow_records']}")
    console.print(f"  - 冷启动比例：{stats['cold_start_ratio']:.1%}")


@cli.command("recommend")
@click.option("--child-id", "-c", type=str, default=None,
              help="指定孩子ID（不指定则为所有孩子推荐）")
@click.option("--count", "-n", type=int, default=5,
              help="每个孩子的推荐数量（默认为5）")
@click.option("--no-filter", is_flag=True, default=False,
              help="不使用规则引擎过滤（默认会过滤不符合规则的推荐）")
@pass_app_context
def recommend(app: AppContext, child_id: Optional[str], count: int, no_filter: bool):
    """
    生成推荐：为孩子推荐阅读包
    
    基于兴趣画像和规则引擎，为每个孩子推荐合适的图书，
    并提供可解释的推荐理由。
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 推荐[/bold blue]",
        subtitle=f"推荐 {count} 本图书"
    ))
    
    app.load_data()
    
    if not app.books:
        console.print("[red]错误：未找到图书数据[/red]")
        return
    
    child_ids = [child_id] if child_id else app.get_all_child_ids()
    
    if not child_ids:
        console.print("[red]错误：未找到任何孩子记录[/red]")
        return
    
    use_filter = not no_filter
    
    if child_id:
        recs = app.recommender.recommend_for_child(child_id, count, use_filter)
        
        profile = app.profile_builder.get_profile(child_id)
        if profile:
            console.print(f"\n[bold]孩子信息：[/bold]")
            console.print(f"  ID: {child_id}")
            console.print(f"  姓名: {profile.name or '未知'}")
            console.print(f"  年龄: {profile.age or '未知'} 岁")
            console.print(f"  冷启动: {'是' if profile.is_cold_start else '否'}")
        
        if recs:
            console.print(f"\n[green]✓ 推荐结果（{len(recs)} 本）：[/green]")
            
            table = Table(title=f"推荐结果 - {child_id}")
            table.add_column("排名", style="cyan", justify="center")
            table.add_column("书名", style="magenta")
            table.add_column("作者", style="green")
            table.add_column("分类", style="yellow")
            table.add_column("年龄段", style="blue")
            table.add_column("分数", style="red", justify="center")
            
            for rec in recs:
                table.add_row(
                    str(rec.rank),
                    rec.title,
                    rec.author,
                    rec.category,
                    rec.age_group,
                    f"{rec.score:.3f}"
                )
            
            console.print(table)
            
            console.print(f"\n[bold]推荐理由：[/bold]")
            for rec in recs:
                console.print(f"\n  [cyan]{rec.rank}. {rec.title}[/cyan]")
                for reason in rec.reasons:
                    console.print(f"    - {reason}")
        else:
            console.print(f"[yellow]警告：没有找到适合的推荐图书[/yellow]")
    else:
        all_recs = app.recommender.recommend_for_all_children(
            child_ids=child_ids,
            n=count,
            use_rules_filter=use_filter
        )
        
        console.print(f"\n[green]✓ 已为 {len(all_recs)} 个孩子生成推荐[/green]")
        
        total_recs = sum(len(recs) for recs in all_recs.values())
        console.print(f"  总计 {total_recs} 条推荐")
        
        table = Table(title="推荐摘要")
        table.add_column("孩子ID", style="cyan")
        table.add_column("推荐数", style="green", justify="center")
        table.add_column("最高分", style="yellow", justify="center")
        
        for cid, recs in all_recs.items():
            if recs:
                max_score = max(r.score for r in recs)
                table.add_row(cid, str(len(recs)), f"{max_score:.3f}")
            else:
                table.add_row(cid, "0", "-")
        
        console.print(table)


@cli.command("check")
@click.option("--child-id", "-c", type=str, default=None,
              help="指定孩子ID（不指定则检查所有孩子的推荐）")
@click.option("--recommendations-file", "-f", type=click.Path(exists=True, path_type=Path), default=None,
              help="推荐结果 JSON 文件路径（如果不指定，则重新生成推荐）")
@pass_app_context
def check(app: AppContext, child_id: Optional[str], recommendations_file: Optional[Path]):
    """
    质量检查：检测推荐中的问题
    
    检查以下问题：
    - 年龄段不匹配
    - 库存不足
    - 重复借阅
    - 禁推主题
    - 冷启动风险
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 检查[/bold blue]",
        subtitle="质量检测"
    ))
    
    app.load_data()
    
    if recommendations_file:
        console.print(f"\n[info]从文件加载推荐结果：{recommendations_file}[/info]")
        try:
            with open(recommendations_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            all_recs = {}
            for child_data in data.get('children', []):
                cid = child_data.get('child_id')
                recs = []
                for rec_data in child_data.get('recommendations', []):
                    rec = Recommendation(
                        book_id=rec_data.get('book_id', ''),
                        title=rec_data.get('title', ''),
                        author=rec_data.get('author', ''),
                        category=rec_data.get('category', ''),
                        age_group=rec_data.get('age_group', ''),
                        themes=rec_data.get('themes', []),
                        score=rec_data.get('score', 0.0),
                        reasons=rec_data.get('reasons', []),
                        rank=rec_data.get('rank', 0)
                    )
                    recs.append(rec)
                all_recs[cid] = recs
        except Exception as e:
            console.print(f"[red]错误：无法加载推荐文件 - {e}[/red]")
            return
    else:
        child_ids = [child_id] if child_id else app.get_all_child_ids()
        if not child_ids:
            console.print("[red]错误：未找到任何孩子记录[/red]")
            return
        
        all_recs = app.recommender.recommend_for_all_children(
            child_ids=child_ids,
            n=5,
            use_rules_filter=False
        )
    
    total_issues = 0
    total_warnings = 0
    total_children = 0
    
    for cid, recs in all_recs.items():
        if child_id and cid != child_id:
            continue
        
        total_children += 1
        
        console.print(f"\n[bold]孩子：{cid}[/bold]")
        
        rec_dicts = [asdict(r) for r in recs]
        check_results = app.rules_engine.check_recommendations(rec_dicts, cid)
        
        child_issues = 0
        child_warnings = 0
        
        table = Table(title=f"检查结果 - {cid}")
        table.add_column("书名", style="magenta")
        table.add_column("状态", style="cyan", justify="center")
        table.add_column("风险等级", style="yellow", justify="center")
        table.add_column("问题数", style="red", justify="center")
        table.add_column("警告数", style="blue", justify="center")
        
        for rec, check in check_results:
            status = "✅ 通过" if check.is_eligible else "❌ 有问题"
            
            risk_color = "green"
            if check.risk_level == RiskLevel.MEDIUM:
                risk_color = "yellow"
            elif check.risk_level == RiskLevel.HIGH:
                risk_color = "red"
            elif check.risk_level == RiskLevel.CRITICAL:
                risk_color = "bright_red"
            
            table.add_row(
                rec.get('title', '未知'),
                status,
                f"[{risk_color}]{check.risk_level.value}[/{risk_color}]",
                str(len(check.issues)),
                str(len(check.warnings))
            )
            
            child_issues += len(check.issues)
            child_warnings += len(check.warnings)
        
        console.print(table)
        
        if child_issues > 0 or child_warnings > 0:
            console.print(f"\n[bold]详细问题：[/bold]")
            for rec, check in check_results:
                if check.issues or check.warnings:
                    console.print(f"\n  [cyan]《{rec.get('title', '未知')}》[/cyan]")
                    
                    for issue in check.issues:
                        console.print(f"    [red]✗ 问题：{issue}[/red]")
                    
                    for warning in check.warnings:
                        console.print(f"    [yellow]⚠ 警告：{warning}[/yellow]")
        
        total_issues += child_issues
        total_warnings += child_warnings
    
    console.print(f"\n[bold]检查统计：[/bold]")
    console.print(f"  - 检查孩子数：{total_children}")
    console.print(f"  - 总问题数：{total_issues}")
    console.print(f"  - 总警告数：{total_warnings}")
    
    if total_issues > 0:
        console.print(f"\n[red]⚠ 发现 {total_issues} 个严重问题，请检查后再使用推荐结果[/red]")


@cli.command("review")
@click.option("--child-id", "-c", type=str, required=True,
              help="孩子ID（必填）")
@click.option("--original-file", "-o", type=click.Path(exists=True, path_type=Path), default=None,
              help="原始推荐 JSON 文件路径")
@click.option("--final-file", "-f", type=click.Path(exists=True, path_type=Path), default=None,
              help="调整后推荐 JSON 文件路径")
@click.option("--reviewer", "-r", type=str, default="",
              help="复核人姓名")
@click.option("--notes", "-n", type=str, default="",
              help="备注信息")
@pass_app_context
def review(
    app: AppContext, 
    child_id: str, 
    original_file: Optional[Path], 
    final_file: Optional[Path],
    reviewer: str,
    notes: str
):
    """
    复核存储：保存人工调整结果
    
    记录推荐结果的人工调整，包括：
    - 移除不合适的推荐
    - 添加替代图书
    - 添加备注说明
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 复核[/bold blue]",
        subtitle="保存人工调整"
    ))
    
    app.load_data()
    
    if not original_file or not final_file:
        console.print("[yellow]提示：请提供原始推荐文件和调整后文件[/yellow]")
        console.print("\n使用示例：")
        console.print("  reading_recommender review -c C001 -o original.json -f final.json -r 张老师")
        return
    
    try:
        with open(original_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        
        with open(final_file, 'r', encoding='utf-8') as f:
            final_data = json.load(f)
    except Exception as e:
        console.print(f"[red]错误：无法读取文件 - {e}[/red]")
        return
    
    original_recs = []
    for child in original_data.get('children', []):
        if child.get('child_id') == child_id:
            original_recs = child.get('recommendations', [])
            break
    
    final_recs = []
    for child in final_data.get('children', []):
        if child.get('child_id') == child_id:
            final_recs = child.get('recommendations', [])
            break
    
    if not original_recs:
        console.print(f"[yellow]警告：在原始文件中未找到孩子 {child_id} 的推荐[/yellow]")
    
    if not final_recs:
        console.print(f"[yellow]警告：在调整后文件中未找到孩子 {child_id} 的推荐[/yellow]")
    
    review_record = app.review_storage.save_adjustment(
        child_id=child_id,
        original_recommendations=original_recs,
        final_recommendations=final_recs,
        reviewer=reviewer,
        notes=notes
    )
    
    original_ids = {r.get('book_id') for r in original_recs}
    final_ids = {r.get('book_id') for r in final_recs}
    
    removed = original_ids - final_ids
    added = final_ids - original_ids
    
    console.print(f"\n[green]✓ 复核记录已保存[/green]")
    console.print(f"\n[bold]变更统计：[/bold]")
    console.print(f"  - 原始推荐数：{len(original_recs)}")
    console.print(f"  - 调整后推荐数：{len(final_recs)}")
    console.print(f"  - 移除图书数：{len(removed)}")
    console.print(f"  - 添加图书数：{len(added)}")
    console.print(f"  - 复核人：{reviewer or '未指定'}")
    
    if removed:
        console.print(f"\n[red]移除的图书：[/red]")
        for bid in removed:
            console.print(f"  - {bid}")
    
    if added:
        console.print(f"\n[green]添加的图书：[/green]")
        for bid in added:
            console.print(f"  - {bid}")
    
    stats = app.review_storage.get_statistics()
    console.print(f"\n[bold]复核统计：[/bold]")
    console.print(f"  - 已复核孩子数：{stats['total_reviewed_children']}")
    console.print(f"  - 总操作数：{stats['total_actions']}")


@cli.command("report")
@click.option("--format", "-f", type=click.Choice(['markdown', 'csv', 'json', 'all']), default='all',
              help="导出格式（默认为 all，导出所有格式）")
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None,
              help="输出目录路径（默认为 data/output）")
@click.option("--child-id", "-c", type=str, default=None,
              help="指定孩子ID（不指定则导出所有孩子）")
@click.option("--with-check", is_flag=True, default=True,
              help="包含质量检查结果（默认开启）")
@pass_app_context
def report(
    app: AppContext, 
    format: str, 
    output: Optional[Path], 
    child_id: Optional[str],
    with_check: bool
):
    """
    导出报告：生成 Markdown/CSV/JSON 格式的报告
    
    将推荐结果、质量检查和兴趣画像导出为多种格式，
    方便查看和分享。
    """
    console.print(Panel.fit(
        "[bold blue]阅读包推荐质检员 - 报告[/bold blue]",
        subtitle=f"导出格式：{format}"
    ))
    
    app.load_data()
    
    if output:
        app.exporter = Exporter(output)
    
    child_ids = [child_id] if child_id else app.get_all_child_ids()
    
    if not child_ids:
        console.print("[yellow]警告：未找到任何孩子记录，无法生成报告[/yellow]")
        return
    
    all_recs = app.recommender.recommend_for_all_children(
        child_ids=child_ids,
        n=5,
        use_rules_filter=True
    )
    
    profiles = app.profile_builder.get_all_profiles()
    
    check_results = None
    if with_check:
        check_results = {}
        for cid, recs in all_recs.items():
            rec_dicts = [asdict(r) for r in recs]
            checks = app.rules_engine.check_recommendations(rec_dicts, cid)
            check_results[cid] = checks
    
    if format == 'markdown':
        filepath = app.exporter.export_markdown(all_recs, check_results, profiles)
        console.print(f"\n[green]✓ Markdown 报告已导出：{filepath}[/green]")
    elif format == 'csv':
        filepath = app.exporter.export_csv(all_recs, check_results, profiles)
        console.print(f"\n[green]✓ CSV 报告已导出：{filepath}[/green]")
    elif format == 'json':
        filepath = app.exporter.export_json(all_recs, check_results, profiles)
        console.print(f"\n[green]✓ JSON 报告已导出：{filepath}[/green]")
    else:
        files = app.exporter.export_all_formats(all_recs, check_results, profiles)
        console.print(f"\n[green]✓ 所有格式报告已导出：[/green]")
        for fmt, filepath in files.items():
            console.print(f"  - {fmt}: {filepath}")
    
    console.print(f"\n[bold]报告内容：[/bold]")
    console.print(f"  - 孩子数：{len(all_recs)}")
    console.print(f"  - 推荐总数：{sum(len(r) for r in all_recs.values())}")
    console.print(f"  - 包含质量检查：{'是' if with_check else '否'}")


def main():
    """入口函数"""
    cli()


if __name__ == "__main__":
    main()
