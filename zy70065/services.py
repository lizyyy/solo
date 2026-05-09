from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import json

from models import (
    Reader, Book, Branch, Holding, Reservation, Transfer,
    Notification, Borrow, OperationLog,
    ReservationStatus, TransferStatus, OperationType,
    Base
)
from schemas import (
    ReservationCreate, TransferCreate, TransferStart, TransferArrive,
    PickupBook, ManualCorrection, generate_id
)


class BusinessError(Exception):
    """业务异常基类"""
    def __init__(self, message: str, data: Dict = None):
        self.message = message
        self.data = data or {}
        super().__init__(message)


class ValidationError(BusinessError):
    """校验失败"""
    pass


class IdempotentError(BusinessError):
    """幂等校验失败"""
    pass


class StateError(BusinessError):
    """状态流转错误"""
    pass


class NotFoundError(BusinessError):
    """资源不存在"""
    pass


def log_operation(
    db: Session,
    operation_type: OperationType,
    description: str,
    operator: str = "系统",
    reservation_id: str = None,
    transfer_id: str = None,
    old_value: str = None,
    new_value: str = None,
    is_manual: bool = False
):
    """记录操作日志"""
    log = OperationLog(
        operation_type=operation_type,
        reservation_id=reservation_id,
        transfer_id=transfer_id,
        operator=operator,
        description=description,
        old_value=old_value,
        new_value=new_value,
        is_manual=is_manual
    )
    db.add(log)


def check_idempotent(
    db: Session,
    operation_type: OperationType,
    request_id: str,
    context: Dict = None
) -> Optional[dict]:
    """检查并记录幂等性
    
    返回：如果已处理则返回之前的结果，否则返回 None
    """
    existing = db.query(OperationLog).filter(
        OperationLog.operation_type == operation_type,
        OperationLog.description.contains(request_id)
    ).first()
    
    if existing:
        return {
            "success": True,
            "message": "请求已处理过",
            "data": {
                "operation_time": existing.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "operator": existing.operator,
                "is_retry": True
            }
        }
    return None


def ensure_exists(db: Session, model: Base, id_value: str, entity_name: str):
    """确保实体存在"""
    entity = db.query(model).filter(model.id == id_value).first()
    if not entity:
        raise NotFoundError(f"{entity_name}不存在")
    return entity


def get_next_queue_position(db: Session, book_id: str, pickup_branch_id: str) -> int:
    """获取下一个队列位置"""
    from sqlalchemy import func
    max_pos = db.query(func.max(Reservation.queue_position)).filter(
        Reservation.book_id == book_id,
        Reservation.pickup_branch_id == pickup_branch_id,
        Reservation.status.in_([
            ReservationStatus.PENDING, ReservationStatus.IN_TRANSIT])
    ).scalar()
    return (max_pos or 0) + 1


def create_reservation(db: Session, data: ReservationCreate) -> dict:
    """创建预约"""
    
    idempotent_check = check_idempotent(db, OperationType.CREATE_RESERVATION, data.request_id)
    if idempotent_check:
        return idempotent_check
    
    reader = ensure_exists(db, Reader, data.reader_id, "读者")
    book = ensure_exists(db, Book, data.book_id, "图书")
    pickup_branch = ensure_exists(db, Branch, data.pickup_branch_id, "取书分馆")
    
    existing_active_reservations = db.query(Reservation).filter(
        Reservation.reader_id == data.reader_id,
        Reservation.book_id == data.book_id,
        Reservation.status.in_([
            ReservationStatus.PENDING,
            ReservationStatus.IN_TRANSIT,
            ReservationStatus.ARRIVED
        ])
    ).count()
    
    if existing_active_reservations > 0:
        raise ValidationError("您已预约过此书且尚未完成，请先取消或取书")
    
    available_holdings = db.query(Holding).filter(
        Holding.book_id == data.book_id,
        Holding.status == "在馆"
    ).all()
    
    queue_pos = get_next_queue_position(db, data.book_id, data.pickup_branch_id)
    
    reservation = Reservation(
        id=generate_id("RES"),
        request_id=data.request_id,
        reader_id=data.reader_id,
        book_id=data.book_id,
        pickup_branch_id=data.pickup_branch_id,
        queue_position=queue_pos,
        status=ReservationStatus.PENDING,
        remarks=data.remarks
    )
    db.add(reservation)
    db.flush()
    
    log_operation(
        db,
        OperationType.CREATE_RESERVATION,
        f"创建预约: {data.request_id}",
        reservation_id=reservation.id,
        new_value=json.dumps({
            "读者": reader.name,
            "图书": book.title,
            "取书分馆": pickup_branch.name,
            "队列位置": queue_pos
        }, ensure_ascii=False)
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": f"预约成功，您排在第 {queue_pos} 位",
        "data": {
            "预约编号": reservation.id,
            "读者": reader.name,
            "图书": book.title,
            "取书分馆": pickup_branch.name,
            "队列位置": queue_pos,
            "当前状态": reservation.status.value,
            "是否需要调拨": len(available_holdings) > 0,
            "在馆馆藏数": len(available_holdings)
        }
    }


