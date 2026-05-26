import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas


def export_penalty_records_to_excel(
    db: Session,
    records: List[models.PenaltyRecord],
) -> BytesIO:
    data = []
    for record in records:
        data.append({
            "记录ID": record.id,
            "批次ID": record.batch_id,
            "运单号": record.waybill_no,
            "规则编码": record.rule_code or "",
            "规则名称": record.rule_name or "",
            "异常类型": record.exception_type,
            "异常原因": record.exception_reason,
            "中转节点": record.transfer_node or "",
            "扣罚比例": f"{record.penalty_ratio * 100:.1f}%",
            "扣罚金额": record.penalty_amount,
            "天气免责": "是" if record.is_weather_exempt else "否",
            "天气原因": record.weather_reason or "",
            "跨中转责任": "是" if record.is_cross_transfer else "否",
            "跨中转详情": record.cross_transfer_detail or "",
            "重复扣罚": "是" if record.is_duplicate else "否",
            "原始记录ID": record.original_penalty_id or "",
            "状态": record.status,
            "处理结果": record.process_result or "",
            "处理原因": record.process_reason or "",
            "处理人": record.processed_by or "",
            "处理时间": record.processed_at.strftime("%Y-%m-%d %H:%M:%S") if record.processed_at else "",
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="扣罚明细", index=False)

        workbook = writer.book
        worksheet = writer.sheets["扣罚明细"]

        header_format = workbook.add_format({
            "bold": True,
            "bg_color": "#D9E1F2",
            "border": 1,
            "align": "center",
            "valign": "vcenter",
        })

        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)

        for i, col in enumerate(df.columns):
            max_len = max(
                df[col].astype(str).map(len).max(),
                len(str(col))
            ) + 2
            worksheet.set_column(i, i, min(max_len, 50))

    output.seek(0)
    return output


def export_batch_report_to_excel(
    db: Session,
    batch_id: int,
    records: List[models.PenaltyRecord],
) -> BytesIO:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")

    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        summary_data = [{
            "批次号": batch.batch_no,
            "批次名称": batch.name,
            "创建人": batch.created_by,
            "创建时间": batch.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "状态": batch.status,
            "运单总数": db.query(models.Waybill).filter(models.Waybill.batch_id == batch_id).count(),
            "异常记录数": len(records),
            "待处理数": sum(1 for r in records if r.status == "pending"),
            "已通过数": sum(1 for r in records if r.status == "approved"),
            "已驳回数": sum(1 for r in records if r.status == "rejected"),
            "已退回数": sum(1 for r in records if r.status == "returned"),
            "待补材料数": sum(1 for r in records if r.status == "supplement"),
            "已放行数": sum(1 for r in records if r.status == "released"),
            "总扣罚金额": sum(r.penalty_amount for r in records if r.status in ["approved"]),
        }]
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name="批次汇总", index=False)

        workbook = writer.book
        summary_worksheet = writer.sheets["批次汇总"]
        for i, col in enumerate(df_summary.columns):
            max_len = max(
                df_summary[col].astype(str).map(len).max(),
                len(str(col))
            ) + 2
            summary_worksheet.set_column(i, i, min(max_len, 40))

        detail_data = []
        for record in records:
            detail_data.append({
                "记录ID": record.id,
                "运单号": record.waybill_no,
                "异常类型": record.exception_type,
                "异常原因": record.exception_reason,
                "中转节点": record.transfer_node or "",
                "扣罚比例": f"{record.penalty_ratio * 100:.1f}%",
                "扣罚金额": record.penalty_amount,
                "天气免责": "是" if record.is_weather_exempt else "否",
                "跨中转责任": "是" if record.is_cross_transfer else "否",
                "重复扣罚": "是" if record.is_duplicate else "否",
                "状态": record.status,
                "处理结果": record.process_result or "",
                "处理原因": record.process_reason or "",
                "处理人": record.processed_by or "",
                "处理时间": record.processed_at.strftime("%Y-%m-%d %H:%M:%S") if record.processed_at else "",
            })

        df_detail = pd.DataFrame(detail_data)
        df_detail.to_excel(writer, sheet_name="扣罚明细", index=False)

        detail_worksheet = writer.sheets["扣罚明细"]
        header_format = workbook.add_format({
            "bold": True,
            "bg_color": "#D9E1F2",
            "border": 1,
            "align": "center",
            "valign": "vcenter",
        })
        for col_num, value in enumerate(df_detail.columns.values):
            detail_worksheet.write(0, col_num, value, header_format)

        for i, col in enumerate(df_detail.columns):
            max_len = max(
                df_detail[col].astype(str).map(len).max(),
                len(str(col))
            ) + 2
            detail_worksheet.set_column(i, i, min(max_len, 50))

    output.seek(0)
    return output


