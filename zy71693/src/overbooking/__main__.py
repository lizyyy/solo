"""航班超售补偿优化系统 - 主程序入口。

整合所有模块，提供完整的端到端工作流：
1. 数据导入与清洗
2. 异常检测
3. 概率建模（爽约率预测）
4. 成本优化
5. 情景对比
6. 风险解释
7. 报告导出
8. 回滚与人工覆盖支持

使用方式：
    python -m overbooking optimize --flight CA1234 --date 2026-06-15
    python -m overbooking optimize --sample
    python -m overbooking rollback --record-id rec_xxx --reason "数据错误"
    python -m overbooking override --record-id rec_xxx --field "optimal_overbooking.Y" --value 10
"""
from __future__ import annotations

import logging
import sys
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional

import click
from rich.logging import RichHandler

from .data_loader import DataLoader
from .probability_model import ProbabilityModel
from .cost_optimizer import CostOptimizer
from .anomaly_detector import AnomalyDetector
from .scenario_comparator import ScenarioComparator, RiskExplainer
from .rollback_manager import RollbackManager
from .report_exporter import ReportExporter, TerminalPresenter
from .sample_data import generate_all_sample_data
from .models import (
    OptimizationRequest, OptimizationResult, FlightInfo,
    DataIssue, CabinClass
)

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True, show_time=False, show_path=False)]
)
logger = logging.getLogger("overbooking")