def create_transfer(db: Session, data: TransferCreate) -> dict:
    """创建调拨单"""
    
    idempotent_check = check_idempotent(db, OperationType.CREATE_TRANSFER, data.request_id)
    if idempotent_check:
        return idempotent_check
    
    reservation = ensure_exists(db, Reservation, data.reservation_id, "预约")
    
    if reservation.status != ReservationStatus.PENDING:
        raise StateError(f"当前预约状态为「{reservation.status.value}」，无法创建调拨")
    
    from_holding = ensure_exists(db, Holding, data.from_holding_id, "调出馆藏")
    
    if from_holding.book_id != reservation.book_id:
        raise ValidationError("调出馆藏与预约图书不一致")
    
    if from_holding.status != "在馆":
        raise ValidationError(f"调出馆藏当前状态为「{from_holding.status}」，无法调拨")
    
    from_branch = ensure_exists(db, Branch, from_holding.branch_id, "调出门店")
    to_branch = ensure_exists(db, Branch, reservation.pickup_branch_id, "调入门店")
    
    if from_holding.branch_id == reservation.pickup_branch_id:
        raise ValidationError("图书已在取书分馆，无需调拨")
    
    estimated_arrival = datetime.utcnow() + timedelta(days=data.estimated_days)
    
    transfer = Transfer(
        id=generate_id("TRF"),
        request_id=data.request_id,
        reservation_id=reservation.id,
        from_branch_id=from_holding.branch_id,
        to_branch_id=reservation.pickup_branch_id,
        from_holding_id=from_holding.id,
        status=TransferStatus.PENDING,
        estimated_arrival=estimated_arrival
    )
    db.add(transfer)
    db.flush()
    
    from_holding.status = "调拨锁定"
    
    reservation.status = ReservationStatus.IN_TRANSIT
    reservation.holding_id = from_holding.id
    reservation.transferred_at = datetime.utcnow()
    
    log_operation(
        db,
        OperationType.CREATE_TRANSFER,
        f"创建调拨单: {data.request_id}",
        reservation_id=reservation.id,
        transfer_id=transfer.id,
        new_value=json.dumps({
            "调出门店": from_branch.name,
            "调入门店": to_branch.name,
            "馆藏条码": from_holding.barcode,
            "预计到达": estimated_arrival.strftime("%Y-%m-%d")
        }, ensure_ascii=False)
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": "调拨单创建成功，等待发出",
        "data": {
            "调拨编号": transfer.id,
            "预约编号": reservation.id,
            "调出门店": from_branch.name,
            "调入门店": to_branch.name,
            "馆藏条码": from_holding.barcode,
            "当前状态": transfer.status.value,
            "预计到达": estimated_arrival.strftime("%Y-%m-%d")
        }
    }


