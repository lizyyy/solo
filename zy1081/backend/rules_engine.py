from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class RuleThresholds:
    consecutive_no_shows: int = 2
    late_minutes_threshold: int = 30
    high_no_show_rate: float = 20.0
    high_late_rate: float = 25.0
    high_complaint_rate: float = 10.0
    high_refund_rate: float = 8.0
    zone_noise_complaints: int = 3
    seat_complaints: int = 2
    member_complaints_about: int = 2
    low_utilization_threshold: float = 30.0
    high_utilization_threshold: float = 80.0
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RuleThresholds':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'consecutive_no_shows': self.consecutive_no_shows,
            'late_minutes_threshold': self.late_minutes_threshold,
            'high_no_show_rate': self.high_no_show_rate,
            'high_late_rate': self.high_late_rate,
            'high_complaint_rate': self.high_complaint_rate,
            'high_refund_rate': self.high_refund_rate,
            'zone_noise_complaints': self.zone_noise_complaints,
            'seat_complaints': self.seat_complaints,
            'member_complaints_about': self.member_complaints_about,
            'low_utilization_threshold': self.low_utilization_threshold,
            'high_utilization_threshold': self.high_utilization_threshold
        }


@dataclass
class RiskItem:
    item_type: str
    item_id: str
    item_name: str
    risk_level: str
    risk_score: float
    issues: List[str]
    suggestions: List[str]
    metrics: Dict[str, Any]


@dataclass
class AdjustmentSuggestion:
    category: str
    priority: str
    title: str
    description: str
    affected_items: List[Dict[str, str]]
    expected_impact: Dict[str, Any]
    implementation_steps: List[str]


