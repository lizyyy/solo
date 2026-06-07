from datetime import datetime, timedelta
from models import (
    MusicUseRecord, MusicUseType, RecordStatus,
    GroupChatMessage, ContractScreenshot, ProcessingStep, RoyaltyDetail
)


def create_demo_records():
    now = datetime.now()

    record1 = MusicUseRecord(
        record_id="REC-001",
        video_id="VID-2026-0520-001",
        video_title="【巡演北京站】开场暖场短视频",
        publish_time=now - timedelta(days=18),
        music_name="城市的脚步",
        artist="林夕乐队",
        use_type=MusicUseType.OFFICIAL,
        status=RecordStatus.NORMAL,
        current_caliber="正选曲目，合同约定巡演全站点可用",
        notes="顺利记录，流程完整"
    )
    record1.source_messages = [
        GroupChatMessage(
            msg_id="MSG-001",
            sender="巡演统筹-阿梅",
            content="接龙：北京站开场曲确认 - 《城市的脚步》，正选曲目，已走合同流程",
            timestamp=now - timedelta(days=20),
            screenshot_ref="screenshot/group_chat_001.png"
        ),
        GroupChatMessage(
            msg_id="MSG-002",
            sender="音乐总监-老王",
            content="确认，这首版权清晰",
            timestamp=now - timedelta(days=20),
        )
    ]
    record1.contract_screenshot = ContractScreenshot(
        screenshot_id="CTR-001",
        contract_no="HT-2026-XY-003",
        music_name="城市的脚步",
        artist="林夕乐队",
        use_scope="全国巡演全站点短视频配乐",
        fee_rate=0.08,
        upload_time=now - timedelta(days=25),
        uploaded_by="法务-小李"
    )
    record1.processing_history = [
        ProcessingStep(
            step_name="排练群接龙导入",
            operator="系统自动",
            timestamp=now - timedelta(days=19),
            action="从排练群接龙记录导入，识别为正选曲目",
            remark="群消息2条，含接龙确认"
        ),
        ProcessingStep(
            step_name="合同页匹配",
            operator="系统自动",
            timestamp=now - timedelta(days=19),
            action="匹配到合同 HT-2026-XY-003",
            remark="费用口径8%，与接龙一致"
        ),
        ProcessingStep(
            step_name="分账明细计算",
            operator="系统自动",
            timestamp=now - timedelta(days=19),
            action="生成分账明细",
            remark="正常流程完成"
        )
    ]
    record1.royalty = RoyaltyDetail(
        music_name="城市的脚步",
        artist="林夕乐队",
        use_count=3,
        unit_price=500.0,
        total_amount=1500.0,
        fee_rate=0.08,
        settlement_status="待结算"
    )

    record2 = MusicUseRecord(
        record_id="REC-002",
        video_id="VID-2026-0522-007",
        video_title="【巡演上海站】幕后花絮vlog",
        publish_time=now - timedelta(days=16),
        music_name="晚风轻吹",
        artist="独立音乐人-阿凯",
        use_type=MusicUseType.SUBSTITUTE,
        status=RecordStatus.PENDING_REVIEW,
        current_caliber="临时替补曲目，仅群聊口头提及，待票务复核",
        notes="临时替补只在群里说了一句，未走正式流程"
    )
    record2.source_messages = [
        GroupChatMessage(
            msg_id="MSG-003",
            sender="排练群-小张",
            content="还是得口头兜底：上海站花絮临时换《晚风轻吹》，大家注意下",
            timestamp=now - timedelta(days=17),
            screenshot_ref="screenshot/group_chat_003.png"
        )
    ]
    record2.processing_history = [
        ProcessingStep(
            step_name="排练群接龙导入",
            operator="系统自动",
            timestamp=now - timedelta(days=16),
            action="从群聊识别到临时替补曲目",
            remark="仅1条群消息，无接龙格式，无合同匹配"
        ),
        ProcessingStep(
            step_name="状态标记",
            operator="系统自动",
            timestamp=now - timedelta(days=16),
            action="标记为【待票务复核】",
            remark="临时替补只在群里说了一句，不自动归正常，留待人工确认"
        )
    ]
    record2.royalty = RoyaltyDetail(
        music_name="晚风轻吹",
        artist="独立音乐人-阿凯",
        use_count=1,
        unit_price=0.0,
        total_amount=0.0,
        fee_rate=0.0,
        settlement_status="暂缓-待复核"
    )

    record3 = MusicUseRecord(
        record_id="REC-003",
        video_id="VID-2026-0510-004",
        video_title="【巡演广州站】艺人采访片段",
        publish_time=now - timedelta(days=28),
        music_name="时光盒",
        artist="追忆组合",
        use_type=MusicUseType.REVISED,
        status=RecordStatus.CONTRACT_SUPPLEMENTED,
        current_caliber="旧口径已修正，以合同页截图 HT-2026-XY-001 为准",
        notes="最初口径错误，后来从合同页截图补来正确口径"
    )
    record3.source_messages = [
        GroupChatMessage(
            msg_id="MSG-004",
            sender="运营-小周",
            content="广州站采访BGM用《时光盒》，记得是免费的对吧？",
            timestamp=now - timedelta(days=30),
        )
    ]
    record3.contract_screenshot = ContractScreenshot(
        screenshot_id="CTR-002",
        contract_no="HT-2026-XY-001",
        music_name="时光盒",
        artist="追忆组合",
        use_scope="巡演采访类短视频",
        fee_rate=0.05,
        upload_time=now - timedelta(days=10),
        uploaded_by="巡演统筹-阿梅"
    )
    record3.processing_history = [
        ProcessingStep(
            step_name="首次导入",
            operator="系统自动",
            timestamp=now - timedelta(days=29),
            action="从群聊导入，初步识别为免费BGM",
            remark="错误口径：误以为是免费曲目"
        ),
        ProcessingStep(
            step_name="人工修正触发",
            operator="票务-老刘",
            timestamp=now - timedelta(days=12),
            action="发现口径异常，标记需修正",
            remark="分账明细对不上，发起核查"
        ),
        ProcessingStep(
            step_name="合同页截图补录",
            operator="巡演统筹-阿梅",
            timestamp=now - timedelta(days=10),
            action="上传合同 HT-2026-XY-001 截图，补录正确口径",
            remark="费用口径5%，采访类可用"
        ),
        ProcessingStep(
            step_name="重跑分账",
            operator="系统自动",
            timestamp=now - timedelta(days=10),
            action="按新口径重新计算分账",
            remark="历史记录已保留首次错误口径供追溯"
        )
    ]
    record3.royalty = RoyaltyDetail(
        music_name="时光盒",
        artist="追忆组合",
        use_count=2,
        unit_price=300.0,
        total_amount=600.0,
        fee_rate=0.05,
        settlement_status="已修正-待结算"
    )

    return [record1, record2, record3]


DEMO_GROUP_CHAT_SNIPPET = """
【排练群】2026-05-20
┌─────────────────────────────────────┐
│ 巡演统筹-阿梅 14:30                    │
│ 接龙：北京站开场曲确认                  │
│ 1. 《城市的脚步》 - 正选曲目，已走合同   │
│ 音乐总监-老王 14:32 确认 ✓             │
└─────────────────────────────────────┘

【排练群】2026-05-22 紧急消息
┌─────────────────────────────────────┐
│ 小张 18:47                           │
│ 还是得口头兜底：上海站花絮临时换       │
│ 《晚风轻吹》，大家注意下             │
│ （无后续跟进，无接龙格式）            │
└─────────────────────────────────────┘
"""

DEMO_CONTRACT_SNIPPET = """
【合同页截图 HT-2026-XY-001】
┌─────────────────────────────────────────┐
│ 音乐授权合同                              │
│ 合同编号：HT-2026-XY-001                  │
│ 曲目：《时光盒》  艺人：追忆组合           │
│ 使用范围：巡演采访类短视频                 │
│ 费用标准：播放量分成 5%                   │
│ 签署日期：2026-04-15                      │
└─────────────────────────────────────────┘
"""