def start_transfer(db: Session, transfer_id: str, data: TransferStart) -> dict:
    """开始调拨（发出）"""
    
    transfer = ensure_exists(db, Transfer, transfer_id, "调拨单")
    reservation = ensure_exists(db, Reservation, transfer.reservation_id, "预约")
    
    if transfer.status != TransferStatus.PENDING:
        raise StateError(f"当前调拨状态为「{transfer.status.value}」，无法开始")
    
    transfer.status = TransferStatus.IN_TRANSIT
    transfer.started_at = datetime.utcnow()
    
    log_operation(
        db,
        OperationType.START_TRANSFER,
        f"调拨开始运输: {transfer_id}",
        reservation_id=reservation.id,
        transfer_id=transfer.id,
        operator=data.operator,
        old_value=TransferStatus.PENDING.value,
        new_value=TransferStatus.IN_TRANSIT.value
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": "图书已发出，正在运输中",
        "data": {
            "调拨编号": transfer.id,
            "当前状态": transfer.status.value,
            "发出时间": transfer.started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "操作人": data.operator
        }
    }


def arrive_transfer(db: Session, transfer_id: str, data: TransferArrive) -> dict:
    """调拨到馆"""
    
    transfer = ensure_exists(db, Transfer, transfer_id, "调拨单")
    reservation = ensure_exists(db, Reservation, transfer.reservation_id, "预约")
    from_holding = ensure_exists(db, Holding, transfer.from_holding_id, "馆藏")
    to_branch = ensure_exists(db, Branch, transfer.to_branch_id, "调入门店")
    
    if transfer.status != TransferStatus.IN_TRANSIT:
        raise StateError(f"当前调拨状态为「{transfer.status.value}」，无法确认到馆")
    
    to_holding = Holding(
        id=generate_id("HLD"),
        book_id=from_holding.book_id,
        branch_id=transfer.to_branch_id,
        barcode=f"{from_holding.barcode}-{to_branch.id}",
        status="在馆",
        location=f"{to_branch.name}-预约待取"
    )
    db.add(to_holding)
    db.flush()
    
    transfer.status = TransferStatus.ARRIVED
    transfer.to_holding_id = to_holding.id
    transfer.arrived_at = datetime.utcnow()
    
    from_holding.status = "已调出"
    from_holding.last_checked_at = datetime.utcnow()
    
    reservation.status = ReservationStatus.ARRIVED
    reservation.holding_id = to_holding.id
    reservation.arrived_at = datetime.utcnow()
    reservation.pickup_deadline = datetime.utcnow() + timedelta(days=7)
    
    reader = ensure_exists(db, Reader, reservation.reader_id, "读者")
    book = ensure_exists(db, Book, reservation.book_id, "图书")
    
    notification_content = (
        f"【图书馆通知】尊敬的{reader.name}读者，您预约的《{book.title}》"
        f"已到达{to_branch.name}，请于{reservation.pickup_deadline.strftime('%Y-%m-%d')}"
        f"前到馆取书，逾期将自动取消。"
    )
    notification = Notification(
        id=generate_id("NTF"),
        reservation_id=reservation.id,
        reader_id=reservation.reader_id,
        type="到馆通知",
        content=notification_content,
        channel="短信",
        status="已发送"
    )
    db.add(notification)
    
    log_operation(
        db,
        OperationType.TRANSFER_ARRIVED,
        f"调拨到馆: {transfer_id}",
        reservation_id=reservation.id,
        transfer_id=transfer.id,
        operator=data.operator,
        old_value=TransferStatus.IN_TRANSIT.value,
        new_value=TransferStatus.ARRIVED.value
    )
    
    log_operation(
        db,
        OperationType.SEND_NOTIFICATION,
        f"发送到馆通知",
        reservation_id=reservation.id,
        new_value=json.dumps({
            "读者": reader.name,
            "图书": book.title,
            "取书截止": reservation.pickup_deadline.strftime("%Y-%m-%d")
        }, ensure_ascii=False)
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": f"图书已到馆，已通知读者 {reader.name}",
        "data": {
            "调拨编号": transfer.id,
            "馆藏条码": to_holding.barcode,
            "到达分馆": to_branch.name,
            "到达时间": transfer.arrived_at.strftime("%Y-%m-%d %H:%M:%S"),
            "取书截止": reservation.pickup_deadline.strftime("%Y-%m-%d"),
            "通知状态": "已发送",
            "操作人": data.operator
        }
    }


