from datetime import datetime, timedelta
from pathlib import Path

from .config import PHOTO_DIR, OPERATOR_LAOCEN, OPERATOR_ENGINEER, RECORD_STATUS
from .models import SensorRecordCreate
from . import core, database


BASE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


async def load_demo_data() -> str:
    await database.init_db()

    now = datetime.now()

    record1 = SensorRecordCreate(
        sensor_no="SN-2024-001",
        collision_time=now - timedelta(hours=5),
        car_mass_kg=10.5,
        velocity_ms=2.8,
        friction_coeff=0.02,
        collision_efficiency=0.92,
        notes="顺利记录 - 1号试验轨道，数据完整无修正",
    )
    result1 = await core.import_sensor_record(record1)

    record2 = SensorRecordCreate(
        sensor_no="SN-2024-002",
        collision_time=now - timedelta(hours=3),
        car_mass_kg=12.0,
        velocity_ms=3.5,
        friction_coeff=0.03,
        collision_efficiency=0.88,
        notes="人工改过系数但没写原因 - 老岑当时急着去吃饭没备注",
    )
    result2 = await core.import_sensor_record(record2)

    record3 = SensorRecordCreate(
        sensor_no="SN-2024-003",
        collision_time=now - timedelta(hours=1),
        car_mass_kg=9.8,
        velocity_ms=2.2,
        friction_coeff=0.02,
        collision_efficiency=0.95,
        notes="后来从工况照片补来旧口径 - 小雨后轨道积水",
    )
    result3 = await core.import_sensor_record(record3)

    corr_result = await core.apply_manual_correction(
        record_id=result2.record_id,
        field_name="friction_coeff",
        new_value=0.05,
        operator=OPERATOR_LAOCEN,
        reason=None,
    )

    await core.apply_manual_correction(
        record_id=result3.record_id,
        field_name="friction_coeff",
        new_value=0.06,
        operator=OPERATOR_LAOCEN,
        reason="目测轨道湿滑，先修正",
    )

    photo_path2 = BASE_DATA_DIR / "photos" / "SN-2024-002_detail.txt"
    await core.upload_work_photo(
        record_id=result2.record_id,
        source_file_path=str(photo_path2),
        note="碰撞点刮痕照片，供工程师复核参考",
        extracted_friction_coeff=None,
        uploader=OPERATOR_LAOCEN,
    )

    photo_path3 = BASE_DATA_DIR / "photos" / "SN-2024-003_scene.txt"
    await core.upload_work_photo(
        record_id=result3.record_id,
        source_file_path=str(photo_path3),
        note="轨道积水照片，旧口径摩擦系数 0.08",
        extracted_friction_coeff=0.08,
        uploader=OPERATOR_LAOCEN,
    )

    await core.run_playback(result1.record_id, OPERATOR_LAOCEN)

    lines = [
        "=" * 60,
        "演示数据加载完成！",
        "=" * 60,
        "",
        "三条典型记录：",
        "",
        f"1. [SN-2024-001] 顺利记录",
        f"   原始动量: {10.5 * 2.8:.2f} kg·m/s",
        f"   修正动量: {10.5 * 2.8 * 0.92 * (1 - 0.02):.4f} kg·m/s",
        f"   状态: {RECORD_STATUS['NORMAL']}",
        f"   说明: 数据完整，无人工修正，一次通过",
        "",
        f"2. [SN-2024-002] 人工改过系数但没写原因 ⚠",
        f"   原始动量: {12.0 * 3.5:.2f} kg·m/s",
        f"   修正前: {12.0 * 3.5 * 0.88 * (1 - 0.03):.4f} kg·m/s",
        f"   修正后: {12.0 * 3.5 * 0.88 * (1 - 0.05):.4f} kg·m/s",
        f"   状态: {RECORD_STATUS['PENDING_REVIEW']}",
        f"   说明: 老岑改了摩擦系数(0.03→0.05)但没写原因，待设备工程师复核",
        f"   已上传工况照片供复核参考",
        "",
        f"3. [SN-2024-003] 从工况照片补来的旧口径",
        f"   原始动量: {9.8 * 2.2:.2f} kg·m/s",
        f"   第一次(原始): {9.8 * 2.2 * 0.95 * (1 - 0.02):.4f} kg·m/s",
        f"   第二次(人工): {9.8 * 2.2 * 0.95 * (1 - 0.06):.4f} kg·m/s",
        f"   第三次(照片): {9.8 * 2.2 * 0.95 * (1 - 0.08):.4f} kg·m/s",
        f"   状态: {RECORD_STATUS['NORMAL']}",
        f"   说明: 先人工修正，后从照片提取旧口径0.08，补录后参数回放页自动更新",
        "",
        "=" * 60,
        "老岑给新人讲流程的三步演示：",
        "  第一步: 导入传感器编号 (load-demo 已完成)",
        "  第二步: 补看工况照片 (upload-photo 已模拟)",
        "  第三步: 参数回放页更新 (SN-2024-003 已触发三次回放)",
        "",
        "三种处理结果对比（数值不同）：",
        f"  顺利记录(SN-2024-001): {10.5 * 2.8 * 0.92 * (1 - 0.02):.4f} kg·m/s",
        f"  待复核(SN-2024-002):  {12.0 * 3.5 * 0.88 * (1 - 0.05):.4f} kg·m/s ⚠待复核",
        f"  照片补充(SN-2024-003): {9.8 * 2.2 * 0.95 * (1 - 0.08):.4f} kg·m/s (来自旧口径0.08)",
        "=" * 60,
        "",
        "可重跑命令：",
        "  python -m collision_playback list",
        "  python -m collision_playback show 1",
        "  python -m collision_playback show 2",
        "  python -m collision_playback show 3",
        "  python -m collision_playback show-by-sensor SN-2024-002",
        "  python -m collision_playback pending",
        "  python -m collision_playback review 2",
        "  python -m collision_playback playback 3",
        "  python -m collision_playback summary",
    ]

    return "\n".join(lines)
