import io
import csv
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
import pandas as pd

from app.models import BudgetReport, Violation
from app.crud import get_budget_report


def export_report_to_csv(db: Session, report_id: int) -> bytes:
    report = get_budget_report(db, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Budget Report Export",
        f"Report ID: {report.id}",
        f"Generated At: {report.generated_at}",
        f"Total Violations: {report.total_violations}",
    ])
    writer.writerow([])

    writer.writerow([
        "Violation ID",
        "Chunk Name",
        "Violation Type",
        "Actual Size (KB)",
        "Budget Size (KB)",
        "Excess Size (KB)",
        "Growth Rate (%)",
        "Reason",
        "Needs Review",
        "Reviewed",
    ])

    for violation in report.violations:
        chunk = violation.chunk
        writer.writerow([
            violation.id,
            chunk.chunk_name if chunk else "Unknown",
            violation.violation_type.value,
            f"{violation.actual_size:.2f}" if violation.actual_size else "",
            f"{violation.budget_size:.2f}" if violation.budget_size else "",
            f"{violation.excess_size:.2f}" if violation.excess_size else "",
            f"{violation.growth_rate:.1f}" if violation.growth_rate else "",
            violation.reason or "",
            "Yes" if violation.needs_review else "No",
            "Yes" if violation.reviewed else "No",
        ])

    return output.getvalue().encode('utf-8')


def export_report_to_excel(db: Session, report_id: int) -> bytes:
    report = get_budget_report(db, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        summary_data = {
            'Item': [
                'Report ID',
                'Report Hash',
                'Generated At',
                'Artifact ID',
                'Total Violations',
                'Critical Violations',
                'Warning Violations',
                'Total Excess (KB)',
                'Is Processed',
                'Processed At',
            ],
            'Value': [
                report.id,
                report.report_hash,
                report.generated_at,
                report.artifact_id,
                report.total_violations,
                report.critical_violations,
                report.warning_violations,
                round(report.total_excess_kb, 2),
                'Yes' if report.is_processed else 'No',
                report.processed_at if report.processed_at else 'N/A',
            ],
        }
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)

        violations_data = []
        for violation in report.violations:
            chunk = violation.chunk
            violations_data.append({
                'Violation ID': violation.id,
                'Chunk Name': chunk.chunk_name if chunk else 'Unknown',
                'Violation Type': violation.violation_type.value,
                'Actual Size (KB)': round(violation.actual_size, 2) if violation.actual_size else None,
                'Budget Size (KB)': round(violation.budget_size, 2) if violation.budget_size else None,
                'Excess Size (KB)': round(violation.excess_size, 2) if violation.excess_size else None,
                'Growth Rate (%)': round(violation.growth_rate, 1) if violation.growth_rate else None,
                'Reason': violation.reason,
                'Needs Review': 'Yes' if violation.needs_review else 'No',
                'Reviewed': 'Yes' if violation.reviewed else 'No',
                'Reviewed At': violation.reviewed_at,
                'Reviewed By': violation.reviewed_by,
            })
        pd.DataFrame(violations_data).to_excel(writer, sheet_name='Violations', index=False)

        if report.artifact:
            chunks_data = []
            for chunk in report.artifact.chunks:
                chunks_data.append({
                    'Chunk Name': chunk.chunk_name,
                    'File Size (Bytes)': chunk.file_size,
                    'File Size (KB)': round(chunk.file_size / 1024, 2),
                    'Gzip Size (Bytes)': chunk.gzip_size,
                    'Budget Size (KB)': chunk.budget_size,
                    'Is Initial': 'Yes' if chunk.is_initial else 'No',
                    'Is Async': 'Yes' if chunk.is_async else 'No',
                    'Module Count': len(chunk.modules),
                })
            pd.DataFrame(chunks_data).to_excel(writer, sheet_name='Chunks', index=False)

    output.seek(0)
    return output.getvalue()


def export_multiple_reports_to_excel(db: Session, report_ids: List[int]) -> bytes:
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        all_violations = []
        summary_data = []

        for report_id in report_ids:
            report = get_budget_report(db, report_id)
            if not report:
                continue

            summary_data.append({
                'Report ID': report.id,
                'Generated At': report.generated_at,
                'Project Name': report.artifact.project_name if report.artifact else 'N/A',
                'Branch': report.artifact.branch if report.artifact else 'N/A',
                'Total Violations': report.total_violations,
                'Critical Violations': report.critical_violations,
                'Warning Violations': report.warning_violations,
                'Total Excess (KB)': round(report.total_excess_kb, 2),
                'Is Processed': 'Yes' if report.is_processed else 'No',
            })

            for violation in report.violations:
                chunk = violation.chunk
                all_violations.append({
                    'Report ID': report_id,
                    'Violation ID': violation.id,
                    'Chunk Name': chunk.chunk_name if chunk else 'Unknown',
                    'Violation Type': violation.violation_type.value,
                    'Actual Size (KB)': round(violation.actual_size, 2) if violation.actual_size else None,
                    'Budget Size (KB)': round(violation.budget_size, 2) if violation.budget_size else None,
                    'Excess Size (KB)': round(violation.excess_size, 2) if violation.excess_size else None,
                    'Reason': violation.reason,
                })

        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Reports Summary', index=False)
        pd.DataFrame(all_violations).to_excel(writer, sheet_name='All Violations', index=False)

    output.seek(0)
    return output.getvalue()