def pickup_book(db: Session, reservation_id: str, data: PickupBook) -> dict:
    """取书并生成借阅"""
    
    idempotent_check = check_idempotent(db, OperationType.PICKUP_BOOK, data.request_id)
    if idempotent_check:
        return idempotent_check
    
    reservation = ensure_exists(db, Reservation, reservation_id, "预约")
    
    if reservation.status not in [ReservationStatus.ARRIVED, ReservationStatus.OVERDUE]:
        raise StateError(f"当前预约状态为「{reservation.status.value}」，无法取书")
    
    if reservation.status == ReservationStatus.OVERDUE:
        raise StateError("该预约已逾期释放，请重新预约")
    
    reader = ensure_exists(db, Reader, reservation.reader_id, "读者")
    book = ensure_exists(db, Book, reservation.book_id, "图书")
    holding = ensure_exists(db, Holding, reservation.holding_id, "馆藏")
    branch = ensure_exists(db, Branch, reservation.pickup_branch_id, "取书分馆")
    
    due_date = date.today() + timedelta(days=data.borrow_days)
    
    borrow = Borrow(
        id=generate_id("BRW"),
        reservation_id=reservation.id,
        reader_id=reservation.reader_id,
        holding_id=reservation.holding_id,
        due_date=due_date,
        status="借阅中"
    )
    db.add(borrow)
    db.flush()
    
    reservation.status = ReservationStatus.PICKED_UP
    reservation.picked_up_at = datetime.utcnow()
    
    holding.status = "借出"
    holding.last_checked_at = datetime.utcnow()
    
    log_operation(
        db,
        OperationType.PICKUP_BOOK,
        f"读者取书: {data.request_id}",
        reservation_id=reservation.id,
        operator=data.operator,
        new_value=json.dumps({
            "读者": reader.name,
            "图书": book.title,
            "馆藏条码": holding.barcode
        }, ensure_ascii=False)
    )
    
    log_operation(
        db,
        OperationType.CREATE_BORROW,
        f"生成借阅记录",
        reservation_id=reservation.id,
        new_value=json.dumps({
            "借阅编号": borrow.id,
            "应还日期": due_date.strftime("%Y-%m-%d"),
            "借阅天数": data.borrow_days
        }, ensure_ascii=False)
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": f"取书成功，已生成借阅记录",
        "data": {
            "预约状态": "已取书",
            "借阅编号": borrow.id,
            "读者": reader.name,
            "图书": book.title,
            "馆藏条码": holding.barcode,
            "取书分馆": branch.name,
            "应还日期": due_date.strftime("%Y-%m-%d"),
            "借阅天数": data.borrow_days,
            "操作人": data.operator
        }
    }


def process_overdue_reservations(db: Session) -> dict:
    """批量处理逾期未取的预约（释放资源）"""
    
    now = datetime.utcnow()
    overdue_reservations = db.query(Reservation).filter(
        Reservation.status == ReservationStatus.ARRIVED,
        Reservation.pickup_deadline < now
    ).all()
    
    released_count = 0
    released_details = []
    
    for reservation in overdue_reservations:
        reservation.status = ReservationStatus.OVERDUE
        reservation.cancelled_at = now
        
        if reservation.holding_id:
            holding = db.query(Holding).filter(Holding.id == reservation.holding_id).first()
            if holding:
                holding.status = "在馆"
                holding.location = None
        
        reader = db.query(Reader).filter(Reader.id == reservation.reader_id).first()
        book = db.query(Book).filter(Book.id == reservation.book_id).first()
        
        log_operation(
            db,
            OperationType.OVERDUE_RELEASE,
            f"逾期释放预约: {reservation.id}",
            reservation_id=reservation.id,
            old_value=ReservationStatus.ARRIVED.value,
            new_value=ReservationStatus.OVERDUE.value,
            is_manual=False
        )
        
        released_count += 1
        released_details.append({
            "预约编号": reservation.id,
            "读者": reader.name if reader else "未知",
            "图书": book.title if book else "未知"
        })
    
    db.commit()
    
    return {
        "success": True,
        "message": f"共处理 {released_count} 笔逾期预约",
        "data": {
            "处理数量": released_count,
            "处理时间": now.strftime("%Y-%m-%d %H:%M:%S"),
            "处理详情": released_details
        }
    }


