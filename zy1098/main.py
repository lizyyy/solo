#!/usr/bin/env python3
"""
作文错题与薄弱知识点归类助手
本地运行的作文分析工具，用于归类错题和识别薄弱知识点
"""

import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from core.models import Essay, Feedback, Mistake, Report
from core.parser import Parser, ParseResult
from core.validator import Validator, ValidationResult, ValidationLevel
from core.classifier import Classifier, ClassificationResult
from core.similarity import SimilarityEngine, ClusterEngine
from core.filter import FilterEngine, FilterCriteria, SortCriteria, SortOrder
from core.task_generator import TaskGenerator, TaskGenerationConfig
from core.exporter import Exporter
from config.loader import ConfigLoader, RulesConfig, DictionaryConfig


class EssayAnalyzer:
    def __init__(self, config_dir: Optional[Path] = None):
        self.config_loader = ConfigLoader(config_dir)
        self.rules: RulesConfig = self.config_loader.load_rules()
        self.dict_config: DictionaryConfig = self.config_loader.load_dictionary()

        self.parser = Parser()
        self.validator = Validator(self.dict_config)
        self.classifier = Classifier(self.rules)
        self.similarity_engine = SimilarityEngine(self.rules, self.dict_config)
        self.cluster_engine = ClusterEngine(self.rules, self.similarity_engine)
        self.filter_engine = FilterEngine(self.dict_config)
        self.task_generator = TaskGenerator(self.rules, self.dict_config)
        self.exporter = Exporter(self.rules)

        self.essays: List[Essay] = []
        self.feedback_list: List[Feedback] = []
        self.mistakes: List[Mistake] = []

    def import_files(
        self,
        essays_csv: Optional[Path] = None,
        feedback_md: Optional[Path] = None,
        mistakes_json: Optional[Path] = None
    ) -> Dict[str, Any]:
        results = {
            'essays': {'count': 0, 'errors': [], 'warnings': []},
            'feedback': {'count': 0, 'errors': [], 'warnings': []},
            'mistakes': {'count': 0, 'errors': [], 'warnings': []},
            'validation': {'has_errors': False, 'issues': []}
        }

        if essays_csv and essays_csv.exists():
            parse_result = Parser.parse_csv_essays(essays_csv)
            results['essays']['count'] = len(parse_result.items)
            results['essays']['errors'] = parse_result.errors
            results['essays']['warnings'] = parse_result.warnings
            self.essays.extend(parse_result.items)

            if parse_result.items:
                val_result = self.validator.validate_essays(parse_result.items)
                if val_result.has_errors:
                    results['validation']['has_errors'] = True
                for issue in val_result.issues:
                    results['validation']['issues'].append({
                        'level': issue.level.value,
                        'field': issue.field,
                        'message': issue.message,
                        'suggestion': issue.suggestion,
                        'student_name': issue.student_name
                    })

        if feedback_md and feedback_md.exists():
            parse_result = Parser.parse_markdown_feedback(feedback_md)
            results['feedback']['count'] = len(parse_result.items)
            results['feedback']['errors'] = parse_result.errors
            results['feedback']['warnings'] = parse_result.warnings
            self.feedback_list.extend(parse_result.items)

            if parse_result.items:
                val_result = self.validator.validate_feedback(parse_result.items)
                if val_result.has_errors:
                    results['validation']['has_errors'] = True
                for issue in val_result.issues:
                    results['validation']['issues'].append({
                        'level': issue.level.value,
                        'field': issue.field,
                        'message': issue.message,
                        'suggestion': issue.suggestion,
                        'student_name': issue.student_name
                    })

        if mistakes_json and mistakes_json.exists():
            parse_result = Parser.parse_json_mistakes(mistakes_json)
            results['mistakes']['count'] = len(parse_result.items)
            results['mistakes']['errors'] = parse_result.errors
            results['mistakes']['warnings'] = parse_result.warnings
            self.mistakes.extend(parse_result.items)

            if parse_result.items:
                val_result = self.validator.validate_mistakes(parse_result.items)
                if val_result.has_errors:
                    results['validation']['has_errors'] = True
                for issue in val_result.issues:
                    results['validation']['issues'].append({
                        'level': issue.level.value,
                        'field': issue.field,
                        'message': issue.message,
                        'suggestion': issue.suggestion,
                        'student_name': issue.student_name
                    })

        return results

    def analyze(
        self,
        filter_criteria: Optional[FilterCriteria] = None,
        cluster_threshold: Optional[float] = None,
        task_config: Optional[TaskGenerationConfig] = None
    ) -> Report:
        filter_criteria = filter_criteria or FilterCriteria()

        essays = self.filter_engine.filter_essays(self.essays, filter_criteria)
        feedback = self.filter_engine.filter_feedback(self.feedback_list, filter_criteria)
        mistakes = self.filter_engine.filter_mistakes(self.mistakes, filter_criteria)

        classification = self.classifier.classify_all(essays, feedback, mistakes)

        labeled_items = classification.labeled_items
        if filter_criteria.labels or filter_criteria.confidence_min or filter_criteria.item_types:
            labeled_items = self.filter_engine.filter_labeled_items(labeled_items, filter_criteria)

        clusters = self.cluster_engine.cluster_items(
            labeled_items,
            threshold=cluster_threshold
        )

        weaknesses = self.task_generator.generate_weakness_points(labeled_items, by_student=True)

        weaknesses = self.filter_engine.sort_weakness_points(
            weaknesses,
            SortCriteria(field='priority', order=SortOrder.DESC)
        )

        task_config = task_config or TaskGenerationConfig()
        tasks = self.task_generator.generate_tasks(weaknesses, task_config)

        filters_applied = {}
        if filter_criteria.student_name:
            filters_applied['学生'] = filter_criteria.student_name
        if filter_criteria.essay_type:
            filters_applied['文体'] = filter_criteria.essay_type
        if filter_criteria.date_from:
            filters_applied['开始日期'] = filter_criteria.date_from
        if filter_criteria.date_to:
            filters_applied['结束日期'] = filter_criteria.date_to
        if filter_criteria.score_min is not None:
            filters_applied['最低分数'] = filter_criteria.score_min
        if filter_criteria.labels:
            filters_applied['标签'] = ', '.join(filter_criteria.labels)

        report = Report(
            generated_at=datetime.now(),
            student_name=filter_criteria.student_name if filter_criteria.student_name else None,
            filters_applied=filters_applied,
            essays_count=len(essays),
            feedback_count=len(feedback),
            mistakes_count=len(mistakes),
            labeled_items=labeled_items,
            clusters=clusters,
            weakness_points=weaknesses,
            tasks=tasks
        )

        return report

    def export_report(
        self,
        report: Report,
        output_dir: Path,
        formats: List[str] = None,
        include_evidence: bool = True
    ) -> Dict[str, Path]:
        formats = formats or ['markdown', 'html', 'json']
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        exported_files = {}

        if 'markdown' in formats or 'md' in formats:
            md_path = output_dir / f"report_{timestamp}.md"
            self.exporter.export_markdown(report, md_path, include_evidence)
            exported_files['markdown'] = md_path

        if 'html' in formats:
            html_path = output_dir / f"report_{timestamp}.html"
            self.exporter.export_html(report, html_path, include_evidence)
            exported_files['html'] = html_path

        if 'json' in formats:
            json_path = output_dir / f"report_{timestamp}.json"
            self.exporter.export_json(report, json_path)
            exported_files['json'] = json_path

        return exported_files

    def get_students(self) -> List[str]:
        all_items = self.essays + self.feedback_list + self.mistakes
        return self.filter_engine.get_unique_students(all_items)

    def get_essay_types(self) -> List[str]:
        all_items = self.essays + [f for f in self.feedback_list if f.essay_type]
        return self.filter_engine.get_unique_essay_types(all_items)

    def get_date_range(self) -> tuple:
        all_items = self.essays + self.feedback_list + self.mistakes
        return self.filter_engine.get_date_range(all_items)


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║              作文错题与薄弱知识点归类助手                      ║
║         Essay Error & Weakness Analyzer v1.0.0               ║
╠══════════════════════════════════════════════════════════════╣
║  本地运行 · 规则驱动 · 无需外部模型                           ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def print_import_results(results: Dict[str, Any]):
    print("\n" + "=" * 60)
    print("📥 导入结果统计")
    print("=" * 60)

    print(f"\n  📝 作文记录 (essays.csv):")
    print(f"     成功导入: {results['essays']['count']} 条")
    if results['essays']['errors']:
        print(f"     ❌ 错误: {len(results['essays']['errors'])} 个")
        for err in results['essays']['errors'][:3]:
            print(f"        - {err}")
    if results['essays']['warnings']:
        print(f"     ⚠️  警告: {len(results['essays']['warnings'])} 个")

    print(f"\n  💬 老师反馈 (feedback.md):")
    print(f"     成功导入: {results['feedback']['count']} 条")
    if results['feedback']['errors']:
        print(f"     ❌ 错误: {len(results['feedback']['errors'])} 个")
        for err in results['feedback']['errors'][:3]:
            print(f"        - {err}")

    print(f"\n  ❌ 错题记录 (mistakes.json):")
    print(f"     成功导入: {results['mistakes']['count']} 条")
    if results['mistakes']['errors']:
        print(f"     ❌ 错误: {len(results['mistakes']['errors'])} 个")
        for err in results['mistakes']['errors'][:3]:
            print(f"        - {err}")

    if results['validation']['issues']:
        print(f"\n  🔍 数据校验问题:")
        errors = [i for i in results['validation']['issues'] if i['level'] == 'error']
        warnings = [i for i in results['validation']['issues'] if i['level'] == 'warning']

        if errors:
            print(f"\n     ❌ 严重错误 ({len(errors)} 个):")
            for err in errors[:5]:
                student = err.get('student_name', '未知')
                field = err.get('field', '未知')
                msg = err.get('message', '')
                sug = err.get('suggestion', '')
                print(f"        - 学生: {student} | 字段: {field}")
                print(f"          问题: {msg}")
                print(f"          建议: {sug}")

        if warnings:
            print(f"\n     ⚠️  警告 ({len(warnings)} 个):")
            for warn in warnings[:3]:
                student = warn.get('student_name', '未知')
                msg = warn.get('message', '')
                print(f"        - {student}: {msg}")

    total = (
        results['essays']['count'] +
        results['feedback']['count'] +
        results['mistakes']['count']
    )
    print(f"\n  📊 总计导入: {total} 条记录")


