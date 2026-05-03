import argparse
import os
import sys
from datetime import date
from pathlib import Path
from typing import Optional

from trademark_deadlines.core.data_loader import DataLoader, LoadedData
from trademark_deadlines.core.date_calculator import DateCalculator, DeadlineCalculationResult
from trademark_deadlines.core.risk_detector import RiskDetector, RiskItem
from trademark_deadlines.output.csv_exporter import CSVExporter
from trademark_deadlines.output.markdown_exporter import MarkdownExporter
from trademark_deadlines.output.ics_exporter import ICSExporter


def get_sample_dir() -> Path:
    package_dir = Path(__file__).parent.parent
    sample_dir = package_dir / "sample"
    
    if not sample_dir.exists():
        alt_sample_dir = Path(__file__).parent / "sample"
        if alt_sample_dir.exists():
            return alt_sample_dir
        
        cwd_sample = Path.cwd() / "sample"
        if cwd_sample.exists():
            return cwd_sample
    
    return sample_dir


class TrademarkDeadlinesApp:
    def __init__(
        self,
        cases_path: str,
        actions_path: str,
        holiday_rules_path: str,
        jurisdiction_rules_path: str,
        output_dir: str = ".",
        reference_date: Optional[date] = None,
        imminent_threshold: int = 7
    ):
        self.cases_path = cases_path
        self.actions_path = actions_path
        self.holiday_rules_path = holiday_rules_path
        self.jurisdiction_rules_path = jurisdiction_rules_path
        self.output_dir = output_dir
        self.reference_date = reference_date or date.today()
        self.imminent_threshold = imminent_threshold
        
        self.loaded_data: Optional[LoadedData] = None
        self.deadlines: list = []
        self.risks: list = []
    
    def run(self) -> int:
        print("=" * 60)
        print("商标案件期限复核工具")
        print(f"参考日期: {self.reference_date}")
        print("=" * 60)
        print()
        
        print("[1/5] 加载数据...")
        if not self._load_data():
            return 1
        
        print(f"   - 已加载 {len(self.loaded_data.cases)} 个案件")
        print(f"   - 已加载 {len(self.loaded_data.actions)} 个动作")
        print(f"   - 已加载 {len(self.loaded_data.jurisdiction_rules)} 个司法管辖区规则")
        
        if self.loaded_data.data_issues.issues:
            print(f"   ⚠️ 发现 {len(self.loaded_data.data_issues.issues)} 个数据质量问题")
        
        print()
        
        print("[2/5] 计算截止日期...")
        self._calculate_deadlines()
        print(f"   - 计算了 {len(self.deadlines)} 个期限")
        
        overdue = len([d for d in self.deadlines if d.is_overdue])
        imminent = len([d for d in self.deadlines if 0 <= d.days_until_deadline <= self.imminent_threshold])
        
        if overdue > 0:
            print(f"   🔴 已逾期: {overdue} 个")
        if imminent > 0:
            print(f"   🟠 即将到期: {imminent} 个")
        print()
        
        print("[3/5] 检测风险...")
        self._detect_risks()
        print(f"   - 检测到 {len(self.risks)} 个风险项")
        print()
        
        print("[4/5] 生成输出文件...")
        self._generate_outputs()
        print()
        
        print("[5/5] 完成!")
        print("-" * 60)
        
        self._print_summary()
        
        return 0
    
    def _load_data(self) -> bool:
        try:
            loader = DataLoader()
            self.loaded_data = loader.load_all(
                self.cases_path,
                self.actions_path,
                self.holiday_rules_path,
                self.jurisdiction_rules_path
            )
            return True
        except Exception as e:
            print(f"   ❌ 数据加载失败: {e}")
            return False
    
    def _calculate_deadlines(self):
        if not self.loaded_data:
            return
        
        calculator = DateCalculator(
            jurisdiction_rules=self.loaded_data.jurisdiction_rules,
            holiday_calendars=self.loaded_data.holiday_calendars,
            reference_date=self.reference_date
        )
        
        all_deadlines = []
        for case in self.loaded_data.cases:
            case_deadlines = calculator.calculate_case_deadlines(
                case, self.loaded_data.actions
            )
            all_deadlines.extend(case_deadlines)
        
        self.deadlines = all_deadlines
    
    def _detect_risks(self):
        if not self.loaded_data:
            return
        
        detector = RiskDetector(
            jurisdiction_rules=self.loaded_data.jurisdiction_rules,
            imminent_threshold_days=self.imminent_threshold,
            reference_date=self.reference_date
        )
        
        self.risks = detector.detect_all_risks(
            self.loaded_data.cases,
            self.loaded_data.actions,
            self.deadlines
        )
    
    def _generate_outputs(self):
        output_path = Path(self.output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        csv_path = output_path / "deadlines.csv"
        csv_exporter = CSVExporter()
        count = csv_exporter.export_deadlines(
            self.deadlines,
            str(csv_path),
            self.reference_date
        )
        print(f"   - 已生成: {csv_path} ({count} 条记录)")
        
        md_path = output_path / "risk_report.md"
        md_exporter = MarkdownExporter()
        md_exporter.export_report(
            self.deadlines,
            self.risks,
            self.loaded_data.data_issues if self.loaded_data else None,
            str(md_path),
            self.reference_date
        )
        print(f"   - 已生成: {md_path}")
        
        ics_path = output_path / "calendar.ics"
        ics_exporter = ICSExporter()
        ics_exporter.export_calendar(
            self.deadlines,
            self.risks,
            str(ics_path),
            self.reference_date
        )
        print(f"   - 已生成: {ics_path}")
    
    def _print_summary(self):
        total = len(self.deadlines)
        overdue = len([d for d in self.deadlines if d.is_overdue])
        imminent_3d = len([d for d in self.deadlines if 0 <= d.days_until_deadline <= 3])
        imminent_7d = len([d for d in self.deadlines if 0 <= d.days_until_deadline <= 7])
        
        print(f"总期限数: {total}")
        print(f"  - 已逾期: {overdue}")
        print(f"  - 3天内到期: {imminent_3d}")
        print(f"  - 7天内到期: {imminent_7d}")
        print()
        print(f"风险项数: {len(self.risks)}")
        print()
        print("输出文件:")
        print(f"  - deadlines.csv - 期限详情表")
        print(f"  - risk_report.md - 风险报告")
        print(f"  - calendar.ics - 日历文件")
        print()


def run_demo():
    sample_dir = get_sample_dir()
    
    cases_path = sample_dir / "cases.csv"
    actions_path = sample_dir / "actions.jsonl"
    holiday_rules_path = sample_dir / "holiday_rules.yaml"
    jurisdiction_rules_path = sample_dir / "jurisdiction_rules.yaml"
    
    required_files = [
        cases_path,
        actions_path,
        holiday_rules_path,
        jurisdiction_rules_path
    ]
    
    missing_files = [f for f in required_files if not f.exists()]
    
    if missing_files:
        print("=" * 60)
        print("Demo 模式")
        print("=" * 60)
        print()
        print("⚠️  缺少示例数据文件:")
        for f in missing_files:
            print(f"   - {f}")
        print()
        print("请确保 sample 目录包含以下文件:")
        print("  - cases.csv")
        print("  - actions.jsonl")
        print("  - holiday_rules.yaml")
        print("  - jurisdiction_rules.yaml")
        print()
        print(f"当前搜索的 sample 目录: {sample_dir}")
        return 1
    
    print("=" * 60)
    print("Demo 模式 - 使用示例数据")
    print("=" * 60)
    print()
    
    output_dir = Path.cwd() / "demo_output"
    
    app = TrademarkDeadlinesApp(
        cases_path=str(cases_path),
        actions_path=str(actions_path),
        holiday_rules_path=str(holiday_rules_path),
        jurisdiction_rules_path=str(jurisdiction_rules_path),
        output_dir=str(output_dir)
    )
    
    return app.run()


def main():
    parser = argparse.ArgumentParser(
        description="商标案件期限复核工具 - 批量计算商标案件期限并检测风险",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用自定义数据文件
  python -m trademark_deadlines --cases cases.csv --actions actions.jsonl 
           --holidays holiday_rules.yaml --rules jurisdiction_rules.yaml
           --output ./output

  # 使用示例数据运行演示
  python -m trademark_deadlines demo
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    demo_parser = subparsers.add_parser("demo", help="使用示例数据运行演示")
    
    parser.add_argument("--cases", type=str, help="案件数据CSV文件路径")
    parser.add_argument("--actions", type=str, help="动作数据JSONL文件路径")
    parser.add_argument("--holidays", type=str, help="节假日规则YAML文件路径")
    parser.add_argument("--rules", type=str, help="司法管辖区规则YAML文件路径")
    parser.add_argument("--output", type=str, default=".", help="输出目录 (默认: 当前目录)")
    parser.add_argument("--reference-date", type=str, 
                        help="参考日期 (格式: YYYY-MM-DD, 默认: 今天)")
    parser.add_argument("--imminent-threshold", type=int, default=7,
                        help="即将到期阈值天数 (默认: 7天)")
    
    args = parser.parse_args()
    
    if args.command == "demo":
        sys.exit(run_demo())
    
    if not (args.cases and args.actions and args.holidays and args.rules):
        parser.print_help()
        print()
        print("错误: 必须提供所有数据文件路径，或使用 'demo' 命令运行示例")
        sys.exit(1)
    
    reference_date = None
    if args.reference_date:
        try:
            from datetime import datetime
            reference_date = datetime.strptime(args.reference_date, "%Y-%m-%d").date()
        except ValueError:
            print(f"错误: 无效的日期格式 '{args.reference_date}'，请使用 YYYY-MM-DD 格式")
            sys.exit(1)
    
    app = TrademarkDeadlinesApp(
        cases_path=args.cases,
        actions_path=args.actions,
        holiday_rules_path=args.holidays,
        jurisdiction_rules_path=args.rules,
        output_dir=args.output,
        reference_date=reference_date,
        imminent_threshold=args.imminent_threshold
    )
    
    sys.exit(app.run())


if __name__ == "__main__":
    main()
