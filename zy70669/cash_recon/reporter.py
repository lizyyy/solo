import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import List, Tuple
from dataclasses import asdict
from .rule_engine import ProcessedRecord, DiffType, DiffLevel
from .tracker import TrackingResult
from .parser import BadRow


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate_full_report(
        self,
        records_with_tracking: List[Tuple[ProcessedRecord, TrackingResult]],
        bad_rows: List[BadRow],
        report_prefix: str = "cash_recon"
    ) -> dict:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        results = {
            "timestamp": timestamp,
            "total_records": len(records_with_tracking),
            "bad_rows_count": len(bad_rows),
            "files": {}
        }

        excel_path = self.output_dir / f"{report_prefix}_{timestamp}.xlsx"
        self._export_to_excel(records_with_tracking, bad_rows, excel_path)
        results["files"]["excel"] = str(excel_path)

        summary_path = self.output_dir / f"{report_prefix}_{timestamp}_summary.txt"
        self._export_summary(records_with_tracking, bad_rows, summary_path)
        results["files"]["summary"] = str(summary_path)

        csv_path = self.output_dir / f"{report_prefix}_{timestamp}.csv"
        self._export_to_csv(records_with_tracking, csv_path)
        results["files"]["csv"] = str(csv_path)

        return results

    def _export_to_excel(
        self,
        records_with_tracking: List[Tuple[ProcessedRecord, TrackingResult]],
        bad_rows: List[BadRow],
        file_path: Path
    ):
        main_data = []
        for record, tracking in records_with_tracking:
            row = {
                "网点编号": record.网点编号,
                "网点名称": record.网点名称,
                "日期": record.日期,
                "账面金额": round(record.账面金额, 2),
                "盘点金额": round(record.盘点金额, 2),
                "备用金余额": round(record.备用金余额, 2),
                "原始差异": round(record.原始差异, 2),
                "备用金调整额": round(record.备用金调整额, 2),
                "调整后差异": round(record.调整后差异, 2),
                "差异类型": record.差异类型.value,
                "差异级别": record.差异级别.value,
                "备注": record.备注,
                "备注含长款词": record.备注分析.has_long_keyword,
                "备注含短款词": record.备注分析.has_short_keyword,
                "备注含备用金词": record.备注分析.has_imprest_keyword,
                "备注含调整词": record.备注分析.has_imprest_adjust_keyword,
                "备注提取金额": str(record.备注分析.extracted_amounts),
                "是否新增记录": tracking.is_new,
                "是否有变更": tracking.is_changed,
                "记录哈希": tracking.current_hash,
                "来源文件": record.来源文件,
                "来源工作表": record.来源工作表 or "",
                "来源行号": record.来源行号
            }
            main_data.append(row)

        bad_data = []
        for bad in bad_rows:
            row = {
                "文件名称": bad.file_name,
                "工作表": bad.sheet_name or "",
                "行号": bad.row_number,
                "错误信息": bad.error,
                "原始数据": str(bad.original_data)
            }
            bad_data.append(row)

        summary_data = self._generate_summary_stats(records_with_tracking, bad_rows)

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            pd.DataFrame(main_data).to_excel(writer, sheet_name='处理结果', index=False)
            if bad_data:
                pd.DataFrame(bad_data).to_excel(writer, sheet_name='错误行记录', index=False)
            pd.DataFrame([{"统计项": k, "数值": v} for k, v in summary_data.items()]).to_excel(
                writer, sheet_name='统计汇总', index=False
            )

    def _export_to_csv(
        self,
        records_with_tracking: List[Tuple[ProcessedRecord, TrackingResult]],
        file_path: Path
    ):
        main_data = []
        for record, tracking in records_with_tracking:
            row = {
                "网点编号": record.网点编号,
                "网点名称": record.网点名称,
                "日期": record.日期,
                "账面金额": round(record.账面金额, 2),
                "盘点金额": round(record.盘点金额, 2),
                "备用金余额": round(record.备用金余额, 2),
                "原始差异": round(record.原始差异, 2),
                "备用金调整额": round(record.备用金调整额, 2),
                "调整后差异": round(record.调整后差异, 2),
                "差异类型": record.差异类型.value,
                "差异级别": record.差异级别.value,
                "备注": record.备注,
                "来源文件": record.来源文件,
                "来源行号": record.来源行号
            }
            main_data.append(row)
        
        pd.DataFrame(main_data).to_csv(file_path, index=False, encoding='utf-8-sig')

    def _export_summary(
        self,
        records_with_tracking: List[Tuple[ProcessedRecord, TrackingResult]],
        bad_rows: List[BadRow],
        file_path: Path
    ):
        stats = self._generate_summary_stats(records_with_tracking, bad_rows)
        
        lines = [
            "=" * 60,
            "现金长短款备用金备注归因排查报告",
            "=" * 60,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "-" * 60,
            "一、总体统计",
            "-" * 60,
            f"处理记录总数: {stats['处理记录总数']}",
            f"解析失败行数: {stats['解析失败行数']}",
            f"有效记录数: {stats['有效记录数']}",
            "",
            "-" * 60,
            "二、差异类型统计",
            "-" * 60,
        ]
        
        for dtype in DiffType:
            key = f"{dtype.value}数量"
            if key in stats:
                lines.append(f"{dtype.value}: {stats[key]}")
        
        lines.extend([
            "",
            "-" * 60,
            "三、差异级别统计",
            "-" * 60,
        ])
        
        for dlevel in DiffLevel:
            key = f"{dlevel.value}差异数量"
            if key in stats:
                lines.append(f"{dlevel.value}: {stats[key]}")
        
        lines.extend([
            "",
            "-" * 60,
            "四、金额统计",
            "-" * 60,
            f"长款总金额: {stats['长款总金额']:.2f}",
            f"短款总金额: {stats['短款总金额']:.2f}",
            f"净差异金额: {stats['净差异金额']:.2f}",
            f"备用金调整总额: {stats['备用金调整总额']:.2f}",
            "",
            "-" * 60,
            "五、追踪统计",
            "-" * 60,
            f"新增记录数: {stats['新增记录数']}",
            f"有变更记录数: {stats['有变更记录数']}",
            "",
            "=" * 60
        ])
        
        file_path.write_text("\n".join(lines), encoding='utf-8')

    def _generate_summary_stats(
        self,
        records_with_tracking: List[Tuple[ProcessedRecord, TrackingResult]],
        bad_rows: List[BadRow]
    ) -> dict:
        records = [r for r, _ in records_with_tracking]
        
        stats = {
            "处理记录总数": len(records_with_tracking) + len(bad_rows),
            "解析失败行数": len(bad_rows),
            "有效记录数": len(records_with_tracking),
            "长款总金额": sum(r.调整后差异 for r in records if r.调整后差异 > 1e-6),
            "短款总金额": sum(-r.调整后差异 for r in records if r.调整后差异 < -1e-6),
            "净差异金额": sum(r.调整后差异 for r in records),
            "备用金调整总额": sum(abs(r.备用金调整额) for r in records),
            "新增记录数": sum(1 for _, t in records_with_tracking if t.is_new),
            "有变更记录数": sum(1 for _, t in records_with_tracking if t.is_changed),
        }
        
        for dtype in DiffType:
            stats[f"{dtype.value}数量"] = sum(1 for r in records if r.差异类型 == dtype)
        
        for dlevel in DiffLevel:
            stats[f"{dlevel.value}差异数量"] = sum(1 for r in records if r.差异级别 == dlevel)
        
        return stats
