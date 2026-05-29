from datetime import datetime, timedelta
from typing import List

from .models import (
    Commission,
    CommissionStatus,
    ConfirmationRecord,
    PaymentNode,
    RevisionRecord,
    SketchVersion,
)
from .storage import StorageManager


def create_sample_data(storage: StorageManager) -> List[Commission]:
    commissions = []
    
    base_date = datetime.now() - timedelta(days=30)
    
    c1 = Commission(
        id="CM001",
        title="头像插画 - 小A",
        client_name="Alice",
        created_at=base_date,
        description="二次元风格头像，蓝发猫耳少女",
        status=CommissionStatus.IN_PROGRESS,
        max_revisions=3,
        sketches=[
            SketchVersion(
                version=1,
                file_path="./sketches/CM001_v1.png",
                created_at=base_date + timedelta(days=1),
                description="初始草图",
                revisions=[
                    RevisionRecord(
                        version=1,
                        feedback="耳朵再大一点",
                        date=base_date + timedelta(days=2),
                        is_resolved=True,
                        resolved_at=base_date + timedelta(days=2),
                    ),
                ],
            ),
            SketchVersion(
                version=2,
                file_path="./sketches/CM001_v2.png",
                created_at=base_date + timedelta(days=3),
                description="修改后草图",
                revisions=[
                    RevisionRecord(
                        version=1,
                        feedback="眼睛颜色换成紫色",
                        date=base_date + timedelta(days=4),
                    ),
                ],
            ),
        ],
        payments=[
            PaymentNode(
                node_type="deposit",
                amount=200.0,
                due_date=base_date + timedelta(days=1),
                paid=True,
                paid_at=base_date + timedelta(days=1),
                transaction_id="TXN001",
            ),
            PaymentNode(
                node_type="final",
                amount=300.0,
                due_date=base_date + timedelta(days=14),
                paid=False,
            ),
        ],
        confirmations=[
            ConfirmationRecord(
                stage="sketch",
                confirmed=True,
                confirmed_at=base_date + timedelta(days=3),
                screenshot_path="./screenshots/CM001_sketch.png",
            ),
        ],
        tags=["头像", "二次元"],
    )
    commissions.append(c1)
    
    c2 = Commission(
        id="CM002",
        title="商插海报 - 品牌B",
        client_name="Brand Company",
        created_at=base_date + timedelta(days=5),
        description="产品宣传海报，需要活泼可爱风格",
        status=CommissionStatus.REVISING,
        max_revisions=3,
        sketches=[
            SketchVersion(
                version=1,
                file_path="./sketches/CM002_v1.png",
                created_at=base_date + timedelta(days=6),
                description="方案A",
                revisions=[
                    RevisionRecord(version=1, feedback="配色太暗", date=base_date + timedelta(days=7), is_resolved=True, resolved_at=base_date + timedelta(days=7)),
                    RevisionRecord(version=2, feedback="人物位置左移", date=base_date + timedelta(days=8), is_resolved=True, resolved_at=base_date + timedelta(days=8)),
                    RevisionRecord(version=3, feedback="LOGO放大", date=base_date + timedelta(days=9), is_resolved=True, resolved_at=base_date + timedelta(days=9)),
                    RevisionRecord(version=4, feedback="背景换成渐变", date=base_date + timedelta(days=10), is_resolved=True, resolved_at=base_date + timedelta(days=10)),
                ],
            ),
            SketchVersion(
                version=2,
                file_path="./sketches/CM002_v2.png",
                created_at=base_date + timedelta(days=11),
                description="方案B",
                revisions=[
                    RevisionRecord(version=1, feedback="风格不对，要更简约", date=base_date + timedelta(days=12)),
                ],
            ),
        ],
        payments=[
            PaymentNode(node_type="deposit", amount=1500.0, due_date=base_date + timedelta(days=5), paid=True, paid_at=base_date + timedelta(days=5)),
            PaymentNode(node_type="final", amount=3500.0, due_date=base_date + timedelta(days=25), paid=False),
        ],
        confirmations=[
            ConfirmationRecord(stage="sketch", confirmed=True, confirmed_at=base_date + timedelta(days=11), screenshot_path="./screenshots/CM002_sketch.png"),
        ],
        tags=["商业", "海报"],
    )
    commissions.append(c2)
    
    c3 = Commission(
        id="CM003",
        title="立绘 - 游戏角色",
        client_name="Game Studio",
        created_at=base_date + timedelta(days=15),
        description="RPG游戏主角全身立绘",
        status=CommissionStatus.COMPLETED,
        max_revisions=2,
        sketches=[
            SketchVersion(
                version=1,
                file_path="./sketches/CM003_v1.png",
                created_at=base_date + timedelta(days=16),
                description="初始设定",
                revisions=[RevisionRecord(version=1, feedback="武器换成剑", date=base_date + timedelta(days=17), is_resolved=True, resolved_at=base_date + timedelta(days=17))],
            ),
        ],
        payments=[
            PaymentNode(node_type="deposit", amount=800.0, due_date=base_date + timedelta(days=15), paid=True, paid_at=base_date + timedelta(days=15)),
            PaymentNode(node_type="final", amount=1200.0, due_date=base_date + timedelta(days=22), paid=False),
        ],
        confirmations=[
            ConfirmationRecord(stage="sketch", confirmed=True, confirmed_at=base_date + timedelta(days=18), screenshot_path="./screenshots/CM003_sketch.png"),
            ConfirmationRecord(stage="lineart", confirmed=True, confirmed_at=base_date + timedelta(days=20), screenshot_path=None),
            ConfirmationRecord(stage="final", confirmed=True, confirmed_at=base_date + timedelta(days=25), screenshot_path=None),
        ],
        tags=["立绘", "游戏"],
    )
    commissions.append(c3)
    
    c4 = Commission(
        id="CM004",
        title="Q版表情包",
        client_name="David",
        created_at=base_date + timedelta(days=20),
        description="16个Q版表情，用于社交媒体",
        status=CommissionStatus.WAITING_CONFIRM,
        max_revisions=2,
        sketches=[
            SketchVersion(version=1, file_path="./sketches/CM004_v1.png", created_at=base_date + timedelta(days=21), description="第一套8个"),
        ],
        payments=[
            PaymentNode(node_type="deposit", amount=400.0, due_date=base_date + timedelta(days=20), paid=True, paid_at=base_date + timedelta(days=20)),
        ],
        confirmations=[],
        tags=["表情包", "Q版"],
    )
    commissions.append(c4)
    
    c5 = Commission(
        id="CM005",
        title="书籍封面",
        client_name="出版社E",
        created_at=base_date + timedelta(days=2),
        description="科幻小说封面设计",
        status=CommissionStatus.COMPLETED,
        max_revisions=3,
        sketches=[
            SketchVersion(
                version=1,
                file_path="./sketches/CM005_v1.png",
                created_at=base_date + timedelta(days=3),
                revisions=[RevisionRecord(version=1, feedback="字体再大一点", date=base_date + timedelta(days=4), is_resolved=True, resolved_at=base_date + timedelta(days=4))],
            ),
            SketchVersion(
                version=2,
                file_path="./sketches/CM005_v2.png",
                created_at=base_date + timedelta(days=5),
            ),
        ],
        payments=[
            PaymentNode(node_type="deposit", amount=500.0, due_date=base_date + timedelta(days=2), paid=True, paid_at=base_date + timedelta(days=2)),
            PaymentNode(node_type="final", amount=1000.0, due_date=base_date + timedelta(days=10), paid=True, paid_at=base_date + timedelta(days=10)),
        ],
        confirmations=[
            ConfirmationRecord(stage="sketch", confirmed=True, confirmed_at=base_date + timedelta(days=6), screenshot_path="./screenshots/CM005_sketch.png"),
            ConfirmationRecord(stage="final", confirmed=True, confirmed_at=base_date + timedelta(days=12), screenshot_path="./screenshots/CM005_final.png"),
        ],
        tags=["封面", "书籍"],
    )
    commissions.append(c5)
    
    for c in commissions:
        storage.save_commission(c, backup=False)
    
    return commissions
