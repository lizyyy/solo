import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from sqlalchemy import and_, or_
from extensions import db
from models import (
    TemperatureRecord, SampleTransfer, AlarmRecord, 
    ReviewNote, RiskAnalysis, TodoItem, ReviewConclusion
)
from config import Config

class AnalysisService:
    @staticmethod
    def detect_continuous_overtemperature(batch_number: Optional[str] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = TemperatureRecord.query
        if batch_number:
            query = query.filter_by(batch_number=batch_number)
        
        records = query.order_by(
            TemperatureRecord.batch_number,
            TemperatureRecord.probe_id,
            TemperatureRecord.record_time
        ).all()
        
        if not records:
            return risks
        
        grouped = defaultdict(list)
        for record in records:
            key = (record.batch_number, record.probe_id)
            grouped[key].append(record)
        
        for (batch, probe), group in grouped.items():
            overs = []
            in_over = False
            over_start = None
            over_min_temp = None
            over_max_temp = None
            over_records = []
            
            for record in sorted(group, key=lambda x: x.record_time):
                is_over = (record.temperature < Config.TEMPERATURE_LOWER_THRESHOLD or 
                          record.temperature > Config.TEMPERATURE_UPPER_THRESHOLD)
                
                if is_over:
                    if not in_over:
                        in_over = True
                        over_start = record
                        over_min_temp = record.temperature
                        over_max_temp = record.temperature
                        over_records = [record]
                    else:
                        over_min_temp = min(over_min_temp, record.temperature)
                        over_max_temp = max(over_max_temp, record.temperature)
                        over_records.append(record)
                else:
                    if in_over and over_start:
                        duration = (record.record_time - over_start.record_time).total_seconds() / 60
                        
                        if duration >= Config.OVERTEMP_DURATION_THRESHOLD:
                            risk = {
                                'risk_type': 'continuous_overtemperature',
                                'batch_number': batch,
                                'probe_id': probe,
                                'location': over_start.location,
                                'start_time': over_start.record_time,
                                'end_time': record.record_time,
                                'duration_minutes': round(duration, 2),
                                'min_temperature': over_min_temp,
                                'max_temperature': over_max_temp,
                                'threshold_lower': Config.TEMPERATURE_LOWER_THRESHOLD,
                                'threshold_upper': Config.TEMPERATURE_UPPER_THRESHOLD,
                                'description': f'连续超温检测：从 {over_start.record_time} 到 {record.record_time}，持续 {round(duration, 2)} 分钟。温度范围：{over_min_temp}°C ~ {over_max_temp}°C，阈值：{Config.TEMPERATURE_LOWER_THRESHOLD}°C ~ {Config.TEMPERATURE_UPPER_THRESHOLD}°C',
                                'risk_level': AnalysisService._calculate_overtemp_risk_level(duration, over_max_temp)
                            }
                            risks.append(risk)
                        
                        in_over = False
                        over_start = None
                        over_records = []
            
            if in_over and over_start and len(over_records) > 1:
                last_record = over_records[-1]
                duration = (last_record.record_time - over_start.record_time).total_seconds() / 60
                
                if duration >= Config.OVERTEMP_DURATION_THRESHOLD:
                    risk = {
                        'risk_type': 'continuous_overtemperature',
                        'batch_number': batch,
                        'probe_id': probe,
                        'location': over_start.location,
                        'start_time': over_start.record_time,
                        'end_time': last_record.record_time,
                        'duration_minutes': round(duration, 2),
                        'min_temperature': over_min_temp,
                        'max_temperature': over_max_temp,
                        'threshold_lower': Config.TEMPERATURE_LOWER_THRESHOLD,
                        'threshold_upper': Config.TEMPERATURE_UPPER_THRESHOLD,
                        'description': f'连续超温检测（未闭合）：从 {over_start.record_time} 到 {last_record.record_time}，持续 {round(duration, 2)} 分钟。温度范围：{over_min_temp}°C ~ {over_max_temp}°C',
                        'risk_level': AnalysisService._calculate_overtemp_risk_level(duration, over_max_temp)
                    }
                    risks.append(risk)
        
        return risks
    
    @staticmethod
    def _calculate_overtemp_risk_level(duration_minutes: float, max_temp: float) -> str:
        if duration_minutes > 30 or max_temp > -10:
            return 'critical'
        elif duration_minutes > 15 or max_temp > -12:
            return 'high'
        else:
            return 'medium'
    
    @staticmethod
    def detect_transfer_breakpoints(batch_number: Optional[str] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = SampleTransfer.query
        if batch_number:
            query = query.filter_by(batch_number=batch_number)
        
        transfers = query.order_by(
            SampleTransfer.batch_number,
            SampleTransfer.sample_id,
            SampleTransfer.transfer_time
        ).all()
        
        if not transfers:
            return risks
        
        grouped = defaultdict(list)
        for transfer in transfers:
            key = (transfer.batch_number, transfer.sample_id)
            grouped[key].append(transfer)
        
        for (batch, sample_id), group in grouped.items():
            sorted_transfers = sorted(group, key=lambda x: x.transfer_time)
            
            for i in range(1, len(sorted_transfers)):
                prev = sorted_transfers[i-1]
                curr = sorted_transfers[i]
                
                if prev.to_location != curr.from_location:
                    duration = (curr.transfer_time - prev.transfer_time).total_seconds() / 60
                    
                    risk = {
                        'risk_type': 'transfer_breakpoint',
                        'batch_number': batch,
                        'sample_id': sample_id,
                        'sample_name': prev.sample_name,
                        'prev_transfer_time': prev.transfer_time,
                        'curr_transfer_time': curr.transfer_time,
                        'prev_to_location': prev.to_location,
                        'curr_from_location': curr.from_location,
                        'gap_minutes': round(duration, 2),
                        'description': f'交接断点检测：样本 {sample_id} ({prev.sample_name}) 从 {prev.transfer_time} 交接至 "{prev.to_location}"，但下一次交接在 {curr.transfer_time} 从 "{curr.from_location}" 开始。存在 {round(duration, 2)} 分钟的交接断层，责任环节不明确。',
                        'risk_level': AnalysisService._calculate_breakpoint_risk_level(duration)
                    }
                    risks.append(risk)
        
        return risks
    
    @staticmethod
    def _calculate_breakpoint_risk_level(gap_minutes: float) -> str:
        if gap_minutes > 120:
            return 'critical'
        elif gap_minutes > 60:
            return 'high'
        else:
            return 'medium'
    
    @staticmethod
    def detect_duplicate_numbers(batch_number: Optional[str] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = SampleTransfer.query
        if batch_number:
            query = query.filter_by(batch_number=batch_number)
        
        transfers = query.all()
        
        if not transfers:
            return risks
        
        sample_id_counts = defaultdict(list)
        batch_sample_counts = defaultdict(lambda: defaultdict(list))
        
        for transfer in transfers:
            sample_id_counts[transfer.sample_id].append(transfer)
            batch_sample_counts[transfer.batch_number][transfer.sample_id].append(transfer)
        
        for sample_id, records in sample_id_counts.items():
            if len(records) > 1:
                batches = set(r.batch_number for r in records)
                locations = [r.from_location for r in records] + [r.to_location for r in records]
                times = [r.transfer_time for r in records]
                
                risk = {
                    'risk_type': 'duplicate_sample_id',
                    'sample_id': sample_id,
                    'sample_name': records[0].sample_name if records else '',
                    'occurrences': len(records),
                    'batches': list(batches),
                    'locations': list(set(locations)),
                    'first_time': min(times),
                    'last_time': max(times),
                    'description': f'重复编号风险：样本ID "{sample_id}" 出现在 {len(batches)} 个批次中，共 {len(records)} 次记录。涉及位置：{list(set(locations))}。时间范围：{min(times)} ~ {max(times)}。可能存在样本混淆或编号错误。',
                    'risk_level': AnalysisService._calculate_duplicate_risk_level(len(batches), len(records))
                }
                risks.append(risk)
        
        for batch, samples in batch_sample_counts.items():
            for sample_id, records in samples.items():
                if len(records) > 1:
                    risk = {
                        'risk_type': 'duplicate_in_batch',
                        'batch_number': batch,
                        'sample_id': sample_id,
                        'sample_name': records[0].sample_name if records else '',
                        'occurrences': len(records),
                        'first_time': min(r.transfer_time for r in records),
                        'last_time': max(r.transfer_time for r in records),
                        'description': f'批次内重复：在批次 "{batch}" 中，样本ID "{sample_id}" 出现了 {len(records)} 次。时间范围：{min(r.transfer_time for r in records)} ~ {max(r.transfer_time for r in records)}。可能存在重复录入或样本重复。',
                        'risk_level': 'medium' if len(records) <= 2 else 'high'
                    }
                    risks.append(risk)
        
        return risks
    
    @staticmethod
    def _calculate_duplicate_risk_level(num_batches: int, num_occurrences: int) -> str:
        if num_batches > 2 or num_occurrences > 5:
            return 'critical'
        elif num_batches > 1 or num_occurrences > 2:
            return 'high'
        else:
            return 'medium'
    
    @staticmethod
    def run_full_analysis(batch_number: Optional[str] = None) -> Dict[str, Any]:
        RiskAnalysis.query.filter(RiskAnalysis.batch_number == batch_number).delete() if batch_number else RiskAnalysis.query.delete()
        db.session.commit()
        
        overtemperature_risks = AnalysisService.detect_continuous_overtemperature(batch_number)
        breakpoint_risks = AnalysisService.detect_transfer_breakpoints(batch_number)
        duplicate_risks = AnalysisService.detect_duplicate_numbers(batch_number)
        
        all_risks = []
        
        for risk in overtemperature_risks:
            db_risk = RiskAnalysis(
                batch_number=risk['batch_number'],
                risk_type=risk['risk_type'],
                risk_level=risk['risk_level'],
                description=risk['description'],
                location=risk.get('location', ''),
                start_time=risk.get('start_time'),
                end_time=risk.get('end_time'),
                duration_minutes=risk.get('duration_minutes'),
                temperature=risk.get('max_temperature'),
                sample_ids=risk.get('probe_id', ''),
                status='pending'
            )
            db.session.add(db_risk)
            all_risks.append({**risk, 'db_id': None})
        
        for risk in breakpoint_risks:
            db_risk = RiskAnalysis(
                batch_number=risk['batch_number'],
                risk_type=risk['risk_type'],
                risk_level=risk['risk_level'],
                description=risk['description'],
                location=f"{risk.get('prev_to_location', '')} -> {risk.get('curr_from_location', '')}",
                start_time=risk.get('prev_transfer_time'),
                end_time=risk.get('curr_transfer_time'),
                duration_minutes=risk.get('gap_minutes'),
                sample_ids=risk.get('sample_id', ''),
                status='pending'
            )
            db.session.add(db_risk)
            all_risks.append({**risk, 'db_id': None})
        
        for risk in duplicate_risks:
            db_risk = RiskAnalysis(
                batch_number=risk.get('batch_number', 'UNKNOWN_BATCH'),
                risk_type=risk['risk_type'],
                risk_level=risk['risk_level'],
                description=risk['description'],
                location=', '.join(risk.get('locations', [])) if risk.get('locations') else '',
                start_time=risk.get('first_time'),
                end_time=risk.get('last_time'),
                sample_ids=risk.get('sample_id', ''),
                status='pending'
            )
            db.session.add(db_risk)
            all_risks.append({**risk, 'db_id': None})
        
        db.session.commit()
        
        risk_counts = {
            'continuous_overtemperature': len(overtemperature_risks),
            'transfer_breakpoint': len(breakpoint_risks),
            'duplicate_sample_id': len([r for r in duplicate_risks if r['risk_type'] == 'duplicate_sample_id']),
            'duplicate_in_batch': len([r for r in duplicate_risks if r['risk_type'] == 'duplicate_in_batch']),
            'total': len(all_risks)
        }
        
        return {
            'success': True,
            'risk_counts': risk_counts,
            'risks': [
                {
                    'risk_type': r['risk_type'],
                    'risk_level': r['risk_level'],
                    'batch_number': r.get('batch_number', ''),
                    'description': r['description']
                }
                for r in all_risks
            ]
        }
    
    @staticmethod
    def get_risk_analysis(batch_number: Optional[str] = None) -> List[Dict[str, Any]]:
        query = RiskAnalysis.query
        if batch_number:
            query = query.filter_by(batch_number=batch_number)
        
        risks = query.order_by(
            db.case(
                (RiskAnalysis.risk_level == 'critical', 1),
                (RiskAnalysis.risk_level == 'high', 2),
                (RiskAnalysis.risk_level == 'medium', 3),
                (RiskAnalysis.risk_level == 'low', 4),
                else_=5
            ),
            RiskAnalysis.created_at.desc()
        ).all()
        
        result = []
        for risk in risks:
            conclusions = [
                {
                    'id': c.id,
                    'reviewer': c.reviewer,
                    'review_time': c.review_time.isoformat() if c.review_time else None,
                    'conclusion_type': c.conclusion_type,
                    'root_cause': c.root_cause,
                    'corrective_action': c.corrective_action,
                    'preventive_action': c.preventive_action,
                    'responsibility': c.responsibility,
                    'deadline': c.deadline.isoformat() if c.deadline else None,
                    'status': c.status,
                    'comments': c.comments
                }
                for c in risk.conclusions
            ]
            
            todos = [
                {
                    'id': t.id,
                    'title': t.title,
                    'description': t.description,
                    'assignee': t.assignee,
                    'due_date': t.due_date.isoformat() if t.due_date else None,
                    'priority': t.priority,
                    'status': t.status,
                    'completed_at': t.completed_at.isoformat() if t.completed_at else None,
                    'completed_by': t.completed_by
                }
                for t in risk.todos
            ]
            
            result.append({
                'id': risk.id,
                'batch_number': risk.batch_number,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'description': risk.description,
                'location': risk.location,
                'start_time': risk.start_time.isoformat() if risk.start_time else None,
                'end_time': risk.end_time.isoformat() if risk.end_time else None,
                'duration_minutes': risk.duration_minutes,
                'temperature': risk.temperature,
                'sample_ids': risk.sample_ids,
                'status': risk.status,
                'created_at': risk.created_at.isoformat() if risk.created_at else None,
                'updated_at': risk.updated_at.isoformat() if risk.updated_at else None,
                'conclusions': conclusions,
                'todos': todos
            })
        
        return result
    
    @staticmethod
    def add_review_conclusion(risk_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        risk = RiskAnalysis.query.get(risk_id)
        if not risk:
            return {'success': False, 'error': '风险记录不存在'}
        
        deadline = None
        if data.get('deadline'):
            try:
                deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
            except ValueError:
                pass
        
        conclusion = ReviewConclusion(
            risk_analysis_id=risk_id,
            batch_number=risk.batch_number,
            reviewer=data.get('reviewer', ''),
            conclusion_type=data.get('conclusion_type', ''),
            root_cause=data.get('root_cause', ''),
            corrective_action=data.get('corrective_action', ''),
            preventive_action=data.get('preventive_action', ''),
            responsibility=data.get('responsibility', ''),
            deadline=deadline,
            status=data.get('status', 'pending'),
            comments=data.get('comments', '')
        )
        
        db.session.add(conclusion)
        db.session.commit()
        
        return {
            'success': True,
            'conclusion': {
                'id': conclusion.id,
                'risk_analysis_id': conclusion.risk_analysis_id,
                'reviewer': conclusion.reviewer,
                'review_time': conclusion.review_time.isoformat() if conclusion.review_time else None,
                'conclusion_type': conclusion.conclusion_type,
                'root_cause': conclusion.root_cause,
                'corrective_action': conclusion.corrective_action,
                'preventive_action': conclusion.preventive_action,
                'responsibility': conclusion.responsibility,
                'deadline': conclusion.deadline.isoformat() if conclusion.deadline else None,
                'status': conclusion.status,
                'comments': conclusion.comments
            }
        }
    
    @staticmethod
    def add_todo_item(risk_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        risk = RiskAnalysis.query.get(risk_id)
        if not risk:
            return {'success': False, 'error': '风险记录不存在'}
        
        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                pass
        
        todo = TodoItem(
            risk_analysis_id=risk_id,
            batch_number=risk.batch_number,
            title=data.get('title', ''),
            description=data.get('description', ''),
            assignee=data.get('assignee', ''),
            due_date=due_date,
            priority=data.get('priority', 'medium'),
            status=data.get('status', 'pending')
        )
        
        db.session.add(todo)
        db.session.commit()
        
        return {
            'success': True,
            'todo': {
                'id': todo.id,
                'title': todo.title,
                'description': todo.description,
                'assignee': todo.assignee,
                'due_date': todo.due_date.isoformat() if todo.due_date else None,
                'priority': todo.priority,
                'status': todo.status
            }
        }
    
    @staticmethod
    def update_risk_status(risk_id: int, status: str) -> Dict[str, Any]:
        risk = RiskAnalysis.query.get(risk_id)
        if not risk:
            return {'success': False, 'error': '风险记录不存在'}
        
        risk.status = status
        db.session.commit()
        
        return {
            'success': True,
            'risk': {
                'id': risk.id,
                'status': risk.status
            }
        }
    
    @staticmethod
    def get_batch_overview(batch_number: str) -> Dict[str, Any]:
        temp_records = TemperatureRecord.query.filter_by(batch_number=batch_number).count()
        transfers = SampleTransfer.query.filter_by(batch_number=batch_number).count()
        alarms = AlarmRecord.query.filter_by(batch_number=batch_number).count()
        reviews = ReviewNote.query.filter_by(batch_number=batch_number).count()
        
        risks = RiskAnalysis.query.filter_by(batch_number=batch_number).all()
        risk_count = len(risks)
        critical_risks = sum(1 for r in risks if r.risk_level == 'critical')
        high_risks = sum(1 for r in risks if r.risk_level == 'high')
        pending_risks = sum(1 for r in risks if r.status == 'pending')
        
        todos = TodoItem.query.filter_by(batch_number=batch_number).all()
        todo_count = len(todos)
        pending_todos = sum(1 for t in todos if t.status == 'pending')
        
        return {
            'batch_number': batch_number,
            'temperature_records': temp_records,
            'sample_transfers': transfers,
            'alarm_records': alarms,
            'review_notes': reviews,
            'risk_analysis': {
                'total': risk_count,
                'critical': critical_risks,
                'high': high_risks,
                'pending': pending_risks
            },
            'todos': {
                'total': todo_count,
                'pending': pending_todos
            }
        }
