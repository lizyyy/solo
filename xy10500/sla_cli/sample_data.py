from .models import db

SAMPLE_TICKETS = [
    {
        "ticket_id": "T-2026-001",
        "customer_id": "C-001",
        "customer_type": "NORMAL",
        "created_at": "2026-05-08 10:30:00",
        "priority": "NORMAL",
        "current_queue": "客服一线",
        "current_status": "已解决"
    },
    {
        "ticket_id": "T-2026-002",
        "customer_id": "C-002",
        "customer_type": "VIP",
        "created_at": "2026-05-06 14:00:00",
        "priority": "HIGH",
        "current_queue": "技术支持",
        "current_status": "处理中"
    },
    {
        "ticket_id": "T-2026-003",
        "customer_id": "C-003",
        "customer_type": "NORMAL",
        "created_at": "2026-05-05 17:00:00",
        "priority": "NORMAL",
        "current_queue": "客服一线",
        "current_status": "处理中"
    },
    {
        "ticket_id": "T-2026-004",
        "customer_id": "C-004",
        "customer_type": "VIP",
        "created_at": "2026-05-07 09:00:00",
        "priority": "URGENT",
        "current_queue": "管理层",
        "current_status": "已升级"
    },
    {
        "ticket_id": "T-2026-005",
        "customer_id": "C-005",
        "customer_type": "URGENT",
        "created_at": "2026-05-01 11:00:00",
        "priority": "URGENT",
        "current_queue": "技术支持",
        "current_status": "暂停中"
    }
]

SAMPLE_TRANSITIONS = [
    {
        "ticket_id": "T-2026-001",
        "transition_id": "TR-001-01",
        "from_queue": None,
        "to_queue": "客服一线",
        "from_status": None,
        "to_status": "新建",
        "transition_time": "2026-05-08 10:30:00",
        "operator": "系统"
    },
    {
        "ticket_id": "T-2026-001",
        "transition_id": "TR-001-02",
        "from_queue": "客服一线",
        "to_queue": "客服一线",
        "from_status": "新建",
        "to_status": "处理中",
        "transition_time": "2026-05-08 10:35:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-001",
        "transition_id": "TR-001-03",
        "from_queue": "客服一线",
        "to_queue": "技术支持",
        "from_status": "处理中",
        "to_status": "转派",
        "transition_time": "2026-05-08 11:00:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-001",
        "transition_id": "TR-001-04",
        "from_queue": "技术支持",
        "to_queue": "技术支持",
        "from_status": "转派",
        "to_status": "处理中",
        "transition_time": "2026-05-08 11:30:00",
        "operator": "李四"
    },
    {
        "ticket_id": "T-2026-001",
        "transition_id": "TR-001-05",
        "from_queue": "技术支持",
        "to_queue": "客服一线",
        "from_status": "处理中",
        "to_status": "已解决",
        "transition_time": "2026-05-08 15:00:00",
        "operator": "李四"
    },
    {
        "ticket_id": "T-2026-002",
        "transition_id": "TR-002-01",
        "from_queue": None,
        "to_queue": "客服一线",
        "from_status": None,
        "to_status": "新建",
        "transition_time": "2026-05-06 14:00:00",
        "operator": "系统"
    },
    {
        "ticket_id": "T-2026-002",
        "transition_id": "TR-002-02",
        "from_queue": "客服一线",
        "to_queue": "技术支持",
        "from_status": "新建",
        "to_status": "转派",
        "transition_time": "2026-05-06 14:15:00",
        "operator": "王五"
    },
    {
        "ticket_id": "T-2026-002",
        "transition_id": "TR-002-03",
        "from_queue": "技术支持",
        "to_queue": "技术支持",
        "from_status": "转派",
        "to_status": "处理中",
        "transition_time": "2026-05-07 10:00:00",
        "operator": "赵六"
    },
    {
        "ticket_id": "T-2026-003",
        "transition_id": "TR-003-01",
        "from_queue": None,
        "to_queue": "客服一线",
        "from_status": None,
        "to_status": "新建",
        "transition_time": "2026-05-05 17:00:00",
        "operator": "系统"
    },
    {
        "ticket_id": "T-2026-003",
        "transition_id": "TR-003-02",
        "from_queue": "客服一线",
        "to_queue": "客服一线",
        "from_status": "新建",
        "to_status": "处理中",
        "transition_time": "2026-05-05 17:10:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-003",
        "transition_id": "TR-003-03",
        "from_queue": "客服一线",
        "to_queue": "客服一线",
        "from_status": "处理中",
        "to_status": "暂停",
        "transition_time": "2026-05-05 17:30:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-003",
        "transition_id": "TR-003-04",
        "from_queue": "客服一线",
        "to_queue": "客服一线",
        "from_status": "暂停",
        "to_status": "处理中",
        "transition_time": "2026-05-06 10:30:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-004",
        "transition_id": "TR-004-01",
        "from_queue": None,
        "to_queue": "客服一线",
        "from_status": None,
        "to_status": "新建",
        "transition_time": "2026-05-07 09:00:00",
        "operator": "系统"
    },
    {
        "ticket_id": "T-2026-004",
        "transition_id": "TR-004-02",
        "from_queue": "客服一线",
        "to_queue": "客服二线",
        "from_status": "新建",
        "to_status": "升级",
        "transition_time": "2026-05-07 09:30:00",
        "operator": "王五"
    },
    {
        "ticket_id": "T-2026-004",
        "transition_id": "TR-004-03",
        "from_queue": "客服二线",
        "to_queue": "管理层",
        "from_status": "升级",
        "to_status": "已升级",
        "transition_time": "2026-05-08 09:00:00",
        "operator": "李主管"
    },
    {
        "ticket_id": "T-2026-005",
        "transition_id": "TR-005-01",
        "from_queue": None,
        "to_queue": "客服一线",
        "from_status": None,
        "to_status": "新建",
        "transition_time": "2026-05-01 11:00:00",
        "operator": "系统"
    },
    {
        "ticket_id": "T-2026-005",
        "transition_id": "TR-005-02",
        "from_queue": "客服一线",
        "to_queue": "技术支持",
        "from_status": "新建",
        "to_status": "转派",
        "transition_time": "2026-05-01 11:20:00",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-005",
        "transition_id": "TR-005-03",
        "from_queue": "技术支持",
        "to_queue": "技术支持",
        "from_status": "转派",
        "to_status": "暂停",
        "transition_time": "2026-05-01 11:45:00",
        "operator": "李四"
    }
]