class RulesEngine:
    RISK_LEVELS = {
        'critical': {'min_score': 70, 'color': '#dc2626'},
        'high': {'min_score': 40, 'color': '#ea580c'},
        'medium': {'min_score': 20, 'color': '#ca8a04'},
        'low': {'min_score': 0, 'color': '#16a34a'}
    }

    def __init__(self, metrics: Dict[str, Any], thresholds: Optional[RuleThresholds] = None):
        self.metrics = metrics
        self.thresholds = thresholds or RuleThresholds()
        self._risk_items: List[RiskItem] = []
        self._suggestions: List[AdjustmentSuggestion] = []

    def run_all_rules(self) -> Dict[str, Any]:
        self._risk_items = []
        
        self._check_members()
        self._check_zones()
        self._check_time_slots()
        self._check_seats()
        
        self._generate_suggestions()
        
        return {
            'risk_items': [self._risk_item_to_dict(item) for item in self._risk_items],
            'suggestions': [self._suggestion_to_dict(sug) for sug in self._suggestions],
            'thresholds': self.thresholds.to_dict(),
            'summary': self._generate_summary()
        }

    def _check_members(self):
        member_metrics = self.metrics.get('by_member', {})
        
        for member_id, member in member_metrics.items():
            issues = []
            risk_score = 0.0
            
            if member['no_show_rate'] >= self.thresholds.high_no_show_rate:
                issues.append(f"爽约率过高: {member['no_show_rate']}% (阈值: {self.thresholds.high_no_show_rate}%)")
                risk_score += member['no_show_rate'] * 0.5
            
            if member['late_rate'] >= self.thresholds.high_late_rate:
                issues.append(f"迟到率过高: {member['late_rate']}% (阈值: {self.thresholds.high_late_rate}%)")
                risk_score += member['late_rate'] * 0.3
            
            if member['avg_late_minutes'] >= self.thresholds.late_minutes_threshold:
                issues.append(f"平均迟到时间过长: {member['avg_late_minutes']}分钟 (阈值: {self.thresholds.late_minutes_threshold}分钟)")
                risk_score += 20
            
            if member['complaints_about'] >= self.thresholds.member_complaints_about:
                issues.append(f"被投诉次数过多: {member['complaints_about']}次 (阈值: {self.thresholds.member_complaints_about}次)")
                risk_score += member['complaints_about'] * 15
            
            if issues:
                member_name = f"会员 {member_id}" if member['is_member'] else f"非会员 {member_id}"
                self._risk_items.append(RiskItem(
                    item_type='member',
                    item_id=member_id,
                    item_name=member_name,
                    risk_level=self._get_risk_level(risk_score),
                    risk_score=min(round(risk_score, 2), 100.0),
                    issues=issues,
                    suggestions=self._get_member_suggestions(member, issues),
                    metrics={
                        'total_bookings': member['total_bookings'],
                        'no_show_rate': member['no_show_rate'],
                        'late_rate': member['late_rate'],
                        'avg_late_minutes': member['avg_late_minutes'],
                        'complaints_about': member['complaints_about'],
                        'is_member': member['is_member']
                    }
                ))

    def _check_zones(self):
        zone_metrics = self.metrics.get('by_zone', {})
        
        for zone_id, zone in zone_metrics.items():
            issues = []
            risk_score = 0.0
            
            if zone['noise_complaints'] >= self.thresholds.zone_noise_complaints:
                issues.append(f"噪音投诉过多: {zone['noise_complaints']}次 (阈值: {self.thresholds.zone_noise_complaints}次)")
                risk_score += zone['noise_complaints'] * 10
            
            if zone['complaint_rate'] >= self.thresholds.high_complaint_rate:
                issues.append(f"投诉率过高: {zone['complaint_rate']}% (阈值: {self.thresholds.high_complaint_rate}%)")
                risk_score += zone['complaint_rate'] * 0.8
            
            if zone['no_show_rate'] >= self.thresholds.high_no_show_rate:
                issues.append(f"爽约率过高: {zone['no_show_rate']}% (阈值: {self.thresholds.high_no_show_rate}%)")
                risk_score += zone['no_show_rate'] * 0.4
            
            if zone['refund_complaints'] > 0:
                refund_rate = (zone['refund_complaints'] / zone['total_bookings']) * 100 if zone['total_bookings'] > 0 else 0
                if refund_rate >= self.thresholds.high_refund_rate:
                    issues.append(f"退款率过高: {round(refund_rate, 2)}% (阈值: {self.thresholds.high_refund_rate}%)")
                    risk_score += refund_rate * 0.5
            
            if issues:
                self._risk_items.append(RiskItem(
                    item_type='zone',
                    item_id=zone_id,
                    item_name=zone['zone_name'],
                    risk_level=self._get_risk_level(risk_score),
                    risk_score=min(round(risk_score, 2), 100.0),
                    issues=issues,
                    suggestions=self._get_zone_suggestions(zone, issues),
                    metrics={
                        'total_bookings': zone['total_bookings'],
                        'no_show_rate': zone['no_show_rate'],
                        'complaint_rate': zone['complaint_rate'],
                        'noise_complaints': zone['noise_complaints'],
                        'refund_complaints': zone['refund_complaints'],
                        'seat_count': zone['seat_count']
                    }
                ))

    def _check_time_slots(self):
        slot_metrics = self.metrics.get('by_time_slot', {})
        
        for slot_id, slot in slot_metrics.items():
            issues = []
            risk_score = 0.0
            
            if slot['no_show_rate'] >= self.thresholds.high_no_show_rate:
                issues.append(f"爽约率过高: {slot['no_show_rate']}% (阈值: {self.thresholds.high_no_show_rate}%)")
                risk_score += slot['no_show_rate'] * 0.5
            
            if slot['late_rate'] >= self.thresholds.high_late_rate:
                issues.append(f"迟到率过高: {slot['late_rate']}% (阈值: {self.thresholds.high_late_rate}%)")
                risk_score += slot['late_rate'] * 0.3
            
            if slot['complaints'] > 0:
                complaint_rate = (slot['complaints'] / slot['total_bookings']) * 100 if slot['total_bookings'] > 0 else 0
                if complaint_rate >= self.thresholds.high_complaint_rate:
                    issues.append(f"投诉率过高: {round(complaint_rate, 2)}% (阈值: {self.thresholds.high_complaint_rate}%)")
                    risk_score += complaint_rate * 0.8
            
            if issues:
                self._risk_items.append(RiskItem(
                    item_type='time_slot',
                    item_id=slot_id,
                    item_name=slot['slot_name'],
                    risk_level=self._get_risk_level(risk_score),
                    risk_score=min(round(risk_score, 2), 100.0),
                    issues=issues,
                    suggestions=self._get_slot_suggestions(slot, issues),
                    metrics={
                        'total_bookings': slot['total_bookings'],
                        'no_show_rate': slot['no_show_rate'],
                        'late_rate': slot['late_rate'],
                        'complaints': slot['complaints'],
                        'noise_complaints': slot['noise_complaints']
                    }
                ))

    def _check_seats(self):
        heatmap = self.metrics.get('seat_heatmap', {})
        seat_data = heatmap.get('heatmap', [])
        
        for seat in seat_data:
            issues = []
            risk_score = seat.get('risk_score', 0)
            
            if seat['complaints'] >= self.thresholds.seat_complaints:
                issues.append(f"投诉次数过多: {seat['complaints']}次 (阈值: {self.thresholds.seat_complaints}次)")
            
            if seat['no_show_rate'] >= self.thresholds.high_no_show_rate:
                issues.append(f"爽约率过高: {seat['no_show_rate']}% (阈值: {self.thresholds.high_no_show_rate}%)")
            
            utilization = seat['utilization_score'] * 100
            if utilization < self.thresholds.low_utilization_threshold:
                issues.append(f"利用率过低: {round(utilization, 2)}% (阈值: {self.thresholds.low_utilization_threshold}%)")
            elif utilization > self.thresholds.high_utilization_threshold:
                issues.append(f"利用率过高: {round(utilization, 2)}% (阈值: {self.thresholds.high_utilization_threshold}%)")
            
            if issues or risk_score >= 20:
                seat_name = f"座位 {seat['seat_id']} ({seat['zone']}区)"
                self._risk_items.append(RiskItem(
                    item_type='seat',
                    item_id=seat['seat_id'],
                    item_name=seat_name,
                    risk_level=self._get_risk_level(risk_score),
                    risk_score=min(round(risk_score, 2), 100.0),
                    issues=issues if issues else [f"风险评分较高: {risk_score}"],
                    suggestions=self._get_seat_suggestions(seat, issues),
                    metrics={
                        'zone': seat['zone'],
                        'row': seat['row'],
                        'col': seat['col'],
                        'total_bookings': seat['total_bookings'],
                        'no_show_rate': seat['no_show_rate'],
                        'complaints': seat['complaints'],
                        'noise_complaints': seat['noise_complaints'],
                        'utilization_score': seat['utilization_score']
                    }
                ))

    def _generate_suggestions(self):
        self._suggestions = []
        
        critical_members = [r for r in self._risk_items if r.item_type == 'member' and r.risk_level in ['critical', 'high']]
        if critical_members:
            self._suggestions.append(AdjustmentSuggestion(
                category='member_warning',
                priority='high' if any(r.risk_level == 'critical' for r in critical_members) else 'medium',
                title='高风险会员提醒',
                description=f'发现 {len(critical_members)} 名高风险会员，存在多次爽约、迟到或被投诉记录。建议重点关注并采取适当措施。',
                affected_items=[{'id': r.item_id, 'name': r.item_name, 'risk': r.risk_level} for r in critical_members],
                expected_impact={'reduce_no_shows': '预计减少30%的高风险会员爽约', 'improve_compliance': '提高会员规则意识'},
                implementation_steps=[
                    '发送提醒短信/邮件，告知当前风险状态',
                    '对于连续爽约会员，考虑提高保证金要求',
                    '严重违规会员可考虑暂停预约权限',
                    '建立会员积分/信用体系'
                ]
            ))
        
        high_noise_zones = [r for r in self._risk_items if r.item_type == 'zone' and '噪音' in str(r.issues)]
        if high_noise_zones:
            self._suggestions.append(AdjustmentSuggestion(
                category='zone_adjustment',
                priority='high',
                title='噪音问题区域调整',
                description=f'{len(high_noise_zones)} 个区域存在噪音投诉问题。建议重新评估区域功能定位和管理策略。',
                affected_items=[{'id': r.item_id, 'name': r.item_name} for r in high_noise_zones],
                expected_impact={'reduce_complaints': '预计减少50%的噪音投诉', 'improve_satisfaction': '提升整体用户体验'},
                implementation_steps=[
                    '评估噪音源，考虑将高噪音座位调整到讨论区',
                    '在安静区增加"保持安静"标识',
                    '考虑安装隔音设施或分区挡板',
                    '优化座位布局，减少区域间干扰'
                ]
            ))
        
        high_no_show_slots = [r for r in self._risk_items if r.item_type == 'time_slot' and r.metrics.get('no_show_rate', 0) >= self.thresholds.high_no_show_rate]
        if high_no_show_slots:
            self._suggestions.append(AdjustmentSuggestion(
                category='deposit_adjustment',
                priority='medium',
                title='高爽约时段保证金调整',
                description=f'{len(high_no_show_slots)} 个时段爽约率超过阈值。建议提高这些时段的保证金要求以降低爽约风险。',
                affected_items=[{'id': r.item_id, 'name': r.item_name, 'no_show_rate': f"{r.metrics.get('no_show_rate', 0)}%"} for r in high_no_show_slots],
                expected_impact={'reduce_no_shows': '预计减少40%的爽约', 'increase_revenue': '保证金收入可能增加'},
                implementation_steps=[
                    '分析爽约高峰时段的具体原因',
                    '考虑将保证金提高50%-100%',
                    '设置更严格的取消预约时限',
                    '爽约后自动扣除部分或全部保证金'
                ]
            ))
        
        low_util_seats = [r for r in self._risk_items if r.item_type == 'seat' and '利用率过低' in str(r.issues)]
        if low_util_seats:
            self._suggestions.append(AdjustmentSuggestion(
                category='seat_optimization',
                priority='medium',
                title='低利用率座位优化',
                description=f'发现 {len(low_util_seats)} 个座位利用率低于 {self.thresholds.low_utilization_threshold}%。建议优化座位配置或定价策略。',
                affected_items=[{'id': r.item_id, 'name': r.item_name} for r in low_util_seats],
                expected_impact={'increase_utilization': '预计提高20%-30%的利用率', 'better_roi': '提升座位投资回报率'},
                implementation_steps=[
                    '分析低利用率原因（位置、设施、价格等）',
                    '考虑降低这些座位的价格或提供优惠套餐',
                    '优化座位布局，改善位置劣势',
                    '增加设施（如USB接口、更好的照明）'
                ]
            ))

    def _get_risk_level(self, score: float) -> str:
        if score >= 70:
            return 'critical'
        elif score >= 40:
            return 'high'
        elif score >= 20:
            return 'medium'
        else:
            return 'low'

    def _get_member_suggestions(self, member: Dict, issues: List[str]) -> List[str]:
        suggestions = []
        
        if any('爽约率' in issue for issue in issues):
            suggestions.append('建议发送爽约提醒，考虑提高保证金或限制预约数量')
        
        if any('迟到' in issue for issue in issues):
            suggestions.append('建议发送迟到警告，严重者可考虑暂时限制预约')
        
        if any('被投诉' in issue for issue in issues):
            suggestions.append('建议约谈了解情况，严重者可考虑暂停会员资格')
        
        if not suggestions:
            suggestions.append('持续关注该会员的预约行为')
        
        return suggestions

    def _get_zone_suggestions(self, zone: Dict, issues: List[str]) -> List[str]:
        suggestions = []
        
        if any('噪音' in issue for issue in issues):
            suggestions.append('建议加强该区域的噪音管理，考虑调整区域功能定位')
        
        if any('爽约率' in issue for issue in issues):
            suggestions.append('建议提高该区域的保证金要求')
        
        if any('退款' in issue for issue in issues):
            suggestions.append('建议优化退款政策，了解用户退款原因')
        
        if not suggestions:
            suggestions.append('持续关注该区域的运营情况')
        
        return suggestions

    def _get_slot_suggestions(self, slot: Dict, issues: List[str]) -> List[str]:
        suggestions = []
        
        if any('爽约率' in issue for issue in issues):
            suggestions.append('建议提高该时段的保证金要求，或缩短预约取消期限')
        
        if any('迟到' in issue for issue in issues):
            suggestions.append('建议在该时段开始前发送提醒通知')
        
        if any('投诉' in issue for issue in issues):
            suggestions.append('建议增加该时段的工作人员巡查')
        
        if not suggestions:
            suggestions.append('持续关注该时段的运营情况')
        
        return suggestions

    def _get_seat_suggestions(self, seat: Dict, issues: List[str]) -> List[str]:
        suggestions = []
        
        if any('投诉' in issue for issue in issues):
            suggestions.append('建议调查该座位的投诉原因，考虑调整位置或功能')
        
        if any('爽约率' in issue for issue in issues):
            suggestions.append('建议分析该座位频繁爽约的原因')
        
        if any('利用率过低' in issue for issue in issues):
            suggestions.append('建议优化该座位的定价或设施配置')
        
        if any('利用率过高' in issue for issue in issues):
            suggestions.append('建议考虑增加同类型座位，或提高定价')
        
        if not suggestions:
            suggestions.append('持续关注该座位的使用情况')
        
        return suggestions

    def _risk_item_to_dict(self, item: RiskItem) -> Dict[str, Any]:
        return {
            'item_type': item.item_type,
            'item_id': item.item_id,
            'item_name': item.item_name,
            'risk_level': item.risk_level,
            'risk_score': item.risk_score,
            'risk_color': self.RISK_LEVELS.get(item.risk_level, {'color': '#6b7280'})['color'],
            'issues': item.issues,
            'suggestions': item.suggestions,
            'metrics': item.metrics
        }

    def _suggestion_to_dict(self, suggestion: AdjustmentSuggestion) -> Dict[str, Any]:
        return {
            'category': suggestion.category,
            'priority': suggestion.priority,
            'title': suggestion.title,
            'description': suggestion.description,
            'affected_items': suggestion.affected_items,
            'expected_impact': suggestion.expected_impact,
            'implementation_steps': suggestion.implementation_steps
        }

    def _generate_summary(self) -> Dict[str, Any]:
        risk_counts = defaultdict(int)
        type_counts = defaultdict(int)
        
        for item in self._risk_items:
            risk_counts[item.risk_level] += 1
            type_counts[item.item_type] += 1
        
        return {
            'total_risk_items': len(self._risk_items),
            'risk_level_distribution': dict(risk_counts),
            'item_type_distribution': dict(type_counts),
            'total_suggestions': len(self._suggestions),
            'priority_distribution': {
                'high': sum(1 for s in self._suggestions if s.priority == 'high'),
                'medium': sum(1 for s in self._suggestions if s.priority == 'medium'),
                'low': sum(1 for s in self._suggestions if s.priority == 'low')
            }
        }

    def simulate_adjustment(self, adjustment_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        original_metrics = self.metrics.get('overall', {})
        simulation_result = {
            'adjustment_type': adjustment_type,
            'original_metrics': original_metrics.copy(),
            'expected_improvement': {},
            'risks': []
        }

        if adjustment_type == 'increase_deposit':
            zone = params.get('zone')
            slot = params.get('time_slot')
            increase_percent = params.get('increase_percent', 50)
            
            expected_no_show_reduction = min(increase_percent * 0.5, 40)
            current_no_show_rate = original_metrics.get('no_show_rate', 0)
            new_no_show_rate = max(current_no_show_rate * (1 - expected_no_show_reduction / 100), 2)
            
            simulation_result['expected_improvement'] = {
                'no_show_rate': {
                    'original': round(current_no_show_rate, 2),
                    'expected': round(new_no_show_rate, 2),
                    'reduction': round(current_no_show_rate - new_no_show_rate, 2)
                }
            }
            simulation_result['risks'] = [
                '可能导致部分用户流失',
                '需要明确告知用户保证金调整政策'
            ]

        elif adjustment_type == 'zone_reclassification':
            from_zone = params.get('from_zone')
            to_zone = params.get('to_zone')
            
            simulation_result['expected_improvement'] = {
                'noise_complaints': {
                    'original': original_metrics.get('noise_complaint_count', 0),
                    'expected': round(original_metrics.get('noise_complaint_count', 0) * 0.6, 0),
                    'reduction': '预计减少40%'
                }
            }
            simulation_result['risks'] = [
                '可能影响原区域用户体验',
                '需要重新布置标识和设施'
            ]

        elif adjustment_type == 'member_warning':
            member_ids = params.get('member_ids', [])
            
            simulation_result['expected_improvement'] = {
                'member_compliance': {
                    'expected': '预计相关会员行为改善率达60%',
                    'risk_reduction': '预计降低相关会员风险评分30%'
                }
            }
            simulation_result['risks'] = [
                '部分会员可能产生不满情绪',
                '需要持续跟踪改进效果'
            ]

        return simulation_result
