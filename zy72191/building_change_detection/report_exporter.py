import os
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    EvaluationReport, EvaluationRecord, VerificationStatus
)


class ReportExporter:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    def export_to_excel(self, report: EvaluationReport, records: List[EvaluationRecord],
                        output_dir: Optional[str] = None) -> str:
        if output_dir is None:
            output_dir = report.file_path or os.path.join(self.data_dir, "reports", report.report_id)

        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, f"{report.report_id}.xlsx")

        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            self._write_summary_sheet(writer, report, records)
            self._write_all_records_sheet(writer, records)
            self._write_stratified_sheets(writer, records)
            self._write_conflict_sheet(writer, report, records)
            self._write_missing_ref_sheet(writer, report, records)
            self._write_duplicate_sheet(writer, report, records)
            self._write_borderline_sheet(writer, report, records)
            self._write_recommendations_sheet(writer, report)

        return output_file

    def _write_summary_sheet(self, writer, report: EvaluationReport, records: List[EvaluationRecord]):
        summary_data = {
            '项目': [
                '报告ID',
                '模型版本',
                '生成时间',
                '总记录数',
                '通过数',
                '待人工确认数',
                '不通过数',
                '旧口径记录数',
                '边界记录数',
                '数据缺失数',
                '重复记录数',
                '冲突记录数',
                '引用缺失数',
            ],
            '数值': [
                report.report_id,
                report.model_version,
                report.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                report.total_records,
                len([r for r in records if r.verify_status == VerificationStatus.PASSED]),
                len([r for r in records if r.verify_status == VerificationStatus.NEED_MANUAL_CHECK]),
                len([r for r in records if r.verify_status == VerificationStatus.FAILED]),
                len([r for r in records if r.verify_status == VerificationStatus.OLD_CALIBER]),
                len(report.borderline_records),
                len([r for r in records if r.verify_status == VerificationStatus.MISSING_DATA]),
                len(report.duplicate_records),
                len(report.conflict_records),
                len(report.missing_reference_records),
            ]
        }

        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='报告概览', index=False)

    def _write_all_records_sheet(self, writer, records: List[EvaluationRecord]):
        data = []
        for r in records:
            data.append({
                '记录ID': r.record_id,
                '城市': r.city,
                '区域': r.district,
                '网格ID': r.grid_id,
                '变化类型': r.change_type.value,
                '置信度': r.confidence.value,
                '核验状态': r.verify_status.value,
                '材料来源': '、'.join([s.value for s in r.material_sources]),
                '是否缺失引用': '是' if r.has_missing_reference else '否',
                '缺失说明': r.missing_reference_note or '',
                '应用阈值': r.threshold_applied or '',
                '模型版本': r.model_version,
                '评测时间': r.eval_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                '旧口径说明': r.old_caliber_note or '',
                '冲突说明': r.conflict_note or '',
                '是否重复': '是' if r.is_duplicate else '否',
                '重复于': r.duplicate_of or '',
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='全部记录', index=False)

    def _write_stratified_sheets(self, writer, records: List[EvaluationRecord]):
        for status in VerificationStatus:
            status_records = [r for r in records if r.verify_status == status]
            if status_records:
                data = []
                for r in status_records:
                    data.append({
                        '记录ID': r.record_id,
                        '城市': r.city,
                        '区域': r.district,
                        '网格ID': r.grid_id,
                        '变化类型': r.change_type.value,
                        '置信度': r.confidence.value,
                        '材料来源': '、'.join([s.value for s in r.material_sources]),
                        '备注': self._get_record_note(r),
                    })

                df = pd.DataFrame(data)
                sheet_name = f"{status.value}记录"
                sheet_name = sheet_name[:31]
                df.to_excel(writer, sheet_name=sheet_name, index=False)

    def _get_record_note(self, record: EvaluationRecord) -> str:
        notes = []
        if record.missing_reference_note:
            notes.append(record.missing_reference_note)
        if record.old_caliber_note:
            notes.append(record.old_caliber_note)
        if record.conflict_note:
            notes.append(record.conflict_note)
        if record.is_duplicate:
            notes.append(f"重复于: {record.duplicate_of}")
        return '; '.join(notes)

    def _write_conflict_sheet(self, writer, report: EvaluationReport, records: List[EvaluationRecord]):
        if not report.conflict_records:
            return

        conflict_records = [r for r in records if r.record_id in report.conflict_records]
        data = []
        for r in conflict_records:
            data.append({
                '记录ID': r.record_id,
                '城市': r.city,
                '区域': r.district,
                '网格ID': r.grid_id,
                '变化类型': r.change_type.value,
                '当前状态': r.verify_status.value,
                '冲突说明': r.conflict_note or '存在冲突案例，请人工复核',
                '处理建议': '请业务同事核对遥感影像和现场照片，确认变化类型判定是否正确',
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='冲突清单', index=False)

    def _write_missing_ref_sheet(self, writer, report: EvaluationReport, records: List[EvaluationRecord]):
        if not report.missing_reference_records:
            return

        missing_records = [r for r in records if r.record_id in report.missing_reference_records]
        data = []
        for r in missing_records:
            data.append({
                '记录ID': r.record_id,
                '城市': r.city,
                '区域': r.district,
                '网格ID': r.grid_id,
                '变化类型': r.change_type.value,
                '当前状态': r.verify_status.value,
                '问题': r.missing_reference_note or '缺少标注材料引用',
                '处理建议': '请在标注表中补充该记录的标注材料，包含遥感影像截图、判定依据等',
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='引用缺失清单', index=False)

    def _write_duplicate_sheet(self, writer, report: EvaluationReport, records: List[EvaluationRecord]):
        if not report.duplicate_records:
            return

        dup_records = [r for r in records if r.record_id in report.duplicate_records]
        data = []
        for r in dup_records:
            data.append({
                '记录ID': r.record_id,
                '城市': r.city,
                '区域': r.district,
                '网格ID': r.grid_id,
                '变化类型': r.change_type.value,
                '重复于': r.duplicate_of or '',
                '处理建议': '请核对重复记录，保留置信度较高或材料更全的一条，删除其余重复项',
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='重复记录清单', index=False)

    def _write_borderline_sheet(self, writer, report: EvaluationReport, records: List[EvaluationRecord]):
        if not report.borderline_records:
            return

        border_records = [r for r in records if r.record_id in report.borderline_records]
        data = []
        for r in border_records:
            data.append({
                '记录ID': r.record_id,
                '城市': r.city,
                '区域': r.district,
                '网格ID': r.grid_id,
                '变化类型': r.change_type.value,
                '置信度': r.confidence.value,
                '说明': '置信度接近判定阈值，属于边界记录',
                '处理建议': '建议重点复核，可根据实际业务需求调整判定阈值，或由人工确认',
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='边界记录清单', index=False)

    def _write_recommendations_sheet(self, writer, report: EvaluationReport):
        data = []
        for i, rec in enumerate(report.recommendations, 1):
            data.append({
                '序号': i,
                '建议内容': rec,
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='处理建议', index=False)

    def export_to_text(self, report: EvaluationReport, records: List[EvaluationRecord],
                       output_dir: Optional[str] = None) -> str:
        if output_dir is None:
            output_dir = report.file_path or os.path.join(self.data_dir, "reports", report.report_id)

        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, f"{report.report_id}.txt")

        lines = []
        lines.append("=" * 60)
        lines.append("城市遥感建筑变化检测 - 评测报告")
        lines.append("=" * 60)
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"模型版本: {report.model_version}")
        lines.append(f"生成时间: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总记录数: {report.total_records}")
        lines.append("")

        lines.append("-" * 60)
        lines.append("一、统计概览")
        lines.append("-" * 60)

        for stratum, summary in report.stratified_summary.items():
            if stratum == '全部记录':
                continue
            lines.append(f"\n【{stratum}】")
            lines.append(f"  总数: {summary['总数']}")
            if '核验状态分布' in summary:
                lines.append(f"  核验状态: {summary['核验状态分布']}")

        lines.append("")
        lines.append("-" * 60)
        lines.append("二、异常记录清单")
        lines.append("-" * 60)

        if report.missing_reference_records:
            lines.append(f"\n【引用缺失记录】({len(report.missing_reference_records)}条)")
            for rid in report.missing_reference_records[:5]:
                lines.append(f"  - {rid}")
            if len(report.missing_reference_records) > 5:
                lines.append(f"  ... 还有 {len(report.missing_reference_records) - 5} 条")

        if report.conflict_records:
            lines.append(f"\n【冲突记录】({len(report.conflict_records)}条)")
            for rid in report.conflict_records[:5]:
                lines.append(f"  - {rid}")
            if len(report.conflict_records) > 5:
                lines.append(f"  ... 还有 {len(report.conflict_records) - 5} 条")

        if report.duplicate_records:
            lines.append(f"\n【重复记录】({len(report.duplicate_records)}条)")
            for rid in report.duplicate_records[:5]:
                lines.append(f"  - {rid}")
            if len(report.duplicate_records) > 5:
                lines.append(f"  ... 还有 {len(report.duplicate_records) - 5} 条")

        if report.borderline_records:
            lines.append(f"\n【边界记录】({len(report.borderline_records)}条)")
            for rid in report.borderline_records[:5]:
                lines.append(f"  - {rid}")
            if len(report.borderline_records) > 5:
                lines.append(f"  ... 还有 {len(report.borderline_records) - 5} 条")

        lines.append("")
        lines.append("-" * 60)
        lines.append("三、业务处理建议")
        lines.append("-" * 60)

        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"\n{i}. {rec}")

        lines.append("")
        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return output_file

    def export_conflict_list(self, report: EvaluationReport, records: List[EvaluationRecord],
                             output_dir: Optional[str] = None) -> str:
        if output_dir is None:
            output_dir = report.file_path or os.path.join(self.data_dir, "reports", report.report_id)

        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, "冲突清单.txt")

        lines = []
        lines.append("城市遥感建筑变化检测 - 冲突清单")
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        if not report.conflict_records:
            lines.append("本次评测无冲突记录")
        else:
            lines.append(f"共发现 {len(report.conflict_records)} 条冲突记录:")
            lines.append("")

            conflict_records = [r for r in records if r.record_id in report.conflict_records]
            for r in conflict_records:
                lines.append("-" * 40)
                lines.append(f"记录ID: {r.record_id}")
                lines.append(f"城市: {r.city}")
                lines.append(f"区域: {r.district}")
                lines.append(f"网格: {r.grid_id}")
                lines.append(f"变化类型: {r.change_type.value}")
                lines.append(f"当前状态: {r.verify_status.value}")
                lines.append(f"冲突说明: {r.conflict_note or '存在冲突案例'}")
                lines.append(f"处理建议: 请业务同事核对遥感影像，确认判定是否正确")
                lines.append("")

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return output_file
