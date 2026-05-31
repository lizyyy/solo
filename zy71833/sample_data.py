from models import UnitConfig, BattleMaterial
from typing import List


def create_sample_units() -> List[UnitConfig]:
    return [
        UnitConfig(
            unit_id="U001",
            name="遗迹守卫者",
            hp=120,
            attack=25,
            defense=15,
            speed=12,
            skills=["重击"],
        ),
        UnitConfig(
            unit_id="U002",
            name="机关术士",
            hp=80,
            attack=35,
            defense=8,
            speed=15,
            skills=["穿透"],
        ),
        UnitConfig(
            unit_id="U003",
            name="石像傀儡",
            hp=150,
            attack=20,
            defense=20,
            speed=8,
            skills=[],
        ),
        UnitConfig(
            unit_id="U004",
            name="疾风刺客",
            hp=70,
            attack=30,
            defense=10,
            speed=20,
            skills=["暴击"],
        ),
    ]


def create_sample_material_1() -> BattleMaterial:
    units = create_sample_units()[:2]
    return BattleMaterial(
        material_id="MAT-2026-001",
        source="平衡性表格v1.2 - 第3组",
        units=units,
        terrain="ruins",
        weather="clear",
        turn_order=["U002", "U001"],
        special_rules=["机关激活: 第3回合起机关术士攻击+10"],
        version="1.0",
    )


def create_sample_material_2() -> BattleMaterial:
    units = create_sample_units()[2:]
    return BattleMaterial(
        material_id="MAT-2026-002",
        source="群聊讨论 - 2026-05-28 调整方案",
        units=units,
        terrain="mountain",
        weather="fog",
        turn_order=["U004", "U003"],
        special_rules=[],
        version="1.0",
    )


def create_sample_material_3() -> BattleMaterial:
    units = create_sample_units()
    return BattleMaterial(
        material_id="MAT-2026-003",
        source="战报复盘 - 遗迹关卡第5关",
        units=units,
        terrain="ruins",
        weather="storm",
        turn_order=["U004", "U002", "U001", "U003"],
        special_rules=["遗迹祝福: 每回合开始回复5HP"],
        version="1.0",
    )


def create_modified_material_1() -> BattleMaterial:
    units = [
        UnitConfig(
            unit_id="U001",
            name="遗迹守卫者",
            hp=130,
            attack=28,
            defense=15,
            speed=12,
            skills=["重击"],
        ),
        UnitConfig(
            unit_id="U002",
            name="机关术士",
            hp=80,
            attack=35,
            defense=8,
            speed=15,
            skills=["穿透"],
        ),
    ]
    return BattleMaterial(
        material_id="MAT-2026-001",
        source="平衡性表格v1.2 - 第3组",
        units=units,
        terrain="ruins",
        weather="clear",
        turn_order=["U001", "U002"],
        special_rules=["机关激活: 第3回合起机关术士攻击+10"],
        version="1.1",
    )


def create_duplicate_material_1() -> BattleMaterial:
    units = [
        UnitConfig(
            unit_id="U001",
            name="遗迹守卫者",
            hp=120,
            attack=25,
            defense=15,
            speed=12,
            skills=["重击"],
        ),
        UnitConfig(
            unit_id="U002",
            name="机关术士",
            hp=80,
            attack=35,
            defense=8,
            speed=15,
            skills=["穿透"],
        ),
    ]
    return BattleMaterial(
        material_id="MAT-2026-001-DUP",
        source="战报文本导出",
        units=units,
        terrain="ruins",
        weather="clear",
        turn_order=["U002", "U001"],
        special_rules=["机关激活: 第3回合起机关术士攻击+10"],
        version="1.0",
    )


SAMPLE_MATERIALS = {
    "sample1": create_sample_material_1,
    "sample2": create_sample_material_2,
    "sample3": create_sample_material_3,
    "modified1": create_modified_material_1,
    "duplicate1": create_duplicate_material_1,
}
