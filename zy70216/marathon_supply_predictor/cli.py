import argparse
import sys
import os
from datetime import datetime
from typing import Optional

from .models import (
    MarathonEvent, EventDataLoader, ProcessingStatus
)
from .prediction import (
    ConsumptionPredictor, ValidationChecker
)
from .report import ReportGenerator


class ProcessingPipeline:
    def __init__(self, input_file: str, output_dir: str, force: bool = False):
        self.input_file = input_file
        self.output_dir = output_dir
        self.force = force
        self.event: Optional[MarathonEvent] = None
        self.results = []
        self.status: Optional[ProcessingStatus] = None

    def run(self) -> int:
        os.makedirs(self.output_dir, exist_ok=True)

        self.status = ProcessingStatus(
            event_id="unknown",
            timestamp=datetime.now(),
            phase="initialization",
            status="running"
        )

        try:
            self.status.phase = "data_loading"
            print(f"[1/5] 正在加载赛事数据: {self.input_file}")
            self.event = EventDataLoader.load_from_json(self.input_file)
            self.status.event_id = self.event.event_id
            print(f"  ✓ 赛事名称: {self.event.name}")
            print(f"  ✓ 总人数: {self.event.total_estimated_runners}人")
            print(f"  ✓ 分段数: {len(self.event.segments)}")
            print(f"  ✓ 补给站数: {len(self.event.stations)}")

            self.status.phase = "validation"
            print(f"\n[2/5] 正在验证数据...")
            is_valid, errors = ValidationChecker.validate_event(self.event)
            if not is_valid:
                self.status.status = "failed"
                self.status.blocked_reasons = errors
                print("  ✗ 数据验证失败:")
                for err in errors:
                    print(f"    - {err}")
                self._save_status()
                return 1
            print("  ✓ 数据验证通过")

            self.status.phase = "prediction"
            print(f"\n[3/5] 正在进行消耗预测...")
            predictor = ConsumptionPredictor(self.event)
            self.results = predictor.predict_all()
            self._print_prediction_summary()

            self.status.phase = "interception_check"
            print(f"\n[4/5] 正在检查拦截条件...")
            is_intercepted, intercept_reasons = ValidationChecker.check_interception_conditions(
                self.event, self.results
            )
            if is_intercepted:
                self.status.needs_review = True
                self.status.review_reasons = intercept_reasons
                print("  ⚠ 触发拦截条件，需要人工复核:")
                for reason in intercept_reasons:
                    print(f"    - {reason}")
            else:
                print("  ✓ 未触发拦截条件")

            self.status.phase = "reporting"
            print(f"\n[5/5] 正在生成报告...")
            self.status.status = "completed"
            report_generator = ReportGenerator(
                self.event, self.results, self.status, self.output_dir
            )
            files = report_generator.generate_all()
            print("  ✓ 报告已生成:")
            for name, path in files.items():
                print(f"    - {name}: {path}")

            self._save_status()
            print(f"\n{'='*60}")
            if self.status.needs_review:
                print("处理完成，但需要人工复核！")
                print("请查看 shortage_review_*.json 和 final_report_*.txt")
                return 2
            else:
                print("处理完成，一切正常！")
                return 0

        except Exception as e:
            if self.status:
                self.status.status = "error"
                self.status.blocked_reasons = [str(e)]
                self._save_status()
            print(f"\n✗ 处理出错: {e}")
            import traceback
            traceback.print_exc()
            return 1

    def _print_prediction_summary(self):
        ok_count = sum(1 for r in self.results if r.status == "ok")
        warn_count = sum(1 for r in self.results if r.status == "warning")
        err_count = sum(1 for r in self.results if r.status == "error")

        print(f"  预测结果汇总:")
        print(f"    - 正常站点: {ok_count}")
        print(f"    - 风险站点: {warn_count}")
        print(f"    - 错误站点: {err_count}")

        if warn_count > 0:
            print(f"\n  ⚠ 风险站点明细:")
            for r in self.results:
                if r.status == "warning":
                    print(f"    - {r.station_name} ({r.distance_km}km)")

    def _save_status(self):
        if not self.status:
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        status_path = os.path.join(
            self.output_dir, f"run_status_{timestamp}.json"
        )

        with open(status_path, 'w', encoding='utf-8') as f:
            import json
            json.dump(self.status.to_dict(), f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="马拉松补给消耗预测器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  msp process -i data/sample_event.json -o output/
  msp process -i data/high_risk_event.json -o output/ --force
"""
    )

    subparsers = parser.add_subparsers(dest="command", help="命令")

    process_parser = subparsers.add_parser("process", help="处理赛事数据")
    process_parser.add_argument(
        "-i", "--input", required=True,
        help="输入赛事数据文件 (JSON格式)"
    )
    process_parser.add_argument(
        "-o", "--output", required=True,
        help="输出目录"
    )
    process_parser.add_argument(
        "-f", "--force", action="store_true",
        help="强制执行，即使存在数据问题"
    )

    args = parser.parse_args()

    if args.command == "process":
        pipeline = ProcessingPipeline(
            input_file=args.input,
            output_dir=args.output,
            force=args.force
        )
        sys.exit(pipeline.run())
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