class OverbookingSystem:
    """航班超售优化系统主类。"""

    def __init__(
        self,
        storage_path: Optional[str] = None,
        max_overbooking_ratio: float = 0.15,
        risk_threshold: float = 0.05
    ):
        self.data_loader = DataLoader()
        self.probability_model = ProbabilityModel()
        self.cost_optimizer = CostOptimizer(
            max_overbooking_ratio=max_overbooking_ratio,
            risk_threshold=risk_threshold
        )
        self.anomaly_detector = AnomalyDetector()
        self.scenario_comparator = ScenarioComparator()
        self.risk_explainer = RiskExplainer()
        self.rollback_manager = RollbackManager(storage_path=storage_path)
        self.report_exporter = ReportExporter()
        self.terminal = TerminalPresenter()

        self._last_flight_orders = None
        self._last_flight_info = None

    def run_optimization(
        self,
        flight_info_data: Dict[str, Any],
        flight_orders_data: List[Dict[str, Any]],
        no_show_history_data: List[Dict[str, Any]],
        compensation_rules_data: List[Dict[str, Any]],
        passengers_data: Optional[List[Dict[str, Any]]] = None,
        manual_override: bool = False,
        override_params: Optional[Dict[str, Any]] = None,
        output_dir: Optional[str] = None,
        created_by: str = "system",
        skip_duplicate_check: bool = False
    ) -> Optional[OptimizationResult]:
        """执行完整的超售优化流程。"""
        self.terminal.print_welcome()

        request_id = f"req_{uuid.uuid4().hex[:12]}"
        self.terminal.print_loading_status(f"处理请求 {request_id}", "🎫")

        self.terminal.print_loading_status("加载航班信息")
        flights, flight_issues = self.data_loader.load_flight_info([flight_info_data])
        if not flights:
            self.terminal.print_error("无法加载航班信息")
            return None
        flight_info = flights[0]
        self._last_flight_info = flight_info

        self.terminal.print_loading_status(f"加载 {len(flight_orders_data)} 条订单")
        orders, order_issues = self.data_loader.load_flight_orders(flight_orders_data)
        self._last_flight_orders = orders

        self.terminal.print_loading_status(f"加载 {len(no_show_history_data)} 条爽约历史")
        histories, hist_issues = self.data_loader.load_no_show_history(no_show_history_data)

        self.terminal.print_loading_status(f"加载 {len(compensation_rules_data)} 条补偿规则")
        rules, rule_issues = self.data_loader.load_compensation_rules(compensation_rules_data)

        passengers = None
        if passengers_data:
            self.terminal.print_loading_status(f"加载 {len(passengers_data)} 条旅客信息")
            passengers, pass_issues = self.data_loader.load_passengers(passengers_data)
        else:
            pass_issues = []

        all_data_issues: List[DataIssue] = []
        all_data_issues.extend(flight_issues)
        all_data_issues.extend(order_issues)
        all_data_issues.extend(hist_issues)
        all_data_issues.extend(rule_issues)
        all_data_issues.extend(pass_issues)

        consistency_issues = self.data_loader.check_data_consistency(
            orders, flights, passengers
        )
        all_data_issues.extend(consistency_issues)

        self.terminal.print_data_issues_summary(all_data_issues)

        if not skip_duplicate_check:
            is_duplicate, existing_record = self.rollback_manager.check_duplicate_request(
                OptimizationRequest(
                    request_id=request_id,
                    flight_no=flight_info.flight_no,
                    flight_date=flight_info.flight_date
                ),
                len(orders),
                len(histories)
            )
            if is_duplicate and existing_record:
                self.terminal.print_error(
                    f"检测到重复优化请求，最近一次在 "
                    f"{(datetime.now() - existing_record.created_at).total_seconds():.0f} 秒前。"
                    f"使用 --skip-duplicate-check 强制重新运行。"
                )
                return existing_record.result

        self.terminal.print_loading_status("预测旅客爽约率", "📊")
        no_show_prediction = self.probability_model.predict_no_show_rates(
            flight_orders=orders,
            no_show_histories=histories,
            passengers=passengers,
            manual_override=override_params.get("no_show_rates") if override_params else None,
            flight_info=flight_info
        )
        for warning in no_show_prediction.warnings:
            logger.warning(warning)

        self.terminal.print_loading_status("计算最优超售策略", "🎯")
        hours_before = (flight_info.scheduled_departure - datetime.now()).total_seconds() / 3600
        hours_before = max(0, hours_before)

        request = OptimizationRequest(
            request_id=request_id,
            flight_no=flight_info.flight_no,
            flight_date=flight_info.flight_date,
            manual_override=manual_override,
            override_params=override_params
        )

        opt_result = self.cost_optimizer.optimize_flight(
            request=request,
            flight_info=flight_info,
            flight_orders=orders,
            no_show_prediction=no_show_prediction,
            compensation_rules=rules,
            hours_before_flight=hours_before
        )

        self.terminal.print_loading_status("执行异常检测", "🔍")
        anomalies = self.anomaly_detector.detect_all_anomalies(
            prediction=no_show_prediction,
            no_show_histories=histories,
            compensation_rules=rules,
            optimization_result=opt_result,
            flight_info=flight_info,
            flight_orders=orders,
            data_issues=all_data_issues,
            hours_before_flight=hours_before
        )

        opt_result.anomalies = [a.to_dict() for a in anomalies]

        opt_result._flight_orders = orders

        self.terminal.print_loading_status("生成情景对比", "📈")
        scenario_comparison = self.scenario_comparator.generate_comparison(
            optimization_result=opt_result,
            flight_info=flight_info,
            flight_orders=orders,
            no_show_prediction=no_show_prediction,
            compensation_rules=rules
        )

        self.terminal.print_loading_status("生成人话解释", "💬")
        anomalies_summary = self.anomaly_detector.summarize_anomalies()
        summary = self.risk_explainer.generate_summary(
            optimization_result=opt_result,
            scenario_comparison=scenario_comparison,
            anomalies_summary=anomalies_summary
        )

        record = self.rollback_manager.save_optimization(
            request=request,
            result=opt_result,
            created_by=created_by,
            flight_orders_count=len(orders),
            no_show_count=len(histories)
        )

        self.terminal.print_scenario_comparison(scenario_comparison)
        self.terminal.print_optimization_result(
            opt_result, flight_info, summary, anomalies
        )

        if output_dir:
            md_path = Path(output_dir) / f"{flight_info.flight_no}_{flight_info.flight_date}_report.md"
            json_path = Path(output_dir) / f"{flight_info.flight_no}_{flight_info.flight_date}_report.json"

            manual_overrides = self.rollback_manager.get_override_summary(record.record_id)

            self.report_exporter.export_markdown(
                optimization_result=opt_result,
                flight_info=flight_info,
                scenario_comparison=scenario_comparison,
                anomalies=anomalies,
                summary=summary,
                manual_overrides=manual_overrides,
                data_issues=all_data_issues,
                output_path=str(md_path)
            )

            self.report_exporter.export_json(
                optimization_result=opt_result,
                flight_info=flight_info,
                scenario_comparison=scenario_comparison,
                anomalies=anomalies,
                summary=summary,
                manual_overrides=manual_overrides,
                data_issues=all_data_issues,
                output_path=str(json_path)
            )

            self.terminal.print_report_saved(str(md_path), str(json_path))

        return opt_result

    def rollback_record(
        self,
        record_id: str,
        reason: str,
        rolled_back_by: str = "user"
    ) -> bool:
        """回滚指定的优化记录。"""
        success = self.rollback_manager.rollback(record_id, reason, rolled_back_by)
        if success:
            self.terminal.print_rollback_success(record_id)
        else:
            self.terminal.print_error(f"回滚失败：记录 {record_id} 不存在或已回滚")
        return success

    def apply_override(
        self,
        record_id: str,
        field_name: str,
        new_value: Any,
        reason: str,
        applied_by: str = "user"
    ) -> bool:
        """应用人工覆盖。"""
        override = self.rollback_manager.apply_manual_override(
            record_id, field_name, new_value, reason, applied_by
        )
        if override:
            self.terminal.print_override_success(
                field_name, override.old_value, override.new_value
            )
            return True
        else:
            self.terminal.print_error(f"人工覆盖失败")
            return False

    def get_flight_history(self, flight_no: str, flight_date: str) -> List[Dict[str, Any]]:
        """获取航班的优化历史。"""
        records = self.rollback_manager.get_flight_history(
            flight_no, flight_date, include_rolled_back=True
        )
        history = []
        for r in records:
            history.append({
                "record_id": r.record_id,
                "created_at": r.created_at.isoformat(),
                "created_by": r.created_by,
                "status": r.status,
                "optimal_overbooking": {
                    c.value: v for c, v in r.result.optimal_overbooking.items()
                },
                "rollback_reason": r.rollback_reason
            })
        return history

    def get_statistics(self) -> Dict[str, Any]:
        """获取系统统计信息。"""
        return self.rollback_manager.get_statistics()


