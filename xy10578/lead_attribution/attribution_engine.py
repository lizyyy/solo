import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from .models import (
    Deal, Customer, Attribution, AttributionType, SourceType,
    AuditLog, RecordStatus
)
from .database import DatabaseManager


class AttributionEngine:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def calculate_attribution(self, deal: Deal, customer: Customer) -> Dict[str, List[Attribution]]:
        touch_points = self.db.get_customer_touch_points(
            customer.id, 
            before_time=deal.close_time
        )
        
        if not touch_points:
            touch_points = [{
                'id': f"organic_{customer.id}",
                'customer_id': customer.id,
                'source_type': SourceType.ORGANIC,
                'touch_time': deal.close_time,
                'source_details': {},
                'record_type': 'organic'
            }]
        
        valid_touch_points = []
        for tp in touch_points:
            if tp['touch_time'] <= deal.close_time:
                valid_touch_points.append(tp)
        
        if not valid_touch_points:
            valid_touch_points = [{
                'id': f"organic_{customer.id}",
                'customer_id': customer.id,
                'source_type': SourceType.ORGANIC,
                'touch_time': deal.close_time,
                'source_details': {},
                'record_type': 'organic'
            }]
        
        first_touch = self._first_touch_attribution(deal, customer, valid_touch_points)
        last_touch = self._last_touch_attribution(deal, customer, valid_touch_points)
        weighted = self._weighted_attribution(deal, customer, valid_touch_points)
        
        return {
            'first_touch': first_touch,
            'last_touch': last_touch,
            'weighted': weighted
        }

    def _first_touch_attribution(self, deal: Deal, customer: Customer, 
                                  touch_points: List[Dict]) -> List[Attribution]:
        first_tp = sorted(touch_points, key=lambda x: x['touch_time'])[0]
        
        attribution = Attribution(
            id=f"attribution_{uuid.uuid4().hex[:8]}",
            deal_id=deal.id,
            customer_id=customer.id,
            attribution_type=AttributionType.FIRST_TOUCH,
            source_type=first_tp['source_type'],
            source_record_id=first_tp['id'],
            source_record_type=first_tp['record_type'],
            percentage=100.0,
            amount=deal.amount,
            is_manual=False,
            operator=None
        )
        return [attribution]

    def _last_touch_attribution(self, deal: Deal, customer: Customer,
                                 touch_points: List[Dict]) -> List[Attribution]:
        last_tp = sorted(touch_points, key=lambda x: x['touch_time'])[-1]
        
        attribution = Attribution(
            id=f"attribution_{uuid.uuid4().hex[:8]}",
            deal_id=deal.id,
            customer_id=customer.id,
            attribution_type=AttributionType.LAST_TOUCH,
            source_type=last_tp['source_type'],
            source_record_id=last_tp['id'],
            source_record_type=last_tp['record_type'],
            percentage=100.0,
            amount=deal.amount,
            is_manual=False,
            operator=None
        )
        return [attribution]

    def _weighted_attribution(self, deal: Deal, customer: Customer,
                               touch_points: List[Dict]) -> List[Attribution]:
        sorted_tps = sorted(touch_points, key=lambda x: x['touch_time'])
        n = len(sorted_tps)
        
        if n == 1:
            tp = sorted_tps[0]
            return [Attribution(
                id=f"attribution_{uuid.uuid4().hex[:8]}",
                deal_id=deal.id,
                customer_id=customer.id,
                attribution_type=AttributionType.WEIGHTED,
                source_type=tp['source_type'],
                source_record_id=tp['id'],
                source_record_type=tp['record_type'],
                percentage=100.0,
                amount=deal.amount,
                is_manual=False,
                operator=None
            )]
        
        if n == 2:
            first_weight = 0.4
            last_weight = 0.6
            middle_weight = 0
        else:
            first_weight = 0.225
            last_weight = 0.325
            middle_weight = (1.0 - first_weight - last_weight) / (n - 2)
        
        attributions = []
        
        for i, tp in enumerate(sorted_tps):
            if i == 0:
                weight = first_weight
            elif i == n - 1:
                weight = last_weight
            else:
                weight = middle_weight
            
            percentage = round(weight * 100, 2)
            amount = round(deal.amount * weight, 2)
            
            attributions.append(Attribution(
                id=f"attribution_{uuid.uuid4().hex[:8]}",
                deal_id=deal.id,
                customer_id=customer.id,
                attribution_type=AttributionType.WEIGHTED,
                source_type=tp['source_type'],
                source_record_id=tp['id'],
                source_record_type=tp['record_type'],
                percentage=percentage,
                amount=amount,
                is_manual=False,
                operator=None
            ))
        
        return attributions

    def run_attribution_for_all_deals(self) -> Dict[str, Any]:
        deals = self.db.get_all_deals()
        results = []
        
        for deal in deals:
            customer = self.db.get_customer_by_id(deal.customer_id)
            if not customer:
                continue
            
            existing = self.db.get_attributions_by_deal(deal.id)
            if existing:
                continue
            
            attributions_by_type = self.calculate_attribution(deal, customer)
            
            for attr_type, attributions in attributions_by_type.items():
                for attr in attributions:
                    self.db.save_attribution(attr)
            
            results.append({
                'deal_id': deal.id,
                'deal_name': deal.deal_name,
                'customer': customer.name,
                'amount': deal.amount,
                'attributions_count': sum(len(a) for a in attributions_by_type.values())
            })
        
        return {
            'total_deals_processed': len(results),
            'deals': results
        }

    def manual_update_attribution(self, deal_id: str, attribution_type: AttributionType,
                                    new_source: list, operator: str, 
                                    reason: str = None) -> List[Attribution]:
        deal = self.db.get_deal_by_id(deal_id)
        if not deal:
            raise ValueError(f"Deal not found: {deal_id}")
        
        old_attributions = self.db.get_attributions_by_deal(deal_id)
        old_attributions = [a for a in old_attributions if a.attribution_type == attribution_type]
        
        for attr in old_attributions:
            self.db.save_audit_log(AuditLog(
                id=f"audit_{uuid.uuid4().hex[:8]}",
                action='DELETE_ATTRIBUTION',
                record_type='attribution',
                record_id=attr.id,
                old_value=asdict(attr),
                new_value=None,
                operator=operator,
                reason=reason
            ))
        
        self.db.delete_attributions(deal_id, attribution_type)
        
        new_attributions = []
        for source_info in new_source:
            attr = Attribution(
                id=f"attribution_{uuid.uuid4().hex[:8]}",
                deal_id=deal_id,
                customer_id=deal.customer_id,
                attribution_type=attribution_type,
                source_type=SourceType(source_info['source_type']),
                source_record_id=source_info.get('source_record_id', f"manual_{uuid.uuid4().hex[:8]}"),
                source_record_type=source_info.get('source_record_type', 'manual'),
                percentage=source_info.get('percentage', 100.0),
                amount=round(deal.amount * (source_info.get('percentage', 100.0) / 100), 2),
                is_manual=True,
                operator=operator
            )
            self.db.save_attribution(attr)
            new_attributions.append(attr)
            
            self.db.save_audit_log(AuditLog(
                id=f"audit_{uuid.uuid4().hex[:8]}",
                action='CREATE_ATTRIBUTION',
                record_type='attribution',
                record_id=attr.id,
                old_value=None,
                new_value=asdict(attr),
                operator=operator,
                reason=reason
            ))
        
        return new_attributions

    def get_attribution_summary(self) -> Dict[str, Any]:
        all_attributions = self.db.get_all_attributions()
        deals = self.db.get_all_deals()
        customers = self.db.get_all_customers()
        
        summary_by_source_first = {}
        summary_by_source_last = {}
        summary_by_source_weighted = {}
        
        for attr in all_attributions:
            st = attr.source_type.value
            if attr.attribution_type == AttributionType.FIRST_TOUCH:
                summary_by_source_first[st] = summary_by_source_first.get(st, 0) + attr.amount
            elif attr.attribution_type == AttributionType.LAST_TOUCH:
                summary_by_source_last[st] = summary_by_source_last.get(st, 0) + attr.amount
            elif attr.attribution_type == AttributionType.WEIGHTED:
                summary_by_source_weighted[st] = summary_by_source_weighted.get(st, 0) + attr.amount
        
        total_revenue = sum(d.amount for d in deals if d.status == 'won')
        
        return {
            'overview': {
                'total_customers': len(customers),
                'total_deals': len(deals),
                'total_revenue': total_revenue,
                'total_attributions': len(all_attributions),
                'manual_attributions': sum(1 for a in all_attributions if a.is_manual)
            },
            'first_touch': summary_by_source_first,
            'last_touch': summary_by_source_last,
            'weighted': summary_by_source_weighted
        }
