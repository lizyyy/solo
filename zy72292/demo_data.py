from datetime import datetime, timedelta

from processor import SketchProcessor
from models import PathPlayback


def create_demo_playback() -> PathPlayback:
    processor = SketchProcessor()

    playback = processor.create_playback("2026春季国际会展中心摊位视线图")

    result = processor.import_sketch(
        name="B区一层摊位分布图",
        importer="现场班组-老张",
        floor_number=1,
        z_axis_direction="down",
        stall_coordinates=[
            {"x": 0.0, "y": 0.0, "z": 0.0, "stall_id": "B001"},
            {"x": 10.5, "y": 0.0, "z": 0.0, "stall_id": "B002"},
            {"x": 21.0, "y": 0.0, "z": 0.0, "stall_id": "B003"},
            {"x": 0.0, "y": 8.0, "z": 0.0, "stall_id": "B004"},
            {"x": 10.5, "y": 8.0, "z": 0.0, "stall_id": "B005"},
            {"x": 21.0, "y": 8.0, "z": 0.0, "stall_id": "B006"},
        ],
        raw_data={
            "source": "CAD导入",
            "scale": "1:100",
            "drawing_version": "v2.1",
        },
    )

    playback.sketch = result["sketch"]
    playback.issues.extend(result["issues"])

    processor.add_point_cloud_log(
        playback=playback,
        operator="航测内业-小魏",
        action="点云抽稀处理",
        thinning_ratio=0.3,
        parameters={
            "algorithm": "体素滤波",
            "leaf_size": 0.05,
            "min_points": 5,
        },
        notes="原始点云共120万点，抽稀后保留36万点，Z轴坐标系采用航测内业标准",
    )

    processor.add_manual_correction(
        playback=playback,
        operator="航测内业-小魏",
        field_name="stall_coordinates",
        old_value="B005坐标(10.5, 8.0, 0.0)",
        new_value="B005坐标(10.8, 8.2, 0.0)",
        reason="现场复核发现B005摊位立柱位置偏差，根据实际测量修正",
    )

    processor.add_rerun(
        playback=playback,
        operator="航测内业-小魏",
        reason="B005摊位坐标修正后，重新计算视线遮挡分析",
        affected_results=[
            "B005摊位主视线范围",
            "B005与B002摊位互视分析",
            "B区南侧通道通视性报告",
        ],
    )

    return playback


def create_step_by_step_demo():
    processor = SketchProcessor()
    playback = processor.create_playback("【教学演示】大型会展摊位视线图处理流程")

    step1 = processor.import_sketch(
        name="A区主展厅二层摊位图",
        importer="新人-小李",
        floor_number=2,
        z_axis_direction="down",
        stall_coordinates=[
            {"x": 0.0, "y": 0.0, "z": 0.0, "stall_id": "A201"},
            {"x": 15.0, "y": 0.0, "z": 0.0, "stall_id": "A202"},
            {"x": 30.0, "y": 0.0, "z": 0.0, "stall_id": "A203"},
        ],
    )
    playback.sketch = step1["sketch"]
    playback.issues.extend(step1["issues"])

    return {
        "playback": playback,
        "processor": processor,
    }