@click.group()
@click.option("--storage-path", type=click.Path(), default="./data/records",
              help="记录存储路径")
@click.option("--max-overbooking-ratio", type=float, default=0.15,
              help="最大超售比例")
@click.option("--risk-threshold", type=float, default=0.05,
              help="可接受的超售概率阈值")
@click.pass_context
def cli(ctx, storage_path, max_overbooking_ratio, risk_threshold):
    """航班超售补偿优化系统 - 基于概率建模的智能决策工具。"""
    ctx.ensure_object(dict)
    ctx.obj["system"] = OverbookingSystem(
        storage_path=storage_path,
        max_overbooking_ratio=max_overbooking_ratio,
        risk_threshold=risk_threshold
    )


@cli.command()
@click.option("--flight", required=False, help="航班号，如 CA1234")
@click.option("--date", required=False, help="航班日期，如 2026-06-15")
@click.option("--sample", is_flag=True, help="使用示例数据运行")
@click.option("--orders-file", type=click.Path(exists=True), help="订单CSV文件")
@click.option("--history-file", type=click.Path(exists=True), help="爽约历史CSV文件")
@click.option("--flight-file", type=click.Path(exists=True), help="航班信息CSV文件")
@click.option("--passengers-file", type=click.Path(exists=True), help="旅客名单CSV文件")
@click.option("--rules-file", type=click.Path(exists=True), help="补偿规则CSV文件")
@click.option("--output-dir", type=click.Path(), default="./output",
              help="报告输出目录")
