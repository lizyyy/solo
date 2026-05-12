import uuid
import json
import csv
from datetime import datetime
from dateutil import parser as date_parser
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from .models import (
    Customer, SourceType, CustomerType, RecordStatus,
    AdClick, EventAttendance, Referral, Deal,
    AuditLog, ImportSession, ImportStatus, Blacklist,
    SalesFollowUp, Lead
)
from .database import DatabaseManager


class DataImporter:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def import_ad_clicks(self, file_path: str, operator: str = "system") -> ImportSession:
        session = ImportSession(
            id=f"import_{uuid.uuid4().hex[:8]}",
            source_type="ad_click",
            file_path=file_path,
            status=ImportStatus.PENDING
        )
        self.db.save_import_session(session)
        
        try:
            data = self._load_file(file_path)
            session.total_records = len(data)
            
            for record in data:
                try:
                    result = self._process_ad_click_record(record, operator)
                    if result == 'success':
                        session.success_count += 1
                    elif result == 'duplicate':
                        session.duplicate_count += 1
                    elif result == 'blacklisted':
                        session.blacklisted_count += 1
                except Exception as e:
                    session.failed_count += 1
                    if not session.error_message:
                        session.error_message = str(e)
            
            if session.failed_count > 0 and session.success_count == 0:
                session.status = ImportStatus.FAILED
            elif session.failed_count > 0:
                session.status = ImportStatus.PARTIAL
            else:
                session.status = ImportStatus.SUCCESS
                
        except Exception as e:
            session.status = ImportStatus.FAILED
            session.error_message = str(e)
        finally:
            session.completed_at = datetime.now()
            self.db.save_import_session(session)
        
        return session

    def import_event_attendances(self, file_path: str, operator: str = "system") -> ImportSession:
        session = ImportSession(
            id=f"import_{uuid.uuid4().hex[:8]}",
            source_type="event",
            file_path=file_path,
            status=ImportStatus.PENDING
        )
        self.db.save_import_session(session)
        
        try:
            data = self._load_file(file_path)
            session.total_records = len(data)
            
            for record in data:
                try:
                    result = self._process_event_record(record, operator)
                    if result == 'success':
                        session.success_count += 1
                    elif result == 'duplicate':
                        session.duplicate_count += 1
                    elif result == 'blacklisted':
                        session.blacklisted_count += 1
                except Exception as e:
                    session.failed_count += 1
                    if not session.error_message:
                        session.error_message = str(e)
            
            if session.failed_count > 0 and session.success_count == 0:
                session.status = ImportStatus.FAILED
            elif session.failed_count > 0:
                session.status = ImportStatus.PARTIAL
            else:
                session.status = ImportStatus.SUCCESS
                
        except Exception as e:
            session.status = ImportStatus.FAILED
            session.error_message = str(e)
        finally:
            session.completed_at = datetime.now()
            self.db.save_import_session(session)
        
        return session

    def import_referrals(self, file_path: str, operator: str = "system") -> ImportSession:
        session = ImportSession(
            id=f"import_{uuid.uuid4().hex[:8]}",
            source_type="referral",
            file_path=file_path,
            status=ImportStatus.PENDING
        )
        self.db.save_import_session(session)
        
        try:
            data = self._load_file(file_path)
            session.total_records = len(data)
            
            for record in data:
                try:
                    result = self._process_referral_record(record, operator)
                    if result == 'success':
                        session.success_count += 1
                    elif result == 'duplicate':
                        session.duplicate_count += 1
                    elif result == 'blacklisted':
                        session.blacklisted_count += 1
                except Exception as e:
                    session.failed_count += 1
                    if not session.error_message:
                        session.error_message = str(e)
            
            if session.failed_count > 0 and session.success_count == 0:
                session.status = ImportStatus.FAILED
            elif session.failed_count > 0:
                session.status = ImportStatus.PARTIAL
            else:
                session.status = ImportStatus.SUCCESS
                
        except Exception as e:
            session.status = ImportStatus.FAILED
            session.error_message = str(e)
        finally:
            session.completed_at = datetime.now()
            self.db.save_import_session(session)
        
        return session

    def import_deals(self, file_path: str, operator: str = "system") -> ImportSession:
        session = ImportSession(
            id=f"import_{uuid.uuid4().hex[:8]}",
            source_type="deal",
            file_path=file_path,
            status=ImportStatus.PENDING
        )
        self.db.save_import_session(session)
        
        try:
            data = self._load_file(file_path)
            session.total_records = len(data)
            
            for record in data:
                try:
                    result = self._process_deal_record(record, operator)
                    if result == 'success':
                        session.success_count += 1
                    elif result == 'duplicate':
                        session.duplicate_count += 1
                except Exception as e:
                    session.failed_count += 1
                    if not session.error_message:
                        session.error_message = str(e)
            
            if session.failed_count > 0 and session.success_count == 0:
                session.status = ImportStatus.FAILED
            elif session.failed_count > 0:
                session.status = ImportStatus.PARTIAL
            else:
                session.status = ImportStatus.SUCCESS
                
        except Exception as e:
            session.status = ImportStatus.FAILED
            session.error_message = str(e)
        finally:
            session.completed_at = datetime.now()
            self.db.save_import_session(session)
        
        return session

    def import_leads(self, file_path: str, operator: str = "system") -> ImportSession:
        session = ImportSession(
            id=f"import_{uuid.uuid4().hex[:8]}",
            source_type="lead",
            file_path=file_path,
            status=ImportStatus.PENDING
        )
        self.db.save_import_session(session)
        
        try:
            data = self._load_file(file_path)
            session.total_records = len(data)
            
            for record in data:
                try:
                    result = self._process_lead_record(record, operator)
                    if result == 'success':
                        session.success_count += 1
                    elif result == 'duplicate':
                        session.duplicate_count += 1
                    elif result == 'blacklisted':
                        session.blacklisted_count += 1
                except Exception as e:
                    session.failed_count += 1
                    if not session.error_message:
                        session.error_message = str(e)
            
            if session.failed_count > 0 and session.success_count == 0:
                session.status = ImportStatus.FAILED
            elif session.failed_count > 0:
                session.status = ImportStatus.PARTIAL
            else:
                session.status = ImportStatus.SUCCESS
                
        except Exception as e:
            session.status = ImportStatus.FAILED
            session.error_message = str(e)
        finally:
            session.completed_at = datetime.now()
            self.db.save_import_session(session)
        
        return session

    def _load_file(self, file_path: str) -> List[Dict]:
        if file_path.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'data' in data:
                    return data['data']
                return data
        elif file_path.endswith('.csv'):
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                return list(reader)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")

    def _parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return date_parser.parse(value)
        raise ValueError(f"Cannot parse datetime: {value}")

    def _get_or_create_customer(self, record: Dict, operator: str) -> Tuple[Customer, bool]:
        email = record.get('email')
        phone = record.get('phone')
        external_id = record.get('external_id')
        
        if email and self.db.is_blacklisted(email):
            raise ValueError(f"Email is blacklisted: {email}")
        if phone and self.db.is_blacklisted(phone):
            raise ValueError(f"Phone is blacklisted: {phone}")
        
        customer = self.db.find_customer(email=email, phone=phone, external_id=external_id)
        is_new = False
        
        if customer is None:
            is_new = True
            customer_type = CustomerType(record.get('customer_type', 'individual'))
            customer = Customer(
                id=f"customer_{uuid.uuid4().hex[:8]}",
                name=record.get('name', record.get('customer_name', 'Unknown')),
                customer_type=customer_type,
                email=email,
                phone=phone,
                company_name=record.get('company_name'),
                external_id=external_id,
                status=RecordStatus.ACTIVE
            )
            self.db.save_customer(customer)
            self.db.save_audit_log(AuditLog(
                id=f"audit_{uuid.uuid4().hex[:8]}",
                action='CREATE_CUSTOMER',
                record_type='customer',
                record_id=customer.id,
                old_value=None,
                new_value=asdict(customer),
                operator=operator
            ))
        
        return customer, is_new

    def _process_ad_click_record(self, record: Dict, operator: str) -> str:
        external_id = record.get('external_id')
        if external_id:
            existing = [a for a in self.db.get_all_ad_clicks() if a.external_id == external_id]
            if existing:
                return 'duplicate'
        
        email = record.get('email')
        if email and self.db.is_blacklisted(email):
            return 'blacklisted'
        
        customer, is_new = self._get_or_create_customer(record, operator)
        
        ad_click = AdClick(
            id=f"ad_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            campaign_id=record.get('campaign_id', record.get('campaign', f"campaign_{uuid.uuid4().hex[:4]}")),
            campaign_name=record.get('campaign_name', record.get('campaign', 'Unknown Campaign')),
            channel=record.get('channel', 'Unknown'),
            click_time=self._parse_datetime(record.get('click_time', record.get('time', datetime.now()))),
            cost=float(record.get('cost', 0)),
            external_id=external_id,
            status=RecordStatus.ACTIVE,
            metadata={k: v for k, v in record.items() if k not in [
                'email', 'phone', 'external_id', 'name', 'customer_name', 
                'customer_type', 'company_name'
            ]}
        )
        self.db.save_ad_click(ad_click)
        
        return 'success'

    def _process_event_record(self, record: Dict, operator: str) -> str:
        external_id = record.get('external_id')
        if external_id:
            existing = [e for e in self.db.get_all_event_attendances() if e.external_id == external_id]
            if existing:
                return 'duplicate'
        
        email = record.get('email')
        if email and self.db.is_blacklisted(email):
            return 'blacklisted'
        
        customer, is_new = self._get_or_create_customer(record, operator)
        
        event = EventAttendance(
            id=f"event_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            event_id=record.get('event_id', f"event_{uuid.uuid4().hex[:4]}"),
            event_name=record.get('event_name', record.get('event', 'Unknown Event')),
            event_type=record.get('event_type', 'conference'),
            checkin_time=self._parse_datetime(record.get('checkin_time', record.get('time', datetime.now()))),
            booth=record.get('booth'),
            salesperson=record.get('salesperson'),
            external_id=external_id,
            status=RecordStatus.ACTIVE,
            metadata={k: v for k, v in record.items() if k not in [
                'email', 'phone', 'external_id', 'name', 'customer_name',
                'customer_type', 'company_name'
            ]}
        )
        self.db.save_event_attendance(event)
        
        return 'success'

    def _process_referral_record(self, record: Dict, operator: str) -> str:
        external_id = record.get('external_id')
        if external_id:
            existing = [r for r in self.db.get_all_referrals() if r.external_id == external_id]
            if existing:
                return 'duplicate'
        
        email = record.get('email')
        if email and self.db.is_blacklisted(email):
            return 'blacklisted'
        
        customer, is_new = self._get_or_create_customer(record, operator)
        
        referral = Referral(
            id=f"referral_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            referrer_id=record.get('referrer_id'),
            referrer_name=record.get('referrer_name'),
            referral_time=self._parse_datetime(record.get('referral_time', record.get('time', datetime.now()))),
            referral_channel=record.get('referral_channel', 'direct'),
            external_id=external_id,
            status=RecordStatus.ACTIVE,
            metadata={k: v for k, v in record.items() if k not in [
                'email', 'phone', 'external_id', 'name', 'customer_name',
                'customer_type', 'company_name'
            ]}
        )
        self.db.save_referral(referral)
        
        return 'success'

    def _process_deal_record(self, record: Dict, operator: str) -> str:
        external_id = record.get('external_id')
        if external_id:
            existing = [d for d in self.db.get_all_deals() if d.external_id == external_id]
            if existing:
                return 'duplicate'
        
        customer, is_new = self._get_or_create_customer(record, operator)
        
        deal = Deal(
            id=f"deal_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            deal_name=record.get('deal_name', record.get('name', f"Deal for {customer.name}")),
            amount=float(record.get('amount', record.get('value', 0))),
            close_time=self._parse_datetime(record.get('close_time', record.get('time', datetime.now()))),
            salesperson=record.get('salesperson'),
            pipeline_stage=record.get('stage', 'closed_won'),
            external_id=external_id,
            status=record.get('status', 'won'),
            metadata={k: v for k, v in record.items() if k not in [
                'email', 'phone', 'external_id', 'name', 'customer_name',
                'customer_type', 'company_name'
            ]}
        )
        self.db.save_deal(deal)
        
        follow_up = SalesFollowUp(
            id=f"followup_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            deal_id=deal.id,
            follow_up_time=deal.close_time,
            salesperson=deal.salesperson,
            status='completed',
            notes=f"Deal closed: {deal.deal_name}, Amount: {deal.amount}"
        )
        self.db.save_sales_follow_up(follow_up)
        
        return 'success'

    def _process_lead_record(self, record: Dict, operator: str) -> str:
        external_id = record.get('external_id')
        if external_id:
            existing = [l for l in self.db.get_all_leads() if l.external_id == external_id]
            if existing:
                return 'duplicate'
        
        email = record.get('email')
        if email and self.db.is_blacklisted(email):
            return 'blacklisted'
        
        customer, is_new = self._get_or_create_customer(record, operator)
        
        source_type_str = record.get('source_type', record.get('source', 'organic'))
        source_type = SourceType(source_type_str)
        
        lead = Lead(
            id=f"lead_{uuid.uuid4().hex[:8]}",
            customer_id=customer.id,
            source_type=source_type,
            source_details={
                'campaign': record.get('campaign'),
                'channel': record.get('channel'),
                'landing_page': record.get('landing_page')
            },
            touch_time=self._parse_datetime(record.get('touch_time', record.get('time', datetime.now()))),
            external_id=external_id,
            status=RecordStatus.ACTIVE
        )
        self.db.save_lead(lead)
        
        return 'success'

    def add_to_blacklist(self, identifier: str, identifier_type: str, 
                         reason: str = None, operator: str = "system") -> Blacklist:
        blacklist = Blacklist(
            id=f"blacklist_{uuid.uuid4().hex[:8]}",
            identifier=identifier,
            identifier_type=identifier_type,
            reason=reason,
            added_by=operator
        )
        self.db.save_blacklist(blacklist)
        
        self.db.save_audit_log(AuditLog(
            id=f"audit_{uuid.uuid4().hex[:8]}",
            action='ADD_BLACKLIST',
            record_type='blacklist',
            record_id=blacklist.id,
            old_value=None,
            new_value=asdict(blacklist),
            operator=operator,
            reason=reason
        ))
        
        return blacklist

    def check_data_consistency(self) -> Dict[str, Any]:
        issues = []
        
        deals = self.db.get_all_deals()
        for deal in deals:
            customer = self.db.get_customer_by_id(deal.customer_id)
            if not customer:
                issues.append({
                    'type': 'missing_customer',
                    'deal_id': deal.id,
                    'message': f"Deal {deal.id} references non-existent customer {deal.customer_id}"
                })
                continue
            
            touch_points = self.db.get_customer_touch_points(customer.id, deal.close_time)
            late_touch_points = [
                tp for tp in touch_points 
                if tp['touch_time'] > deal.close_time
            ]
            if late_touch_points:
                issues.append({
                    'type': 'source_after_deal',
                    'deal_id': deal.id,
                    'customer': customer.name,
                    'count': len(late_touch_points),
                    'message': f"Customer {customer.name} has {len(late_touch_points)} touch points after deal close"
                })
        
        all_attributions = self.db.get_all_attributions()
        deal_attr_map = {}
        for attr in all_attributions:
            key = (attr.deal_id, attr.attribution_type.value)
            if key not in deal_attr_map:
                deal_attr_map[key] = []
            deal_attr_map[key].append(attr)
        
        for (deal_id, attr_type), attrs in deal_attr_map.items():
            total = sum(a.percentage for a in attrs)
            if not (99 <= total <= 101):
                issues.append({
                    'type': 'attribution_percentage_error',
                    'deal_id': deal_id,
                    'attribution_type': attr_type,
                    'total_percentage': total,
                    'message': f"Deal {deal_id} {attr_type} attribution totals {total}%, should be ~100%"
                })
        
        return {
            'total_deals': len(deals),
            'total_attributions': len(all_attributions),
            'issues_found': len(issues),
            'issues': issues
        }
