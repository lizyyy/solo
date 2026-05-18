from datetime import datetime
from typing import List, Dict, Optional
from enum import Enum

class AlarmLevel(str, Enum):
    CRITICAL = "严重"
    MAJOR = "重要"
    MINOR = "一般"
    WARNING = "提示"

class FaultType(str, Enum):
    COMMUNICATION_FAILURE = "通信故障"
    POWER_MODULE_FAILURE = "功率模块故障"
    GUN_LOCK_FAILURE = "枪锁故障"
    SCREEN_FAILURE = "屏幕故障"
    CARD_READER_FAILURE = "读卡器故障"
    LEAKAGE_PROTECTION = "漏电保护"
    OVER_TEMPERATURE = "过温保护"
    OVER_VOLTAGE = "过压保护"
    UNDER_VOLTAGE = "欠压保护"
    OTHER = "其他故障"

class RepairStatus(str, Enum):
    PENDING = "待派单"
    DISPATCHED = "已派单"
    ACCEPTED = "已接单"
    IN_PROGRESS = "处理中"
    PENDING_REVIEW = "待复核"
    REJECTED = "驳回"
    CLOSED = "已闭环"

class TeamType(str, Enum):
    ELECTRICAL_TEAM = "电气班组"
    MECHANICAL_TEAM = "机械班组"
    COMMUNICATION_TEAM = "通信班组"
    COMPREHENSIVE_TEAM = "综合班组"

repair_orders_db: Dict[str, Dict] = {}
alarms_db: Dict[str, Dict] = {}

async def init_db():
    repair_orders_db.clear()
    alarms_db.clear()

async def seed_data():
    from datetime import timedelta
    
    alarms = [
        {
            "alarm_id": "ALM-20240515-001",
            "charger_id": "CP-BJ-XC-001",
            "charger_name": "西城站01号直流桩",
            "station_id": "ST-BJ-XC-001",
            "station_name": "北京西城运维站",
            "fault_type": FaultType.POWER_MODULE_FAILURE,
            "alarm_level": AlarmLevel.CRITICAL,
            "alarm_time": datetime.now() - timedelta(hours=2),
            "fault_description": "3号功率模块输出异常，电压波动超过±15%",
            "manufacturer": "特来电",
            "model": "TCD-60KW",
            "installation_date": datetime(2023, 3, 15),
            "location": "A区3号位",
            "contact_person": "张站长",
            "contact_phone": "13800138001"
        },
        {
            "alarm_id": "ALM-20240515-002",
            "charger_id": "CP-BJ-XC-002",
            "charger_name": "西城站02号交流桩",
            "station_id": "ST-BJ-XC-001",
            "station_name": "北京西城运维站",
            "fault_type": FaultType.COMMUNICATION_FAILURE,
            "alarm_level": AlarmLevel.MAJOR,
            "alarm_time": datetime.now() - timedelta(hours=1),
            "fault_description": "4G模块离线，无法上送充电数据",
            "manufacturer": "星星充电",
            "model": "XXC-7KW",
            "installation_date": datetime(2023, 5, 20),
            "location": "B区1号位",
            "contact_person": "张站长",
            "contact_phone": "13800138001"
        },
        {
            "alarm_id": "ALM-20240515-003",
            "charger_id": "CP-BJ-HD-005",
            "charger_name": "海淀站05号直流桩",
            "station_id": "ST-BJ-HD-001",
            "station_name": "北京海淀运维站",
            "fault_type": FaultType.GUN_LOCK_FAILURE,
            "alarm_level": AlarmLevel.MINOR,
            "alarm_time": datetime.now() - timedelta(minutes=30),
            "fault_description": "2号充电枪锁止机构故障，无法正常拔枪",
            "manufacturer": "国家电网",
            "model": "GW-120KW",
            "installation_date": datetime(2022, 11, 8),
            "location": "C区2号位",
            "contact_person": "李站长",
            "contact_phone": "13900139002"
        }
    ]
    
    for alarm in alarms:
        alarms_db[alarm["alarm_id"]] = alarm
    
    repair_orders = [
        {
            "order_id": "RO-20240515-001",
            "alarm_id": "ALM-20240515-001",
            "charger_id": "CP-BJ-XC-001",
            "charger_name": "西城站01号直流桩",
            "station_id": "ST-BJ-XC-001",
            "station_name": "北京西城运维站",
            "fault_type": FaultType.POWER_MODULE_FAILURE,
            "alarm_level": AlarmLevel.CRITICAL,
            "alarm_time": datetime.now() - timedelta(hours=2),
            "fault_description": "3号功率模块输出异常，电压波动超过±15%",
            "dispatch_time": datetime.now() - timedelta(hours=1, minutes=30),
            "dispatch_user": "调度员-王",
            "assigned_team": TeamType.ELECTRICAL_TEAM,
            "team_leader": "刘班长",
            "team_phone": "13700137001",
            "accept_time": datetime.now() - timedelta(hours=1),
            "accept_user": "刘班长",
            "arrival_time": None,
            "repair_start_time": None,
            "repair_end_time": None,
            "repair_content": None,
            "replaced_parts": None,
            "verification_result": None,
            "verification_user": None,
            "verification_time": None,
            "close_time": None,
            "close_user": None,
            "status": RepairStatus.IN_PROGRESS,
            "reject_reason": None,
            "remark": "需携带3号功率模块备件",
            "manufacturer": "特来电",
            "model": "TCD-60KW",
            "location": "A区3号位"
        },
        {
            "order_id": "RO-20240515-002",
            "alarm_id": "ALM-20240515-002",
            "charger_id": "CP-BJ-XC-002",
            "charger_name": "西城站02号交流桩",
            "station_id": "ST-BJ-XC-001",
            "station_name": "北京西城运维站",
            "fault_type": FaultType.COMMUNICATION_FAILURE,
            "alarm_level": AlarmLevel.MAJOR,
            "alarm_time": datetime.now() - timedelta(hours=1),
            "fault_description": "4G模块离线，无法上送充电数据",
            "dispatch_time": datetime.now() - timedelta(minutes=45),
            "dispatch_user": "调度员-王",
            "assigned_team": TeamType.COMMUNICATION_TEAM,
            "team_leader": "赵班长",
            "team_phone": "13600136001",
            "accept_time": None,
            "accept_user": None,
            "arrival_time": None,
            "repair_start_time": None,
            "repair_end_time": None,
            "repair_content": None,
            "replaced_parts": None,
            "verification_result": None,
            "verification_user": None,
            "verification_time": None,
            "close_time": None,
            "close_user": None,
            "status": RepairStatus.DISPATCHED,
            "reject_reason": None,
            "remark": "需携带4G模块和SIM卡备件",
            "manufacturer": "星星充电",
            "model": "XXC-7KW",
            "location": "B区1号位"
        }
    ]
    
    for order in repair_orders:
        repair_orders_db[order["order_id"]] = order