@click.option("--override-no-show-rate", type=(str, float), multiple=True,
              help="人工覆盖爽约率，如 Y=0.15 C=0.08")
@click.option("--override-max-overbooking", type=(str, int), multiple=True,
              help="人工覆盖最大超售数，如 Y=20 C=5")
@click.option("--created-by", default="user", help="操作人")
@click.option("--skip-duplicate-check", is_flag=True,
              help="跳过重复请求检测")
@click.pass_context
def optimize(
    ctx, flight, date, sample, orders_file, history_file,
    flight_file, passengers_file, rules_file, output_dir,
    override_no_show_rate, override_max_overbooking,
    created_by, skip_duplicate_check
):
    """执行航班超售优化。"""
    system: OverbookingSystem = ctx.obj["system"]

    override_params = {}
    if override_no_show_rate:
        override_params["no_show_rates"] = dict(override_no_show_rate)
    if override_max_overbooking:
        override_params["max_overbooking"] = dict(override_max_overbooking)

    manual_override = len(override_params) > 0

    try:
        if sample:
            data = generate_all_sample_data(flight_no=flight or "CA1234")
            result = system.run_optimization(
                flight_info_data=data["flight_info"],
                flight_orders_data=data["flight_orders"],
                no_show_history_data=data["no_show_history"],
                compensation_rules_data=data["compensation_rules"],
                passengers_data=data["passengers"],
                manual_override=manual_override,
                override_params=override_params if manual_override else None,
                output_dir=output_dir,
                created_by=created_by,
                skip_duplicate_check=skip_duplicate_check
            )
        else:
            if not (flight and date and orders_file and history_file and flight_file):
                raise click.UsageError(
                    "必须提供 --flight --date --orders-file --history-file --flight-file，"
                    "或使用 --sample"
                )

            flight_info_data_list, _ = system.data_loader.load_from_csv(flight_file, "flight_info")
            flight_info_data = None
            for fi in flight_info_data_list:
                if fi.flight_no == flight and str(fi.flight_date) == date:
                    flight_info_data = {
                        "flight_no": fi.flight_no,
                        "flight_date": fi.flight_date.isoformat(),
                        "departure": fi.departure,
                        "arrival": fi.arrival,
                        "scheduled_departure": fi.scheduled_departure.isoformat(),
                        "capacity": {c.value: v for c, v in fi.capacity.items()}
                    }
                    break

            if not flight_info_data:
                system.terminal.print_error(f"未找到航班 {flight} {date} 的信息")
                return

            orders, _ = system.data_loader.load_from_csv(orders_file, "flight_orders")
            orders_data = [o.model_dump() for o in orders]

            histories, _ = system.data_loader.load_from_csv(history_file, "no_show_history")
            histories_data = [h.model_dump() for h in histories]

            rules_data = None
            if rules_file:
                rules, _ = system.data_loader.load_from_csv(rules_file, "compensation_rules")
                rules_data = [r.model_dump() for r in rules]
            else:
                from .sample_data import generate_compensation_rules
                rules_data = generate_compensation_rules()

            passengers_data = None
            if passengers_file:
                passengers, _ = system.data_loader.load_from_csv(passengers_file, "passengers")
                passengers_data = [p.model_dump() for p in passengers]

            result = system.run_optimization(
                flight_info_data=flight_info_data,
                flight_orders_data=orders_data,
                no_show_history_data=histories_data,
                compensation_rules_data=rules_data,
                passengers_data=passengers_data,
                manual_override=manual_override,
                override_params=override_params if manual_override else None,
                output_dir=output_dir,
                created_by=created_by,
                skip_duplicate_check=skip_duplicate_check
            )

        if result is None:
            sys.exit(1)

    except Exception as e:
        logger.exception(f"优化执行失败: {e}")
        sys.exit(1)


