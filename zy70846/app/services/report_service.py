import os
import csv
from datetime import datetime
from io import BytesIO, StringIO
from typing import Optional

import xlsxwriter

from app.schemas.reconciliation import ReconciliationRecord, ReconciliationStatus
from app.storage.memory import storage
from app.core.config import settings


class ReportService:
    def __init__(self):
        os.makedirs(settings.REPORT_PATH, exist_ok=True)
    
    def _get_discrepancy_type_label(self, dtype: str) -> str:
        labels = {
            "overstock": "盘盈",
            "understock": "盘亏",
            "expiring_soon": "临期预警",
            "sku_alias": "SKU别名",
            "over_replenish": "补货多送",
            "under_replenish": "补货少送",
            "unknown": "未知"
        }
        return labels.get(dtype, dtype)
    
    def _get_review_action_label(self, action: Optional[str]) -> str:
        labels = {
            "approve": "通过",
            "reject": "驳回",
            "revise": "修订",
            "request_more_info": "需补充材料"
        }
        return labels.get(action or "", "未处理")
    
    def _get_status_label(self, status: str) -> str:
        labels = {
            "pending": "待处理",
            "processing": "处理中",
            "reviewing": "待复核",
            "approved": "已批准",
            "rejected": "已拒绝",
            "completed": "已完成"
        }
        return labels.get(status, status)
    
    def generate_excel_report(self, reconciliation_id: str) -> BytesIO:
        record = storage.get_reconciliation(reconciliation_id)
        if not record:
            raise ValueError("对账记录不存在")
        
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        title_format = workbook.add_format({
            'bold': True, 'font_size': 14, 'align': 'center', 'valign': 'vcenter'
        })
        header_format = workbook.add_format({
            'bold': True, 'bg_color': '#D7E4BC', 'border': 1
        })
        normal_format = workbook.add_format({'border': 1})
        warning_format = workbook.add_format({'bg_color': '#FFC7CE', 'border': 1})
        success_format = workbook.add_format({'bg_color': '#C6EFCE', 'border': 1})
        
        ws_summary = workbook.add_worksheet("对账汇总")
        ws_summary.set_column('A:B', 25)
        ws_summary.set_column('C:D', 15)
        
        ws_summary.merge_range('A1:D1', f"便利店对账报告 - {record.store_name}", title_format)
        
        summary_data = [
            ["对账编号", record.id, "对账日期", record.reconciliation_date.isoformat()],
            ["门店编号", record.store_id, "门店名称", record.store_name],
            ["操作人", record.operator, "对账状态", self._get_status_label(record.status.value)],
            ["盘点记录", record.inventory_record_id, "销售记录", record.sales_record_id],
            ["补货记录", record.replenishment_record_id, "完成时间", record.completed_at.isoformat() if record.completed_at else ""],
            ["", "", "", ""],
            ["汇总统计", "", "", ""],
            ["SKU总数", record.summary.total_skus, "匹配SKU数", record.summary.matched_skus],
            ["差异SKU数", record.summary.discrepant_skus, "已解决SKU数", record.summary.resolved_skus],
            ["总库存数量", record.summary.total_inventory_qty, "总销售数量", record.summary.total_sales_qty],
            ["总补货数量", record.summary.total_replenish_qty, "理论库存", record.summary.expected_inventory],
            ["实际库存", record.summary.actual_inventory, "", ""],
            ["盘盈总数", record.summary.overstock_qty, "盘亏总数", record.summary.understock_qty],
            ["临期商品数", record.summary.expiring_skus, "SKU别名数", record.summary.alias_skus],
            ["差异总数量", record.summary.total_discrepancy_qty, "差异总金额", f"{record.summary.total_discrepancy_value:.2f}"],
        ]
        
        for row_idx, row_data in enumerate(summary_data, 2):
            for col_idx, value in enumerate(row_data):
                ws_summary.write(row_idx, col_idx, value, normal_format)
        
        ws_detail = workbook.add_worksheet("差异明细")
        headers = [
            "SKU", "商品名称", "差异类型", "差异数量", "差异金额",
            "库存数量", "销售数量", "补货数量", "理论库存", "实际库存",
            "是否SKU别名", "是否临期", "过期日期", "差异说明",
            "处理状态", "处理人", "处理意见", "处理时间"
        ]
        
        ws_detail.set_column('A:A', 15)
        ws_detail.set_column('B:B', 20)
        ws_detail.set_column('C:C', 12)
        ws_detail.set_column('D:D', 10)
        ws_detail.set_column('E:E', 12)
        ws_detail.set_column('F:H', 10)
        ws_detail.set_column('I:J', 12)
        ws_detail.set_column('K:L', 12)
        ws_detail.set_column('M:M', 12)
        ws_detail.set_column('N:N', 40)
        ws_detail.set_column('O:R', 15)
        
        for col_idx, header in enumerate(headers):
            ws_detail.write(0, col_idx, header, header_format)
        
        for row_idx, disc in enumerate(record.discrepancies, 1):
            fmt = success_format if disc.is_resolved else warning_format
            
            row_data = [
                disc.sku,
                disc.sku_name,
                self._get_discrepancy_type_label(disc.discrepancy_type.value),
                disc.discrepancy_qty,
                round(disc.discrepancy_value, 2),
                disc.inventory_qty,
                disc.sales_qty,
                disc.replenish_qty,
                disc.expected_qty,
                disc.actual_qty,
                "是" if disc.is_sku_alias else "否",
                "是" if disc.is_expiring_soon else "否",
                disc.expiry_date.isoformat() if disc.expiry_date else "",
                disc.explanation,
                "已解决" if disc.is_resolved else "待处理",
                disc.reviewer or "",
                disc.review_remark or "",
                disc.reviewed_at.isoformat() if disc.reviewed_at else ""
            ]
            
            for col_idx, value in enumerate(row_data):
                ws_detail.write(row_idx, col_idx, value, fmt)
        
        ws_audit = workbook.add_worksheet("审计日志")
        audit_headers = ["时间", "操作", "操作人", "详情"]
        ws_audit.set_column('A:A', 25)
        ws_audit.set_column('B:B', 15)
        ws_audit.set_column('C:C', 15)
        ws_audit.set_column('D:D', 50)
        
        for col_idx, header in enumerate(audit_headers):
            ws_audit.write(0, col_idx, header, header_format)
        
        audit_logs = storage.get_audit_logs(reconciliation_id)
        for row_idx, log in enumerate(audit_logs, 1):
            ws_audit.write(row_idx, 0, log.timestamp.isoformat(), normal_format)
            ws_audit.write(row_idx, 1, log.action, normal_format)
            ws_audit.write(row_idx, 2, log.operator, normal_format)
            ws_audit.write(row_idx, 3, str(log.details), normal_format)
        
        workbook.close()
        output.seek(0)
        
        filename = f"对账报告_{record.store_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        filepath = os.path.join(settings.REPORT_PATH, filename)
        with open(filepath, 'wb') as f:
            f.write(output.getvalue())
        
        output.seek(0)
        return output
    
    def generate_csv_report(self, reconciliation_id: str) -> StringIO:
        record = storage.get_reconciliation(reconciliation_id)
        if not record:
            raise ValueError("对账记录不存在")
        
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["对账汇总"])
        writer.writerow(["对账编号", record.id])
        writer.writerow(["门店名称", record.store_name])
        writer.writerow(["对账日期", record.reconciliation_date.isoformat()])
        writer.writerow(["操作人", record.operator])
        writer.writerow(["对账状态", self._get_status_label(record.status.value)])
        writer.writerow([])
        
        writer.writerow(["统计项", "数值"])
        writer.writerow(["SKU总数", record.summary.total_skus])
        writer.writerow(["匹配SKU数", record.summary.matched_skus])
        writer.writerow(["差异SKU数", record.summary.discrepant_skus])
        writer.writerow(["已解决SKU数", record.summary.resolved_skus])
        writer.writerow(["盘盈总数", record.summary.overstock_qty])
        writer.writerow(["盘亏总数", record.summary.understock_qty])
        writer.writerow(["临期商品数", record.summary.expiring_skus])
        writer.writerow(["差异总数量", record.summary.total_discrepancy_qty])
        writer.writerow(["差异总金额", f"{record.summary.total_discrepancy_value:.2f}"])
        writer.writerow([])
        
        writer.writerow(["差异明细"])
        writer.writerow([
            "SKU", "商品名称", "差异类型", "差异数量", "差异金额",
            "库存数量", "销售数量", "补货数量", "差异说明", "处理状态"
        ])
        
        for disc in record.discrepancies:
            writer.writerow([
                disc.sku,
                disc.sku_name,
                self._get_discrepancy_type_label(disc.discrepancy_type.value),
                disc.discrepancy_qty,
                round(disc.discrepancy_value, 2),
                disc.inventory_qty,
                disc.sales_qty,
                disc.replenish_qty,
                disc.explanation,
                "已解决" if disc.is_resolved else "待处理"
            ])
        
        output.seek(0)
        return output


report_service = ReportService()
