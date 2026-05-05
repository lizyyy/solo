"""导出功能模块 - Markdown追溯单和JSON审计包"""
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from roast_trace.checker import CheckEngine
from roast_trace.models import AuditPackage, BatchStatus, CheckType
from roast_trace.query import QueryEngine
from roast_trace.state import StateManager


class Exporter:
    def __init__(
        self,
        check_engine: CheckEngine,
        query_engine: QueryEngine,
        state_manager: StateManager,
    ):
        self.check_engine = check_engine
        self.query_engine = query_engine
        self.state_manager = state_manager

    def generate_trace_report_md(
        self,
        roast_batch_id: str,
        output_path: Optional[Path] = None,
    ) -> str:
        batch_data = self.query_engine.query_roast_batch(roast_batch_id)

        if "error" in batch_data:
            return f"# 错误\n\n{batch_data['error']}"

        md_lines: list[str] = []

        status_info = batch_data["status"]
        status_color = {
            "normal": "🟢",
            "hold": "🟡",
            "recall": "🔴",
            "cleared": "🟢",
        }

        md_lines.append(f"# 咖啡批次追溯单\n")
        md_lines.append(f"**批次号**: {roast_batch_id}  ")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ")

        combined_status = status_info.get("combined", "unknown")
        status_emoji = status_color.get(combined_status, "⚪")
        md_lines.append(f"**当前状态**: {status_emoji} {combined_status.upper()}  ")
        md_lines.append("")

        md_lines.append("## 状态信息\n")
        md_lines.append(f"- 自动检测状态: {status_color.get(status_info['auto_detection'], '⚪')} {status_info['auto_detection']}")
        if status_info.get("human_reviewed"):
            md_lines.append(f"- 人工复核状态: {status_color.get(status_info['human_reviewed'], '⚪')} {status_info['human_reviewed']}")
        md_lines.append("")

        roast_log = batch_data["roast_log"]
        md_lines.append("## 烘焙记录\n")
        md_lines.append(f"| 项目 | 内容 |")
        md_lines.append(f"|------|------|")
        md_lines.append(f"| 烘焙日期 | {roast_log['roast_date']} |")
        md_lines.append(f"| 烘焙师 | {roast_log['roaster']} |")
        md_lines.append(f"| 烘焙度 | {roast_log['roast_level']} |")
        md_lines.append(f"| 生豆重量 | {roast_log['green_weight_kg']} kg |")
        md_lines.append(f"| 熟豆重量 | {roast_log['roasted_weight_kg']} kg |")
        md_lines.append(f"| 总烘焙时间 | {roast_log['drop_time']} 秒 |")
        md_lines.append(f"| 出锅温度 | {roast_log['drop_temp']} °C |")
        if roast_log.get('first_crack_time'):
            md_lines.append(f"| 一爆时间 | {roast_log['first_crack_time']} 秒 |")
        if roast_log.get('first_crack_temp'):
            md_lines.append(f"| 一爆温度 | {roast_log['first_crack_temp']} °C |")
        md_lines.append("")

        md_lines.append("## 生豆来源\n")
        for i, gb in enumerate(batch_data["green_batches"], 1):
            if "error" in gb:
                md_lines.append(f"### {i}. ⚠️ 未注册批次: {gb['batch_id']}\n")
            else:
                md_lines.append(f"### {i}. 生豆批次: {gb['batch_id']}\n")
                md_lines.append(f"| 项目 | 内容 |")
                md_lines.append(f"|------|------|")
                md_lines.append(f"| 产地 | {gb['origin']} |")
                md_lines.append(f"| 品种 | {gb['variety']} |")
                md_lines.append(f"| 处理法 | {gb['process']} |")
                md_lines.append(f"| 到货日期 | {gb['arrival_date']} |")
                md_lines.append(f"| 到货数量 | {gb['quantity_kg']} kg |")
                md_lines.append(f"| 供应商 | {gb['supplier']} |")
                if gb.get('certificate'):
                    md_lines.append(f"| 认证编号 | {gb['certificate']} |")
            md_lines.append("")

        if batch_data["cupping_records"]:
            md_lines.append("## 杯测记录\n")
            for i, record in enumerate(batch_data["cupping_records"], 1):
                md_lines.append(f"### {i}. 杯测日期: {record['cupping_date']}\n")
                md_lines.append(f"- 杯测师: {record['cupper']}")
                md_lines.append(f"- 综合得分: {record['overall']}/10")
                md_lines.append(f"- 缺陷点数: {record['total_defect_points']} 点")
                md_lines.append("")

                md_lines.append("#### 分项得分\n")
                md_lines.append(f"| 项目 | 得分 |")
                md_lines.append(f"|------|------|")
                md_lines.append(f"| 干香 | {record['dry_aroma']} |")
                md_lines.append(f"| 湿香 | {record['wet_aroma']} |")
                md_lines.append(f"| 风味 | {record['flavor']} |")
                md_lines.append(f"| 余韵 | {record['aftertaste']} |")
                md_lines.append(f"| 酸度 | {record['acidity']} |")
                md_lines.append(f"| 醇厚度 | {record['body']} |")
                md_lines.append(f"| 一致性 | {record['uniformity']} |")
                md_lines.append(f"| 干净度 | {record['clean_cup']} |")
                md_lines.append(f"| 甜度 | {record['sweetness']} |")
                md_lines.append("")

                if record.get("defects"):
                    md_lines.append("#### 缺陷记录\n")
                    for defect in record["defects"]:
                        defect_type = defect.get("type", "未知")
                        points = defect.get("points", 0)
                        description = defect.get("description", "")
                        md_lines.append(f"- **{defect_type}** ({points}点): {description}")
                    md_lines.append("")

                if record.get("notes"):
                    md_lines.append(f"#### 备注\n")
                    md_lines.append(f"{record['notes']}")
                    md_lines.append("")

        if batch_data["labels"]:
            md_lines.append("## 包装贴标\n")
            for i, label in enumerate(batch_data["labels"], 1):
                md_lines.append(f"### {i}. 贴标编号: {label['label_id']}\n")
                md_lines.append(f"| 项目 | 内容 |")
                md_lines.append(f"|------|------|")
                md_lines.append(f"| 产品名称 | {label['product_name']} |")
                md_lines.append(f"| 生产批号 | {label['batch_number']} |")
                md_lines.append(f"| 净含量 | {label['net_weight_g']} g |")
                md_lines.append(f"| 贴标数量 | {label['quantity']} 份 |")
                md_lines.append(f"| 包装日期 | {label['pack_date']} |")
                md_lines.append(f"| 包装员 | {label['packer']} |")
                md_lines.append(f"| 最佳赏味期 | {label['best_before_date']} |")
                md_lines.append("")

        if batch_data["shipments"]:
            md_lines.append("## 发货记录\n")
            for i, shipment in enumerate(batch_data["shipments"], 1):
                md_lines.append(f"### {i}. 发货单号: {shipment['shipment_id']}\n")
                md_lines.append(f"| 项目 | 内容 |")
                md_lines.append(f"|------|------|")
                md_lines.append(f"| 发货日期 | {shipment['shipment_date']} |")
                md_lines.append(f"| 门店名称 | {shipment['store_name']} |")
                md_lines.append(f"| 产品名称 | {shipment['product_name']} |")
                md_lines.append(f"| 发货数量 | {shipment['quantity']} |")
                md_lines.append(f"| 状态 | {shipment['status']} |")
                if shipment.get("tracking_number"):
                    md_lines.append(f"| 运单号 | {shipment['tracking_number']} |")
                md_lines.append("")

        if batch_data["check_results"]:
            md_lines.append("## 质检告警\n")
            for i, check in enumerate(batch_data["check_results"], 1):
                severity_emoji = "🔴" if check["severity"] == "critical" else "🟡"
                md_lines.append(f"### {i}. {severity_emoji} {check['check_type']}\n")
                md_lines.append(f"- **严重程度**: {check['severity']}")
                md_lines.append(f"- **消息**: {check['message']}")
                md_lines.append(f"- **检测时间**: {check['detected_at']}")

                if check.get("details"):
                    md_lines.append("\n#### 详细信息\n")
                    for key, value in check["details"].items():
                        md_lines.append(f"- **{key}**: {value}")
                md_lines.append("")

        if batch_data["reviews"]:
            md_lines.append("## 人工复核记录\n")
            for i, review in enumerate(batch_data["reviews"], 1):
                review_status = review.get("status", "unknown")
                md_lines.append(f"### {i}. {status_color.get(review_status, '⚪')} 复核记录\n")
                md_lines.append(f"- **复核人**: {review['reviewer']}")
                md_lines.append(f"- **复核时间**: {review['review_date']}")
                md_lines.append(f"- **状态设置**: {review_status}")
                md_lines.append(f"- **备注**: {review['notes']}")
                if review.get("action_items"):
                    md_lines.append("\n#### 行动项\n")
                    for item in review["action_items"]:
                        md_lines.append(f"- [ ] {item}")
                md_lines.append("")

        md_content = "\n".join(md_lines)

        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md_content)

        return md_content

    def generate_audit_package(
        self,
        output_path: Optional[Path] = None,
        include_all: bool = True,
        flagged_only: bool = False,
    ) -> AuditPackage:
        all_check_results = self.check_engine.run_all_checks()
        flagged_batches = self.check_engine.get_all_flagged_batches()

        batches_to_include: set[str] = set()
        if flagged_only:
            batches_to_include = set(flagged_batches.keys())
        else:
            batches_to_include = set(self.check_engine.roast_logs.keys())

        audit_batches: list[dict[str, Any]] = []
        for batch_id in batches_to_include:
            batch_data = self.query_engine.query_roast_batch(batch_id)
            audit_batches.append(batch_data)

        flat_check_results: list[dict[str, Any]] = []
        for check_type, results in all_check_results.items():
            for result in results:
                if not flagged_only or result.roast_batch_id in batches_to_include:
                    flat_check_results.append(result.model_dump(mode="json"))

        all_reviews = self.state_manager.get_reviews()
        if flagged_only:
            all_reviews = [
                r for r in all_reviews
                if r.get("roast_batch_id") in batches_to_include
            ]

        package = AuditPackage(
            batches=audit_batches,
            check_results=flat_check_results,
            reviews=all_reviews,
        )

        if include_all:
            package.green_batches = [
                b.model_dump(mode="json")
                for b in self.check_engine.green_batches.values()
            ]
            package.roast_logs = [
                l.model_dump(mode="json")
                for l in self.check_engine.roast_logs.values()
            ]
            package.cupping_records = []
            for records in self.check_engine.cupping_records.values():
                package.cupping_records.extend(
                    r.model_dump(mode="json") for r in records
                )
            package.labels = []
            for labels in self.check_engine.labels.values():
                package.labels.extend(
                    l.model_dump(mode="json") for l in labels
                )
            package.shipments = [
                s.model_dump(mode="json")
                for s in self.check_engine.shipments
            ]

        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(package.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

        return package

    def generate_flagged_summary_md(self, output_path: Optional[Path] = None) -> str:
        flagged = self.query_engine.query_flagged_batches()
        summary = flagged["summary"]

        md_lines: list[str] = []
        md_lines.append(f"# 风险批次汇总报告\n")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ")
        md_lines.append("")

        md_lines.append("## 摘要\n")
        md_lines.append(f"| 统计项 | 数量 |")
        md_lines.append(f"|--------|------|")
        md_lines.append(f"| 风险批次总计 | {summary['total_flagged']} |")
        md_lines.append(f"| 🟡 需暂停出货 | {summary['hold_count']} |")
        md_lines.append(f"| 🔴 需召回 | {summary['recall_count']} |")
        md_lines.append("")

        if flagged["recall"]:
            md_lines.append("## 🔴 需召回批次\n")
            for batch in flagged["recall"]:
                md_lines.append(f"### 批次: {batch['roast_batch_id']}\n")
                md_lines.append(f"- **自动检测状态**: {batch['auto_status']}")
                if batch.get("reviewed_status"):
                    md_lines.append(f"- **人工复核状态**: {batch['reviewed_status']}")

                if batch.get("check_results"):
                    md_lines.append("\n#### 告警信息\n")
                    for check in batch["check_results"]:
                        severity_emoji = "🔴" if check["severity"] == "critical" else "🟡"
                        md_lines.append(f"- {severity_emoji} **{check['check_type']}**: {check['message']}")

                md_lines.append("")

        if flagged["hold"]:
            md_lines.append("## 🟡 需暂停出货批次\n")
            for batch in flagged["hold"]:
                md_lines.append(f"### 批次: {batch['roast_batch_id']}\n")
                md_lines.append(f"- **自动检测状态**: {batch['auto_status']}")
                if batch.get("reviewed_status"):
                    md_lines.append(f"- **人工复核状态**: {batch['reviewed_status']}")

                if batch.get("check_results"):
                    md_lines.append("\n#### 告警信息\n")
                    for check in batch["check_results"]:
                        severity_emoji = "🔴" if check["severity"] == "critical" else "🟡"
                        md_lines.append(f"- {severity_emoji} **{check['check_type']}**: {check['message']}")

                md_lines.append("")

        md_content = "\n".join(md_lines)

        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md_content)

        return md_content
