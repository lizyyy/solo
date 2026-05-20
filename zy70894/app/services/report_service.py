import pandas as pd
from io import BytesIO
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
from app.models.models import (
    ComparisonResult, ComparisonSummary, RepairRecord,
    WorkOrder, MaterialBatch, MaterialTraceLog, ReviewRecord
)


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_comparison_report(self, batch_id: str, format: str = 'excel') -> bytes:
        summary = self.db.query(ComparisonSummary).filter(
            ComparisonSummary.batch_id == batch_id
        ).first()

        results = self.db.query(ComparisonResult).filter(
            ComparisonResult.comparison_batch_id == batch_id
        ).all()

        if not summary:
            raise ValueError("Batch not found")

        if format == 'excel':
            return self._generate_excel_report(summary, results)
        elif format == 'csv':
            return self._generate_csv_report(results)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def _generate_excel_report(self, summary: ComparisonSummary, results: List[ComparisonResult]) -> bytes:
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_data = {
                '项目': [
                    '批次号', '比对时间', '总记录数', '匹配记录数', '差异记录数',
                    '待复核数', '已解决数', '物料批次问题', '工位问题',
                    '返修闭环问题', '同批多缺陷问题'
                ],
                '数值': [
                    summary.batch_id,
                    summary.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    summary.total_records,
                    summary.matched_records,
                    summary.discrepancy_records,
                    summary.pending_review,
                    summary.resolved_records,
                    summary.material_batch_issues,
                    summary.station_issues,
                    summary.repair_loop_issues,
                    summary.multi_defect_issues
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='汇总', index=False)

            detail_data = []
            for r in results:
                detail_data.append({
                    '产品序列号': r.product_sn,
                    '工单号': r.work_order_no,
                    '匹配状态': r.match_status,
                    '差异类型': r.discrepancy_type or '',
                    '差异详情': r.discrepancy_details or '',
                    '责任工位': r.responsible_station or '',
                    '置信度': r.confidence_score,
                    '是否已解决': '是' if r.is_resolved else '否',
                    '解决备注': r.resolution_notes or ''
                })
            pd.DataFrame(detail_data).to_excel(writer, sheet_name='明细', index=False)

            discrepancy_data = []
            for r in results:
                if r.match_status == 'DISCREPANCY':
                    discrepancy_data.append({
                        '产品序列号': r.product_sn,
                        '工单号': r.work_order_no,
                        '差异类型': r.discrepancy_type or '',
                        '差异说明': self._get_discrepancy_explanation(r.discrepancy_type),
                        '建议措施': self._get_action_suggestion(r.discrepancy_type)
                    })
            if discrepancy_data:
                pd.DataFrame(discrepancy_data).to_excel(writer, sheet_name='差异分析说明', index=False)

        output.seek(0)
        return output.getvalue()

    def _generate_csv_report(self, results: List[ComparisonResult]) -> bytes:
        data = []
        for r in results:
            data.append({
                'product_sn': r.product_sn,
                'work_order_no': r.work_order_no,
                'match_status': r.match_status,
                'discrepancy_type': r.discrepancy_type or '',
                'discrepancy_details': r.discrepancy_details or '',
                'responsible_station': r.responsible_station or '',
                'confidence_score': r.confidence_score,
                'is_resolved': r.is_resolved
            })
        
        output = BytesIO()
        pd.DataFrame(data).to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        return output.getvalue()

    def _get_discrepancy_explanation(self, discrepancy_type: str) -> str:
        explanations = {
            'MATERIAL_BATCH_MISMATCH': '返修记录中的物料批号与工单中记录的物料批号不一致',
            'REPAIR_LOOP': '同一产品序列号多次经过相同工站进行返修',
            'MULTI_DEFECT': '同一物料批次发现多个缺陷产品',
            'STATION_ISSUE': '特定工位发现异常高比例的缺陷记录',
            'MISSING_WORK_ORDER': '返修记录关联的工单在系统中不存在'
        }
        return explanations.get(discrepancy_type, '其他类型差异')

    def _get_action_suggestion(self, discrepancy_type: str) -> str:
        suggestions = {
            'MATERIAL_BATCH_MISMATCH': '1.核对工单物料发放记录 2.检查返修记录物料录入是否正确 3.确认是否存在现场换料未记录',
            'REPAIR_LOOP': '1.分析缺陷根本原因 2.检查前工序是否有漏检 3.评估返修SOP是否需要优化',
            'MULTI_DEFECT': '1.检查原材料供应商质量 2.核查生产设备状态 3.评估工艺参数稳定性',
            'STATION_ISSUE': '1.检查设备精度和保养情况 2.核查操作员资质和作业方法 3.评估来料质量',
            'MISSING_WORK_ORDER': '1.核对工单编号录入是否正确 2.确认工单系统数据同步情况 3.检查工单是否已关闭或删除'
        }
        return suggestions.get(discrepancy_type, '请联系质量工程师进一步分析')

    def trace_material_batch(self, batch_no: str) -> Dict:
        batch = self.db.query(MaterialBatch).filter(
            MaterialBatch.batch_no == batch_no
        ).first()

        if not batch:
            return {'found': False, 'error': '物料批次未找到'}

        trace_logs = self.db.query(MaterialTraceLog).filter(
            MaterialTraceLog.batch_no == batch_no
        ).order_by(MaterialTraceLog.operation_time).all()

        related_repairs = self.db.query(RepairRecord).filter(
            RepairRecord.material_batch_no == batch_no
        ).all()

        related_orders = self.db.query(WorkOrder).filter(
            WorkOrder.material_batch_no == batch_no
        ).all()

        defect_rate = (batch.defect_qty / batch.used_qty * 100) if batch.used_qty > 0 else 0

        trace_chain = []
        for log in trace_logs:
            trace_chain.append({
                'time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S') if log.operation_time else '',
                'station': log.station,
                'operator': log.operator,
                'operation_type': log.operation_type,
                'product_sn': log.product_sn,
                'work_order': log.work_order_no,
                'remarks': log.remarks
            })

        return {
            'found': True,
            'batch_info': {
                'batch_no': batch.batch_no,
                'material_code': batch.material_code,
                'material_name': batch.material_name,
                'supplier': batch.supplier,
                'production_date': batch.production_date.strftime('%Y-%m-%d') if batch.production_date else '',
                'received_date': batch.received_date.strftime('%Y-%m-%d') if batch.received_date else '',
                'total_qty': batch.total_qty,
                'used_qty': batch.used_qty,
                'defect_qty': batch.defect_qty,
                'defect_rate': round(defect_rate, 2),
                'quality_status': batch.quality_status,
                'storage_location': batch.storage_location
            },
            'trace_chain': trace_chain,
            'related_repairs_count': len(related_repairs),
            'related_work_orders_count': len(related_orders),
            'related_repairs': [{'product_sn': r.product_sn, 'defect': r.defect_description, 'station': r.repair_station} 
                               for r in related_repairs[:10]],
            'related_work_orders': [{'order_no': wo.order_no, 'product': wo.product_model, 'qty': wo.actual_qty}
                                   for wo in related_orders[:10]],
            'quality_assessment': self._assess_quality(batch, defect_rate)
        }

    def _assess_quality(self, batch: MaterialBatch, defect_rate: float) -> Dict:
        if defect_rate < 1:
            level = '优秀'
            color = '绿色'
            recommendation = '该批次质量稳定，可继续正常使用'
        elif defect_rate < 3:
            level = '良好'
            color = '蓝色'
            recommendation = '质量符合要求，建议关注后续趋势'
        elif defect_rate < 5:
            level = '一般'
            color = '黄色'
            recommendation = '缺陷率偏高，建议加强巡检'
        else:
            level = '较差'
            color = '红色'
            recommendation = '缺陷率严重超标，建议暂停使用并启动原因调查'

        return {
            'level': level,
            'color': color,
            'recommendation': recommendation
        }

    def generate_decision_report(self, result_id: int) -> Dict:
        result = self.db.query(ComparisonResult).filter(
            ComparisonResult.id == result_id
        ).first()

        if not result:
            return {'error': '记录未找到'}

        repair_record = self.db.query(RepairRecord).filter(
            RepairRecord.id == result.repair_record_id
        ).first()

        reviews = self.db.query(ReviewRecord).filter(
            ReviewRecord.comparison_result_id == result_id
        ).all()

        decision_options = []
        
        if result.match_status == 'MATCHED':
            decision_options.append({
                'action': '放行',
                'description': '数据核对无误，可正常放行',
                'supporting_evidence': '工单与返修记录完全匹配，无差异发现',
                'risk_level': '低'
            })
        else:
            if result.discrepancy_type == 'MATERIAL_BATCH_MISMATCH':
                decision_options.extend([
                    {
                        'action': '返工',
                        'description': '物料批次不符，需退回确认正确物料后重新加工',
                        'supporting_evidence': '返修记录物料与工单不一致，可能存在错料风险',
                        'risk_level': '高'
                    },
                    {
                        'action': '特采放行',
                        'description': '经评估后可特采放行，需记录原因',
                        'supporting_evidence': '物料虽不符但经技术评估不影响产品功能',
                        'risk_level': '中'
                    }
                ])
            elif result.discrepancy_type == 'REPAIR_LOOP':
                decision_options.extend([
                    {
                        'action': '报废',
                        'description': '多次返修仍未解决，建议报废处理',
                        'supporting_evidence': '同一产品多次返修，可能存在根本性质量问题',
                        'risk_level': '高'
                    },
                    {
                        'action': '送技术分析',
                        'description': '提交技术部门进行根本原因分析',
                        'supporting_evidence': '需要专业技术团队深入分析问题根源',
                        'risk_level': '中'
                    }
                ])
            else:
                decision_options.append({
                    'action': '待确认',
                    'description': '需要进一步核实信息后再做决定',
                    'supporting_evidence': '存在差异需要补充调查',
                    'risk_level': '中'
                })

        return {
            'record_id': result.id,
            'product_sn': result.product_sn,
            'work_order_no': result.work_order_no,
            'current_status': result.match_status,
            'discrepancy_type': result.discrepancy_type,
            'discrepancy_details': result.discrepancy_details,
            'repair_details': {
                'defect_code': repair_record.defect_code if repair_record else '',
                'defect_description': repair_record.defect_description if repair_record else '',
                'repair_station': repair_record.repair_station if repair_record else '',
                'repair_result': repair_record.repair_result if repair_record else ''
            } if repair_record else None,
            'review_history': [
                {
                    'reviewer': r.reviewer,
                    'date': r.review_date.strftime('%Y-%m-%d %H:%M:%S') if r.review_date else '',
                    'decision': r.review_decision,
                    'notes': r.review_notes
                } for r in reviews
            ],
            'decision_options': decision_options,
            'is_resolved': result.is_resolved
        }
