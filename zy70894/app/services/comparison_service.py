import uuid
from datetime import datetime
from typing import List, Dict
from sqlalchemy import and_, func
from sqlalchemy.orm import Session
from app.models.models import (
    RepairRecord, WorkOrder, ComparisonResult, ComparisonSummary,
    MaterialBatch, MaterialTraceLog
)


class ComparisonService:
    def __init__(self, db: Session):
        self.db = db

    def run_comparison(self) -> Dict:
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        repair_records = self.db.query(RepairRecord).all()
        work_orders = {wo.order_no: wo for wo in self.db.query(WorkOrder).all()}
        
        results = []
        summary = {
            'total': 0,
            'matched': 0,
            'discrepancy': 0,
            'material_batch_issues': 0,
            'station_issues': 0,
            'repair_loop_issues': 0,
            'multi_defect_issues': 0
        }

        for record in repair_records:
            summary['total'] += 1
            
            work_order = work_orders.get(record.work_order_no)
            discrepancies = []
            discrepancy_type = None
            responsible_station = None
            confidence = 1.0
            
            if not work_order:
                discrepancies.append(f"工单 {record.work_order_no} 不存在")
                discrepancy_type = "MISSING_WORK_ORDER"
                confidence = 0.3
            else:
                if record.material_batch_no != work_order.material_batch_no:
                    discrepancies.append(
                        f"物料批次不匹配: 返修记录={record.material_batch_no}, 工单={work_order.material_batch_no}"
                    )
                    discrepancy_type = "MATERIAL_BATCH_MISMATCH"
                    summary['material_batch_issues'] += 1
                    confidence *= 0.7
                    responsible_station = self._determine_responsible_station(record, work_order)

            loop_info = self._check_repair_loop(record.product_sn)
            if loop_info['is_loop']:
                discrepancies.append(loop_info['details'])
                if not discrepancy_type:
                    discrepancy_type = "REPAIR_LOOP"
                summary['repair_loop_issues'] += 1
                confidence *= 0.8

            multi_defect_info = self._check_multi_defects(record.product_sn, record.material_batch_no)
            if multi_defect_info['has_multi_defects']:
                discrepancies.append(multi_defect_info['details'])
                if not discrepancy_type:
                    discrepancy_type = "MULTI_DEFECT"
                summary['multi_defect_issues'] += 1
                confidence *= 0.85

            station_info = self._analyze_station_issue(record)
            if station_info['has_issue']:
                discrepancies.append(station_info['details'])
                if not discrepancy_type:
                    discrepancy_type = "STATION_ISSUE"
                summary['station_issues'] += 1
                if not responsible_station:
                    responsible_station = station_info['responsible_station']
                confidence *= 0.9

            if discrepancies:
                match_status = "DISCREPANCY"
                summary['discrepancy'] += 1
            else:
                match_status = "MATCHED"
                summary['matched'] += 1

            result = ComparisonResult(
                comparison_batch_id=batch_id,
                repair_record_id=record.id,
                work_order_no=record.work_order_no,
                product_sn=record.product_sn,
                match_status=match_status,
                discrepancy_type=discrepancy_type,
                discrepancy_details="; ".join(discrepancies) if discrepancies else None,
                responsible_station=responsible_station,
                confidence_score=confidence,
                is_resolved=False
            )
            self.db.add(result)
            results.append(result)

        self.db.flush()

        comparison_summary = ComparisonSummary(
            batch_id=batch_id,
            total_records=summary['total'],
            matched_records=summary['matched'],
            discrepancy_records=summary['discrepancy'],
            pending_review=summary['discrepancy'],
            resolved_records=0,
            material_batch_issues=summary['material_batch_issues'],
            station_issues=summary['station_issues'],
            repair_loop_issues=summary['repair_loop_issues'],
            multi_defect_issues=summary['multi_defect_issues']
        )
        self.db.add(comparison_summary)
        self.db.commit()

        return {
            'batch_id': batch_id,
            'summary': summary,
            'results_count': len(results)
        }

    def _check_repair_loop(self, product_sn: str) -> Dict:
        records = self.db.query(RepairRecord).filter(
            RepairRecord.product_sn == product_sn
        ).order_by(RepairRecord.repair_date).all()

        if len(records) <= 1:
            return {'is_loop': False}

        station_sequence = [r.repair_station for r in records]
        unique_stations = set(station_sequence)
        
        if len(unique_stations) < len(station_sequence) * 0.5:
            repeated_stations = {s: station_sequence.count(s) for s in unique_stations if station_sequence.count(s) > 1}
            details = (f"产品 {product_sn} 存在返修闭环: 共返修 {len(records)} 次, "
                      f"重复工位: {repeated_stations}")
            return {'is_loop': True, 'details': details}

        return {'is_loop': False}

    def _check_multi_defects(self, product_sn: str, material_batch: str) -> Dict:
        same_batch_records = self.db.query(RepairRecord).filter(
            and_(
                RepairRecord.material_batch_no == material_batch,
                RepairRecord.product_sn != product_sn
            )
        ).all()

        if len(same_batch_records) >= 3:
            defect_codes = {}
            for r in same_batch_records:
                defect_codes[r.defect_code] = defect_codes.get(r.defect_code, 0) + 1
            
            details = (f"物料批次 {material_batch} 存在多缺陷: 同批次发现 {len(same_batch_records)} 个缺陷产品, "
                      f"缺陷类型分布: {defect_codes}")
            return {'has_multi_defects': True, 'details': details}

        return {'has_multi_defects': False}

    def _analyze_station_issue(self, record: RepairRecord) -> Dict:
        same_station_records = self.db.query(RepairRecord).filter(
            and_(
                RepairRecord.repair_station == record.repair_station,
                RepairRecord.id != record.id
            )
        ).count()

        defect_rate_threshold = 5
        if same_station_records >= defect_rate_threshold:
            return {
                'has_issue': True,
                'details': f"工位 {record.repair_station} 缺陷率异常: 近期已发现 {same_station_records} 起缺陷",
                'responsible_station': record.repair_station
            }

        return {'has_issue': False}

    def _determine_responsible_station(self, record: RepairRecord, work_order: WorkOrder) -> str:
        if 'SMT' in record.repair_station.upper():
            return 'SMT车间'
        elif 'TEST' in record.repair_station.upper():
            return '测试工位'
        elif 'ASSEMBLE' in record.repair_station.upper() or '组装' in record.repair_station:
            return '组装工位'
        
        return record.repair_station

    def get_comparison_results(self, batch_id: str = None, status: str = None) -> List[ComparisonResult]:
        query = self.db.query(ComparisonResult)
        
        if batch_id:
            query = query.filter(ComparisonResult.comparison_batch_id == batch_id)
        if status:
            query = query.filter(ComparisonResult.match_status == status)
            
        return query.order_by(ComparisonResult.created_at.desc()).all()

    def get_summary(self, batch_id: str) -> ComparisonSummary:
        return self.db.query(ComparisonSummary).filter(ComparisonSummary.batch_id == batch_id).first()

    def recalculate_summary(self, batch_id: str) -> Dict:
        results = self.db.query(ComparisonResult).filter(
            ComparisonResult.comparison_batch_id == batch_id
        ).all()

        summary = self.db.query(ComparisonSummary).filter(
            ComparisonSummary.batch_id == batch_id
        ).first()

        if not summary:
            return {'error': 'Summary not found'}

        summary.total_records = len(results)
        summary.matched_records = sum(1 for r in results if r.match_status == 'MATCHED')
        summary.discrepancy_records = sum(1 for r in results if r.match_status == 'DISCREPANCY')
        summary.pending_review = sum(1 for r in results if r.match_status == 'DISCREPANCY' and not r.is_resolved)
        summary.resolved_records = sum(1 for r in results if r.is_resolved)

        self.db.commit()
        return {
            'batch_id': batch_id,
            'total': summary.total_records,
            'matched': summary.matched_records,
            'discrepancy': summary.discrepancy_records,
            'pending': summary.pending_review,
            'resolved': summary.resolved_records
        }
