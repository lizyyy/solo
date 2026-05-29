from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    Stage, Artist, ArtistAvailability, ChangeoverRule,
    NoiseRestriction, Schedule, ScheduleHistory, Conflict, Notification,
    ScheduleStatus, NotificationStatus,
)
from app.engine import run_full_conflict_check

FESTIVAL_DATE = datetime(2026, 7, 18)


def seed_if_empty(db: Session):
    if db.query(Stage).first():
        return

    # ── 舞台 ──
    stages = [
        Stage(
            name="主舞台·雷霆",
            location="A区中央草坪",
            capacity=15000,
            noise_limit_db=100.0,
            has_noise_monitor=True,
            equipment_tags="线阵PA, 返送监听×8, 舞台灯光架, 烟机",
            available_from=FESTIVAL_DATE.replace(hour=10, minute=0),
            available_to=FESTIVAL_DATE.replace(hour=23, minute=0),
        ),
        Stage(
            name="电子舞台·脉冲",
            location="B区湖畔",
            capacity=6000,
            noise_limit_db=90.0,
            has_noise_monitor=True,
            equipment_tags="低音炮阵列, DJ台, LED屏, 激光",
            available_from=FESTIVAL_DATE.replace(hour=12, minute=0),
            available_to=FESTIVAL_DATE.replace(hour=23, minute=30),
        ),
        Stage(
            name="民谣帐篷·暖风",
            location="C区林间",
            capacity=2000,
            noise_limit_db=80.0,
            has_noise_monitor=False,
            equipment_tags="小型PA, 木吉他DI, 立麦×3",
            available_from=FESTIVAL_DATE.replace(hour=11, minute=0),
            available_to=FESTIVAL_DATE.replace(hour=21, minute=0),
        ),
    ]
    for s in stages:
        db.add(s)
    db.flush()

    # ── 艺人 ──
    artists = [
        Artist(
            name="赵雷",
            genre="民谣",
            avg_volume_db=78.0,
            rider_equipment="木吉他DI×1, 立麦×2, 和声话筒×1",
            contact_phone="138****2210",
            contact_email="zhaolei_mgmt@example.com",
            notes="不接22:00后场次，有噪音敏感要求",
        ),
        Artist(
            name="痛仰乐队",
            genre="摇滚",
            avg_volume_db=102.0,
            rider_equipment="吉他箱×2, 贝斯箱×1, 鼓组全套, 主唱手持×2",
            contact_phone="139****5577",
            contact_email="tongyang_mgmt@example.com",
            notes="需要独立化妆间，鼓组自带",
        ),
        Artist(
            name="陈粒",
            genre="独立流行",
            avg_volume_db=85.0,
            rider_equipment="键盘×1, 吉他DI×2, 主唱手持×1",
            contact_phone="136****8834",
            contact_email="chenli_mgmt@example.com",
            notes="当日17:00才从外地飞到，可能迟到",
        ),
        Artist(
            name="Anti-General",
            genre="电子",
            avg_volume_db=95.0,
            rider_equipment="CDJ-3000×2, DJM-900, 监听耳机",
            contact_phone="137****4412",
            contact_email="ag_booking@example.com",
            notes="只演电子舞台，低音要猛",
        ),
        Artist(
            name="五条人",
            genre="民谣",
            avg_volume_db=82.0,
            rider_equipment="手风琴DI×1, 吉他DI×1, 立麦×2",
            contact_phone="135****6621",
            contact_email="wtour_mgmt@example.com",
            notes="舞台旁边需要有插座给海丰摩托车充电（开玩笑的，但要立麦）",
        ),
        Artist(
            name="新裤子",
            genre="摇滚",
            avg_volume_db=105.0,
            rider_equipment="吉他箱×2, 贝斯箱×1, 合成器×1, 鼓组, 主唱手持×2",
            contact_phone="133****9988",
            contact_email="newpants_mgmt@example.com",
            notes="压轴优先，演出时长不少于60分钟",
        ),
    ]
    for a in artists:
        db.add(a)
    db.flush()

    # ── 艺人档期 ──
    avail_windows = [
        ArtistAvailability(
            artist_id=artists[0].id,
            window_start=FESTIVAL_DATE.replace(hour=11, minute=0),
            window_end=FESTIVAL_DATE.replace(hour=18, minute=0),
            is_hard_constraint=True,
            note="不接22:00后，傍晚前必须结束",
        ),
        ArtistAvailability(
            artist_id=artists[1].id,
            window_start=FESTIVAL_DATE.replace(hour=14, minute=0),
            window_end=FESTIVAL_DATE.replace(hour=23, minute=0),
            is_hard_constraint=False,
            note="希望下午到晚间，可微调",
        ),
        ArtistAvailability(
            artist_id=artists[2].id,
            window_start=FESTIVAL_DATE.replace(hour=17, minute=30),
            window_end=FESTIVAL_DATE.replace(hour=22, minute=0),
            is_hard_constraint=True,
            note="航班预计17:00落地，赶过去至少17:30",
        ),
        ArtistAvailability(
            artist_id=artists[3].id,
            window_start=FESTIVAL_DATE.replace(hour=20, minute=0),
            window_end=FESTIVAL_DATE.replace(hour=23, minute=30),
            is_hard_constraint=True,
            note="电子舞台夜间档",
        ),
        ArtistAvailability(
            artist_id=artists[4].id,
            window_start=FESTIVAL_DATE.replace(hour=13, minute=0),
            window_end=FESTIVAL_DATE.replace(hour=20, minute=0),
            is_hard_constraint=False,
            note="下午到晚上都行",
        ),
        ArtistAvailability(
            artist_id=artists[5].id,
            window_start=FESTIVAL_DATE.replace(hour=19, minute=0),
            window_end=FESTIVAL_DATE.replace(hour=23, minute=0),
            is_hard_constraint=True,
            note="压轴，必须20:00后开场",
        ),
    ]
    for w in avail_windows:
        db.add(w)
    db.flush()

    # ── 换场规则 ──
    changeover_rules = [
        ChangeoverRule(
            from_genre="民谣", to_genre="摇滚",
            duration_minutes=45,
            equipment_swap="民谣小PA→摇滚大箱+鼓组",
            note="设备差异大，换场耗时",
        ),
        ChangeoverRule(
            from_genre="摇滚", to_genre="摇滚",
            duration_minutes=25,
            equipment_swap="鼓组共用，吉他箱微调",
        ),
        ChangeoverRule(
            from_genre="民谣", to_genre="民谣",
            duration_minutes=15,
            equipment_swap="DI切换+立麦",
        ),
        ChangeoverRule(
            from_artist_id=artists[1].id,
            to_artist_id=artists[5].id,
            stage_id=stages[0].id,
            duration_minutes=35,
            equipment_swap="痛仰鼓组→新裤子鼓组(尺寸不同要调)",
            note="两家鼓手体型差大，鼓凳+镲片都要重调",
        ),
        ChangeoverRule(
            duration_minutes=30,
            note="默认换场时间",
        ),
    ]
    for r in changeover_rules:
        db.add(r)
    db.flush()

    # ── 噪声限制 ──
    noise_restrictions = [
        NoiseRestriction(
            stage_id=stages[0].id,
            area_name="主舞台·雷霆",
            max_db=100.0,
            restricted_from=FESTIVAL_DATE.replace(hour=22, minute=0),
            restricted_to=FESTIVAL_DATE.replace(hour=23, minute=59),
            reason="东侧居民区投诉风险，环保局限令",
            authority="市生态环境局",
            is_recurring_daily=False,
        ),
        NoiseRestriction(
            stage_id=stages[1].id,
            area_name="电子舞台·脉冲",
            max_db=85.0,
            restricted_from=FESTIVAL_DATE.replace(hour=22, minute=0),
            restricted_to=FESTIVAL_DATE.replace(hour=23, minute=59),
            reason="湖畔住宅区噪声敏感",
            authority="街道办协调",
            is_recurring_daily=False,
        ),
        NoiseRestriction(
            stage_id=stages[2].id,
            area_name="民谣帐篷·暖风",
            max_db=80.0,
            restricted_from=FESTIVAL_DATE.replace(hour=10, minute=0),
            restricted_to=FESTIVAL_DATE.replace(hour=21, minute=0),
            reason="全天限80dB，林间自然区域",
            authority="园区管理方",
            is_recurring_daily=False,
        ),
        NoiseRestriction(
            area_name="全场通用",
            max_db=75.0,
            restricted_from=FESTIVAL_DATE.replace(hour=23, minute=0),
            restricted_to=FESTIVAL_DATE.replace(hour=23, minute=59),
            reason="深夜降噪，文化局演出许可条件",
            authority="市文化广电旅游局",
            is_recurring_daily=False,
        ),
    ]
    for r in noise_restrictions:
        db.add(r)
    db.flush()

    # ── 排程（含故意制造的冲突场景） ──
    schedules = [
        Schedule(
            artist_id=artists[0].id,
            stage_id=stages[2].id,
            start_time=FESTIVAL_DATE.replace(hour=11, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=11, minute=50),
            status=ScheduleStatus.CONFIRMED,
            changeover_before_minutes=0,
            changeover_after_minutes=15,
            estimated_volume_db=78.0,
            assigned_by="王导",
            note="开场嘉宾，暖场45分钟+返场",
        ),
        Schedule(
            artist_id=artists[4].id,
            stage_id=stages[2].id,
            start_time=FESTIVAL_DATE.replace(hour=12, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=12, minute=50),
            status=ScheduleStatus.CONFIRMED,
            changeover_before_minutes=10,
            changeover_after_minutes=15,
            estimated_volume_db=82.0,
            assigned_by="王导",
            note="五条人下午场",
        ),
        Schedule(
            artist_id=artists[1].id,
            stage_id=stages[0].id,
            start_time=FESTIVAL_DATE.replace(hour=15, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=16, minute=0),
            status=ScheduleStatus.CONFIRMED,
            changeover_before_minutes=0,
            changeover_after_minutes=45,
            estimated_volume_db=102.0,
            assigned_by="王导",
            note="痛仰下午场，鼓组自带需提前进场",
        ),
        Schedule(
            artist_id=artists[5].id,
            stage_id=stages[0].id,
            start_time=FESTIVAL_DATE.replace(hour=16, minute=15),
            end_time=FESTIVAL_DATE.replace(hour=17, minute=30),
            status=ScheduleStatus.DRAFT,
            changeover_before_minutes=45,
            changeover_after_minutes=0,
            estimated_volume_db=105.0,
            assigned_by="王导",
            note="新裤子接痛仰——换场只有15分钟！故意设置冲突",
        ),
        Schedule(
            artist_id=artists[2].id,
            stage_id=stages[0].id,
            start_time=FESTIVAL_DATE.replace(hour=16, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=16, minute=50),
            status=ScheduleStatus.DRAFT,
            changeover_before_minutes=0,
            changeover_after_minutes=0,
            estimated_volume_db=85.0,
            assigned_by="李导",
            note="陈粒排了16:00但她17:30才到——迟到冲突",
        ),
        Schedule(
            artist_id=artists[3].id,
            stage_id=stages[1].id,
            start_time=FESTIVAL_DATE.replace(hour=21, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=22, minute=30),
            status=ScheduleStatus.CONFIRMED,
            changeover_before_minutes=0,
            changeover_after_minutes=0,
            estimated_volume_db=95.0,
            assigned_by="李导",
            note="Anti-General 电子夜间档，22:00后噪声超标",
        ),
        Schedule(
            artist_id=artists[2].id,
            stage_id=stages[2].id,
            start_time=FESTIVAL_DATE.replace(hour=18, minute=0),
            end_time=FESTIVAL_DATE.replace(hour=18, minute=50),
            status=ScheduleStatus.DRAFT,
            changeover_before_minutes=0,
            changeover_after_minutes=0,
            estimated_volume_db=85.0,
            assigned_by="王导",
            note="陈粒民谣帐篷场——但与主舞台16:00档重叠，双重预约冲突",
        ),
    ]
    for s in schedules:
        db.add(s)
    db.flush()

    # ── 自动检测冲突 ──
    for s in schedules:
        conflicts = run_full_conflict_check(db, s)
        for c in conflicts:
            db.add(c)
    db.flush()

    # ── 改动历史（模拟排程从创建到调整的过程） ──
    history_entries = [
        ScheduleHistory(
            schedule_id=schedules[3].id,
            change_type="create",
            field_name=None,
            old_value=None,
            new_value=None,
            changed_by="王导",
            change_reason="初次排程：新裤子接痛仰压轴",
            changed_at=FESTIVAL_DATE.replace(hour=9, minute=0) - timedelta(days=3),
        ),
        ScheduleHistory(
            schedule_id=schedules[3].id,
            change_type="update",
            field_name="start_time",
            old_value=FESTIVAL_DATE.replace(hour=17, minute=0).isoformat(),
            new_value=FESTIVAL_DATE.replace(hour=16, minute=15).isoformat(),
            changed_by="王导",
            change_reason="新裤子经纪方要求提前开场，赶飞机回京",
            changed_at=FESTIVAL_DATE.replace(hour=14, minute=0) - timedelta(days=1),
        ),
        ScheduleHistory(
            schedule_id=schedules[4].id,
            change_type="create",
            field_name=None,
            old_value=None,
            new_value=None,
            changed_by="李导",
            change_reason="初次排程：陈粒16:00主舞台",
            changed_at=FESTIVAL_DATE.replace(hour=10, minute=0) - timedelta(days=5),
        ),
        ScheduleHistory(
            schedule_id=schedules[4].id,
            change_type="update",
            field_name="start_time",
            old_value=FESTIVAL_DATE.replace(hour=17, minute=30).isoformat(),
            new_value=FESTIVAL_DATE.replace(hour=16, minute=0).isoformat(),
            changed_by="李导",
            change_reason="场地协调提前，但未核实陈粒航班时间",
            changed_at=FESTIVAL_DATE.replace(hour=16, minute=0) - timedelta(days=2),
        ),
    ]
    for h in history_entries:
        db.add(h)
    db.flush()

    # ── 通知清单 ──
    notifications = [
        Notification(
            recipient="王导",
            recipient_role="项目经理",
            subject="排程冲突：新裤子换场时间不足",
            body="新裤子(16:15)接痛仰(16:00结束)仅15分钟换场，需45分钟。请调整开场时间或缩短痛仰演出。",
            notification_type="conflict_alert",
            status=NotificationStatus.SENT,
            related_schedule_id=schedules[3].id,
            related_conflict_id=None,
            sent_at=FESTIVAL_DATE.replace(hour=9, minute=30) - timedelta(days=1),
        ),
        Notification(
            recipient="李导",
            recipient_role="副导演",
            subject="艺人迟到风险：陈粒17:30才到",
            body="陈粒排程16:00开场，但航班预计17:00落地，档期从17:30开始。当前为硬约束冲突，需改时间。",
            notification_type="conflict_alert",
            status=NotificationStatus.PENDING,
            related_schedule_id=schedules[4].id,
        ),
        Notification(
            recipient="安保组-张队",
            recipient_role="安保",
            subject="噪声预警：Anti-General 22:00后可能超标",
            body="电子舞台脉冲22:00后限85dB，Anti-General预估95dB。需提前准备降噪措施或缩短演出。",
            notification_type="noise_warning",
            status=NotificationStatus.PENDING,
            related_schedule_id=schedules[5].id,
        ),
        Notification(
            recipient="陈粒经纪",
            recipient_role="艺人经纪",
            subject="档期确认：7月18日民谣帐篷18:00-18:50",
            body="请确认7月18日18:00-18:50民谣帐篷·暖风场次。注意：您当日主舞台还有16:00排程待调整，请协调。",
            notification_type="schedule_confirm",
            status=NotificationStatus.PENDING,
            related_schedule_id=schedules[6].id,
        ),
    ]
    for n in notifications:
        db.add(n)

    db.commit()
