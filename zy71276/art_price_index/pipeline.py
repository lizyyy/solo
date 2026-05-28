from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

from .models import ProcessingStatus, ProcessingResult
from .importer import DirectoryImporter
from .currency import CurrencyNormalizer
from .duplicate import DuplicateDetector
from .outlier import OutlierDetector
from .index_calculator import PriceIndexCalculator
from .visualizer import IndexVisualizer
from .report import ReportGenerator


class ArtPriceIndexPipeline:
    def __init__(
        self,
        input_dir: str,
        output_dir: str,
        target_currency: str = "USD",
        period: str = "monthly",
        outlier_method: str = "robust",
    ):
        self.input_dir = input_dir
        self.output_dir = Path(output_dir)
        self.target_currency = target_currency
        self.period = period
        self.outlier_method = outlier_method

        self.importer = DirectoryImporter(input_dir)
        self.currency_normalizer = CurrencyNormalizer(target_currency)
        self.duplicate_detector = DuplicateDetector()
        self.outlier_detector = OutlierDetector(method=outlier_method)
        self.index_calculator = PriceIndexCalculator(period=period)
        self.visualizer = IndexVisualizer()
        self.report_generator = ReportGenerator()

    def run(self) -> ProcessingResult:
        print(f"\n{'='*60}")
        print("艺术品价格指数分析流水线")
        print(f"{'='*60}")
        print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"输入目录: {self.input_dir}")
        print(f"输出目录: {self.output_dir}")
        print(f"目标币种: {self.target_currency}")
        print(f"指数周期: {self.period}")
        print(f"异常检测方法: {self.outlier_method}")
        print()

        print("步骤 1/6: 导入数据...")
        result = self.importer.import_directory()
        print(f"  - 总文件: {result.total_files}")
        print(f"  - 成功: {result.successful_files}, 失败: {result.failed_files}")
        print(f"  - 总记录: {result.total_records}")
        print(f"  - 问题数: {len(result.issues)}")
        print()

        if result.total_records == 0:
            print("警告: 没有导入任何记录，提前终止")
            self._finalize(result)
            return result

        print("步骤 2/6: 币种归一化...")
        result = self.currency_normalizer.normalize_records(result)
        conv_stats = self.currency_normalizer.get_conversion_summary()
        print(f"  - 已转换币种: {sum(conv_stats.get('conversions_by_currency', {}).values())}")
        print(f"  - 支持币种: {len(conv_stats.get('supported_currencies', []))}")
        print()

        print("步骤 3/6: 检测重复记录...")
        result = self.duplicate_detector.detect_and_remove_duplicates(result)
        dup_stats = self.duplicate_detector.get_duplicate_summary()
        print(f"  - 移除重复: {dup_stats['total_duplicates_removed']}")
        print()

        print("步骤 4/6: 检测异常值 (极端价格)...")
        result = self.outlier_detector.detect_outliers(result)
        out_stats = self.outlier_detector.get_outlier_summary()
        print(f"  - 极端值排除: {out_stats['total_extreme_values_removed']}")
        if out_stats.get("outliers_by_group"):
            print(f"  - 分组详情: {out_stats['outliers_by_group']}")
        print()

        print("步骤 5/6: 计算价格指数...")
        result = self.index_calculator.calculate_index(result)
        idx_stats = self.index_calculator.get_index_summary()
        if idx_stats:
            print(f"  - 指数周期: {idx_stats.get('periods_count', 0)}")
            print(f"  - 当期指数: {idx_stats.get('current_value', 'N/A')}")
            print(f"  - 基期: {idx_stats.get('base_period', 'N/A')}")
        else:
            print("  - 指数未生成 (有效记录不足)")
        print()

        print("步骤 6/6: 生成报告和图表...")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        reports = self.report_generator.generate_all_reports(result, str(self.output_dir))
        print(f"  - 文本报告: {reports.get('text_report', 'N/A')}")
        print(f"  - JSON报告: {reports.get('json_report', 'N/A')}")
        print(f"  - 记录CSV: {reports.get('records_csv', 'N/A')}")

        charts = self.visualizer.generate_all_charts(result, str(self.output_dir))
        for name, path in charts.items():
            print(f"  - {name}: {path}")
        print()

        self._finalize(result)

        print(f"{'='*60}")
        print(f"处理完成! 状态: {result.status.value}")
        print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")

        return result

    def _finalize(self, result: ProcessingResult) -> None:
        result.completed_at = datetime.now()

        if result.status == ProcessingStatus.PROCESSING:
            if result.failed_files == 0:
                result.status = ProcessingStatus.COMPLETED
            elif result.successful_files > 0:
                result.status = ProcessingStatus.PARTIAL
            else:
                result.status = ProcessingStatus.FAILED
