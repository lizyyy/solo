"""业务检查逻辑模块"""
from typing import Any

from roast_trace.models import (
    BatchStatus,
    CheckResult,
    CheckType,
    CuppingRecord,
    GreenBeanBatch,
    PackagingLabel,
    RoastLog,
    ShipmentRecord,
)

DEFECT_THRESHOLD_CRITICAL = 5.0
DEFECT_THRESHOLD_WARNING = 2.0

ROAST_TIME_MIN = 300
ROAST_TIME_MAX = 900
ROAST_TEMP_MIN = 180
ROAST_TEMP_MAX = 240
FIRST_CRACK_TIME_MIN = 180
FIRST_CRACK_TIME_MAX = 480
FIRST_CRACK_TEMP_MIN = 190
FIRST_CRACK_TEMP_MAX = 210


class CheckEngine:
    def __init__(self):
        self.green_batches: dict[str, GreenBeanBatch] = {}
        self.roast_logs: dict[str, RoastLog] = {}
        self.cupping_records: dict[str, list[CuppingRecord]] = {}
        self.labels: dict[str, list[PackagingLabel]] = {}
        self.shipments: list[ShipmentRecord] = []

    def load_green_batches(self, batches: list[GreenBeanBatch]) -> None:
        for batch in batches:
            self.green_batches[batch.batch_id] = batch

    def load_roast_logs(self, logs: list[RoastLog]) -> None:
        for log in logs:
            self.roast_logs[log.roast_batch_id] = log

    def load_cupping_records(self, records: list[CuppingRecord]) -> None:
        for record in records:
            if record.roast_batch_id not in self.cupping_records:
                self.cupping_records[record.roast_batch_id] = []
            self.cupping_records[record.roast_batch_id].append(record)

    def load_labels(self, labels: list[PackagingLabel]) -> None:
        for label in labels:
            if label.roast_batch_id not in self.labels:
                self.labels[label.roast_batch_id] = []
            self.labels[label.roast_batch_id].append(label)

    def load_shipments(self, shipments: list[ShipmentRecord]) -> None:
        self.shipments.extend(shipments)

    def check_green_batch_mix(self) -> list[CheckResult]:
        results: list[CheckResult] = []
        for roast_batch_id, roast_log in self.roast_logs.items():
            unknown_batches: list[str] = []
            for green_batch_id in roast_log.green_batch_ids:
                if green_batch_id not in self.green_batches:
                    unknown_batches.append(green_batch_id)
            if unknown_batches:
                results.append(CheckResult(
                    check_type=CheckType.GREEN_BATCH_MIX,
                    roast_batch_id=roast_batch_id,
                    severity="critical",
                    message=f"烘焙批次使用了未注册的生豆批次: {', '.join(unknown_batches)}",
                    details={
                        "roast_batch_id": roast_batch_id,
                        "unknown_green_batches": unknown_batches,
                        "used_green_batches": roast_log.green_batch_ids,
                    }
                ))
        return results

    def check_roast_curve_anomaly(self) -> list[CheckResult]:
        results: list[CheckResult] = []
        for roast_batch_id, roast_log in self.roast_logs.items():
            anomalies: list[str] = []
            details: dict[str, Any] = {"roast_batch_id": roast_batch_id}

            if roast_log.drop_time < ROAST_TIME_MIN or roast_log.drop_time > ROAST_TIME_MAX:
                anomalies.append(f"烘焙时间异常: {roast_log.drop_time}秒")
                details["drop_time"] = roast_log.drop_time
                details["expected_range"] = f"{ROAST_TIME_MIN}-{ROAST_TIME_MAX}秒"

            if roast_log.drop_temp < ROAST_TEMP_MIN or roast_log.drop_temp > ROAST_TEMP_MAX:
                anomalies.append(f"出锅温度异常: {roast_log.drop_temp}°C")
                details["drop_temp"] = roast_log.drop_temp
                details["expected_temp_range"] = f"{ROAST_TEMP_MIN}-{ROAST_TEMP_MAX}°C"

            if roast_log.first_crack_time:
                if (roast_log.first_crack_time < FIRST_CRACK_TIME_MIN or
                        roast_log.first_crack_time > FIRST_CRACK_TIME_MAX):
                    anomalies.append(f"一爆时间异常: {roast_log.first_crack_time}秒")
                    details["first_crack_time"] = roast_log.first_crack_time
                    details["expected_first_crack_range"] = (
                        f"{FIRST_CRACK_TIME_MIN}-{FIRST_CRACK_TIME_MAX}秒"
                    )

            if roast_log.first_crack_temp:
                if (roast_log.first_crack_temp < FIRST_CRACK_TEMP_MIN or
                        roast_log.first_crack_temp > FIRST_CRACK_TEMP_MAX):
                    anomalies.append(f"一爆温度异常: {roast_log.first_crack_temp}°C")
                    details["first_crack_temp"] = roast_log.first_crack_temp
                    details["expected_first_crack_temp_range"] = (
                        f"{FIRST_CRACK_TEMP_MIN}-{FIRST_CRACK_TEMP_MAX}°C"
                    )

            if roast_log.roasted_weight_kg < roast_log.green_weight_kg * 0.75:
                loss_ratio = (
                    1 - roast_log.roasted_weight_kg / roast_log.green_weight_kg
                ) * 100
                anomalies.append(f"失重率过高: {loss_ratio:.1f}%")
                details["loss_ratio"] = f"{loss_ratio:.1f}%"
                details["green_weight"] = roast_log.green_weight_kg
                details["roasted_weight"] = roast_log.roasted_weight_kg

            if anomalies:
                results.append(CheckResult(
                    check_type=CheckType.ROAST_CURVE_ANOMALY,
                    roast_batch_id=roast_batch_id,
                    severity="warning" if len(anomalies) == 1 else "critical",
                    message="烘焙曲线异常: " + "; ".join(anomalies),
                    details=details
                ))
        return results

    def check_cupping_defect_exceed(self) -> list[CheckResult]:
        results: list[CheckResult] = []
        for roast_batch_id, records in self.cupping_records.items():
            for record in records:
                if record.total_defect_points >= DEFECT_THRESHOLD_CRITICAL:
                    results.append(CheckResult(
                        check_type=CheckType.CUPPING_DEFECT_EXCEED,
                        roast_batch_id=roast_batch_id,
                        severity="critical",
                        message=(
                            f"杯测缺陷点数超限: {record.total_defect_points}点 "
                            f"(阈值: {DEFECT_THRESHOLD_CRITICAL}点)"
                        ),
                        details={
                            "roast_batch_id": roast_batch_id,
                            "defect_points": record.total_defect_points,
                            "defects": record.defects,
                            "cupper": record.cupper,
                            "cupping_date": str(record.cupping_date),
                        }
                    ))
                elif record.total_defect_points >= DEFECT_THRESHOLD_WARNING:
                    results.append(CheckResult(
                        check_type=CheckType.CUPPING_DEFECT_EXCEED,
                        roast_batch_id=roast_batch_id,
                        severity="warning",
                        message=(
                            f"杯测缺陷点数警告: {record.total_defect_points}点 "
                            f"(阈值: {DEFECT_THRESHOLD_WARNING}点)"
                        ),
                        details={
                            "roast_batch_id": roast_batch_id,
                            "defect_points": record.total_defect_points,
                            "defects": record.defects,
                            "cupper": record.cupper,
                            "cupping_date": str(record.cupping_date),
                        }
                    ))
        return results

    def check_label_mismatch(self) -> list[CheckResult]:
        results: list[CheckResult] = []
        for roast_batch_id, labels in self.labels.items():
            if roast_batch_id not in self.roast_logs:
                for label in labels:
                    results.append(CheckResult(
                        check_type=CheckType.LABEL_MISMATCH,
                        roast_batch_id=roast_batch_id,
                        severity="critical",
                        message=f"贴标引用不存在的烘焙批次: {roast_batch_id}",
                        details={
                            "label_id": label.label_id,
                            "batch_number": label.batch_number,
                            "product_name": label.product_name,
                        }
                    ))
                continue

            roast_log = self.roast_logs[roast_batch_id]
            batch_numbers: set[str] = set()
            for label in labels:
                batch_numbers.add(label.batch_number)
                if label.roast_date != roast_log.roast_date:
                    results.append(CheckResult(
                        check_type=CheckType.LABEL_MISMATCH,
                        roast_batch_id=roast_batch_id,
                        severity="warning",
                        message=(
                            f"贴标烘焙日期与烘焙记录不一致: "
                            f"贴标日期={label.roast_date}, 烘焙记录日期={roast_log.roast_date}"
                        ),
                        details={
                            "label_id": label.label_id,
                            "label_roast_date": str(label.roast_date),
                            "roast_log_date": str(roast_log.roast_date),
                        }
                    ))

            if len(batch_numbers) > 1:
                results.append(CheckResult(
                    check_type=CheckType.LABEL_MISMATCH,
                    roast_batch_id=roast_batch_id,
                    severity="critical",
                    message=f"同一烘焙批次使用了多个生产批号: {', '.join(batch_numbers)}",
                    details={
                        "roast_batch_id": roast_batch_id,
                        "batch_numbers": list(batch_numbers),
                    }
                ))
        return results

    def check_shipment_risk(self, flagged_batches: set[str]) -> list[CheckResult]:
        results: list[CheckResult] = []
        for shipment in self.shipments:
            for item in shipment.items:
                roast_batch_id = item.get("roast_batch_id")
                if roast_batch_id and roast_batch_id in flagged_batches:
                    results.append(CheckResult(
                        check_type=CheckType.SHIPMENT_RISK,
                        roast_batch_id=roast_batch_id,
                        severity="critical",
                        message=(
                            f"风险批次已发货: 批次 {roast_batch_id} 通过发货单 "
                            f"{shipment.shipment_id} 发往 {shipment.store_name}"
                        ),
                        details={
                            "roast_batch_id": roast_batch_id,
                            "shipment_id": shipment.shipment_id,
                            "store_name": shipment.store_name,
                            "shipment_date": str(shipment.shipment_date),
                            "quantity": item.get("quantity", 0),
                            "product_name": item.get("product_name", ""),
                            "recipient": shipment.recipient,
                            "tracking_number": shipment.tracking_number,
                        }
                    ))
        return results

    def run_all_checks(self) -> dict[str, list[CheckResult]]:
        all_results: dict[str, list[CheckResult]] = {}

        all_results["green_batch_mix"] = self.check_green_batch_mix()
        all_results["roast_curve_anomaly"] = self.check_roast_curve_anomaly()
        all_results["cupping_defect_exceed"] = self.check_cupping_defect_exceed()
        all_results["label_mismatch"] = self.check_label_mismatch()

        flagged_batches: set[str] = set()
        for check_results in all_results.values():
            for result in check_results:
                if result.severity == "critical":
                    flagged_batches.add(result.roast_batch_id)

        all_results["shipment_risk"] = self.check_shipment_risk(flagged_batches)

        return all_results

    def get_batch_status(self, roast_batch_id: str) -> BatchStatus:
        all_results = self.run_all_checks()
        for check_results in all_results.values():
            for result in check_results:
                if result.roast_batch_id == roast_batch_id:
                    if result.severity == "critical":
                        if result.check_type == CheckType.SHIPMENT_RISK:
                            return BatchStatus.RECALL
                        return BatchStatus.HOLD
        return BatchStatus.NORMAL

    def get_all_flagged_batches(self) -> dict[str, BatchStatus]:
        flagged: dict[str, BatchStatus] = {}
        all_results = self.run_all_checks()
        for check_results in all_results.values():
            for result in check_results:
                batch_id = result.roast_batch_id
                if result.severity == "critical":
                    if result.check_type == CheckType.SHIPMENT_RISK:
                        flagged[batch_id] = BatchStatus.RECALL
                    elif batch_id not in flagged:
                        flagged[batch_id] = BatchStatus.HOLD
        return flagged
