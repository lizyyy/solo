"""
错因分析模块

对检测到的错误进行深度分析，说明错误原因、影响范围和修正建议。
"""

from typing import List, Dict, Any
from collections import defaultdict

from .core import SonarRecord, PhysicsBounds


ERROR_EXPLANATIONS = {
    "E001": {
        "name": "缺少必填字段",
        "description": "声呐测距计算必须同时具备水温、回波时间和目标距离三个核心字段。",
        "impact": "缺少字段的记录无法进行声速修正和测距计算，只能作为无效数据排除。",
        "suggestion": "请检查数据来源，补全缺失的字段值。",
        "formula_reference": "d = c(T) * t / 2，三个量缺一不可",
    },
    "E002": {
        "name": "目标距离为负",
        "description": "目标距离是标量，表示两点之间的长度，在数学上不可能为负数。",
        "impact": "负值会导致声速反推结果符号错误，所有依赖距离的计算全部失效。",
        "suggestion": "检查是否遗漏了绝对值符号，或者将回波时间/水温误填入距离字段。",
        "physics_note": "距离 d ≥ 0 m 是物理公理",
    },
    "E003": {
        "name": "回波时间无效",
        "description": "回波时间必须为正值，且应在合理范围（0.001s ~ 10s）内。",
        "impact": "回波时间为0或负会导致声速计算除零错误或结果为负；超出范围则测距结果不可信。",
        "suggestion": "检查设备是否正常触发，时间单位是否正确（是秒不是毫秒）。",
        "range": f"合理范围: [{PhysicsBounds.TIME_MIN}, {PhysicsBounds.TIME_MAX}] s",
    },
    "E004": {
        "name": "水温超出范围",
        "description": f"水温应在 {PhysicsBounds.TEMP_MIN}℃ ~ {PhysicsBounds.TEMP_MAX}℃ 范围内（海水冰点约-2℃）。",
        "impact": "水温超出范围时，UNESCO声速修正公式不再适用（外插），计算结果不可靠，声速计算将被跳过。",
        "suggestion": "检查温度传感器校准，确认单位是否为摄氏度(℃)，排除字段填反的可能。",
        "formula_reference": "c(T) = 1449.2 + 4.6T - 0.055T² + 0.00029T³ （UNESCO标准，适用范围-2~40℃）",
    },
    "E005": {
        "name": "疑似声速单位错误",
        "description": "根据距离和回波时间反推的声速远小于水中声速理论最小值（约1400 m/s）。",
        "impact": "单位错误会导致距离计算偏差3.6倍（km/h → m/s 需除以3.6）。",
        "suggestion": "检查声速单位是否混淆了 km/h 和 m/s。1440 km/h = 400 m/s，而实际声速约1440 m/s。",
        "conversion": "1 m/s = 3.6 km/h，水中声速约 1450 m/s = 5220 km/h",
    },
    "E006": {
        "name": "回波重复",
        "description": "同一设备在极短时间内（回波时间差异<1%）产生了两条几乎相同的记录。",
        "impact": "重复记录会导致统计平均偏差，浪费计算资源。",
        "suggestion": "检查数据导入过程，确认是否重复导入了同一批数据。保留信噪比高的一条即可。",
        "detection": "相同设备ID + 回波时间差异<1%",
    },
    "E007": {
        "name": "疑似字段填反",
        "description": "水温、回波时间、目标距离三者的数值量级明显不符合物理常识。",
        "impact": "字段填反会导致所有后续计算完全错误，但程序可能不报错（garbage in, garbage out）。",
        "suggestion": "请核对原始记录，确认三个字段是否正确填写：\n"
                      "  - 水温：通常 0-30℃，极少超过 40℃\n"
                      "  - 回波时间：通常 0.01-2s，极少超过 10s\n"
                      "  - 目标距离：通常 10-1000m，实验环境可达数公里",
        "detection": "数值量级与该字段物理意义不符",
    },
    "E008": {
        "name": "交叉验证不一致",
        "description": "根据声速和测量距离反推的理论回波时间与实际回波时间偏差超过10%。",
        "impact": "表明三者之间存在不一致，可能是测量误差、记录错误或设备故障。",
        "suggestion": "检查实验过程是否有干扰（多径效应、气泡、目标移动等），必要时重新测量。",
        "verification": "t_expected = 2*d_measured / c(T)，与实际 t_echo 比较",
    },
    "E009": {
        "name": "计算声速超出理论范围",
        "description": f"根据水温计算的声速超出 {PhysicsBounds.VELOCITY_MIN}-{PhysicsBounds.VELOCITY_MAX} m/s 理论范围。",
        "impact": "声速异常会导致距离计算出现系统性偏差。",
        "suggestion": "检查水温读数是否正确，确认声速公式适用条件（淡水/海水、压力等）。",
        "range": f"理论范围: [{PhysicsBounds.VELOCITY_MIN}, {PhysicsBounds.VELOCITY_MAX}] m/s",
    },
}