@cli.command()
@click.option("--record-id", required=True, help="要回滚的记录ID")
@click.option("--reason", required=True, help="回滚原因")
@click.option("--rolled-back-by", default="user", help="操作人")
@click.pass_context
def rollback(ctx, record_id, reason, rolled_back_by):
    """回滚指定的优化记录。"""
    system: OverbookingSystem = ctx.obj["system"]
    success = system.rollback_record(record_id, reason, rolled_back_by)
    sys.exit(0 if success else 1)


@cli.command()
@click.option("--record-id", required=True, help="记录ID")
@click.option("--field", required=True,
              help="要覆盖的字段，如 optimal_overbooking.Y 或 expected_no_show_rate.C")
@click.option("--value", required=True, help="新值")
@click.option("--reason", required=True, help="覆盖原因")
@click.option("--applied-by", default="user", help="操作人")
@click.pass_context
def override(ctx, record_id, field, value, reason, applied_by):
    """人工覆盖优化结果中的某个字段。

    示例：
    overbooking override --record-id rec_xxx --field optimal_overbooking.Y --value 15 --reason "旺季需求高"
    overbooking override --record-id rec_xxx --field expected_no_show_rate.Y --value 0.12 --reason "近期爽约率上升"
    """
    system: OverbookingSystem = ctx.obj["system"]

    try:
        if field.startswith("optimal_overbooking") or field.startswith("expected_no_show_rate"):
            parts = field.split(".")
            if len(parts) == 2 and parts[1] in ["F", "C", "W", "Y"]:
                if parts[0] == "optimal_overbooking":
                    value = int(value)
                else:
                    value = float(value)
        success = system.apply_override(
            record_id, field, value, reason, applied_by
        )
        sys.exit(0 if success else 1)
    except ValueError as e:
        system.terminal.print_error(f"值格式错误: {e}")
        sys.exit(1)


@cli.command(name="list")
@click.option("--flight", required=True, help="航班号")
@click.option("--date", required=True, help="航班日期")
@click.pass_context
def list_history(ctx, flight, date):
    """查看航班的优化历史。"""
    system: OverbookingSystem = ctx.obj["system"]
    history = system.get_flight_history(flight, date)

    if not history:
        system.terminal.print_error(f"未找到航班 {flight} {date} 的优化记录")
        sys.exit(1)

    system.terminal.print_success(f"找到 {len(history)} 条历史记录：")
    for h in history:
        status_color = {
            "active": "[green]",
            "rolled_back": "[red]"
        }
        status_str = f"{status_color.get(h['status'], '')}{h['status'].upper()}[/]"
        ob_str = ", ".join(f"{c}={v}" for c, v in h["optimal_overbooking"].items())
        system.console.print(
            f"  {h['record_id']} | {h['created_at']} | {status_str} | "
            f"超售: {ob_str} | {h.get('rollback_reason', '')}"
        )


@cli.command()
@click.pass_context
def stats(ctx):
    """查看系统统计信息。"""
    system: OverbookingSystem = ctx.obj["system"]
    stats = system.get_statistics()

    system.console.print()
    system.console.print("[bold]📊 系统统计[/]")
    system.console.print(f"  总记录数: {stats['total_records']}")
    system.console.print(f"  有效记录: {stats['active_records']}")
    system.console.print(f"  已回滚: {stats['rolled_back_records']}")
    system.console.print(f"  覆盖航班: {stats['unique_flights']}")
    system.console.print(f"  人工覆盖: {stats['total_manual_overrides']} 次")
    system.console.print()


def main():
    """主函数入口。"""
    cli(obj={})


if __name__ == "__main__":
    main()