def manual_correction(db: Session, reservation_id: str, data: ManualCorrection) -> dict:
    """人工修正预约"""
    
    reservation = ensure_exists(db, Reservation, reservation_id, "预约")
    
    old_values = {
        "状态": reservation.status.value,
        "队列位置": reservation.queue_position,
        "取书截止": reservation.pickup_deadline.strftime("%Y-%m-%d %H:%M:%S") if reservation.pickup_deadline else None
    }
    
    changes = []
    
    if data.new_status and data.new_status != reservation.status:
        changes.append(f"状态从「{reservation.status.value}」改为「{data.new_status.value}」")
        reservation.status = data.new_status
        
        if data.new_status == ReservationStatus.CANCELLED:
            reservation.cancelled_at = datetime.utcnow()
            if reservation.holding_id:
                holding = db.query(Holding).filter(Holding.id == reservation.holding_id).first()
                if holding:
                    holding.status = "在馆"
    
    if data.new_queue_position is not None:
        changes.append(f"队列位置从 {reservation.queue_position} 改为 {data.new_queue_position}")
        reservation.queue_position = data.new_queue_position
    
    if data.new_pickup_deadline:
        old_deadline = reservation.pickup_deadline.strftime("%Y-%m-%d") if reservation.pickup_deadline else "无"
        new_deadline = data.new_pickup_deadline.strftime("%Y-%m-%d")
        changes.append(f"取书截止从 {old_deadline} 改为 {new_deadline}")
        reservation.pickup_deadline = data.new_pickup_deadline
    
    if not changes:
        raise ValidationError("未指定任何需要修改的内容")
    
    new_values = {
        "状态": reservation.status.value,
        "队列位置": reservation.queue_position,
        "取书截止": reservation.pickup_deadline.strftime("%Y-%m-%d %H:%M:%S") if reservation.pickup_deadline else None
    }
    
    log_operation(
        db,
        OperationType.MANUAL_CORRECTION,
        f"人工修正: {'; '.join(changes)}",
        reservation_id=reservation.id,
        operator=data.operator,
        old_value=json.dumps(old_values, ensure_ascii=False),
        new_value=json.dumps(new_values, ensure_ascii=False),
        is_manual=True
    )
    
    db.commit()
    
    return {
        "success": True,
        "message": f"人工修正成功",
        "data": {
            "预约编号": reservation.id,
            "操作人": data.operator,
            "修正内容": changes,
            "修正原因": data.reason,
            "修正后状态": reservation.status.value,
            "修正后队列位置": reservation.queue_position
        }
    }


def query_reader_reservations(db: Session, reader_id: str) -> dict:
    """查询读者预约记录"""
    
    reader = ensure_exists(db, Reader, reader_id, "读者")
    
    reservations = db.query(Reservation).filter(
        Reservation.reader_id == reader_id
    ).order_by(Reservation.created_at.desc()).all()
    
    result = []
    for r in reservations:
        book = db.query(Book).filter(Book.id == r.book_id).first()
        branch = db.query(Branch).filter(Branch.id == r.pickup_branch_id).first()
        
        result.append({
            "预约编号": r.id,
            "图书": book.title if book else "未知",
            "取书分馆": branch.name if branch else "未知",
            "当前状态": r.status.value,
            "队列位置": r.queue_position,
            "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "取书截止": r.pickup_deadline.strftime("%Y-%m-%d") if r.pickup_deadline else None
        })
    
    return {
        "success": True,
        "message": f"找到 {len(result)} 条预约记录",
        "data": {
            "读者": reader.name,
            "预约记录": result
        }
    }


