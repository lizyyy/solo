from datetime import datetime
from typing import Dict, List, Any
import json
import csv
import io
from pathlib import Path

from .models import AuditReport, Batch


class ReportExporter:
    @staticmethod
    def _serialize_datetime(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    @staticmethod
    def to_dict(report: AuditReport) -> Dict[str, Any]:
        return {
            "report_id": report.report_id,
            "created_at": report.created_at.isoformat(),
            "summary": report.summary,
            "rules": [
                {
                    "rule_id": r.rule_id,
                    "name": r.name,
                    "sample_size": r.sample_size,
                    "pass_threshold": r.pass_threshold,
                    "batch_size_range": r.batch_size_range,
                }
                for r in report.rules
            ],
            "batches": [
                {
                    "batch_id": b.batch_id,
                    "product": b.product,
                    "total_quantity": b.total_quantity,
                    "sample_quantity": b.sample_quantity,
                    "production_date": b.production_date.isoformat() if b.production_date else None,
                    "line": b.line,
                    "pass_rate": b.pass_rate,
                    "defective_count": b.defective_count,
                    "sample_count": len(b.samples),
                    "recheck_count": len(b.rechecks),
                    "merged_from": b.merged_from,
                    "samples": [
                        {
                            "sample_id": s.sample_id,
                            "is_defective": s.is_defective,
                            "effective_defective": b._is_effectively_defective(s),
                            "inspection_time": s.inspection_time.isoformat() if s.inspection_time else None,
                            "inspector": s.inspector,
                            "remark": s.remark,
                            "rework_count": s.rework_count,
                        }
                        for s in b.samples
                    ],
                    "rechecks": [
                        {
                            "sample_id": r.sample_id,
                            "original_result": r.original_result,
                            "recheck_result": r.recheck_result,
                            "recheck_time": r.recheck_time.isoformat() if r.recheck_time else None,
                            "rechecker": r.rechecker,
                            "reason": r.reason,
                        }
                        for r in b.rechecks
                    ],
                }
                for b in report.batches
            ],
            "discrepancies": report.discrepancies,
            "dirty_data_warnings": report.dirty_data_warnings,
        }

    @staticmethod
    def to_json(report: AuditReport, indent: int = 2) -> str:
        return json.dumps(ReportExporter.to_dict(report), 
                         indent=indent, ensure_ascii=False, default=ReportExporter._serialize_datetime)

    @staticmethod
    def to_text(report: AuditReport) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append(f"质检抽样复核报告")
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"生成时间: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("[概览]")
        lines.append(f"  批次总数: {report.summary.get('total_batches', 0)}")
        lines.append(f"  样本总数: {report.summary.get('total_samples', 0)}")
        lines.append(f"  复检总数: {report.summary.get('total_rechecks', 0)}")
        lines.append(f"  不合格样本: {report.summary.get('total_defective', 0)}")
        lines.append(f"  差异项数: {report.summary.get('total_discrepancies', 0)}")
        lines.append(f"  警告数量: {report.summary.get('total_warnings', 0)}")
        lines.append(f"  整体通过率: {report.summary.get('overall_pass_rate', 0):.2%}")
        lines.append("")
        
        lines.append("[批次详情]")
        for batch in report.batches:
            lines.append(f"  批次: {batch.batch_id}")
            lines.append(f"    产品: {batch.product} | 批量: {batch.total_quantity}")
            lines.append(f"    抽样: {len(batch.samples)} 样本 | 复检: {len(batch.rechecks)} 次")
            lines.append(f"    不合格: {batch.defective_count} | 通过率: {batch.pass_rate:.2%}")
            if batch.merged_from:
                lines.append(f"    合并自: {', '.join(batch.merged_from)}")
            lines.append("")
        
        if report.discrepancies:
            lines.append("[差异项]")
            for d in report.discrepancies:
                lines.append(f"  {d.get('type', 'unknown')}: 批次 {d.get('batch_id', 'N/A')}")
                if d.get('type') == 'pass_rate_mismatch':
                    lines.append(f"    申报: {d.get('declared', 0):.2%} vs 计算: {d.get('calculated', 0):.2%}")
                if d.get('type') == 'conclusion_mismatch':
                    lines.append(f"    申报: {d.get('declared')} vs 计算: {d.get('calculated')}")
                lines.append("")
        
        if report.dirty_data_warnings:
            lines.append("[脏数据警告]")
            for w in report.dirty_data_warnings:
                lines.append(f"  [{w.get('level', 'warning')}] {w.get('code')}: {w.get('message')}")
                if w.get('context'):
                    lines.append(f"    上下文: {w.get('context')}")
            lines.append("")
        
        lines.append("[抽样规则]")
        for rule in report.rules:
            lines.append(f"  {rule.rule_id}: {rule.name}")
            lines.append(f"    抽样数: {rule.sample_size} | 合格阈值: {rule.pass_threshold:.2%}")
            if rule.batch_size_range:
                lines.append(f"    适用批量: {rule.batch_size_range[0]}-{rule.batch_size_range[1]}")
            lines.append("")
        
        return "\n".join(lines)

    @staticmethod
    def to_csv(report: AuditReport) -> Dict[str, str]:
        outputs = {}
        
        batches_csv = io.StringIO()
        batches_writer = csv.writer(batches_csv)
        batches_writer.writerow([
            "批次号", "产品", "批量", "样本数", "不合格数", "通过率",
            "复检数", "合并自", "生产线", "生产日期"
        ])
        for b in report.batches:
            batches_writer.writerow([
                b.batch_id, b.product, b.total_quantity,
                len(b.samples), b.defective_count, f"{b.pass_rate:.4f}",
                len(b.rechecks), ",".join(b.merged_from) if b.merged_from else "",
                b.line or "",
                b.production_date.strftime("%Y-%m-%d") if b.production_date else ""
            ])
        outputs["batches.csv"] = batches_csv.getvalue()
        
        samples_csv = io.StringIO()
        samples_writer = csv.writer(samples_csv)
        samples_writer.writerow([
            "批次号", "样本编号", "原始结果", "最终结果",
            "检验时间", "检验员", "返工次数", "备注"
        ])
        for b in report.batches:
            for s in b.samples:
                effective = b._is_effectively_defective(s)
                samples_writer.writerow([
                    b.batch_id, s.sample_id,
                    "不合格" if s.is_defective else "合格",
                    "不合格" if effective else "合格",
                    s.inspection_time.strftime("%Y-%m-%d %H:%M") if s.inspection_time else "",
                    s.inspector or "", s.rework_count, s.remark or ""
                ])
        outputs["samples.csv"] = samples_csv.getvalue()
        
        rechecks_csv = io.StringIO()
        rechecks_writer = csv.writer(rechecks_csv)
        rechecks_writer.writerow([
            "批次号", "样本编号", "原始结果", "复检结果",
            "复检时间", "复检员", "复检原因"
        ])
        for b in report.batches:
            for r in b.rechecks:
                rechecks_writer.writerow([
                    b.batch_id, r.sample_id,
                    "不合格" if r.original_result else "合格",
                    "不合格" if r.recheck_result else "合格",
                    r.recheck_time.strftime("%Y-%m-%d %H:%M") if r.recheck_time else "",
                    r.rechecker or "", r.reason or ""
                ])
        outputs["rechecks.csv"] = rechecks_csv.getvalue()
        
        discrepancies_csv = io.StringIO()
        dis_writer = csv.writer(discrepancies_csv)
        dis_writer.writerow(["批次号", "类型", "详情"])
        for d in report.discrepancies:
            dis_writer.writerow([
                d.get("batch_id", ""),
                d.get("type", ""),
                json.dumps(d, ensure_ascii=False, default=ReportExporter._serialize_datetime)
            ])
        outputs["discrepancies.csv"] = discrepancies_csv.getvalue()
        
        warnings_csv = io.StringIO()
        warn_writer = csv.writer(warnings_csv)
        warn_writer.writerow(["时间", "级别", "编码", "消息", "上下文"])
        for w in report.dirty_data_warnings:
            warn_writer.writerow([
                w.get("timestamp", ""), w.get("level", ""), w.get("code", ""),
                w.get("message", ""), json.dumps(w.get("context", {}), ensure_ascii=False)
            ])
        outputs["warnings.csv"] = warnings_csv.getvalue()
        
        return outputs