SAMPLE_PAUSES = [
    {
        "ticket_id": "T-2026-002",
        "pause_id": "P-002-01",
        "pause_start": "2026-05-06 15:00:00",
        "pause_end": "2026-05-07 09:30:00",
        "pause_reason": "等待客户提供详细报错日志",
        "pause_reason_category": "等待客户",
        "operator": "王五"
    },
    {
        "ticket_id": "T-2026-003",
        "pause_id": "P-003-01",
        "pause_start": "2026-05-05 17:30:00",
        "pause_end": "2026-05-06 10:30:00",
        "pause_reason": "下班时间，暂停处理",
        "pause_reason_category": "内部转派",
        "operator": "张三"
    },
    {
        "ticket_id": "T-2026-005",
        "pause_id": "P-005-01",
        "pause_start": "2026-05-01 11:45:00",
        "pause_end": None,
        "pause_reason": "等待第三方系统接口响应",
        "pause_reason_category": "等待第三方",
        "operator": "李四"
    }
]

SAMPLE_ESCALATIONS = [
    {
        "ticket_id": "T-2026-004",
        "escalation_id": "E-004-01",
        "escalation_time": "2026-05-06 08:00:00",
        "from_level": "L1",
        "to_level": "L2",
        "from_queue": "客服一线",
        "to_queue": "客服二线",
        "escalation_reason": "VIP客户紧急问题",
        "operator": "王五"
    },
    {
        "ticket_id": "T-2026-004",
        "escalation_id": "E-004-02",
        "escalation_time": "2026-05-08 09:00:00",
        "from_level": "L2",
        "to_level": "L3",
        "from_queue": "客服二线",
        "to_queue": "管理层",
        "escalation_reason": "24小时未解决，升级至管理层",
        "operator": "李主管"
    }
]

HOLIDAYS = [
    {"date": "2026-05-01", "name": "劳动节", "is_weekend": 0},
    {"date": "2026-05-02", "name": "劳动节假期", "is_weekend": 0},
    {"date": "2026-05-03", "name": "劳动节假期", "is_weekend": 1},
    {"date": "2026-05-09", "name": "周六", "is_weekend": 1},
    {"date": "2026-05-10", "name": "周日", "is_weekend": 1},
]


def create_sample_data():
    conn = db.conn
    
    ticket_count = 0
    for ticket in SAMPLE_TICKETS:
        conn.execute("""
            INSERT OR REPLACE INTO tickets 
            (ticket_id, customer_id, customer_type, created_at, priority, 
             current_queue, current_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            ticket["ticket_id"],
            ticket["customer_id"],
            ticket["customer_type"],
            ticket["created_at"],
            ticket["priority"],
            ticket["current_queue"],
            ticket["current_status"]
        ))
        ticket_count += 1
    
    transition_count = 0
    for trans in SAMPLE_TRANSITIONS:
        conn.execute("""
            INSERT OR REPLACE INTO status_transitions 
            (ticket_id, transition_id, from_queue, to_queue, from_status, 
             to_status, transition_time, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trans["ticket_id"],
            trans["transition_id"],
            trans["from_queue"],
            trans["to_queue"],
            trans["from_status"],
            trans["to_status"],
            trans["transition_time"],
            trans["operator"]
        ))
        transition_count += 1
    
    pause_count = 0
    for pause in SAMPLE_PAUSES:
        conn.execute("""
            INSERT OR REPLACE INTO pauses 
            (ticket_id, pause_id, pause_start, pause_end, pause_reason, 
             pause_reason_category, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            pause["ticket_id"],
            pause["pause_id"],
            pause["pause_start"],
            pause["pause_end"],
            pause["pause_reason"],
            pause["pause_reason_category"],
            pause["operator"]
        ))
        pause_count += 1
    
    escalation_count = 0
    for esc in SAMPLE_ESCALATIONS:
        conn.execute("""
            INSERT OR REPLACE INTO escalations 
            (ticket_id, escalation_id, escalation_time, from_level, to_level, 
             from_queue, to_queue, escalation_reason, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            esc["ticket_id"],
            esc["escalation_id"],
            esc["escalation_time"],
            esc["from_level"],
            esc["to_level"],
            esc["from_queue"],
            esc["to_queue"],
            esc["escalation_reason"],
            esc["operator"]
        ))
        escalation_count += 1
    
    conn.commit()
    
    return {
        "tickets": ticket_count,
        "transitions": transition_count,
        "pauses": pause_count,
        "escalations": escalation_count
    }


def create_holidays():
    conn = db.conn
    
    for holiday in HOLIDAYS:
        conn.execute("""
            INSERT OR REPLACE INTO holidays (date, name, is_weekend)
            VALUES (?, ?, ?)
        """, (holiday["date"], holiday["name"], holiday["is_weekend"]))
    
    conn.commit()
