import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import storage
from models import STATUS_PENDING, STATUS_ALIGNED, STATUS_FLAGGED, STATUS_BLOCKED, STATUS_CLOSED
import algorithms


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "records.json")


def seed_if_empty(force: bool = False):
    if os.path.exists(DATA_FILE) and not force:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            import json
            raw = json.load(f)
            if raw.get("records"):
                print(f"[seed] 已有 {len(raw['records'])} 条记录，跳过种子数据（使用 --force 重生成）")
                return

    print("[seed] 开始生成真实感样例数据...")

    rec1 = storage.create_record(
        pet_name="雪球",
        pet_type="龙猫",
        owner_name="王女士",
        owner_contact="138****2345 / 微信：wang_xueqiu",
        original_temp=37.8,
        target_temp_min=36.5,
        target_temp_max=37.5,
        current_temp=37.2,
    )

    algorithms.add_wechat_note(
        rec1.record_id,
        "王女士：雪球今天早上37.2度，比昨天好点了。早上喂了美洛昔康0.5ml，早晚各一次。",
    )

    algorithms.add_wechat_note(
        rec1.record_id,
        "王女士：对了，刚才的剂量我发错了撤回了一条消息，应该是美洛昔康0.3ml早晚各一次。之前医生开的是0.5ml但是雪球体重轻。",
    )

    algorithms.initial_align(rec1.record_id)

    print(f"  [样例1] 雪球(龙猫) 已生成：含撤回记录 + 剂量变更 → 应自动标记 BLOCKED")

    rec2 = storage.create_record(
        pet_name="豆豆",
        pet_type="鬃狮蜥",
        owner_name="李先生",
        owner_contact="139****7788",
        original_temp=38.5,
        target_temp_min=35.0,
        target_temp_max=38.0,
        current_temp=36.8,
    )
    algorithms.add_wechat_note(
        rec2.record_id,
        "李先生：豆豆晒灯后测了36.8度，状态还行。喂食正常。",
    )
    algorithms.add_wechat_note(
        rec2.record_id,
        "李先生：补：今天下午又测了一次是37.5度，刚才说的36.8度是上午的。",
    )
    algorithms.initial_align(rec2.record_id)
    print(f"  [样例2] 豆豆(鬃狮蜥) 已生成：体温两次测量不一致 → WARNING")

    rec3 = storage.create_record(
        pet_name="胖胖",
        pet_type="非洲迷你刺猬",
        owner_name="陈小姐",
        owner_contact="微信：cjj_pangpang",
        original_temp=35.2,
        target_temp_min=35.0,
        target_temp_max=37.0,
        current_temp=36.1,
    )
    algorithms.add_wechat_note(
        rec3.record_id,
        "陈小姐：胖胖昨晚活动少，今早测36.1度。益生菌1袋每天一次。",
    )
    algorithms.initial_align(rec3.record_id)

    algorithms.manual_override(
        rec3.record_id,
        operator="阿岑",
        new_status=STATUS_FLAGGED,
        reason="现场电话回访胖胖主人时，主人临时补充：昨晚实际体温偏低到34.9，之前微信里忘了提，因此需要再观察24h。原结论'已达标'改判为'继续追踪'。",
        resolve_flag_ids=[],
    )
    print(f"  [样例3] 胖胖(刺猬) 已生成：阿岑人工改判记录，含详细原因")

    rec4 = storage.create_record(
        pet_name="皮皮",
        pet_type="安格鲁貂",
        owner_name="赵先生",
        owner_contact="137****0011",
        original_temp=39.1,
        target_temp_min=37.8,
        target_temp_max=39.0,
        current_temp=38.5,
    )
    algorithms.add_wechat_note(
        rec4.record_id,
        "赵先生：皮皮今天食欲正常，38.5度。阿莫西林片半片 bid。",
    )
    algorithms.initial_align(rec4.record_id)
    algorithms.close_record(rec4.record_id, operator="系统", close_note="连续3天体温稳定，用药无误，归档。")
    print(f"  [样例4] 皮皮(安格鲁貂) 已生成：正常对齐并关闭")

    rec5 = storage.create_record(
        pet_name="团子",
        pet_type="蜜袋鼯",
        owner_name="小周",
        owner_contact="微信：zhou_tuanzi",
        original_temp=35.8,
        target_temp_min=35.5,
        target_temp_max=36.5,
        current_temp=36.2,
    )
    algorithms.add_wechat_note(
        rec5.record_id,
        "小周：团子今天测了36.2，还好。[撤回] 那个我说错了，钙液是1滴不是2滴。对，钙液1滴每天。维生素A每天1粒。",
    )
    algorithms.add_wechat_note(
        rec5.record_id,
        "小周：对了上次开的驱虫药吃半片，每周一次。",
    )
    algorithms.initial_align(rec5.record_id)
    print(f"  [样例5] 团子(蜜袋鼯) 已生成：备注内嵌 [撤回] 标记 + 多种用药提取")

    total = len(storage.list_records())
    print(f"[seed] 完成，共 {total} 条样例记录。持久化文件：{DATA_FILE}")
    print(f"       重启服务后数据仍在，符合'状态不落内存'要求。")


if __name__ == "__main__":
    force = "--force" in sys.argv
    seed_if_empty(force=force)
