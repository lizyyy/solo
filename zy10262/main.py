from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
from collections import defaultdict

app = FastAPI(title="托育接送授权 API", version="1.0.0")


class AuthorizationType(str, Enum):
    PERMANENT = "permanent"
    TEMPORARY = "temporary"


class PickupStatus(str, Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    PENDING = "pending"


class ExceptionType(str, Enum):
    UNAUTHORIZED_PICKUP = "unauthorized_pickup"
    EXPIRED_AUTHORIZATION = "expired_authorization"
    DUPLICATE_CHECKOUT = "duplicate_checkout"
    DUPLICATE_FEE = "duplicate_fee"
    CLOSED_WITHOUT_NOTE = "closed_without_note"
    OTHER = "other"


class Child(BaseModel):
    child_id: str
    name: str
    birth_date: date
    guardian_name: str
    guardian_phone: str
    created_at: datetime
    is_active: bool = True


class AuthorizedPerson(BaseModel):
    person_id: str
    name: str
    id_card: str
    phone: str
    relation: str
    photo_url: Optional[str] = None
    created_at: datetime


class Authorization(BaseModel):
    auth_id: str
    child_id: str
    person_id: str
    auth_type: AuthorizationType
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    created_by: str
    is_active: bool = True
    idempotency_key: Optional[str] = None


class PickupRecord(BaseModel):
    record_id: str
    child_id: str
    person_id: str
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: PickupStatus
    date: date
    idempotency_key: Optional[str] = None
    created_at: datetime


class LatePickupFee(BaseModel):
    fee_id: str
    record_id: str
    child_id: str
    late_minutes: int
    fee_amount: float
    fee_rate: float
    calculated_at: datetime
    is_paid: bool = False
    idempotency_key: Optional[str] = None


class ExceptionRecord(BaseModel):
    exception_id: str
    child_id: str
    person_id: Optional[str] = None
    record_id: Optional[str] = None
    exception_type: ExceptionType
    description: str
    reported_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    idempotency_key: Optional[str] = None


class InMemoryDB:
    def __init__(self):
        self.children: Dict[str, Child] = {}
        self.authorized_persons: Dict[str, AuthorizedPerson] = {}
        self.authorizations: Dict[str, Authorization] = {}
        self.pickup_records: Dict[str, PickupRecord] = {}
        self.late_fees: Dict[str, LatePickupFee] = {}
        self.exceptions: Dict[str, ExceptionRecord] = {}
        self.idempotency_keys: Dict[str, str] = {}
        
    def check_idempotency(self, key: str) -> Optional[str]:
        return self.idempotency_keys.get(key)
    
    def store_idempotency(self, key: str, result_id: str):
        self.idempotency_keys[key] = result_id


db = InMemoryDB()


def get_db():
    return db


def is_authorized(child_id: str, person_id: str, db: InMemoryDB) -> tuple[bool, Optional[str]]:
    now = datetime.now()
    for auth in db.authorizations.values():
        if auth.child_id == child_id and auth.person_id == person_id and auth.is_active:
            if auth.auth_type == AuthorizationType.PERMANENT:
                return True, None
            if auth.start_date and auth.end_date:
                if auth.start_date <= now <= auth.end_date:
                    return True, None
                else:
                    return False, "授权已过期"
    return False, "未找到有效授权"


def calculate_late_fee(check_out_time: datetime, standard_end_time: datetime = None) -> tuple[int, float]:
    if standard_end_time is None:
        standard_end_time = check_out_time.replace(hour=17, minute=0, second=0, microsecond=0)
    
    if check_out_time <= standard_end_time:
        return 0, 0.0
    
    late_delta = check_out_time - standard_end_time
    late_minutes = int(late_delta.total_seconds() // 60)
    
    rate_per_minute = 2.0
    fee_amount = late_minutes * rate_per_minute
    
    return late_minutes, fee_amount


class ChildCreate(BaseModel):
    name: str
    birth_date: date
    guardian_name: str
    guardian_phone: str


class AuthorizedPersonCreate(BaseModel):
    name: str
    id_card: str
    phone: str
    relation: str
    photo_url: Optional[str] = None


class AuthorizationCreate(BaseModel):
    child_id: str
    person_id: str
    auth_type: AuthorizationType
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_by: str
    idempotency_key: Optional[str] = None


class CheckInRequest(BaseModel):
    child_id: str
    person_id: str
    check_in_time: Optional[datetime] = None
    idempotency_key: Optional[str] = None


class CheckOutRequest(BaseModel):
    child_id: str
    person_id: str
    check_out_time: Optional[datetime] = None
    idempotency_key: Optional[str] = None


class ExceptionReportRequest(BaseModel):
    child_id: str
    person_id: Optional[str] = None
    record_id: Optional[str] = None
    exception_type: ExceptionType
    description: str
    idempotency_key: Optional[str] = None


@app.post("/children", response_model=Child)
def create_child(child: ChildCreate, db: InMemoryDB = Depends(get_db)):
    child_id = f"child_{uuid.uuid4().hex[:8]}"
    db_child = Child(
        child_id=child_id,
        name=child.name,
        birth_date=child.birth_date,
        guardian_name=child.guardian_name,
        guardian_phone=child.guardian_phone,
        created_at=datetime.now()
    )
    db.children[child_id] = db_child
    return db_child


@app.get("/children", response_model=List[Child])
def list_children(db: InMemoryDB = Depends(get_db)):
    return list(db.children.values())


@app.get("/children/{child_id}", response_model=Child)
def get_child(child_id: str, db: InMemoryDB = Depends(get_db)):
    if child_id not in db.children:
        raise HTTPException(status_code=404, detail="儿童不存在")
    return db.children[child_id]


@app.post("/authorized-persons", response_model=AuthorizedPerson)
def create_authorized_person(person: AuthorizedPersonCreate, db: InMemoryDB = Depends(get_db)):
    person_id = f"person_{uuid.uuid4().hex[:8]}"
    db_person = AuthorizedPerson(
        person_id=person_id,
        name=person.name,
        id_card=person.id_card,
        phone=person.phone,
        relation=person.relation,
        photo_url=person.photo_url,
        created_at=datetime.now()
    )
    db.authorized_persons[person_id] = db_person
    return db_person


@app.get("/authorized-persons", response_model=List[AuthorizedPerson])
def list_authorized_persons(db: InMemoryDB = Depends(get_db)):
    return list(db.authorized_persons.values())


@app.post("/authorizations", response_model=Authorization)
def create_authorization(auth: AuthorizationCreate, db: InMemoryDB = Depends(get_db)):
    if auth.idempotency_key:
        existing = db.check_idempotency(auth.idempotency_key)
        if existing:
            return db.authorizations[existing]
    
    if auth.child_id not in db.children:
        raise HTTPException(status_code=404, detail="儿童不存在")
    if auth.person_id not in db.authorized_persons:
        raise HTTPException(status_code=404, detail="授权人不存在")
    
    if auth.auth_type == AuthorizationType.TEMPORARY:
        if not auth.start_date or not auth.end_date:
            raise HTTPException(status_code=400, detail="临时授权需要开始和结束时间")
        if auth.end_date <= auth.start_date:
            raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")
    
    auth_id = f"auth_{uuid.uuid4().hex[:8]}"
    db_auth = Authorization(
        auth_id=auth_id,
        child_id=auth.child_id,
        person_id=auth.person_id,
        auth_type=auth.auth_type,
        start_date=auth.start_date,
        end_date=auth.end_date,
        created_at=datetime.now(),
        created_by=auth.created_by,
        idempotency_key=auth.idempotency_key
    )
    db.authorizations[auth_id] = db_auth
    
    if auth.idempotency_key:
        db.store_idempotency(auth.idempotency_key, auth_id)
    
    return db_auth


@app.get("/authorizations", response_model=List[Authorization])
def list_authorizations(child_id: Optional[str] = None, db: InMemoryDB = Depends(get_db)):
    result = list(db.authorizations.values())
    if child_id:
        result = [a for a in result if a.child_id == child_id]
    return result


@app.get("/authorizations/{auth_id}", response_model=Authorization)
def get_authorization(auth_id: str, db: InMemoryDB = Depends(get_db)):
    if auth_id not in db.authorizations:
        raise HTTPException(status_code=404, detail="授权不存在")
    return db.authorizations[auth_id]


@app.post("/check-in", response_model=PickupRecord)
def check_in(request: CheckInRequest, db: InMemoryDB = Depends(get_db)):
    if request.idempotency_key:
        existing = db.check_idempotency(request.idempotency_key)
        if existing:
            return db.pickup_records[existing]
    
    is_auth, auth_msg = is_authorized(request.child_id, request.person_id, db)
    if not is_auth:
        exception_id = f"exc_{uuid.uuid4().hex[:8]}"
        db.exceptions[exception_id] = ExceptionRecord(
            exception_id=exception_id,
            child_id=request.child_id,
            person_id=request.person_id,
            exception_type=ExceptionType.UNAUTHORIZED_PICKUP,
            description=f"入园被拒绝: {auth_msg}",
            reported_at=datetime.now()
        )
        raise HTTPException(status_code=403, detail=f"未授权入园: {auth_msg}")
    
    today = date.today()
    for record in db.pickup_records.values():
        if record.child_id == request.child_id and record.date == today and record.status == PickupStatus.CHECKED_IN:
            raise HTTPException(status_code=400, detail="该儿童今日已入园")
    
    record_id = f"record_{uuid.uuid4().hex[:8]}"
    check_in_time = request.check_in_time or datetime.now()
    
    db_record = PickupRecord(
        record_id=record_id,
        child_id=request.child_id,
        person_id=request.person_id,
        check_in_time=check_in_time,
        status=PickupStatus.CHECKED_IN,
        date=today,
        idempotency_key=request.idempotency_key,
        created_at=datetime.now()
    )
    db.pickup_records[record_id] = db_record
    
    if request.idempotency_key:
        db.store_idempotency(request.idempotency_key, record_id)
    
    return db_record


@app.post("/check-out", response_model=PickupRecord)
def check_out(request: CheckOutRequest, db: InMemoryDB = Depends(get_db)):
    if request.idempotency_key:
        existing = db.check_idempotency(request.idempotency_key)
        if existing:
            return db.pickup_records[existing]
    
    is_auth, auth_msg = is_authorized(request.child_id, request.person_id, db)
    if not is_auth:
        exception_id = f"exc_{uuid.uuid4().hex[:8]}"
        db.exceptions[exception_id] = ExceptionRecord(
            exception_id=exception_id,
            child_id=request.child_id,
            person_id=request.person_id,
            exception_type=ExceptionType.UNAUTHORIZED_PICKUP,
            description=f"离园被拒绝: {auth_msg}",
            reported_at=datetime.now()
        )
        raise HTTPException(status_code=403, detail=f"未授权离园: {auth_msg}")
    
    today = date.today()
    active_record = None
    for record in db.pickup_records.values():
        if record.child_id == request.child_id and record.date == today and record.status == PickupStatus.CHECKED_IN:
            active_record = record
            break
    
    if not active_record:
        raise HTTPException(status_code=400, detail="该儿童今日未入园或已离园")
    
    check_out_time = request.check_out_time or datetime.now()
    active_record.check_out_time = check_out_time
    active_record.status = PickupStatus.CHECKED_OUT
    
    late_minutes, fee_amount = calculate_late_fee(check_out_time)
    if late_minutes > 0:
        fee_exists = any(f.record_id == active_record.record_id for f in db.late_fees.values())
        if not fee_exists:
            fee_id = f"fee_{uuid.uuid4().hex[:8]}"
            db.late_fees[fee_id] = LatePickupFee(
                fee_id=fee_id,
                record_id=active_record.record_id,
                child_id=request.child_id,
                late_minutes=late_minutes,
                fee_amount=fee_amount,
                fee_rate=2.0,
                calculated_at=datetime.now(),
                idempotency_key=request.idempotency_key
            )
        else:
            exception_id = f"exc_{uuid.uuid4().hex[:8]}"
            db.exceptions[exception_id] = ExceptionRecord(
                exception_id=exception_id,
                child_id=request.child_id,
                record_id=active_record.record_id,
                exception_type=ExceptionType.DUPLICATE_FEE,
                description="检测到重复计算迟接费用",
                reported_at=datetime.now()
            )
    
    if request.idempotency_key:
        db.store_idempotency(request.idempotency_key, active_record.record_id)
    
    return active_record


@app.get("/pickup-records", response_model=List[PickupRecord])
def list_pickup_records(child_id: Optional[str] = None, status: Optional[PickupStatus] = None, 
                        start_date: Optional[date] = None, end_date: Optional[date] = None,
                        db: InMemoryDB = Depends(get_db)):
    result = list(db.pickup_records.values())
    if child_id:
        result = [r for r in result if r.child_id == child_id]
    if status:
        result = [r for r in result if r.status == status]
    if start_date:
        result = [r for r in result if r.date >= start_date]
    if end_date:
        result = [r for r in result if r.date <= end_date]
    return result


@app.get("/pickup-records/{record_id}", response_model=PickupRecord)
def get_pickup_record(record_id: str, db: InMemoryDB = Depends(get_db)):
    if record_id not in db.pickup_records:
        raise HTTPException(status_code=404, detail="接送记录不存在")
    return db.pickup_records[record_id]


@app.get("/late-fees", response_model=List[LatePickupFee])
def list_late_fees(child_id: Optional[str] = None, db: InMemoryDB = Depends(get_db)):
    result = list(db.late_fees.values())
    if child_id:
        result = [f for f in result if f.child_id == child_id]
    return result


@app.post("/exceptions", response_model=ExceptionRecord)
def report_exception(request: ExceptionReportRequest, db: InMemoryDB = Depends(get_db)):
    if request.idempotency_key:
        existing = db.check_idempotency(request.idempotency_key)
        if existing:
            return db.exceptions[existing]
    
    exception_id = f"exc_{uuid.uuid4().hex[:8]}"
    db_exception = ExceptionRecord(
        exception_id=exception_id,
        child_id=request.child_id,
        person_id=request.person_id,
        record_id=request.record_id,
        exception_type=request.exception_type,
        description=request.description,
        reported_at=datetime.now(),
        idempotency_key=request.idempotency_key
    )
    db.exceptions[exception_id] = db_exception
    
    if request.idempotency_key:
        db.store_idempotency(request.idempotency_key, exception_id)
    
    return db_exception


@app.get("/exceptions", response_model=List[ExceptionRecord])
def list_exceptions(child_id: Optional[str] = None, resolved: Optional[bool] = None,
                    db: InMemoryDB = Depends(get_db)):
    result = list(db.exceptions.values())
    if child_id:
        result = [e for e in result if e.child_id == child_id]
    if resolved is not None:
        result = [e for e in result if e.resolved == resolved]
    return result


@app.patch("/exceptions/{exception_id}/resolve", response_model=ExceptionRecord)
def resolve_exception(exception_id: str, resolution_note: str, db: InMemoryDB = Depends(get_db)):
    if exception_id not in db.exceptions:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    
    exception = db.exceptions[exception_id]
    exception.resolved = True
    exception.resolved_at = datetime.now()
    exception.resolution_note = resolution_note
    
    return exception


@app.get("/dashboard")
def get_dashboard(db: InMemoryDB = Depends(get_db)):
    today = date.today()
    now = datetime.now()
    
    checked_in_today = sum(1 for r in db.pickup_records.values() 
                          if r.date == today and r.status == PickupStatus.CHECKED_IN)
    checked_out_today = sum(1 for r in db.pickup_records.values() 
                           if r.date == today and r.status == PickupStatus.CHECKED_OUT)
    
    active_authorizations = sum(1 for a in db.authorizations.values() if a.is_active)
    expired_authorizations = sum(1 for a in db.authorizations.values() 
                                 if a.is_active and a.auth_type == AuthorizationType.TEMPORARY 
                                 and a.end_date and a.end_date < now)
    
    pending_exceptions = sum(1 for e in db.exceptions.values() if not e.resolved)
    
    total_late_fees = sum(f.fee_amount for f in db.late_fees.values() if not f.is_paid)
    
    return {
        "today_summary": {
            "date": today,
            "checked_in_count": checked_in_today,
            "checked_out_count": checked_out_today,
            "currently_in": checked_in_today - checked_out_today
        },
        "authorization_summary": {
            "active_count": active_authorizations,
            "expired_count": expired_authorizations
        },
        "exception_summary": {
            "pending_count": pending_exceptions
        },
        "finance_summary": {
            "total_unpaid_late_fees": total_late_fees
        }
    }


@app.get("/child-status/{child_id}")
def get_child_status(child_id: str, db: InMemoryDB = Depends(get_db)):
    if child_id not in db.children:
        raise HTTPException(status_code=404, detail="儿童不存在")
    
    today = date.today()
    current_record = None
    for record in db.pickup_records.values():
        if record.child_id == child_id and record.date == today:
            current_record = record
            break
    
    authorizations = [a for a in db.authorizations.values() 
                     if a.child_id == child_id and a.is_active]
    
    exceptions = [e for e in db.exceptions.values() 
                  if e.child_id == child_id and not e.resolved]
    
    late_fees = [f for f in db.late_fees.values() 
                if f.child_id == child_id and not f.is_paid]
    
    return {
        "child": db.children[child_id],
        "current_status": current_record.status if current_record else "not_arrived",
        "today_record": current_record,
        "active_authorizations": authorizations,
        "pending_exceptions": exceptions,
        "unpaid_late_fees": late_fees
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
