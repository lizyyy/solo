import json
import csv
from datetime import datetime
from typing import List, Dict, Any
from io import StringIO
from models import ProcessingResult, ValidationError


class ReportGenerator:
    @staticmethod
    def generate_human_readable(results: List[ProcessingResult], errors: List[ValidationError] = None) -> str:
        output = StringIO()
        output.write("=" * 80 + "\n")
        output.write("                    布草分拣返洗短少分级排查报告\n")
        output.write("=" * 80 + "\n")
        output.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        output.write("-" * 80 + "\n\n")

        if errors:
            output.write("【验证警告/错误信息】\n")
            for error in errors:
                prefix = "❌ 错误" if error.severity == "error" else "⚠️  警告"
                output.write(f"{prefix} [{error.field}]: {error.message}\n")
            output.write("\n" + "-" * 80 + "\n\n")

        if not results:
            output.write("【处理结果】无数据\n")
            return output.getvalue()

        total_inbound = sum(r.inbound_quantity for r in results)
        total_damage = sum(r.total_damage for r in results)
        total_rewash = sum(r.total_rewash for r in results)
        total_outbound = sum(r.outbound_quantity for r in results)
        total_shortage = sum(r.shortage for r in results)

        output.write("【汇总统计】\n")
        output.write(f"  总入库数量: {total_inbound}\n")
        output.write(f"  总破损数量: {total_damage} ({total_damage/total_inbound*100:.1f}%)\n" if total_inbound > 0 else "  总破损数量: 0\n")
        output.write(f"  总返洗数量: {total_rewash} ({total_rewash/total_inbound*100:.1f}%)\n" if total_inbound > 0 else "  总返洗数量: 0\n")
        output.write(f"  总出库数量: {total_outbound}\n")
        output.write(f"  总短少数量: {total_shortage}\n")
        output.write("\n" + "-" * 80 + "\n\n")

        output.write("【明细记录】\n")
        for i, result in enumerate(results, 1):
            output.write(f"\n记录 #{i}:\n")
            output.write(f"  酒店名称: {result.hotel_name}\n")
            output.write(f"  布草类型: {result.linen_type}\n")
            output.write(f"  入库数量: {result.inbound_quantity}\n")
            output.write(f"  破损扣减: {result.total_damage}\n")
            output.write(f"  返洗标记: {result.total_rewash}\n")
            output.write(f"  出库数量: {result.outbound_quantity}\n")
            output.write(f"  短少数量: {result.shortage}\n")
            output.write(f"  短少比例: {result.shortage_rate}%\n")
            output.write(f"  短少分级: {result.shortage_level.value}\n")
            output.write(f"  处理时间: {result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}\n")

        output.write("\n" + "=" * 80 + "\n")
        return output.getvalue()

    @staticmethod
    def generate_machine_readable(results: List[ProcessingResult], errors: List[ValidationError] = None) -> Dict[str, Any]:
        data = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "total_records": len(results),
            },
            "summary": {},
            "results": [],
            "errors": [],
        }

        if errors:
            data["errors"] = [
                {"field": e.field, "message": e.message, "severity": e.severity}
                for e in errors
            ]

        if results:
            total_inbound = sum(r.inbound_quantity for r in results)
            total_damage = sum(r.total_damage for r in results)
            total_rewash = sum(r.total_rewash for r in results)
            total_outbound = sum(r.outbound_quantity for r in results)
            total_shortage = sum(r.shortage for r in results)

            data["summary"] = {
                "total_inbound": total_inbound,
                "total_damage": total_damage,
                "total_rewash": total_rewash,
                "total_outbound": total_outbound,
                "total_shortage": total_shortage,
                "damage_rate": round(total_damage / total_inbound * 100, 2) if total_inbound > 0 else 0,
                "rewash_rate": round(total_rewash / total_inbound * 100, 2) if total_inbound > 0 else 0,
            }

            data["results"] = [
                {
                    "hotel_name": r.hotel_name,
                    "linen_type": r.linen_type,
                    "inbound_quantity": r.inbound_quantity,
                    "total_damage": r.total_damage,
                    "total_rewash": r.total_rewash,
                    "outbound_quantity": r.outbound_quantity,
                    "shortage": r.shortage,
                    "shortage_rate": r.shortage_rate,
                    "shortage_level": r.shortage_level.value,
                    "processed_at": r.processed_at.isoformat(),
                }
                for r in results
            ]

        return data

    @staticmethod
    def export_json(results: List[ProcessingResult], errors: List[ValidationError] = None, filepath: str = None) -> str:
        data = ReportGenerator.generate_machine_readable(results, errors)
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        if filepath:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(json_str)
        return json_str

    @staticmethod
    def export_csv(results: List[ProcessingResult], filepath: str = None) -> str:
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "酒店名称", "布草类型", "入库数量", "破损数量", "返洗数量",
            "出库数量", "短少数量", "短少比例(%)", "短少分级", "处理时间"
        ])

        for r in results:
            writer.writerow([
                r.hotel_name,
                r.linen_type,
                r.inbound_quantity,
                r.total_damage,
                r.total_rewash,
                r.outbound_quantity,
                r.shortage,
                r.shortage_rate,
                r.shortage_level.value,
                r.processed_at.strftime('%Y-%m-%d %H:%M:%S'),
            ])

        csv_str = output.getvalue()
        if filepath:
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                f.write(csv_str)
        return csv_str

    @staticmethod
    def export_text(results: List[ProcessingResult], errors: List[ValidationError] = None, filepath: str = None) -> str:
        text = ReportGenerator.generate_human_readable(results, errors)
        if filepath:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
        return text
