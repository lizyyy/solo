import os
import sqlite3
import json
from datetime import datetime
from typing import Dict, Any, Optional, List, TypeVar, Type
from contextlib import contextmanager
from .models import (
    Customer, SourceType, CustomerType, RecordStatus,
    Lead, AdClick, EventAttendance, Referral, Deal,
    Attribution, AttributionType, AuditLog, ImportSession,
    ImportStatus, Blacklist, SalesFollowUp
)

T = TypeVar('T')


class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.environ.get(
                'LEAD_ATTRIBUTION_DB',
                os.path.join(os.getcwd(), '.lead_attribution', 'database.sqlite')
            )
        self.db_path = db_path
        self._ensure_directory()

    def _ensure_directory(self):
        directory = os.path.dirname(self.db_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_database(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.executescript('''
                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    customer_type TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    company_name TEXT,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT
                );
                
                CREATE TABLE IF NOT EXISTS leads (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    source_details TEXT,
                    touch_time TEXT NOT NULL,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS ad_clicks (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    campaign_id TEXT NOT NULL,
                    campaign_name TEXT NOT NULL,
                    channel TEXT NOT NULL,
                    click_time TEXT NOT NULL,
                    cost REAL DEFAULT 0,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS event_attendances (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    event_name TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    checkin_time TEXT NOT NULL,
                    booth TEXT,
                    salesperson TEXT,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS referrals (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    referrer_id TEXT,
                    referrer_name TEXT,
                    referral_time TEXT NOT NULL,
                    referral_channel TEXT,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS deals (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    deal_name TEXT NOT NULL,
                    amount REAL NOT NULL,
                    close_time TEXT NOT NULL,
                    salesperson TEXT,
                    pipeline_stage TEXT,
                    external_id TEXT,
                    status TEXT NOT NULL DEFAULT 'won',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS attributions (
                    id TEXT PRIMARY KEY,
                    deal_id TEXT NOT NULL,
                    customer_id TEXT NOT NULL,
                    attribution_type TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    source_record_id TEXT NOT NULL,
                    source_record_type TEXT NOT NULL,
                    percentage REAL NOT NULL,
                    amount REAL NOT NULL,
                    is_manual INTEGER NOT NULL DEFAULT 0,
                    operator TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (deal_id) REFERENCES deals(id),
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
                
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    operator TEXT,
                    reason TEXT,
                    created_at TEXT NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS import_sessions (
                    id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    total_records INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    failed_count INTEGER DEFAULT 0,
                    duplicate_count INTEGER DEFAULT 0,
                    blacklisted_count INTEGER DEFAULT 0,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    started_at TEXT NOT NULL,
                    completed_at TEXT
                );
                
                CREATE TABLE IF NOT EXISTS blacklist (
                    id TEXT PRIMARY KEY,
                    identifier TEXT NOT NULL UNIQUE,
                    identifier_type TEXT NOT NULL,
                    reason TEXT,
                    added_by TEXT,
                    added_at TEXT NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS sales_follow_ups (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    deal_id TEXT,
                    follow_up_time TEXT NOT NULL,
                    salesperson TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    notes TEXT,
                    next_follow_up TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (customer_id) REFERENCES customers(id),
                    FOREIGN KEY (deal_id) REFERENCES deals(id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
                CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
                CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers(external_id);
                CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
                CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
                CREATE INDEX IF NOT EXISTS idx_ad_clicks_customer_id ON ad_clicks(customer_id);
                CREATE INDEX IF NOT EXISTS idx_event_attendances_customer_id ON event_attendances(customer_id);
                CREATE INDEX IF NOT EXISTS idx_referrals_customer_id ON referrals(customer_id);
                CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
                CREATE INDEX IF NOT EXISTS idx_attributions_deal_id ON attributions(deal_id);
                CREATE INDEX IF NOT EXISTS idx_attributions_customer_id ON attributions(customer_id);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_type, record_id);
                CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
                CREATE INDEX IF NOT EXISTS idx_sales_follow_ups_customer_id ON sales_follow_ups(customer_id);
            ''')

    def _serialize(self, obj: Any) -> str:
        if isinstance(obj, dict):
            return json.dumps(obj, ensure_ascii=False, default=str)
        if isinstance(obj, list):
            return json.dumps(obj, ensure_ascii=False, default=str)
        return obj

    def _deserialize(self, data: str) -> Any:
        if data is None:
            return None
        try:
            return json.loads(data)
        except (TypeError, json.JSONDecodeError):
            return data

    def _datetime_to_str(self, dt: datetime) -> str:
        return dt.strftime('%Y-%m-%d %H:%M:%S')

    def _str_to_datetime(self, s: str) -> datetime:
        if s is None:
            return None
        return datetime.strptime(s, '%Y-%m-%d %H:%M:%S')

    def save_customer(self, customer: Customer) -> Customer:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO customers 
                (id, name, customer_type, email, phone, company_name, 
                 external_id, status, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                customer.id,
                customer.name,
                customer.customer_type.value,
                customer.email,
                customer.phone,
                customer.company_name,
                customer.external_id,
                customer.status.value,
                self._datetime_to_str(customer.created_at),
                self._datetime_to_str(customer.updated_at),
                self._serialize(customer.metadata)
            ))
        return customer

    def get_customer_by_id(self, customer_id: str) -> Optional[Customer]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers WHERE id = ?', (customer_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_customer(row)
            return None

    def get_customer_by_email(self, email: str) -> Optional[Customer]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers WHERE email = ? AND status = ?', 
                          (email, RecordStatus.ACTIVE.value))
            row = cursor.fetchone()
            if row:
                return self._row_to_customer(row)
            return None

    def get_customer_by_phone(self, phone: str) -> Optional[Customer]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers WHERE phone = ? AND status = ?',
                          (phone, RecordStatus.ACTIVE.value))
            row = cursor.fetchone()
            if row:
                return self._row_to_customer(row)
            return None

    def get_customer_by_external_id(self, external_id: str) -> Optional[Customer]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers WHERE external_id = ? AND status = ?',
                          (external_id, RecordStatus.ACTIVE.value))
            row = cursor.fetchone()
            if row:
                return self._row_to_customer(row)
            return None

    def find_customer(self, email: str = None, phone: str = None, 
                      external_id: str = None) -> Optional[Customer]:
        if external_id:
            return self.get_customer_by_external_id(external_id)
        if email:
            return self.get_customer_by_email(email)
        if phone:
            return self.get_customer_by_phone(phone)
        return None

    def _row_to_customer(self, row) -> Customer:
        return Customer(
            id=row['id'],
            name=row['name'],
            customer_type=CustomerType(row['customer_type']),
            email=row['email'],
            phone=row['phone'],
            company_name=row['company_name'],
            external_id=row['external_id'],
            status=RecordStatus(row['status']),
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at']),
            metadata=self._deserialize(row['metadata']) or {}
        )

    def save_lead(self, lead: Lead) -> Lead:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO leads 
                (id, customer_id, source_type, source_details, touch_time,
                 external_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                lead.id,
                lead.customer_id,
                lead.source_type.value,
                self._serialize(lead.source_details),
                self._datetime_to_str(lead.touch_time),
                lead.external_id,
                lead.status.value,
                self._datetime_to_str(lead.created_at),
                self._datetime_to_str(lead.updated_at)
            ))
        return lead

    def save_ad_click(self, ad_click: AdClick) -> AdClick:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO ad_clicks 
                (id, customer_id, campaign_id, campaign_name, channel,
                 click_time, cost, external_id, status, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                ad_click.id,
                ad_click.customer_id,
                ad_click.campaign_id,
                ad_click.campaign_name,
                ad_click.channel,
                self._datetime_to_str(ad_click.click_time),
                ad_click.cost,
                ad_click.external_id,
                ad_click.status.value,
                self._datetime_to_str(ad_click.created_at),
                self._datetime_to_str(ad_click.updated_at),
                self._serialize(ad_click.metadata)
            ))
        return ad_click

    def save_event_attendance(self, event: EventAttendance) -> EventAttendance:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO event_attendances 
                (id, customer_id, event_id, event_name, event_type,
                 checkin_time, booth, salesperson, external_id, status, 
                 created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                event.id,
                event.customer_id,
                event.event_id,
                event.event_name,
                event.event_type,
                self._datetime_to_str(event.checkin_time),
                event.booth,
                event.salesperson,
                event.external_id,
                event.status.value,
                self._datetime_to_str(event.created_at),
                self._datetime_to_str(event.updated_at),
                self._serialize(event.metadata)
            ))
        return event

    def save_referral(self, referral: Referral) -> Referral:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO referrals 
                (id, customer_id, referrer_id, referrer_name, referral_time,
                 referral_channel, external_id, status, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                referral.id,
                referral.customer_id,
                referral.referrer_id,
                referral.referrer_name,
                self._datetime_to_str(referral.referral_time),
                referral.referral_channel,
                referral.external_id,
                referral.status.value,
                self._datetime_to_str(referral.created_at),
                self._datetime_to_str(referral.updated_at),
                self._serialize(referral.metadata)
            ))
        return referral

    def save_deal(self, deal: Deal) -> Deal:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO deals 
                (id, customer_id, deal_name, amount, close_time,
                 salesperson, pipeline_stage, external_id, status, 
                 created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                deal.id,
                deal.customer_id,
                deal.deal_name,
                deal.amount,
                self._datetime_to_str(deal.close_time),
                deal.salesperson,
                deal.pipeline_stage,
                deal.external_id,
                deal.status,
                self._datetime_to_str(deal.created_at),
                self._datetime_to_str(deal.updated_at),
                self._serialize(deal.metadata)
            ))
        return deal

    def save_attribution(self, attribution: Attribution) -> Attribution:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO attributions 
                (id, deal_id, customer_id, attribution_type, source_type,
                 source_record_id, source_record_type, percentage, amount,
                 is_manual, operator, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                attribution.id,
                attribution.deal_id,
                attribution.customer_id,
                attribution.attribution_type.value,
                attribution.source_type.value,
                attribution.source_record_id,
                attribution.source_record_type,
                attribution.percentage,
                attribution.amount,
                1 if attribution.is_manual else 0,
                attribution.operator,
                self._datetime_to_str(attribution.created_at)
            ))
        return attribution

    def delete_attributions(self, deal_id: str, attribution_type: AttributionType = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if attribution_type:
                cursor.execute(
                    'DELETE FROM attributions WHERE deal_id = ? AND attribution_type = ?',
                    (deal_id, attribution_type.value)
                )
            else:
                cursor.execute(
                    'DELETE FROM attributions WHERE deal_id = ?',
                    (deal_id,)
                )

    def save_audit_log(self, audit: AuditLog) -> AuditLog:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO audit_logs 
                (id, action, record_type, record_id, old_value, new_value,
                 operator, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                audit.id,
                audit.action,
                audit.record_type,
                audit.record_id,
                self._serialize(audit.old_value),
                self._serialize(audit.new_value),
                audit.operator,
                audit.reason,
                self._datetime_to_str(audit.created_at)
            ))
        return audit

    def save_import_session(self, session: ImportSession) -> ImportSession:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO import_sessions 
                (id, source_type, file_path, total_records, success_count,
                 failed_count, duplicate_count, blacklisted_count, status,
                 error_message, started_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session.id,
                session.source_type,
                session.file_path,
                session.total_records,
                session.success_count,
                session.failed_count,
                session.duplicate_count,
                session.blacklisted_count,
                session.status.value,
                session.error_message,
                self._datetime_to_str(session.started_at),
                self._datetime_to_str(session.completed_at) if session.completed_at else None
            ))
        return session

    def save_blacklist(self, blacklist: Blacklist) -> Blacklist:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO blacklist 
                (id, identifier, identifier_type, reason, added_by, added_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                blacklist.id,
                blacklist.identifier,
                blacklist.identifier_type,
                blacklist.reason,
                blacklist.added_by,
                self._datetime_to_str(blacklist.added_at)
            ))
        return blacklist

    def is_blacklisted(self, identifier: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM blacklist WHERE identifier = ?', (identifier,))
            return cursor.fetchone() is not None

    def save_sales_follow_up(self, follow_up: SalesFollowUp) -> SalesFollowUp:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO sales_follow_ups 
                (id, customer_id, deal_id, follow_up_time, salesperson,
                 status, notes, next_follow_up, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                follow_up.id,
                follow_up.customer_id,
                follow_up.deal_id,
                self._datetime_to_str(follow_up.follow_up_time),
                follow_up.salesperson,
                follow_up.status,
                follow_up.notes,
                self._datetime_to_str(follow_up.next_follow_up) if follow_up.next_follow_up else None,
                self._datetime_to_str(follow_up.created_at),
                self._datetime_to_str(follow_up.updated_at)
            ))
        return follow_up

    def get_deal_by_id(self, deal_id: str) -> Optional[Deal]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM deals WHERE id = ?', (deal_id,))
            row = cursor.fetchone()
            if row:
                return Deal(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    deal_name=row['deal_name'],
                    amount=row['amount'],
                    close_time=self._str_to_datetime(row['close_time']),
                    salesperson=row['salesperson'],
                    pipeline_stage=row['pipeline_stage'],
                    external_id=row['external_id'],
                    status=row['status'],
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at']),
                    metadata=self._deserialize(row['metadata']) or {}
                )
        return None

    def get_all_deals(self) -> List[Deal]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM deals')
            deals = []
            for row in cursor.fetchall():
                deals.append(Deal(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    deal_name=row['deal_name'],
                    amount=row['amount'],
                    close_time=self._str_to_datetime(row['close_time']),
                    salesperson=row['salesperson'],
                    pipeline_stage=row['pipeline_stage'],
                    external_id=row['external_id'],
                    status=row['status'],
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at']),
                    metadata=self._deserialize(row['metadata']) or {}
                ))
            return deals

    def get_customer_touch_points(self, customer_id: str, before_time: datetime = None) -> List[Dict]:
        touch_points = []
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, customer_id, source_type, touch_time, source_details, 'lead' as record_type
                FROM leads 
                WHERE customer_id = ? AND status = ?
            ''', (customer_id, RecordStatus.ACTIVE.value))
            for row in cursor.fetchall():
                tp = {
                    'id': row['id'],
                    'customer_id': row['customer_id'],
                    'source_type': SourceType(row['source_type']),
                    'touch_time': self._str_to_datetime(row['touch_time']),
                    'source_details': self._deserialize(row['source_details']) or {},
                    'record_type': row['record_type']
                }
                touch_points.append(tp)
            
            cursor.execute('''
                SELECT id, customer_id, campaign_id, campaign_name, channel, click_time, cost, 
                       'ad_click' as record_type
                FROM ad_clicks 
                WHERE customer_id = ? AND status = ?
            ''', (customer_id, RecordStatus.ACTIVE.value))
            for row in cursor.fetchall():
                tp = {
                    'id': row['id'],
                    'customer_id': row['customer_id'],
                    'source_type': SourceType.AD,
                    'touch_time': self._str_to_datetime(row['click_time']),
                    'source_details': {
                        'campaign_id': row['campaign_id'],
                        'campaign_name': row['campaign_name'],
                        'channel': row['channel'],
                        'cost': row['cost']
                    },
                    'record_type': row['record_type']
                }
                touch_points.append(tp)
            
            cursor.execute('''
                SELECT id, customer_id, event_id, event_name, event_type, checkin_time, booth, salesperson,
                       'event' as record_type
                FROM event_attendances 
                WHERE customer_id = ? AND status = ?
            ''', (customer_id, RecordStatus.ACTIVE.value))
            for row in cursor.fetchall():
                tp = {
                    'id': row['id'],
                    'customer_id': row['customer_id'],
                    'source_type': SourceType.EVENT,
                    'touch_time': self._str_to_datetime(row['checkin_time']),
                    'source_details': {
                        'event_id': row['event_id'],
                        'event_name': row['event_name'],
                        'event_type': row['event_type'],
                        'booth': row['booth'],
                        'salesperson': row['salesperson']
                    },
                    'record_type': row['record_type']
                }
                touch_points.append(tp)
            
            cursor.execute('''
                SELECT id, customer_id, referrer_id, referrer_name, referral_time, referral_channel,
                       'referral' as record_type
                FROM referrals 
                WHERE customer_id = ? AND status = ?
            ''', (customer_id, RecordStatus.ACTIVE.value))
            for row in cursor.fetchall():
                tp = {
                    'id': row['id'],
                    'customer_id': row['customer_id'],
                    'source_type': SourceType.REFERRAL,
                    'touch_time': self._str_to_datetime(row['referral_time']),
                    'source_details': {
                        'referrer_id': row['referrer_id'],
                        'referrer_name': row['referrer_name'],
                        'referral_channel': row['referral_channel']
                    },
                    'record_type': row['record_type']
                }
                touch_points.append(tp)
        
        if before_time:
            touch_points = [tp for tp in touch_points if tp['touch_time'] <= before_time]
        
        touch_points.sort(key=lambda x: x['touch_time'])
        return touch_points

    def get_attributions_by_deal(self, deal_id: str) -> List[Attribution]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM attributions WHERE deal_id = ?', (deal_id,))
            attributions = []
            for row in cursor.fetchall():
                attributions.append(Attribution(
                    id=row['id'],
                    deal_id=row['deal_id'],
                    customer_id=row['customer_id'],
                    attribution_type=AttributionType(row['attribution_type']),
                    source_type=SourceType(row['source_type']),
                    source_record_id=row['source_record_id'],
                    source_record_type=row['source_record_type'],
                    percentage=row['percentage'],
                    amount=row['amount'],
                    is_manual=row['is_manual'] == 1,
                    operator=row['operator'],
                    created_at=self._str_to_datetime(row['created_at'])
                ))
            return attributions

    def get_all_customers(self) -> List[Customer]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers')
            return [self._row_to_customer(row) for row in cursor.fetchall()]

    def get_audit_logs(self, record_type: str = None, record_id: str = None) -> List[AuditLog]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM audit_logs'
            params = []
            conditions = []
            
            if record_type:
                conditions.append('record_type = ?')
                params.append(record_type)
            if record_id:
                conditions.append('record_id = ?')
                params.append(record_id)
            
            if conditions:
                query += ' WHERE ' + ' AND '.join(conditions)
            query += ' ORDER BY created_at DESC'
            
            cursor.execute(query, params)
            logs = []
            for row in cursor.fetchall():
                logs.append(AuditLog(
                    id=row['id'],
                    action=row['action'],
                    record_type=row['record_type'],
                    record_id=row['record_id'],
                    old_value=self._deserialize(row['old_value']),
                    new_value=self._deserialize(row['new_value']),
                    operator=row['operator'],
                    reason=row['reason'],
                    created_at=self._str_to_datetime(row['created_at'])
                ))
            return logs

    def get_import_sessions(self) -> List[ImportSession]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM import_sessions ORDER BY started_at DESC')
            sessions = []
            for row in cursor.fetchall():
                sessions.append(ImportSession(
                    id=row['id'],
                    source_type=row['source_type'],
                    file_path=row['file_path'],
                    total_records=row['total_records'],
                    success_count=row['success_count'],
                    failed_count=row['failed_count'],
                    duplicate_count=row['duplicate_count'],
                    blacklisted_count=row['blacklisted_count'],
                    status=ImportStatus(row['status']),
                    error_message=row['error_message'],
                    started_at=self._str_to_datetime(row['started_at']),
                    completed_at=self._str_to_datetime(row['completed_at']) if row['completed_at'] else None
                ))
            return sessions

    def get_sales_follow_ups(self, customer_id: str = None, deal_id: str = None) -> List[SalesFollowUp]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM sales_follow_ups'
            params = []
            conditions = []
            
            if customer_id:
                conditions.append('customer_id = ?')
                params.append(customer_id)
            if deal_id:
                conditions.append('deal_id = ?')
                params.append(deal_id)
            
            if conditions:
                query += ' WHERE ' + ' AND '.join(conditions)
            query += ' ORDER BY follow_up_time DESC'
            
            cursor.execute(query, params)
            follow_ups = []
            for row in cursor.fetchall():
                follow_ups.append(SalesFollowUp(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    deal_id=row['deal_id'],
                    follow_up_time=self._str_to_datetime(row['follow_up_time']),
                    salesperson=row['salesperson'],
                    status=row['status'],
                    notes=row['notes'],
                    next_follow_up=self._str_to_datetime(row['next_follow_up']) if row['next_follow_up'] else None,
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at'])
                ))
            return follow_ups

    def get_all_attributions(self) -> List[Attribution]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM attributions')
            attributions = []
            for row in cursor.fetchall():
                attributions.append(Attribution(
                    id=row['id'],
                    deal_id=row['deal_id'],
                    customer_id=row['customer_id'],
                    attribution_type=AttributionType(row['attribution_type']),
                    source_type=SourceType(row['source_type']),
                    source_record_id=row['source_record_id'],
                    source_record_type=row['source_record_type'],
                    percentage=row['percentage'],
                    amount=row['amount'],
                    is_manual=row['is_manual'] == 1,
                    operator=row['operator'],
                    created_at=self._str_to_datetime(row['created_at'])
                ))
            return attributions

    def get_all_ad_clicks(self) -> List[AdClick]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM ad_clicks')
            items = []
            for row in cursor.fetchall():
                items.append(AdClick(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    campaign_id=row['campaign_id'],
                    campaign_name=row['campaign_name'],
                    channel=row['channel'],
                    click_time=self._str_to_datetime(row['click_time']),
                    cost=row['cost'],
                    external_id=row['external_id'],
                    status=RecordStatus(row['status']),
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at']),
                    metadata=self._deserialize(row['metadata']) or {}
                ))
            return items

    def get_all_event_attendances(self) -> List[EventAttendance]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM event_attendances')
            items = []
            for row in cursor.fetchall():
                items.append(EventAttendance(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    event_id=row['event_id'],
                    event_name=row['event_name'],
                    event_type=row['event_type'],
                    checkin_time=self._str_to_datetime(row['checkin_time']),
                    booth=row['booth'],
                    salesperson=row['salesperson'],
                    external_id=row['external_id'],
                    status=RecordStatus(row['status']),
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at']),
                    metadata=self._deserialize(row['metadata']) or {}
                ))
            return items

    def get_all_referrals(self) -> List[Referral]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM referrals')
            items = []
            for row in cursor.fetchall():
                items.append(Referral(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    referrer_id=row['referrer_id'],
                    referrer_name=row['referrer_name'],
                    referral_time=self._str_to_datetime(row['referral_time']),
                    referral_channel=row['referral_channel'],
                    external_id=row['external_id'],
                    status=RecordStatus(row['status']),
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at']),
                    metadata=self._deserialize(row['metadata']) or {}
                ))
            return items

    def get_all_leads(self) -> List[Lead]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM leads')
            items = []
            for row in cursor.fetchall():
                items.append(Lead(
                    id=row['id'],
                    customer_id=row['customer_id'],
                    source_type=SourceType(row['source_type']),
                    source_details=self._deserialize(row['source_details']) or {},
                    touch_time=self._str_to_datetime(row['touch_time']),
                    external_id=row['external_id'],
                    status=RecordStatus(row['status']),
                    created_at=self._str_to_datetime(row['created_at']),
                    updated_at=self._str_to_datetime(row['updated_at'])
                ))
            return items

    def get_all_blacklist(self) -> List[Blacklist]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM blacklist')
            items = []
            for row in cursor.fetchall():
                items.append(Blacklist(
                    id=row['id'],
                    identifier=row['identifier'],
                    identifier_type=row['identifier_type'],
                    reason=row['reason'],
                    added_by=row['added_by'],
                    added_at=self._str_to_datetime(row['added_at'])
                ))
            return items
