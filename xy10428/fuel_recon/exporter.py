import csv
import json
from typing import List, Dict, Any
from datetime import datetime
from .models import ReconciliationResult, MatchedResult, ReviewStatus


class Exporter:
    @staticmethod
    def export_summary_text(result: ReconciliationResult) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("车队加油卡对账报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-" * 70)

        lines.append("\n【总体统计】")
        lines.append(f"  加油记录总数: {result.total_records} 笔")
        lines.append(f"  正常记录: {result.normal_records} 笔")
        lines.append(f"  异常记录: {result.abnormal_records} 笔")
        lines.append(f"  异常率: {result.summary.get('abnormal_rate', 0)}%")
        lines.append("")
        lines.append(f"  总金额: ¥{result.total_amount:,.2f}")
        lines.append(f"  正常金额: ¥{result.normal_amount:,.2f}")
        lines.append(f"  异常金额: ¥{result.abnormal_amount:,.2f}")
        lines.append(f"  异常金额占比: {(result.abnormal_amount / result.total_amount * 100):.1f}%" if result.total_amount > 0 else "  异常金额占比: 0.0%")

        lines.append("\n【异常类型分布】")
        type_counts = result.summary.get("abnormal_type_counts", {})
        if type_counts:
            for atype, count in type_counts.items():
                lines.append(f"  {atype}: {count} 笔")
        else:
            lines.append("  无异常记录")

        lines.append("\n【待复核司机列表】")
        if result.pending_review_drivers:
            for driver, results in result.pending_review_drivers.items():
                abnormal_amt = sum(r.fuel_record.fuel_amount for r in results)
                lines.append(f"  司机: {driver}")
                lines.append(f"    待复核笔数: {len(results)} 笔, 涉及金额: ¥{abnormal_amt:,.2f}")
        else:
            lines.append("  无待复核记录")

        lines.append("\n" + "=" * 70)
        return "\n".join(lines)

    @staticmethod
    def export_detail_text(results: List[MatchedResult], plate_number: str = None) -> str:
        lines = []
        lines.append("=" * 90)
        if plate_number:
            lines.append(f"车辆 {plate_number} 加油明细")
        else:
            lines.append("全部车辆加油明细")
        lines.append("=" * 90)

        for idx, result in enumerate(results, 1):
            fuel = result.fuel_record
            lines.append(f"\n--- 第 {idx} 笔 (ID: {fuel.id}) ---")
            lines.append(f"  车牌: {fuel.plate_number}")
            lines.append(f"  加油时间: {fuel.fuel_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"  加油站: {fuel.station_name}")
            lines.append(f"  油量: {fuel.fuel_liters:.2f} L")
            lines.append(f"  金额: ¥{fuel.fuel_amount:.2f}")
            lines.append(f"  单价: ¥{fuel.unit_price:.3f}/L")
            lines.append(f"  加油卡: {fuel.card_number}")

            if result.driver_name:
                lines.append(f"  匹配司机: {result.driver_name}")
                if result.schedule:
                    lines.append(f"    排班: {result.schedule.shift_type} ({result.schedule.shift_date})")
            else:
                lines.append("  匹配司机: 未匹配（非排班时间）")

            if result.calculated_distance is not None:
                lines.append(f"  估算行驶里程: {result.calculated_distance:.1f} km")
            if result.calculated_fuel_consumption is not None:
                lines.append(f"  百公里油耗: {result.calculated_fuel_consumption:.2f} L/100km")

            lines.append(f"  状态: {'正常' if result.is_normal else '异常'}")
            if not result.is_normal:
                abnormal_names = ", ".join([at.value for at in result.abnormal_types if at.value != "正常"])
                lines.append(f"  异常类型: {abnormal_names}")

            if result.review_note:
                rn = result.review_note
                lines.append(f"\n  【复核信息】")
                lines.append(f"    复核人: {rn.reviewer}")
                lines.append(f"    复核时间: {rn.review_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"    复核状态: {rn.status.value}")
                lines.append(f"    复核结论: {rn.conclusion}")
                if rn.remarks:
                    lines.append(f"    备注: {rn.remarks}")
            else:
                if not result.is_normal:
                    lines.append("  【复核信息】待复核")

        lines.append("\n" + "=" * 90)
        return "\n".join(lines)

    @staticmethod
    def export_to_csv(result: ReconciliationResult, filepath: str):
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "序号", "加油记录ID", "车牌", "加油时间", "油量(L)", "金额(元)", "单价",
                "加油站", "加油卡", "匹配司机", "排班班次", "行驶里程(km)",
                "百公里油耗(L/100km)", "状态", "异常类型",
                "复核状态", "复核人", "复核结论",
            ])

            for idx, mr in enumerate(result.matched_results, 1):
                fuel = mr.fuel_record
                abnormal_types = ", ".join([at.value for at in mr.abnormal_types])
                review_status = mr.review_note.status.value if mr.review_note else ("待复核" if not mr.is_normal else "无需复核")
                reviewer = mr.review_note.reviewer if mr.review_note else ""
                review_conclusion = mr.review_note.conclusion if mr.review_note else ""

                writer.writerow([
                    idx, fuel.id, fuel.plate_number,
                    fuel.fuel_time.strftime("%Y-%m-%d %H:%M:%S"),
                    f"{fuel.fuel_liters:.2f}", f"{fuel.fuel_amount:.2f}",
                    f"{fuel.unit_price:.3f}", fuel.station_name, fuel.card_number,
                    mr.driver_name or "",
                    mr.schedule.shift_type if mr.schedule else "",
                    f"{mr.calculated_distance:.1f}" if mr.calculated_distance else "",
                    f"{mr.calculated_fuel_consumption:.2f}" if mr.calculated_fuel_consumption else "",
                    "正常" if mr.is_normal else "异常",
                    abnormal_types,
                    review_status, reviewer, review_conclusion,
                ])

    @staticmethod
    def export_to_json(result: ReconciliationResult, filepath: str):
        data = {
            "summary": result.summary,
            "records": [
                {
                    "fuel_record": {
                        "id": mr.fuel_record.id,
                        "plate_number": mr.fuel_record.plate_number,
                        "fuel_time": mr.fuel_record.fuel_time.isoformat(),
                        "fuel_amount": mr.fuel_record.fuel_amount,
                        "fuel_liters": mr.fuel_record.fuel_liters,
                        "unit_price": mr.fuel_record.unit_price,
                        "station_name": mr.fuel_record.station_name,
                        "card_number": mr.fuel_record.card_number,
                        "odometer": mr.fuel_record.odometer,
                    },
                    "driver_name": mr.driver_name,
                    "schedule": {
                        "driver": mr.schedule.driver_name,
                        "shift_type": mr.schedule.shift_type,
                        "shift_date": mr.schedule.shift_date.isoformat(),
                    } if mr.schedule else None,
                    "calculated_distance": mr.calculated_distance,
                    "calculated_fuel_consumption": mr.calculated_fuel_consumption,
                    "is_normal": mr.is_normal,
                    "abnormal_types": [at.value for at in mr.abnormal_types],
                    "review": {
                        "reviewer": mr.review_note.reviewer,
                        "review_time": mr.review_note.review_time.isoformat(),
                        "status": mr.review_note.status.value,
                        "conclusion": mr.review_note.conclusion,
                        "remarks": mr.review_note.remarks,
                    } if mr.review_note else None,
                }
                for mr in result.matched_results
            ],
            "pending_review_drivers": {
                driver: [mr.fuel_record.id for mr in mrs]
                for driver, mrs in result.pending_review_drivers.items()
            },
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
