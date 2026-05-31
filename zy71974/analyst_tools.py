from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import os
import csv

from models import InspectionRecord, CustomerServiceDialog, KnowledgeBaseChange
from inspection_engine import RAGInspectionEngine
from weekly_report import WeeklyReportGenerator


class AnalystTools:
    def __init__(self, engine: RAGInspectionEngine):
        self.engine = engine

    def import_inspection_sample(self, filepath: str) -> List[str]:
        """导入质检表样例"""
        imported_records = []
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"质检表文件不存在: {filepath}")

        _, ext = os.path.splitext(filepath)
        if ext.lower() == '.csv':
            imported_records = self._import_from_csv(filepath)
        elif ext.lower() in ['.xlsx', '.xls']:
            imported_records = self._import_from_excel(filepath)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        return imported_records

    def _import_from_csv(self, filepath: str) -> List[str]:
        """从CSV导入质检记录"""
        imported = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = InspectionRecord(
                    record_id=row.get('record_id', row.get('ID', '')),
                    received_at=datetime.now(),
                    question=row.get('question', row.get('问题', '')),
                    standard_answer=row.get('standard_answer', row.get('标准答案', '')),
                    initial_conclusion=row.get('initial_conclusion', row.get('初始结论', '待复核')),
                    current_conclusion=row.get('current_conclusion', row.get('当前结论', '待复核')),
                    status=row.get('status', '待补'),
                    inspection_items=row,
                    inspector=row.get('inspector', row.get('质检员', ''))
                )
                self.engine.add_inspection_record(record)
                imported.append(record.record_id)
        return imported

    def _import_from_excel(self, filepath: str) -> List[str]:
        """从Excel导入质检记录（占位实现）"""
        print(f"[提示] 请确保已安装 pandas 和 openpyxl 以支持 Excel 导入: {filepath}")
        print("[提示] 可使用 CSV 格式作为替代方案")
        return []

    def check_gray_vs_report_consistency(self, gray_data_path: str,
                                          report_data_path: str) -> Dict:
        """检查灰度结论与报表一致性"""
        inconsistencies = []

        if not os.path.exists(gray_data_path):
            return {"error": f"灰度数据文件不存在: {gray_data_path}"}
        if not os.path.exists(report_data_path):
            return {"error": f"报表数据文件不存在: {report_data_path}"}

        gray_records = self._load_comparison_data(gray_data_path)
        report_records = self._load_comparison_data(report_data_path)

        all_keys = set(gray_records.keys()) | set(report_records.keys())

        for key in all_keys:
            gray_val = gray_records.get(key, {})
            report_val = report_records.get(key, {})

            if key not in gray_records:
                inconsistencies.append({
                    "record_id": key,
                    "type": "灰度缺失",
                    "message": "灰度数据中无此记录"
                })
            elif key not in report_records:
                inconsistencies.append({
                    "record_id": key,
                    "type": "报表缺失",
                    "message": "报表数据中无此记录"
                })
            elif gray_val.get('conclusion') != report_val.get('conclusion'):
                inconsistencies.append({
                    "record_id": key,
                    "type": "结论不一致",
                    "gray_conclusion": gray_val.get('conclusion'),
                    "report_conclusion": report_val.get('conclusion'),
                    "message": f"灰度结论:{gray_val.get('conclusion')} vs 报表结论:{report_val.get('conclusion')}"
                })

        return {
            "total_checked": len(all_keys),
            "inconsistency_count": len(inconsistencies),
            "inconsistencies": inconsistencies,
            "consistency_rate": (len(all_keys) - len(inconsistencies)) / len(all_keys) if all_keys else 1.0
        }

    def _load_comparison_data(self, filepath: str) -> Dict:
        """加载对比数据（简化实现）"""
        data = {}
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rid = row.get('record_id', row.get('ID', ''))
                    if rid:
                        data[rid] = {
                            'conclusion': row.get('conclusion', row.get('结论', '')),
                            'status': row.get('status', row.get('状态', ''))
                        }
        except Exception:
            pass
        return data

    def review_before_export(self, start_date: datetime,
                              end_date: datetime) -> Dict:
        """导出周报前复核检查"""
        review_results = {
            "checks": [],
            "warnings": [],
            "recommendations": [],
            "can_export": True
        }

        records_in_period = [
            r for r in self.engine.records.values()
            if start_date <= r.received_at <= end_date
        ]

        pending_count = sum(1 for r in records_in_period if r.status.value == "待补")
        if pending_count > 0:
            review_results["warnings"].append({
                "type": "待补记录",
                "count": pending_count,
                "message": f"仍有 {pending_count} 条记录处于待补状态，导出后将标记为待处理"
            })

        modified_records = self.engine.get_modified_records()
        modified_in_period = [
            (r, c) for r, c in modified_records
            if start_date <= r.received_at <= end_date
        ]
        if modified_in_period:
            review_results["checks"].append({
                "type": "人工修改记录",
                "count": len(modified_in_period),
                "details": [r.record_id for r, _ in modified_in_period],
                "message": "请确认人工修改记录均已注明原因"
            })

        no_evidence_records = [
            r for r in records_in_period
            if r.status.value == "已确认" and not self.engine.evidence_links.get(r.record_id)
        ]
        if no_evidence_records:
            review_results["warnings"].append({
                "type": "无证据链记录",
                "count": len(no_evidence_records),
                "records": [r.record_id for r in no_evidence_records],
                "message": "部分已确认记录未关联证据，建议补充证据链接"
            })

        delayed_records = self.engine.get_delayed_dialog_records()
        delayed_in_period = [
            (r, d) for r, d in delayed_records
            if start_date <= r.received_at <= end_date
        ]
        if delayed_in_period:
            review_results["checks"].append({
                "type": "延迟对话",
                "count": len(delayed_in_period),
                "details": [f"{r.record_id}(延迟{d[0].delay_hours}h)" for r, d in delayed_in_period],
                "message": "存在延迟补录的客服对话，请确认是否影响结论"
            })

        if review_results["warnings"]:
            review_results["recommendations"].append(
                "建议处理完警告事项后再导出，如需继续请使用 force=True 参数"
            )
            review_results["can_export"] = False

        return review_results

    def generate_review_checklist(self) -> List[str]:
        """生成导出前复核检查清单"""
        return [
            "□ 质检表样例已按规范命名并放置在 sample/inspection/ 目录",
            "□ 客服对话已全部补录，延迟对话已标注 delay_hours",
            "□ 灰度结论与报表数据已比对一致",
            "□ 人工修改记录均已填写修改原因",
            "□ 已确认记录均关联了证据链接",
            "□ 待补记录已与业务方确认补录时间",
            "□ 知识库变更记录已分类标注（补材料/改结论）",
            "□ 周报数据已复核，无明显统计错误",
            "□ 已准备好对业务负责人的解释口径",
            "□ 导出文件已备份到指定目录"
        ]

    def print_operation_guide(self) -> None:
        """打印运营分析师操作指南"""
        guide = """
╔══════════════════════════════════════════════════════════════╗
║                RAG素材体检 - 运营分析师操作指南                ║
╚══════════════════════════════════════════════════════════════╝

【1. 如何放置质检表样例】
   位置: data/samples/inspection/
   格式: CSV 或 Excel
   命名规则: YYYYMMDD_批次号_来源表.csv
   必填字段: record_id(记录ID), question(问题), conclusion(结论)

【2. 去哪看灰度结论和报表不一致】
   方法: 调用 analyst_tools.check_gray_vs_report_consistency()
   输入:
     - 灰度数据路径: data/gray/YYYYMMDD_gray.csv
     - 报表数据路径: data/report/YYYYMMDD_report.csv
   输出: 不一致记录列表，包含类型和具体差异

【3. 导出质检周报前怎么复核】
   步骤:
   ① 调用 analyst_tools.review_before_export() 获取复核结果
   ② 处理所有 WARNING 级别的警告
   ③ 对照 analyst_tools.generate_review_checklist() 逐项检查
   ④ 确认无误后调用 report_generator.export_report_to_text() 导出
   ⑤ 使用 force=True 可强制导出（不推荐）

【4. 常用命令速查】
   engine.add_inspection_record()    - 添加质检记录
   engine.create_evidence_link()     - 创建证据链接
   analyst.check_gray_vs_report_consistency() - 一致性检查
   analyst.review_before_export()    - 导出前复核
   report_generator.export_report_to_text() - 导出文本报告

【5. 数据目录结构】
   data/
   ├── samples/
   │   └── inspection/    # 质检表样例
   ├── gray/              # 灰度结论数据
   ├── report/            # 报表数据
   └── output/            # 周报输出目录
        """
        print(guide)


def quick_start_example():
    """快速入门示例"""
    engine = RAGInspectionEngine()
    analyst = AnalystTools(engine)
    reporter = WeeklyReportGenerator(engine)

    print("=" * 50)
    print("RAG素材体检系统 - 快速入门")
    print("=" * 50)

    analyst.print_operation_guide()

    print("\n[提示] 运行 demo.py 查看完整演示流程")
    return engine, analyst, reporter
