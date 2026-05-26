from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import (
    Waybill, TrackingRecord, PenaltyRule, ReconciliationResult,
    PenaltyHistory, WeatherExemption, ReconciliationBatch
)


class ReconciliationEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = self._load_active_rules()

    def _load_active_rules(self) -> Dict[str, List[PenaltyRule]]:
        rules = self.db.query(PenaltyRule).filter(PenaltyRule.is_active == True).all()
        grouped = {}
        for rule in rules:
            rule_type = rule.rule_type
            if rule_type not in grouped:
                grouped[rule_type] = []
            grouped[rule_type].append(rule)
        for rule_type in grouped:
            grouped[rule_type].sort(key=lambda r: r.priority, reverse=True)
        return grouped

    def reconcile_waybill(self, waybill: Waybill, batch_id: str) -> ReconciliationResult:
        existing = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.waybill_id == waybill.id
        ).first()

        if existing:
            self.db.query(PenaltyHistory).filter(
                PenaltyHistory.reconciliation_id == existing.id
            ).delete()

        result = ReconciliationResult(
            waybill_id=waybill.id,
            waybill_no=waybill.waybill_no,
            batch_id=batch_id
        )

        auto_calc_details = {}

        delay_result = self._calculate_delay(waybill)
        result.delay_hours = delay_result['delay_hours']
        result.is_delayed = delay_result['is_delayed']
        result.delay_level = delay_result['delay_level']
        auto_calc_details['delay'] = delay_result

        damage_result = self._check_damage(waybill)
        result.is_damaged = damage_result['is_damaged']
        result.damage_type = damage_result['damage_type']
        result.damage_severity = damage_result['severity']
        auto_calc_details['damage'] = damage_result

        transfer_result = self._check_transfer_responsibility(waybill)
        result.is_transfer_issue = transfer_result['has_issue']
        result.transfer_responsibility = transfer_result['responsibility']
        auto_calc_details['transfer'] = transfer_result

        weather_exempt = self._check_weather_exemption(waybill)
        result.weather_exempt = weather_exempt['is_exempt']
        result.weather_info = weather_exempt['weather_info']

        duplicate_check = self._check_duplicate_penalty(waybill)
        result.is_duplicate_penalty = duplicate_check['is_duplicate']
        result.duplicate_source = duplicate_check['source']

        penalty_details = []
        all_penalties = []
        total_delay_penalty = 0
        total_damage_penalty = 0
        total_transfer_penalty = 0

        if result.is_delayed and not result.weather_exempt:
            delay_penalties = self._calculate_delay_penalty(waybill, delay_result)
            for penalty in delay_penalties:
                total_delay_penalty += penalty['amount']
                penalty_details.append(penalty)
                all_penalties.append(penalty)

        if result.is_damaged:
            damage_penalties = self._calculate_damage_penalty(waybill, damage_result)
            for penalty in damage_penalties:
                total_damage_penalty += penalty['amount']
                penalty_details.append(penalty)
                all_penalties.append(penalty)

        if result.is_transfer_issue:
            transfer_penalties = self._calculate_transfer_penalty(waybill, transfer_result)
            for penalty in transfer_penalties:
                total_transfer_penalty += penalty['amount']
                penalty_details.append(penalty)
                all_penalties.append(penalty)

        result.delay_penalty = total_delay_penalty
        result.damage_penalty = total_damage_penalty
        result.transfer_penalty = total_transfer_penalty
        result.total_penalty = total_delay_penalty + total_damage_penalty + total_transfer_penalty
        result.penalty_details = {'items': penalty_details}
        result.auto_calculation_details = auto_calc_details

        discrepancy_explanations = self._generate_discrepancy_explanation(
            result, weather_exempt, duplicate_check
        )
        result.discrepancy_explanation = discrepancy_explanations

        result.status = "auto_verified"
        result.review_status = "pending"

        if existing:
            for key, value in result.__dict__.items():
                if not key.startswith('_') and key not in ['id', 'created_at']:
                    setattr(existing, key, value)
            result = existing
        else:
            self.db.add(result)

        self.db.flush()

        for penalty in all_penalties:
            self._create_penalty_history(result, penalty)

        self.db.flush()
        return result

    def _calculate_delay(self, waybill: Waybill) -> Dict[str, Any]:
        if not waybill.planned_arrival_time or not waybill.actual_arrival_time:
            return {
                'delay_hours': 0,
                'is_delayed': False,
                'delay_level': 'normal',
                'reason': '缺少到达时间数据'
            }

        delay = waybill.actual_arrival_time - waybill.planned_arrival_time
        delay_hours = delay.total_seconds() / 3600

        if delay_hours <= 0:
            return {
                'delay_hours': 0,
                'is_delayed': False,
                'delay_level': 'normal',
                'reason': '按时到达'
            }

        if delay_hours < 4:
            level = 'minor'
        elif delay_hours < 12:
            level = 'moderate'
        elif delay_hours < 24:
            level = 'serious'
        else:
            level = 'critical'

        return {
            'delay_hours': round(delay_hours, 2),
            'is_delayed': True,
            'delay_level': level,
            'reason': f'晚点 {round(delay_hours, 2)} 小时',
            'planned_arrival': waybill.planned_arrival_time.isoformat(),
            'actual_arrival': waybill.actual_arrival_time.isoformat()
        }

    def _check_damage(self, waybill: Waybill) -> Dict[str, Any]:
        if not waybill.damage_status:
            return {
                'is_damaged': False,
                'damage_type': None,
                'severity': None,
                'reason': '无破损记录'
            }

        damage_status = waybill.damage_status.lower()

        if '无' in damage_status or 'normal' in damage_status:
            return {
                'is_damaged': False,
                'damage_type': None,
                'severity': None,
                'reason': '无破损'
            }

        if '湿' in damage_status or 'water' in damage_status:
            damage_type = 'water_damage'
        elif '破' in damage_status or 'damage' in damage_status:
            damage_type = 'physical_damage'
        elif '丢' in damage_status or 'lost' in damage_status:
            damage_type = 'lost'
        else:
            damage_type = 'other'

        if '严重' in damage_status or 'serious' in damage_status:
            severity = 'serious'
        elif '轻微' in damage_status or 'minor' in damage_status:
            severity = 'minor'
        else:
            severity = 'moderate'

        return {
            'is_damaged': True,
            'damage_type': damage_type,
            'severity': severity,
            'reason': waybill.damage_description or waybill.damage_status,
            'description': waybill.damage_description
        }

    def _check_transfer_responsibility(self, waybill: Waybill) -> Dict[str, Any]:
        tracking_records = self.db.query(TrackingRecord).filter(
            TrackingRecord.waybill_id == waybill.id
        ).order_by(TrackingRecord.timestamp).all()

        if len(tracking_records) < 2:
            return {
                'has_issue': False,
                'responsibility': None,
                'reason': '轨迹记录不足'
            }

        transfer_points = []
        responsibility = []
        has_issue = False

        for i, record in enumerate(tracking_records):
            if record.is_transfer_point or record.transfer_station:
                transfer_points.append({
                    'station': record.transfer_station or record.location,
                    'city': record.city,
                    'timestamp': record.timestamp.isoformat(),
                    'status': record.status
                })

            if i > 0:
                prev_record = tracking_records[i - 1]
                if record.is_transfer_point or prev_record.is_transfer_point:
                    time_gap = (record.timestamp - prev_record.timestamp).total_seconds() / 3600
                    if time_gap > 24:
                        has_issue = True
                        responsibility.append({
                            'from_station': prev_record.transfer_station or prev_record.location,
                            'to_station': record.transfer_station or record.location,
                            'time_gap_hours': round(time_gap, 2),
                            'issue': '中转超时',
                            'responsible_party': prev_record.transfer_station or record.transfer_station
                        })

        return {
            'has_issue': has_issue,
            'transfer_points': transfer_points,
            'responsibility': responsibility if responsibility else None,
            'reason': f'发现 {len(responsibility)} 个中转问题' if has_issue else '中转正常'
        }

    def _check_weather_exemption(self, waybill: Waybill) -> Dict[str, Any]:
        if not waybill.actual_departure_time or not waybill.actual_arrival_time:
            return {'is_exempt': False, 'weather_info': None}

        exemptions = self.db.query(WeatherExemption).filter(
            WeatherExemption.city.in_([waybill.origin_city, waybill.dest_city])
        ).all()

        for exemption in exemptions:
            waybill_start = waybill.actual_departure_time
            waybill_end = waybill.actual_arrival_time

            if (waybill_start <= exemption.end_time and
                waybill_end >= exemption.start_time):
                overlap_start = max(waybill_start, exemption.start_time)
                overlap_end = min(waybill_end, exemption.end_time)
                overlap_hours = (overlap_end - overlap_start).total_seconds() / 3600

                if overlap_hours > 4:
                    return {
                        'is_exempt': True,
                        'weather_info': {
                            'city': exemption.city,
                            'weather_type': exemption.weather_type,
                            'severity': exemption.severity,
                            'description': exemption.description,
                            'affected_hours': round(overlap_hours, 2),
                            'exemption_period': {
                                'start': exemption.start_time.isoformat(),
                                'end': exemption.end_time.isoformat()
                            }
                        }
                    }

        return {'is_exempt': False, 'weather_info': None}

    def _check_duplicate_penalty(self, waybill: Waybill) -> Dict[str, Any]:
        history = self.db.query(PenaltyHistory).filter(
            PenaltyHistory.waybill_no == waybill.waybill_no
        ).all()

        if history:
            batches = set(h.source_batch for h in history if h.source_batch)
            return {
                'is_duplicate': True,
                'source': f'已在 {", ".join(batches)} 批次中扣罚',
                'duplicate_count': len(history)
            }

        return {'is_duplicate': False, 'source': None}

    def _calculate_delay_penalty(self, waybill: Waybill, delay_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        penalties = []
        delay_rules = self.rules.get('delay', [])

        for rule in delay_rules:
            threshold = rule.threshold_hours or 0
            if delay_result['delay_hours'] < threshold:
                continue

            calculation_basis = {
                'delay_hours': delay_result['delay_hours'],
                'threshold_hours': threshold,
                'freight': waybill.freight or 0,
                'declared_value': waybill.declared_value or 0
            }

            if rule.calculation_method == 'percentage':
                base = waybill.freight or rule.base_value or 0
                amount = base * (rule.percentage or 0) / 100
            elif rule.calculation_method == 'fixed':
                amount = rule.base_value or 0
            elif rule.calculation_method == 'per_hour':
                amount = (delay_result['delay_hours'] - threshold) * (rule.base_value or 0)
            else:
                amount = 0

            if rule.min_penalty and amount < rule.min_penalty:
                amount = rule.min_penalty
            if rule.max_penalty and amount > rule.max_penalty:
                amount = rule.max_penalty

            penalties.append({
                'type': 'delay',
                'rule_id': rule.id,
                'rule_code': rule.rule_code,
                'rule_name': rule.rule_name,
                'calculation_method': rule.calculation_method,
                'calculation_basis': calculation_basis,
                'original_value': delay_result['delay_hours'],
                'amount': round(amount, 2),
                'traceability_path': {
                    'source': 'delay_calculation',
                    'rule_version': rule.version,
                    'formula': f'{rule.calculation_method}: {rule.percentage or rule.base_value}'
                }
            })

        return penalties

    def _calculate_damage_penalty(self, waybill: Waybill, damage_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        penalties = []
        damage_rules = self.rules.get('damage', [])

        for rule in damage_rules:
            conditions = rule.conditions or {}
            if conditions.get('damage_type') and conditions['damage_type'] != damage_result['damage_type']:
                continue
            if conditions.get('severity') and conditions['severity'] != damage_result['severity']:
                continue

            calculation_basis = {
                'damage_type': damage_result['damage_type'],
                'severity': damage_result['severity'],
                'declared_value': waybill.declared_value or 0,
                'freight': waybill.freight or 0
            }

            if rule.calculation_method == 'percentage':
                base = waybill.declared_value or rule.base_value or 0
                amount = base * (rule.percentage or 0) / 100
            elif rule.calculation_method == 'fixed':
                amount = rule.base_value or 0
            else:
                amount = waybill.freight or 0

            if rule.min_penalty and amount < rule.min_penalty:
                amount = rule.min_penalty
            if rule.max_penalty and amount > rule.max_penalty:
                amount = rule.max_penalty

            penalties.append({
                'type': 'damage',
                'rule_id': rule.id,
                'rule_code': rule.rule_code,
                'rule_name': rule.rule_name,
                'calculation_method': rule.calculation_method,
                'calculation_basis': calculation_basis,
                'original_value': waybill.declared_value or 0,
                'amount': round(amount, 2),
                'traceability_path': {
                    'source': 'damage_assessment',
                    'rule_version': rule.version
                }
            })

        return penalties

    def _calculate_transfer_penalty(self, waybill: Waybill, transfer_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        penalties = []
        transfer_rules = self.rules.get('transfer', [])

        if not transfer_result.get('responsibility'):
            return penalties

        for issue in transfer_result['responsibility']:
            for rule in transfer_rules:
                calculation_basis = {
                    'issue_type': issue['issue'],
                    'time_gap_hours': issue['time_gap_hours'],
                    'responsible_party': issue['responsible_party']
                }

                amount = rule.base_value or 100

                penalties.append({
                    'type': 'transfer',
                    'rule_id': rule.id,
                    'rule_code': rule.rule_code,
                    'rule_name': rule.rule_name,
                    'calculation_method': rule.calculation_method,
                    'calculation_basis': calculation_basis,
                    'original_value': issue['time_gap_hours'],
                    'amount': round(amount, 2),
                    'responsible_party': issue['responsible_party'],
                    'traceability_path': {
                        'source': 'transfer_audit',
                        'rule_version': rule.version,
                        'issue': issue['issue']
                    }
                })

        return penalties

    def _create_penalty_history(self, result: ReconciliationResult, penalty: Dict[str, Any]):
        history = PenaltyHistory(
            reconciliation_id=result.id,
            waybill_no=result.waybill_no,
            penalty_type=penalty['type'],
            rule_id=penalty['rule_id'],
            rule_code=penalty['rule_code'],
            rule_name=penalty['rule_name'],
            calculation_basis=penalty['calculation_basis'],
            original_value=penalty['original_value'],
            penalty_amount=penalty['amount'],
            source_type=penalty['type'],
            source_batch=result.batch_id,
            traceability_path=penalty.get('traceability_path')
        )
        self.db.add(history)

    def _generate_discrepancy_explanation(self, result: ReconciliationResult,
                                           weather_exempt: Dict[str, Any],
                                           duplicate_check: Dict[str, Any]) -> str:
        explanations = []

        if result.is_delayed:
            explanations.append(f"【晚点】晚点 {result.delay_hours} 小时，等级: {result.delay_level}")
            if result.weather_exempt and weather_exempt['weather_info']:
                explanations.append(
                    f"【天气免责】因 {weather_exempt['weather_info']['weather_type']} "
                    f"({weather_exempt['weather_info']['severity']}) 影响，晚点扣罚已豁免"
                )

        if result.is_damaged:
            explanations.append(
                f"【破损】类型: {result.damage_type}，严重程度: {result.damage_severity}"
            )

        if result.is_transfer_issue and result.transfer_responsibility:
            for item in result.transfer_responsibility:
                explanations.append(
                    f"【中转问题】{item.get('from_station', '未知')} → {item.get('to_station', '未知')}，"
                    f"超时 {item.get('time_gap_hours', 0)} 小时，责任方: {item.get('responsible_party', '待确认')}"
                )

        if result.is_duplicate_penalty:
            explanations.append(f"【重复扣罚】{result.duplicate_source}")

        if not explanations:
            explanations.append("无异常，正常放行")

        return "\n".join(explanations)

    def reconcile_batch(self, batch_id: str, waybill_ids: Optional[List[int]] = None,
                        batch_name: str = None, period: str = None,
                        generated_by: str = None) -> Dict[str, Any]:
        if waybill_ids:
            waybills = self.db.query(Waybill).filter(Waybill.id.in_(waybill_ids)).all()
        else:
            waybills = self.db.query(Waybill).filter(Waybill.batch_id == batch_id).all()

        batch = ReconciliationBatch(
            batch_id=batch_id,
            batch_name=batch_name or f"对账批次_{batch_id}",
            period=period,
            total_waybills=len(waybills),
            generated_by=generated_by,
            status="processing"
        )
        self.db.add(batch)
        self.db.flush()

        results = []
        for waybill in waybills:
            try:
                result = self.reconcile_waybill(waybill, batch_id)
                results.append(result)
            except Exception as e:
                print(f"处理运单 {waybill.waybill_no} 失败: {e}")

        summary = self._calculate_batch_summary(batch_id, waybills, results)
        batch.total_penalty = summary['total_penalty']
        batch.reconciled_count = summary['processed_count']
        batch.pending_count = summary['pending_count']
        batch.exempt_count = summary['exempt_count']
        batch.summary = summary
        batch.status = "completed"
        batch.completed_at = datetime.now()

        self.db.commit()

        return {
            'batch_id': batch_id,
            'total_count': len(waybills),
            'processed_count': len(results),
            'summary': summary
        }

    def _calculate_batch_summary(self, batch_id: str, waybills: List[Waybill],
                                  results: List[ReconciliationResult]) -> Dict[str, Any]:
        delayed_count = sum(1 for r in results if r.is_delayed)
        damaged_count = sum(1 for r in results if r.is_damaged)
        transfer_issue_count = sum(1 for r in results if r.is_transfer_issue)
        exempt_count = sum(1 for r in results if r.is_exempt or r.weather_exempt)

        total_delay_penalty = sum(r.delay_penalty for r in results)
        total_damage_penalty = sum(r.damage_penalty for r in results)
        total_transfer_penalty = sum(r.transfer_penalty for r in results)
        total_penalty = sum(r.total_penalty for r in results)

        penalty_distribution = {
            '0-100': sum(1 for r in results if 0 < r.total_penalty <= 100),
            '100-500': sum(1 for r in results if 100 < r.total_penalty <= 500),
            '500-1000': sum(1 for r in results if 500 < r.total_penalty <= 1000),
            '1000+': sum(1 for r in results if r.total_penalty > 1000)
        }

        return {
            'batch_id': batch_id,
            'total_waybills': len(waybills),
            'processed_count': len(results),
            'pending_count': len(waybills) - len(results),
            'exempt_count': exempt_count,
            'delayed_count': delayed_count,
            'damaged_count': damaged_count,
            'transfer_issue_count': transfer_issue_count,
            'total_penalty': round(total_penalty, 2),
            'delay_penalty_total': round(total_delay_penalty, 2),
            'damage_penalty_total': round(total_damage_penalty, 2),
            'transfer_penalty_total': round(total_transfer_penalty, 2),
            'average_penalty': round(total_penalty / len(results), 2) if results else 0,
            'penalty_distribution': penalty_distribution
        }