def get_reservation_detail(db: Session, reservation_id: str) -> dict:
    """查询预约详情"""
    
    reservation = ensure_exists(db, Reservation, reservation_id, "预约")
    
    reader = db.query(Reader).filter(Reader.id == reservation.reader_id).first()
    book = db.query(Book).filter(Book.id == reservation.book_id).first()
    branch = db.query(Branch).filter(Branch.id == reservation.pickup_branch_id).first()
    
    transfers = db.query(Transfer).filter(Transfer.reservation_id == reservation.id).all()
    operations = db.query(OperationLog).filter(OperationLog.reservation_id == reservation.id).order_by(OperationLog.created_at.desc()).all()
    
    transfer_list = []
    for t in transfers:
        from_branch = db.query(Branch).filter(Branch.id == t.from_branch_id).first()
        to_branch = db.query(Branch).filter(Branch.id == t.to_branch_id).first()
        transfer_list.append({
            "调拨编号": t.id,
            "调出门店": from_branch.name if from_branch else "未知",
            "调入门店": to_branch.name if to_branch else "未知",
            "状态": t.status.value,
            "创建时间": t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "到达时间": t.arrived_at.strftime("%Y-%m-%d %H:%M:%S") if t.arrived_at else None
        })
    
    operation_list = []
    for op in operations:
        operation_list.append({
            "时间": op.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "操作类型": op.operation_type.value,
            "操作人": op.operator,
            "描述": op.description,
            "是否人工": "是" if op.is_manual else "否"
        })
    
    borrow = db.query(Borrow).filter(Borrow.reservation_id == reservation.id).first()
    
    return {
        "success": True,
        "message": "查询成功",
        "data": {
            "基本信息": {
                "预约编号": reservation.id,
                "读者": reader.name if reader else "未知",
                "电话": reader.phone if reader else "未知",
                "图书": book.title if book else "未知",
                "取书分馆": branch.name if branch else "未知",
                "当前状态": reservation.status.value,
                "队列位置": reservation.queue_position,
                "创建时间": reservation.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "取书截止": reservation.pickup_deadline.strftime("%Y-%m-%d") if reservation.pickup_deadline else None,
                "取书时间": reservation.picked_up_at.strftime("%Y-%m-%d %H:%M:%S") if reservation.picked_up_at else None
            },
            "调拨记录": transfer_list,
            "借阅信息": {
                "借阅编号": borrow.id if borrow else None,
                "应还日期": borrow.due_date.strftime("%Y-%m-%d") if borrow else None,
                "借阅状态": borrow.status if borrow else None
            },
            "操作日志": operation_list
        }
    }


def create_initial_data(db: Session) -> dict:
    """创建测试数据"""
    
    if db.query(Reader).count() > 0:
        return {
            "success": True,
            "message": "数据已存在，无需初始化"
        }
    
    branch1 = Branch(id="B001", name="总馆", address="市中心")
    branch2 = Branch(id="B002", name="东区分馆", address="东区")
    branch3 = Branch(id="B003", name="南区分馆", address="南区")
    db.add_all([branch1, branch2, branch3])
    
    reader1 = Reader(id="R001", name="张三", phone="13800138001")
    reader2 = Reader(id="R002", name="李四", phone="13800138002")
    db.add_all([reader1, reader2])
    
    book1 = Book(id="BK001", isbn="978-7-111-00001-1", title="Python编程从入门到精通", author="张三", publisher="机械工业出版社")
    book2 = Book(id="BK002", isbn="978-7-111-00002-8", title="深入理解计算机系统", author="Randal E.Bryant", publisher="机械工业出版社")
    db.add_all([book1, book2])
    
    holding1 = Holding(id="H001", book_id="BK001", branch_id="B001", barcode="BAR001", status="在馆", location="A区-3层")
    holding2 = Holding(id="H002", book_id="BK001", branch_id="B002", barcode="BAR002", status="在馆", location="B区-2层")
    holding3 = Holding(id="H003", book_id="BK002", branch_id="B001", barcode="BAR003", status="在馆", location="C区-1层")
    holding4 = Holding(id="H004", book_id="BK002", branch_id="B003", barcode="BAR004", status="在馆", location="D区-4层")
    db.add_all([holding1, holding2, holding3, holding4])
    
    db.commit()
    
    return {
        "success": True,
        "message": "初始化数据创建成功",
        "data": {
            "分馆": 3,
            "读者": 2,
            "图书": 2,
            "馆藏": 4
        }
    }
