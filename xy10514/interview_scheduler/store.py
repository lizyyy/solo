import json
import os
from datetime import datetime, timedelta
from typing import Optional
from .models import (
    ScheduleState, Candidate, Interviewer, Room, RoundRule,
    RoundType, TimeSlot, Interview, InterviewStatus, generate_id
)


DEFAULT_DATA_DIR = os.path.join(os.getcwd(), ".interview_scheduler")
STATE_FILE = "state.json"


def get_data_dir(custom_dir: Optional[str] = None) -> str:
    dir_path = custom_dir or DEFAULT_DATA_DIR
    return dir_path


def get_state_path(data_dir: str) -> str:
    return os.path.join(data_dir, STATE_FILE)


def state_exists(data_dir: Optional[str] = None) -> bool:
    data_dir = get_data_dir(data_dir)
    state_path = get_state_path(data_dir)
    return os.path.exists(state_path)


def load_state(data_dir: Optional[str] = None) -> ScheduleState:
    data_dir = get_data_dir(data_dir)
    state_path = get_state_path(data_dir)
    
    if not os.path.exists(state_path):
        return ScheduleState()
    
    with open(state_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return ScheduleState.from_dict(data)


def save_state(state: ScheduleState, data_dir: Optional[str] = None) -> None:
    data_dir = get_data_dir(data_dir)
    state_path = get_state_path(data_dir)
    
    os.makedirs(data_dir, exist_ok=True)
    
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)