def export_record_traceability_to_excel(
    db: Session,
    record_id: int,
) -> BytesIO:
    detail = db.query(models.PenaltyRecord).filter(models.PenaltyRecord.id == record_id).first()
    if not detail:
        raise ValueError("记录不存在")

    waybill = db.query(models.Waybill).filter(models.Waybill.id == detail.waybill_id).first()
    tracking = db.query(models.TrackingRecord).filter(
        models.TrackingRecord.waybill_id == detail.waybill_id
    ).order_by(models.TrackingRecord.timestamp.asc()).all()
    histories = db.query(models.ProcessHistory).filter(
        models.ProcessHistory.penalty_record_id == record_id
    ).order_by(models.ProcessHistory.operated_at.asc()).all()

    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        record_data = [{
            "记录ID": detail.id,
            "运单号": detail.waybill_no,
            "批次ID": detail.batch_id,
            "异常类型": detail.exception_type,
            "异常原因": detail.exception_reason,
            "中转节点": detail.transfer_node or "",
            "扣罚比例": f"{detail.penalty_ratio * 100:.1f}%",
            "扣罚金额": detail.penalty_amount,
            "天气免责": "是" if detail.is_weather_exempt else "否",
            "天气原因": detail.weather_reason or "",
            "跨中转责任": "是" if detail.is_cross_transfer else "否",
            "跨中转详情": detail.cross_transfer_detail or "",
            "重复扣罚": "是" if detail.is_duplicate else "否",
            "原始记录ID": detail.original_penalty_id or "",
            "状态": detail.status,
            "处理结果": detail.process_result or "",
            "处理原因": detail.process_reason or "",
            "处理人": detail.processed_by or "",
            "处理时间": detail.processed_at.strftime("%Y-%m-%d %H:%M:%S") if detail.processed_at else "",
            "创建时间": detail.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }]
        pd.DataFrame(record_data).to_excel(writer, sheet_name="扣罚记录", index=False)

        if waybill:
            waybill_data = [{
                "运单号": waybill.waybill_no,
                "发货人": waybill.sender or "",
                "收货人": waybill.receiver or "",
                "始发地": waybill.origin or "",
                "目的地": waybill.destination or "",
                "重量(kg)": waybill.weight or "",
                "体积(m³)": waybill.volume or "",
                "预计送达": waybill.expected_delivery.strftime("%Y-%m-%d %H:%M:%S") if waybill.expected_delivery else "",
                "实际送达": waybill.actual_delivery.strftime("%Y-%m-%d %H:%M:%S") if waybill.actual_delivery else "",
                "运单状态": waybill.status,
            }]
            pd.DataFrame(waybill_data).to_excel(writer, sheet_name="运单信息", index=False)

        if tracking:
            tracking_data = []
            for t in tracking:
                tracking_data.append({
                    "时间": t.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "节点": t.node,
                    "节点类型": t.node_type or "",
                    "状态": t.status,
                    "操作人": t.operator or "",
                    "位置": t.location or "",
                    "温度(℃)": t.temperature if t.temperature is not None else "",
                    "备注": t.remark or "",
                })
            pd.DataFrame(tracking_data).to_excel(writer, sheet_name="轨迹信息", index=False)

        if histories:
            history_data = []
            for h in histories:
                history_data.append({
                    "操作时间": h.operated_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "操作动作": h.action,
                    "原状态": h.old_status or "",
                    "新状态": h.new_status or "",
                    "操作原因": h.reason,
                    "操作人": h.operator,
                })
            pd.DataFrame(history_data).to_excel(writer, sheet_name="处理历史", index=False)

        workbook = writer.book
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            for i in range(worksheet.dim_colmax + 1):
                worksheet.set_column(i, i, 25)

    output.seek(0)
    return output
