import pandas as pd
from sqlalchemy.orm import Session
import crud, schemas, models
from datetime import datetime
import os


def export_transfer_orders(db: Session, query: schemas.TransferQuery, file_path: str, format: str = 'xlsx'):
    total, items = crud.query_transfer_orders(db, query, page=1, page_size=10000)
    
    data = []
    for item in items:
        data.append({
            '调拨单号': item.order_no,
            '展位编码': item.booth.booth_code,
            '展位名称': item.booth.name,
            '展位负责人': item.booth.manager,
            '物料编码': item.material.material_code,
            '物料名称': item.material.name,
            '物料类型': item.material.type.value,
            '规格': item.material.specification or '',
            '单位': item.material.unit,
            '调拨数量': item.quantity,
            '借用人': item.borrower,
            '操作员': item.operator,
            '调拨时间': item.transfer_time.strftime('%Y-%m-%d %H:%M:%S'),
            '预计归还时间': item.expected_return_time.strftime('%Y-%m-%d %H:%M:%S') if item.expected_return_time else '',
            '状态': item.status.value,
            '已归还数量': item.returned_quantity,
            '异常类型': item.exception_type.value if item.exception_type else '无异常',
            '异常说明': item.exception_note or '',
            '备注': item.remark or ''
        })
    
    df = pd.DataFrame(data)
    
    if format == 'xlsx':
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='调拨记录')
            
            summary = crud.get_transfer_summary(db, query)
            summary_data = {
                '统计项': ['总调拨单数', '总调拨数量', '待归还', '部分归还', '已归还', '异常'],
                '数值': [
                    summary['total_transfers'],
                    summary['total_quantity'],
                    summary['status_summary'].get('待归还', 0),
                    summary['status_summary'].get('部分归还', 0),
                    summary['status_summary'].get('已归还', 0),
                    summary['status_summary'].get('异常', 0)
                ]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, index=False, sheet_name='统计汇总')
            
            if summary['exception_summary']:
                exc_data = []
                for exc in summary['exception_summary']:
                    exc_data.append({
                        '异常类型': exc['exception_type'],
                        '单据数': exc['count'],
                        '影响数量': exc['affected_quantity']
                    })
                exc_df = pd.DataFrame(exc_data)
                exc_df.to_excel(writer, index=False, sheet_name='异常统计')
    else:
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    return total


def export_materials(db: Session, file_path: str, format: str = 'xlsx'):
    materials = crud.get_all_materials(db)
    
    data = []
    for m in materials:
        data.append({
            '物料编码': m.material_code,
            '物料名称': m.name,
            '物料类型': m.type.value,
            '规格': m.specification or '',
            '单位': m.unit,
            '总数量': m.total_quantity,
            '可用数量': m.available_quantity,
            '库存位置': m.location or '',
            '描述': m.description or ''
        })
    
    df = pd.DataFrame(data)
    
    if format == 'xlsx':
        df.to_excel(file_path, index=False, engine='openpyxl')
    else:
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    return len(materials)