def create_sample_data() -> ScheduleState:
    state = ScheduleState()
    
    now = datetime.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    in_three_days = today + timedelta(days=3)
    in_four_days = today + timedelta(days=4)
    in_five_days = today + timedelta(days=5)
    
    state.rooms = {
        "room_a": Room(
            id="room_a",
            name="会议室A",
            capacity=6,
            building="主楼",
            room_number="301",
            equipment=["投影仪", "白板", "视频会议系统"]
        ),
        "room_b": Room(
            id="room_b",
            name="会议室B",
            capacity=4,
            building="主楼",
            room_number="302",
            equipment=["投影仪", "白板"]
        ),
        "room_c": Room(
            id="room_c",
            name="会议室C",
            capacity=8,
            building="西楼",
            room_number="201",
            equipment=["投影仪", "白板", "视频会议系统", "电视"]
        ),
        "room_d": Room(
            id="room_d",
            name="小会议室D",
            capacity=3,
            building="西楼",
            room_number="202",
            equipment=["白板"]
        ),
        "room_e": Room(
            id="room_e",
            name="大会议室E",
            capacity=12,
            building="东楼",
            room_number="101",
            equipment=["投影仪", "白板", "视频会议系统", "电视", "音响"]
        ),
    }
    
    state.round_rules = {
        "engineering_first": RoundRule(
            round_type=RoundType.FIRST,
            position_type="engineering",
            duration_minutes=45,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["投影仪", "白板"]
        ),
        "engineering_second": RoundRule(
            round_type=RoundType.SECOND,
            position_type="engineering",
            duration_minutes=60,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["投影仪", "白板", "视频会议系统"]
        ),
        "engineering_final": RoundRule(
            round_type=RoundType.FINAL,
            position_type="engineering",
            duration_minutes=45,
            min_gap_hours=24,
            required_interviewers=3,
            required_equipment=["投影仪", "白板", "视频会议系统"]
        ),
        "product_first": RoundRule(
            round_type=RoundType.FIRST,
            position_type="product",
            duration_minutes=45,
            min_gap_hours=24,
            required_interviewers=1,
            required_equipment=["投影仪", "白板"]
        ),
        "product_second": RoundRule(
            round_type=RoundType.SECOND,
            position_type="product",
            duration_minutes=60,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["投影仪", "白板"]
        ),
        "product_final": RoundRule(
            round_type=RoundType.FINAL,
            position_type="product",
            duration_minutes=45,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["投影仪", "白板", "视频会议系统"]
        ),
        "sales_first": RoundRule(
            round_type=RoundType.FIRST,
            position_type="sales",
            duration_minutes=30,
            min_gap_hours=24,
            required_interviewers=1,
            required_equipment=["白板"]
        ),
        "sales_second": RoundRule(
            round_type=RoundType.SECOND,
            position_type="sales",
            duration_minutes=45,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["白板"]
        ),
        "sales_final": RoundRule(
            round_type=RoundType.FINAL,
            position_type="sales",
            duration_minutes=30,
            min_gap_hours=24,
            required_interviewers=2,
            required_equipment=["白板", "视频会议系统"]
        ),
    }
    
    state.interviewers = {
        "intv_zhang": Interviewer(
            id="intv_zhang",
            name="张工",
            email="zhang@company.com",
            departments=["engineering"],
            available_slots=[
                TimeSlot(start=tomorrow.replace(hour=9, minute=0), end=tomorrow.replace(hour=12, minute=0)),
                TimeSlot(start=tomorrow.replace(hour=14, minute=0), end=tomorrow.replace(hour=18, minute=0)),
                TimeSlot(start=day_after.replace(hour=9, minute=0), end=day_after.replace(hour=12, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=9, minute=0), end=in_three_days.replace(hour=12, minute=0)),
                TimeSlot(start=in_four_days.replace(hour=14, minute=0), end=in_four_days.replace(hour=18, minute=0)),
            ]
        ),
        "intv_li": Interviewer(
            id="intv_li",
            name="李工",
            email="li@company.com",
            departments=["engineering"],
            available_slots=[
                TimeSlot(start=tomorrow.replace(hour=9, minute=0), end=tomorrow.replace(hour=12, minute=0)),
                TimeSlot(start=day_after.replace(hour=14, minute=0), end=day_after.replace(hour=18, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=9, minute=0), end=in_three_days.replace(hour=18, minute=0)),
                TimeSlot(start=in_five_days.replace(hour=9, minute=0), end=in_five_days.replace(hour=12, minute=0)),
            ]
        ),
        "intv_wang": Interviewer(
            id="intv_wang",
            name="王经理",
            email="wang@company.com",
            departments=["engineering", "product"],
            available_slots=[
                TimeSlot(start=tomorrow.replace(hour=10, minute=0), end=tomorrow.replace(hour=12, minute=0)),
                TimeSlot(start=day_after.replace(hour=9, minute=0), end=day_after.replace(hour=12, minute=0)),
                TimeSlot(start=day_after.replace(hour=14, minute=0), end=day_after.replace(hour=17, minute=0)),
                TimeSlot(start=in_four_days.replace(hour=9, minute=0), end=in_four_days.replace(hour=18, minute=0)),
            ]
        ),
        "intv_zhao": Interviewer(
            id="intv_zhao",
            name="赵总监",
            email="zhao@company.com",
            departments=["engineering"],
            available_slots=[
                TimeSlot(start=day_after.replace(hour=14, minute=0), end=day_after.replace(hour=18, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=14, minute=0), end=in_three_days.replace(hour=18, minute=0)),
                TimeSlot(start=in_five_days.replace(hour=14, minute=0), end=in_five_days.replace(hour=18, minute=0)),
            ]
        ),
        "intv_cai": Interviewer(
            id="intv_cai",
            name="蔡产品",
            email="cai@company.com",
            departments=["product"],
            available_slots=[
                TimeSlot(start=tomorrow.replace(hour=9, minute=0), end=tomorrow.replace(hour=18, minute=0)),
                TimeSlot(start=day_after.replace(hour=9, minute=0), end=day_after.replace(hour=12, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=14, minute=0), end=in_three_days.replace(hour=18, minute=0)),
                TimeSlot(start=in_four_days.replace(hour=9, minute=0), end=in_four_days.replace(hour=12, minute=0)),
            ]
        ),
        "intv_sun": Interviewer(
            id="intv_sun",
            name="孙产品总监",
            email="sun@company.com",
            departments=["product"],
            available_slots=[
                TimeSlot(start=day_after.replace(hour=14, minute=0), end=day_after.replace(hour=18, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=9, minute=0), end=in_three_days.replace(hour=18, minute=0)),
                TimeSlot(start=in_five_days.replace(hour=9, minute=0), end=in_five_days.replace(hour=18, minute=0)),
            ]
        ),
        "intv_zhou": Interviewer(
            id="intv_zhou",
            name="周销售",
            email="zhou@company.com",
            departments=["sales"],
            available_slots=[
                TimeSlot(start=tomorrow.replace(hour=9, minute=0), end=tomorrow.replace(hour=12, minute=0)),
                TimeSlot(start=tomorrow.replace(hour=14, minute=0), end=tomorrow.replace(hour=18, minute=0)),
                TimeSlot(start=day_after.replace(hour=9, minute=0), end=day_after.replace(hour=18, minute=0)),
                TimeSlot(start=in_three_days.replace(hour=14, minute=0), end=in_three_days.replace(hour=18, minute=0)),
            ]
        ),
        "intv_wu": Interviewer(
            id="intv_wu",
            name="吴销售总监",
            email="wu@company.com",
            departments=["sales"],
            available_slots=[
                TimeSlot(start=day_after.replace(hour=10, minute=0), end=day_after.replace(hour=12, minute=0)),
                TimeSlot(start=day_after.replace(hour=14, minute=0), end=day_after.replace(hour=18, minute=0)),
                TimeSlot(start=in_four_days.replace(hour=9, minute=0), end=in_four_days.replace(hour=18, minute=0)),
            ]
        ),
    }
    
    state.candidates = {
        "cand_001": Candidate(
            id="cand_001",
            name="陈小明",
            position="后端开发工程师",
            email="chenxm@email.com",
            phone="13800138001",
            department="engineering",
            notes="3年经验，熟悉Python和Go"
        ),
        "cand_002": Candidate(
            id="cand_002",
            name="刘小花",
            position="产品经理",
            email="liuxh@email.com",
            phone="13800138002",
            department="product",
            notes="5年互联网产品经验"
        ),
        "cand_003": Candidate(
            id="cand_003",
            name="赵大伟",
            position="销售经理",
            email="zhaodw@email.com",
            phone="13800138003",
            department="sales",
            notes="B2B销售经验丰富"
        ),
        "cand_004": Candidate(
            id="cand_004",
            name="王技术",
            position="前端开发工程师",
            email="wangjs@email.com",
            phone="13800138004",
            department="engineering",
            notes="5年前端经验，React专家"
        ),
        "cand_005": Candidate(
            id="cand_005",
            name="李产品",
            position="高级产品经理",
            email="lipm@email.com",
            phone="13800138005",
            department="product",
            notes="曾主导过千万级用户产品"
        ),
        "cand_006": Candidate(
            id="cand_006",
            name="钱销售",
            position="渠道销售",
            email="qianxs@email.com",
            phone="13800138006",
            department="sales",
            notes="有丰富的渠道资源"
        ),
        "cand_007": Candidate(
            id="cand_007",
            name="孙架构",
            position="系统架构师",
            email="sunjg@email.com",
            phone="13800138007",
            department="engineering",
            notes="8年架构经验，大厂背景"
        ),
        "cand_008": Candidate(
            id="cand_008",
            name="周数据",
            position="数据分析工程师",
            email="zhousj@email.com",
            phone="13800138008",
            department="engineering",
            notes="熟悉Python和SQL，数据处理能力强"
        ),
    }
    
    intv_1_slot = TimeSlot(
        start=tomorrow.replace(hour=9, minute=0),
        end=tomorrow.replace(hour=9, minute=45)
    )
    intv_1 = Interview(
        id="intv_001",
        candidate_id="cand_001",
        round_type=RoundType.FIRST,
        slot=intv_1_slot,
        interviewer_ids=["intv_zhang", "intv_li"],
        room_id="room_a",
        status=InterviewStatus.CONFIRMED,
        priority=1,
        reschedule_count=0,
        operator="hr_admin",
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=1),
        notes="候选人状态良好，已确认"
    )
    
    intv_2_slot = TimeSlot(
        start=tomorrow.replace(hour=14, minute=0),
        end=tomorrow.replace(hour=14, minute=45)
    )
    intv_2 = Interview(
        id="intv_002",
        candidate_id="cand_002",
        round_type=RoundType.FIRST,
        slot=intv_2_slot,
        interviewer_ids=["intv_cai"],
        room_id="room_b",
        status=InterviewStatus.SCHEDULED,
        priority=0,
        reschedule_count=0,
        operator="hr_admin",
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(days=1),
        notes="待双方确认"
    )
    
    intv_3_slot = TimeSlot(
        start=day_after.replace(hour=10, minute=0),
        end=day_after.replace(hour=10, minute=30)
    )
    intv_3 = Interview(
        id="intv_003",
        candidate_id="cand_003",
        round_type=RoundType.FIRST,
        slot=intv_3_slot,
        interviewer_ids=["intv_zhou"],
        room_id="room_d",
        status=InterviewStatus.RESCHEDULED,
        priority=2,
        reschedule_count=1,
        operator="hr_admin",
        created_at=now - timedelta(days=3),
        updated_at=now - timedelta(days=1),
        notes="面试官临时有会，改期一次"
    )
    
    intv_4_slot = TimeSlot(
        start=in_three_days.replace(hour=14, minute=0),
        end=in_three_days.replace(hour=15, minute=0)
    )
    intv_4 = Interview(
        id="intv_004",
        candidate_id="cand_001",
        round_type=RoundType.SECOND,
        slot=intv_4_slot,
        interviewer_ids=["intv_wang", "intv_li"],
        room_id="room_c",
        status=InterviewStatus.SCHEDULED,
        priority=1,
        reschedule_count=0,
        operator="hr_admin",
        created_at=now - timedelta(days=1),
        updated_at=now,
        notes="初试通过，安排复试"
    )
    
    intv_5_slot = TimeSlot(
        start=in_five_days.replace(hour=14, minute=0),
        end=in_five_days.replace(hour=14, minute=45)
    )
    intv_5 = Interview(
        id="intv_005",
        candidate_id="cand_004",
        round_type=RoundType.FIRST,
        slot=intv_5_slot,
        interviewer_ids=["intv_zhang", "intv_li"],
        room_id="room_a",
        status=InterviewStatus.CANDIDATE_NO_SHOW,
        priority=3,
        reschedule_count=0,
        operator="hr_admin",
        created_at=now - timedelta(days=4),
        updated_at=now - timedelta(days=1),
        notes="候选人未参加面试，电话无人接听"
    )
    
    intv_6_slot = TimeSlot(
        start=in_four_days.replace(hour=10, minute=0),
        end=in_four_days.replace(hour=10, minute=45)
    )
    intv_6 = Interview(
        id="intv_006",
        candidate_id="cand_002",
        round_type=RoundType.SECOND,
        slot=intv_6_slot,
        interviewer_ids=["intv_cai", "intv_wang"],
        room_id="room_b",
        status=InterviewStatus.SCHEDULED,
        priority=0,
        reschedule_count=0,
        operator="hr_admin",
        created_at=now - timedelta(hours=5),
        updated_at=now - timedelta(hours=5),
        notes=""
    )
    
    state.interviews = {
        "intv_001": intv_1,
        "intv_002": intv_2,
        "intv_003": intv_3,
        "intv_004": intv_4,
        "intv_005": intv_5,
        "intv_006": intv_6,
    }
    
    state.last_updated = now
    
    return state
