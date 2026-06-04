from models import SamplingRecord, ParamDebugRecord, MaterialType


NORMAL_SAMPLING = [
    SamplingRecord(
        grid_id="GRID-001",
        sample_time="2026-06-01 09:00:00",
        boundary_threshold="5%",
        raw_boundary="5%",
        check_point="边界A",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-002",
        sample_time="2026-06-01 09:05:00",
        boundary_threshold="3%",
        raw_boundary="3%",
        check_point="边界B",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-003",
        sample_time="2026-06-01 09:10:00",
        boundary_threshold="8%",
        raw_boundary="8%",
        check_point="边界C",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-004",
        sample_time="2026-06-01 09:15:00",
        boundary_threshold="2.5%",
        raw_boundary="2.5%",
        check_point="边界D",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-005",
        sample_time="2026-06-01 09:20:00",
        boundary_threshold="10%",
        raw_boundary="10%",
        check_point="边界E",
        operator="张三"
    ),
]

NORMAL_PARAMS = [
    ParamDebugRecord(
        grid_id="GRID-001",
        param_name="boundary_threshold",
        param_value="5%",
        debug_time="2026-06-01 08:30:00",
        analyst="小祁",
        remark="边界A"
    ),
    ParamDebugRecord(
        grid_id="GRID-002",
        param_name="boundary_threshold",
        param_value="3%",
        debug_time="2026-06-01 08:35:00",
        analyst="小祁",
        remark="边界B"
    ),
    ParamDebugRecord(
        grid_id="GRID-003",
        param_name="boundary_threshold",
        param_value="8%",
        debug_time="2026-06-01 08:40:00",
        analyst="小祁",
        remark="边界C"
    ),
    ParamDebugRecord(
        grid_id="GRID-004",
        param_name="boundary_threshold",
        param_value="2.5%",
        debug_time="2026-06-01 08:45:00",
        analyst="小祁",
        remark="边界D"
    ),
    ParamDebugRecord(
        grid_id="GRID-005",
        param_name="boundary_threshold",
        param_value="10%",
        debug_time="2026-06-01 08:50:00",
        analyst="小祁",
        remark="边界E"
    ),
]

WRONG_CALIBER_SAMPLING = [
    SamplingRecord(
        grid_id="GRID-001",
        sample_time="2026-06-01 09:00:00",
        boundary_threshold="5%",
        raw_boundary="5%",
        check_point="边界A",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-002",
        sample_time="2026-06-01 09:05:00",
        boundary_threshold="0.03",
        raw_boundary="0.03",
        check_point="边界B",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-003",
        sample_time="2026-06-01 09:10:00",
        boundary_threshold="8%",
        raw_boundary="8%",
        check_point="边界C",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-003",
        sample_time="2026-06-01 09:10:00",
        boundary_threshold="8%",
        raw_boundary="8%",
        check_point="边界C",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-004",
        sample_time="2026-06-01 09:15:00",
        boundary_threshold="2.5%",
        raw_boundary="2.5%",
        check_point="边界D",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-005",
        sample_time="2026-06-01 09:20:00",
        boundary_threshold="0.1",
        raw_boundary="0.1",
        check_point="边界E",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-006",
        sample_time="2026-06-01 09:25:00",
        boundary_threshold="0.045",
        raw_boundary="0.045",
        check_point="边界F",
        operator="张三"
    ),
]