class ErrorAnalyzer:
    """错因分析器"""
    
    def __init__(self):
        self.record_analysis: Dict[str, Dict] = {}
    
    def analyze_record(self, record: SonarRecord) -> Dict[str, Any]:
        """分析单条记录的所有错误"""
        analysis = {
            "record_id": record.record_id,
            "source": record.source,
            "is_valid": record.is_valid,
            "processing_steps": record.processing_steps,
            "errors": [],
            "warnings": [],
            "summary": "",
        }
        
        # 分析错误
        for err in record.errors:
            # 提取错误代码
            code_match = err.find("[")
            code_end = err.find("]")
            code = err[code_match+1:code_end] if code_match >= 0 and code_end > code_match else None
            
            err_info = {
                "raw_message": err,
                "code": code,
                "explanation": ERROR_EXPLANATIONS.get(code, {}),
            }
            analysis["errors"].append(err_info)
        
        # 分析警告
        for warn in record.warnings:
            code_match = warn.find("[")
            code_end = warn.find("]")
            code = warn[code_match+1:code_end] if code_match >= 0 and code_end > code_match else None
            
            warn_info = {
                "raw_message": warn,
                "code": code,
                "explanation": ERROR_EXPLANATIONS.get(code, {}),
            }
            analysis["warnings"].append(warn_info)
        
        # 生成摘要
        if record.is_valid:
            analysis["summary"] = f"记录有效。共 {len(record.warnings)} 个警告。"
        else:
            error_codes = [e["code"] for e in analysis["errors"] if e["code"]]
            analysis["summary"] = (f"记录无效。共 {len(record.errors)} 个错误 "
                                   f"({', '.join(error_codes)})，{len(record.warnings)} 个警告。")
        
        self.record_analysis[record.record_id] = analysis
        return analysis
    
    def analyze_all(self, records: List[SonarRecord]) -> Dict[str, Any]:
        """批量分析所有记录"""
        record_analyses = []
        error_type_counts = defaultdict(int)
        source_errors = defaultdict(lambda: defaultdict(int))
        
        for record in records:
            analysis = self.analyze_record(record)
            record_analyses.append(analysis)
            
            for err in analysis["errors"]:
                if err["code"]:
                    error_type_counts[err["code"]] += 1
                    source_errors[record.source][err["code"]] += 1
        
        # 生成总体分析报告
        total = len(records)
        valid_count = sum(1 for r in records if r.is_valid)
        invalid_count = total - valid_count
        
        summary = {
            "total_records": total,
            "valid_records": valid_count,
            "invalid_records": invalid_count,
            "valid_rate": round(valid_count / total * 100, 2) if total > 0 else 0,
            "error_type_distribution": dict(error_type_counts),
            "source_error_distribution": {k: dict(v) for k, v in source_errors.items()},
        }
        
        # 按严重程度排序的错误类型
        ranked_errors = sorted(
            error_type_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        if ranked_errors:
            top_error = ranked_errors[0]
            summary["top_error"] = {
                "code": top_error[0],
                "count": top_error[1],
                "name": ERROR_EXPLANATIONS.get(top_error[0], {}).get("name", "未知错误"),
            }
        
        return {
            "summary": summary,
            "record_analyses": record_analyses,
            "error_explanations": ERROR_EXPLANATIONS,
        }
    
    def get_processing_flow(self, record: SonarRecord) -> str:
        """获取单条记录的处理流程（用于展示处理顺序）"""
        flow = f"记录 {record.record_id} 处理流程:\n"
        flow += f"  来源: {record.source}\n"
        flow += f"  状态: {'✓ 有效' if record.is_valid else '✗ 无效'}\n"
        flow += f"  处理步骤:\n"
        for i, step in enumerate(record.processing_steps, 1):
            flow += f"    {i}. {step}\n"
        if record.errors:
            flow += f"  错误:\n"
            for err in record.errors:
                flow += f"    - {err}\n"
        if record.warnings:
            flow += f"  警告:\n"
            for warn in record.warnings:
                flow += f"    - {warn}\n"
        return flow