def print_analysis_summary(report: Report):
    print("\n" + "=" * 60)
    print("📊 分析结果摘要")
    print("=" * 60)

    print(f"\n  📈 统计概览:")
    print(f"     作文记录: {report.essays_count} 条")
    print(f"     老师反馈: {report.feedback_count} 条")
    print(f"     错题记录: {report.mistakes_count} 条")
    print(f"     发现问题: {len(report.labeled_items)} 个")
    print(f"     问题聚类: {len(report.clusters)} 组")
    print(f"     薄弱知识点: {len(report.weakness_points)} 个")
    print(f"     复习任务: {len(report.tasks)} 个")

    if report.weakness_points:
        print(f"\n  🎯 薄弱知识点优先级 (Top 5):")
        for idx, wp in enumerate(report.weakness_points[:5], 1):
            from config.loader import ConfigLoader
            rules = ConfigLoader().load_rules()
            rule = rules.labels.get(wp.label)
            label_name = rule.display_name if rule else wp.label
            priority_stars = "⭐" * wp.priority
            print(f"     {idx}. {label_name} {priority_stars}")
            print(f"        出现 {wp.frequency} 次 | 置信度 {wp.avg_confidence:.0%} | 优先级 {wp.priority}/10")

    if report.clusters:
        print(f"\n  🔗 相似问题聚类:")
        for idx, cluster in enumerate(report.clusters[:3], 1):
            from config.loader import ConfigLoader
            rules = ConfigLoader().load_rules()
            rule = rules.labels.get(cluster.label)
            label_name = rule.display_name if rule else cluster.label
            print(f"     {idx}. {label_name}: {len(cluster.items)} 条记录 (相似度 {cluster.avg_similarity:.0%})")

    if report.tasks:
        print(f"\n  ✅ 复习任务清单:")
        for idx, task in enumerate(report.tasks[:3], 1):
            from config.loader import ConfigLoader
            rules = ConfigLoader().load_rules()
            rule = rules.labels.get(task.weakness_label)
            label_name = rule.display_name if rule else task.weakness_label
            priority_stars = "⭐" * task.priority
            print(f"     {idx}. 【{task.student_name}】{label_name} {priority_stars}")
            print(f"        预计时间: {task.estimated_time} | 难度: {task.difficulty}")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='作文错题与薄弱知识点归类助手',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 基本分析流程
  python main.py analyze --essays data/essays.csv --feedback data/feedback.md --mistakes data/mistakes.json

  # 按学生筛选
  python main.py analyze --essays data/essays.csv --student "张三"

  # 指定输出格式
  python main.py analyze --essays data/essays.csv --output-dir ./reports --formats md html json

  # 查看已导入数据的统计信息
  python main.py stats --essays data/essays.csv
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    analyze_parser = subparsers.add_parser('analyze', help='执行完整分析流程')
    analyze_parser.add_argument('--essays', type=Path, help='作文数据 CSV 文件路径')
    analyze_parser.add_argument('--feedback', type=Path, help='老师反馈 Markdown 文件路径')
    analyze_parser.add_argument('--mistakes', type=Path, help='错题记录 JSON 文件路径')
    analyze_parser.add_argument('--student', type=str, help='按学生姓名筛选')
    analyze_parser.add_argument('--essay-type', type=str, help='按作文类型筛选')
    analyze_parser.add_argument('--output-dir', type=Path, default=Path('./reports'), help='输出目录 (默认: ./reports)')
    analyze_parser.add_argument('--formats', nargs='+', default=['md', 'html', 'json'],
                                help='输出格式 (md/html/json, 默认: 全部)')
    analyze_parser.add_argument('--cluster-threshold', type=float, default=0.7,
                                help='聚类相似度阈值 (默认: 0.7)')
    analyze_parser.add_argument('--confidence-min', type=float, default=0.0,
                                help='最低置信度筛选 (默认: 0.0)')
    analyze_parser.add_argument('--max-tasks', type=int, default=5,
                                help='每个学生最多任务数 (默认: 5)')
    analyze_parser.add_argument('--no-evidence', action='store_true',
                                help='报告中不包含证据片段')

    stats_parser = subparsers.add_parser('stats', help='查看数据统计信息')
    stats_parser.add_argument('--essays', type=Path, help='作文数据 CSV 文件路径')
    stats_parser.add_argument('--feedback', type=Path, help='老师反馈 Markdown 文件路径')
    stats_parser.add_argument('--mistakes', type=Path, help='错题记录 JSON 文件路径')

    list_parser = subparsers.add_parser('list', help='列出支持的标签和规则')
    list_parser.add_argument('--labels', action='store_true', help='列出所有错因标签')
    list_parser.add_argument('--config', type=Path, help='自定义配置目录')

    args = parser.parse_args()

    print_banner()

    if args.command == 'analyze':
        analyzer = EssayAnalyzer()

        print("📥 正在导入数据...")
        import_results = analyzer.import_files(
            essays_csv=args.essays,
            feedback_md=args.feedback,
            mistakes_json=args.mistakes
        )
        print_import_results(import_results)

        if import_results['validation']['has_errors']:
            print("\n❌ 数据存在严重错误，请先修正后再继续分析。")
            sys.exit(1)

        total_records = (
            import_results['essays']['count'] +
            import_results['feedback']['count'] +
            import_results['mistakes']['count']
        )

        if total_records == 0:
            print("\n❌ 未导入任何有效数据。请检查文件路径和格式。")
            sys.exit(1)

        filter_criteria = FilterCriteria()
        if args.student:
            filter_criteria.student_name = args.student
        if args.essay_type:
            filter_criteria.essay_type = args.essay_type
        if args.confidence_min > 0:
            filter_criteria.confidence_min = args.confidence_min

        task_config = TaskGenerationConfig(
            max_tasks_per_student=args.max_tasks,
            include_evidence=not args.no_evidence
        )

        print("\n🔍 正在分析数据...")
        report = analyzer.analyze(
            filter_criteria=filter_criteria,
            cluster_threshold=args.cluster_threshold,
            task_config=task_config
        )
        print_analysis_summary(report)

        print(f"\n📤 正在导出报告到: {args.output_dir}")
        exported_files = analyzer.export_report(
            report=report,
            output_dir=args.output_dir,
            formats=args.formats,
            include_evidence=not args.no_evidence
        )

        print("\n✅ 报告已生成:")
        for fmt, path in exported_files.items():
            print(f"   📄 {fmt.upper()}: {path}")

        print("\n" + "=" * 60)
        print("🎉 分析完成！")
        print("=" * 60)

    elif args.command == 'stats':
        analyzer = EssayAnalyzer()

        print("📥 正在导入数据...")
        import_results = analyzer.import_files(
            essays_csv=args.essays,
            feedback_md=args.feedback,
            mistakes_json=args.mistakes
        )
        print_import_results(import_results)

        students = analyzer.get_students()
        essay_types = analyzer.get_essay_types()
        date_range = analyzer.get_date_range()

        print("\n" + "=" * 60)
        print("📊 数据统计")
        print("=" * 60)

        if students:
            print(f"\n  👥 涉及学生 ({len(students)} 人):")
            for student in students:
                print(f"     - {student}")

        if essay_types:
            print(f"\n  📝 作文类型 ({len(essay_types)} 种):")
            for et in essay_types:
                print(f"     - {et}")

        if date_range[0] or date_range[1]:
            print(f"\n  📅 日期范围:")
            if date_range[0]:
                print(f"     最早: {date_range[0]}")
            if date_range[1]:
                print(f"     最晚: {date_range[1]}")

    elif args.command == 'list':
        config_dir = args.config
        config_loader = ConfigLoader(config_dir)
        rules = config_loader.load_rules()

        if args.labels or not (args.labels or args.config):
            print("\n" + "=" * 60)
            print("🏷️  支持的错因标签")
            print("=" * 60)

            for label_id, rule in sorted(rules.labels.items(), key=lambda x: -x[1].priority):
                priority_stars = "⭐" * rule.priority
                print(f"\n  {rule.display_name} {priority_stars} (ID: {label_id})")
                print(f"     描述: {rule.description}")
                print(f"     关键词: {', '.join(rule.keywords[:5])}{'...' if len(rule.keywords) > 5 else ''}")
                print(f"     优先级: {rule.priority} | 预计时间: {rule.estimated_time} | 难度: {rule.difficulty}")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
