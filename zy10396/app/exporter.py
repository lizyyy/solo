import io
import csv
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
import pandas as pd

from app.models import MonthlyResult, AllocationStatus
from app import crud


def export_to_dataframe(
    db: Session, month: str, status: AllocationStatus = None
) -> pd.DataFrame:
    results = crud.get_monthly_results(db, month=month, status=status)
    
    data = []
    for result in results:
        adjustments = result.adjustments
        adjustment_total = sum(adj.adjustment_amount for adj in adjustments)
        
        data.append({
            "月份": result.month,
            "调用方ID": result.caller_id,
            "调用方名称": result.caller.name if result.caller else "Unknown",
            "接口组ID": result.api_group_id,
            "接口组名称": "",
            "规则ID": result.rule_id,
            "规则版本": result.rule_version,
            "总调用次数": result.total_calls,
            "单价": result.unit_price,
            "原始成本": result.raw_cost,
            "调整金额": adjustment_total,
            "分摊后成本": result.allocated_cost,
            "状态": result.status,
            "创建时间": result.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": result.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    return pd.DataFrame(data)


def export_to_xlsx(
    db: Session, month: str, status: AllocationStatus = None
) -> bytes:
    df = export_to_dataframe(db, month, status)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="分摊结果", index=False)
        
        workbook = writer.book
        worksheet = writer.sheets["分摊结果"]
        
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    output.seek(0)
    return output.read()


def export_to_csv(
    db: Session, month: str, status: AllocationStatus = None
) -> str:
    df = export_to_dataframe(db, month, status)
    return df.to_csv(index=False, encoding="utf-8-sig")


def export_summary_to_xlsx(
    db: Session, month: str
) -> bytes:
    results = crud.get_monthly_results(db, month=month)
    
    summary_by_caller = {}
    summary_by_api_group = {}
    
    for result in results:
        caller_name = result.caller.name if result.caller else "Unknown"
        
        if caller_name not in summary_by_caller:
            summary_by_caller[caller_name] = {
                "调用方": caller_name,
                "总调用次数": 0,
                "总成本": 0.0
            }
        summary_by_caller[caller_name]["总调用次数"] += result.total_calls
        summary_by_caller[caller_name]["总成本"] += result.allocated_cost
    
    caller_df = pd.DataFrame(list(summary_by_caller.values()))
    detail_df = export_to_dataframe(db, month)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        detail_df.to_excel(writer, sheet_name="明细数据", index=False)
        caller_df.to_excel(writer, sheet_name="按调用方汇总", index=False)
        
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
    
    output.seek(0)
    return output.read()
