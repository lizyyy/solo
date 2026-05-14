from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Optional
import json
import pandas as pd
from datetime import datetime
import os

from core.database import get_db_connection
from core.config import settings

router = APIRouter()

@router.get("/report")
async def export_report(owner: Optional[str] = None, format: str = "xlsx"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            b.batch_id,
            b.owner,
            b.data_count,
            b.status,
            b.created_at,
            vr.is_valid,
            vr.dirty_data_count,
            vr.validation_summary
        FROM batches b
        LEFT JOIN validation_results vr ON b.batch_id = vr.batch_id
        WHERE 1=1
    '''
    params = []
    
    if owner:
        query += " AND b.owner = ?"
        params.append(owner)
    
    query += " ORDER BY b.created_at DESC"
    
    cursor.execute(query, params)
    batches = cursor.fetchall()
    
    cursor.execute('''
        SELECT batch_id, node_name, error_message, failed_count, occurred_at
        FROM failed_nodes
        ORDER BY occurred_at DESC
    ''')
    failed_nodes = cursor.fetchall()
    
    cursor.execute('''
        SELECT batch_id, operator, status, before_summary, after_summary, replayed_at
        FROM replay_logs
        ORDER BY replayed_at DESC
    ''')
    replay_logs = cursor.fetchall()
    
    conn.close()
    
    df_batches = pd.DataFrame([dict(b) for b in batches])
    
    if not df_batches.empty:
        df_batches['validation_summary'] = df_batches['validation_summary'].apply(
            lambda x: json.loads(x) if x else {}
        )
        
        df_batches['总记录数'] = df_batches['validation_summary'].apply(
            lambda x: x.get('总记录数', x.get('total_records', 0))
        )
        df_batches['脏数据数'] = df_batches['validation_summary'].apply(
            lambda x: x.get('脏数据数', x.get('dirty_records', 0))
        )
        df_batches['脏数据占比'] = df_batches['validation_summary'].apply(
            lambda x: x.get('脏数据占比', x.get('dirty_rate', '0%'))
        )
        
        df_batches = df_batches.drop(columns=['validation_summary'])
    
    df_failed_nodes = pd.DataFrame([dict(n) for n in failed_nodes])
    
    df_replay = pd.DataFrame([dict(l) for l in replay_logs])
    
    if not df_replay.empty:
        df_replay['before_summary'] = df_replay['before_summary'].apply(
            lambda x: json.loads(x) if x else {}
        )
        df_replay['after_summary'] = df_replay['after_summary'].apply(
            lambda x: json.loads(x) if x else {}
        )
        
        df_replay['重放前脏数据数'] = df_replay['before_summary'].apply(
            lambda x: x.get('重放前脏数据数', x.get('dirty_count', 0))
        )
        df_replay['重放后脏数据数'] = df_replay['after_summary'].apply(
            lambda x: x.get('重放后脏数据数', x.get('dirty_count', 0))
        )
        
        df_replay = df_replay.drop(columns=['before_summary', 'after_summary'])
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ETL任务回放报告_{timestamp}.{format}"
    filepath = os.path.join(settings.DATA_DIR, filename)
    
    if format == "xlsx":
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df_batches.to_excel(writer, sheet_name='批次概览', index=False)
            
            if not df_failed_nodes.empty:
                df_by_owner = df_failed_nodes.groupby(['batch_id', 'node_name']).agg({
                    'error_message': 'count',
                    'failed_count': 'sum'
                }).reset_index()
                df_by_owner.columns = ['批次ID', '失败节点', '错误数量', '总失败次数']
                df_by_owner.to_excel(writer, sheet_name='按负责人统计', index=False)
            
            if not df_failed_nodes.empty:
                df_by_node = df_failed_nodes.groupby('node_name').agg({
                    'batch_id': 'nunique',
                    'error_message': 'count',
                    'failed_count': 'sum'
                }).reset_index()
                df_by_node.columns = ['失败节点', '影响批次', '错误数量', '总失败次数']
                df_by_node.to_excel(writer, sheet_name='按失败节点统计', index=False)
            
            if not df_replay.empty:
                df_replay.to_excel(writer, sheet_name='重放日志', index=False)
            
            summary_data = {
                '统计项': ['总批次数', '失败批次数', '已重放批次数', '总失败节点数'],
                '数值': [
                    len(df_batches),
                    len(df_batches[df_batches['status'] == 'failed']) if not df_batches.empty else 0,
                    len(df_replay['batch_id'].unique()) if not df_replay.empty else 0,
                    len(df_failed_nodes['node_name'].unique()) if not df_failed_nodes.empty else 0
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='统计摘要', index=False)
    
    elif format == "csv":
        df_batches.to_csv(filepath, index=False, encoding='utf-8-sig')
    
    return FileResponse(
        filepath,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename=filename
    )

@router.get("/detailed/{batch_id}")
async def export_batch_detail(batch_id: str, format: str = "xlsx"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM batches WHERE batch_id = ?", (batch_id,))
    batch = cursor.fetchone()
    
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="批次不存在")
    
    batch_dict = dict(batch)
    
    cursor.execute("SELECT * FROM validation_results WHERE batch_id = ? ORDER BY validated_at DESC", (batch_id,))
    validations = cursor.fetchall()
    
    cursor.execute("SELECT * FROM failed_nodes WHERE batch_id = ?", (batch_id,))
    failed_nodes = cursor.fetchall()
    
    cursor.execute("SELECT * FROM replay_logs WHERE batch_id = ? ORDER BY replayed_at DESC", (batch_id,))
    replay_logs = cursor.fetchall()
    
    conn.close()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"批次详情_{batch_id}_{timestamp}.{format}"
    filepath = os.path.join(settings.DATA_DIR, filename)
    
    basic_info = {
        '项目': ['批次ID', '负责人', '数据量', '状态', '创建时间'],
        '内容': [
            batch_dict['batch_id'],
            batch_dict['owner'],
            batch_dict['data_count'],
            batch_dict['status'],
            batch_dict['created_at']
        ]
    }
    
    df_basic = pd.DataFrame(basic_info)
    
    validation_list = []
    for v in validations:
        v_dict = dict(v)
        summary = json.loads(v_dict['validation_summary']) if v_dict.get('validation_summary') else {}
        validation_list.append({
            '校验时间': v_dict['validated_at'],
            '是否有效': v_dict['is_valid'],
            '脏数据数量': v_dict['dirty_data_count'],
            '校验摘要': str(summary)
        })
    df_validation = pd.DataFrame(validation_list)
    
    df_failed = pd.DataFrame([dict(n) for n in failed_nodes])
    
    replay_list = []
    for r in replay_logs:
        r_dict = dict(r)
        before = json.loads(r_dict['before_summary']) if r_dict.get('before_summary') else {}
        after = json.loads(r_dict['after_summary']) if r_dict.get('after_summary') else {}
        replay_list.append({
            '重放时间': r_dict['replayed_at'],
            '操作人': r_dict['operator'],
            '状态': r_dict['status'],
            '重放前摘要': str(before),
            '重放后摘要': str(after)
        })
    df_replay = pd.DataFrame(replay_list)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        df_basic.to_excel(writer, sheet_name='基本信息', index=False)
        df_validation.to_excel(writer, sheet_name='校验记录', index=False)
        if not df_failed.empty:
            df_failed.to_excel(writer, sheet_name='失败节点', index=False)
        if not df_replay.empty:
            df_replay.to_excel(writer, sheet_name='重放记录', index=False)
    
    return FileResponse(
        filepath,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename=filename
    )