WRONG_CALIBER_PARAMS = [
    ParamDebugRecord(
        grid_id="GRID-001",
        param_name="boundary_threshold",
        param_value="0.05",
        debug_time="2026-06-01 08:30:00",
        analyst="小祁",
        remark="边界A"
    ),
    ParamDebugRecord(
        grid_id="GRID-002",
        param_name="boundary_threshold",
        param_value="0.05",
        debug_time="2026-06-01 08:35:00",
        analyst="小祁",
        remark="边界B"
    ),
    ParamDebugRecord(
        grid_id="GRID-003",
        param_name="boundary_threshold",
        param_value="8%",
        debug_time="2026-06-01 08:40:00",
        analyst="小祁",
        remark="边界C"
    ),
    ParamDebugRecord(
        grid_id="GRID-004",
        param_name="boundary_threshold",
        param_value="2.5%",
        debug_time="2026-06-01 08:45:00",
        analyst="小祁",
        remark="边界D"
    ),
    ParamDebugRecord(
        grid_id="GRID-005",
        param_name="boundary_threshold",
        param_value="10%",
        debug_time="2026-06-01 08:50:00",
        analyst="小祁",
        remark="边界E"
    ),
    ParamDebugRecord(
        grid_id="GRID-006",
        param_name="boundary_threshold",
        param_value="4.5%",
        debug_time="2026-06-01 08:55:00",
        analyst="小祁",
        remark="边界F"
    ),
    ParamDebugRecord(
        grid_id="GRID-007",
        param_name="boundary_threshold",
        param_value="6%",
        debug_time="2026-06-01 09:00:00",
        analyst="小祁",
        remark="边界G"
    ),
]

SUPPLEMENT_RECORDS = [
    SamplingRecord(
        grid_id="GRID-007",
        sample_time="2026-06-01 10:00:00",
        boundary_threshold="6%",
        raw_boundary="6%",
        check_point="边界G",
        operator="李四"
    ),
    SamplingRecord(
        grid_id="GRID-008",
        sample_time="2026-06-01 10:05:00",
        boundary_threshold="7.5%",
        raw_boundary="7.5%",
        check_point="边界H",
        operator="李四"
    ),
    SamplingRecord(
        grid_id="GRID-002",
        sample_time="2026-06-01 10:10:00",
        boundary_threshold="5%",
        raw_boundary="5%",
        check_point="边界B-修正",
        operator="李四"
    ),
]

SUPPLEMENT_PARAMS = [
    ParamDebugRecord(
        grid_id="GRID-007",
        param_name="boundary_threshold",
        param_value="6%",
        debug_time="2026-06-01 09:30:00",
        analyst="小祁",
        remark="边界G"
    ),
    ParamDebugRecord(
        grid_id="GRID-008",
        param_name="boundary_threshold",
        param_value="7.5%",
        debug_time="2026-06-01 09:35:00",
        analyst="小祁",
        remark="边界H"
    ),
]

PERCENT_DECIMAL_MIX_SAMPLING = [
    SamplingRecord(
        grid_id="GRID-001",
        sample_time="2026-06-01 09:00:00",
        boundary_threshold="5%",
        raw_boundary="5%",
        check_point="边界A",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-001",
        sample_time="2026-06-01 09:01:00",
        boundary_threshold="0.05",
        raw_boundary="0.05",
        check_point="边界A",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-002",
        sample_time="2026-06-01 09:05:00",
        boundary_threshold="0.03",
        raw_boundary="0.03",
        check_point="边界B",
        operator="张三"
    ),
    SamplingRecord(
        grid_id="GRID-002",
        sample_time="2026-06-01 09:06:00",
        boundary_threshold="3%",
        raw_boundary="3%",
        check_point="边界B",
        operator="张三"
    ),
]


def get_material_data(material_type: MaterialType):
    if material_type == MaterialType.NORMAL:
        return {
            "sampling": NORMAL_SAMPLING,
            "params": NORMAL_PARAMS,
            "description": "正常材料：数据格式统一，抽样与参数一致"
        }
    elif material_type == MaterialType.WRONG_CALIBER:
        return {
            "sampling": WRONG_CALIBER_SAMPLING,
            "params": WRONG_CALIBER_PARAMS,
            "description": "错口径材料：存在百分数小数混合、重复导入、参数冲突等问题"
        }
    elif material_type == MaterialType.SUPPLEMENT:
        return {
            "sampling": SUPPLEMENT_RECORDS,
            "params": SUPPLEMENT_PARAMS,
            "description": "补录材料：用于补录测试的新增和修正数据"
        }
    else:
        raise ValueError(f"未知材料类型: {material_type}")
