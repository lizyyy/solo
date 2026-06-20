"""样例数据生成器 - 贴近日常的小包样例，包含边界和重复样本"""

import json
import os
from typing import List, Dict, Any

from .models import MeasurementVariable, EvidenceStatus, VariableType


def generate_daily_samples() -> List[MeasurementVariable]:
    """生成贴近日常的测量样本（包含边界和重复样本）
    
    场景：测量一本平装书的密度
    - 正常样本：用游标卡尺测量长宽高，用天平测量质量
    - 边界样本：用普通直尺测量（精度低，相对不确定度大）
    - 重复样本：同一次测量被录入两次
    """
    
    samples = []
    
    samples.append(MeasurementVariable(
        name="书的长度",
        symbol="a",
        value=21.0,
        uncertainty=0.05,
        unit="cm",
        description="用游标卡尺测量书的长度",
        evidence_source="游标卡尺校准证书 #CAL-2024-001",
        evidence_notes="校准有效期至 2025-12-31",
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"measurement_method": "游标卡尺", "instrument_precision": "0.01 mm"},
    ))
    
    samples.append(MeasurementVariable(
        name="书的宽度",
        symbol="b",
        value=14.8,
        uncertainty=0.05,
        unit="cm",
        description="用游标卡尺测量书的宽度",
        evidence_source="游标卡尺校准证书 #CAL-2024-001",
        evidence_notes="校准有效期至 2025-12-31",
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"measurement_method": "游标卡尺", "instrument_precision": "0.01 mm"},
    ))
    
    samples.append(MeasurementVariable(
        name="书的厚度",
        symbol="h",
        value=2.5,
        uncertainty=0.05,
        unit="cm",
        description="用游标卡尺测量书的厚度（不含封面）",
        evidence_source="游标卡尺校准证书 #CAL-2024-001",
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"measurement_method": "游标卡尺", "pages": 320},
    ))
    
    m_original = MeasurementVariable(
        name="书的质量",
        symbol="m",
        value=385.0,
        uncertainty=0.5,
        unit="g",
        description="用电子天平测量书的质量",
        evidence_source="电子天平校准证书 #CAL-2024-045",
        evidence_notes="天平型号: FA2004",
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"measurement_method": "电子天平", "instrument_precision": "0.1 mg"},
    )
    samples.append(m_original)
    
    samples.append(MeasurementVariable(
        name="底面半径",
        symbol="r",
        value=3.0,
        uncertainty=2.0,
        unit="cm",
        description="用普通直尺粗略测量水杯底面半径",
        evidence_source="普通直尺（无校准证书）",
        evidence_notes="直尺精度约 1 mm，但测量时未对准圆心",
        evidence_status=EvidenceStatus.PENDING,
        is_boundary=True,
        metadata={
            "measurement_method": "普通直尺",
            "notes": "边界样本：相对不确定度 = 2.0/3.0 = 66.7% > 50% 阈值",
        },
    ))
    
    samples.append(MeasurementVariable(
        name="水杯高度",
        symbol="h",
        value=15.0,
        uncertainty=0.1,
        unit="cm",
        description="用游标卡尺测量水杯高度",
        evidence_source="游标卡尺校准证书 #CAL-2024-001",
        evidence_status=EvidenceStatus.PENDING,
        metadata={"measurement_method": "游标卡尺", "notes": "待确认水杯是否为标准圆柱体"},
    ))
    
    m_duplicate = MeasurementVariable(
        name="书的质量",
        symbol="m",
        value=385.0,
        uncertainty=0.5,
        unit="g",
        description="用电子天平测量书的质量（重复录入）",
        evidence_source="电子天平校准证书 #CAL-2024-045",
        evidence_status=EvidenceStatus.CONFIRMED,
        is_duplicate=True,
        duplicate_of=m_original.sample_id,
        metadata={
            "measurement_method": "电子天平",
            "notes": f"重复样本：与样本ID {m_original.sample_id} 的数据完全相同",
        },
    )
    samples.append(m_duplicate)
    
    samples.append(MeasurementVariable(
        name="初速度",
        symbol="v0",
        value=0.0,
        uncertainty=0.01,
        unit="m/s",
        description="自由落体初速度",
        variable_type=VariableType.CONSTANT,
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"notes": "自由落体，初速度为0"},
    ))
    
    samples.append(MeasurementVariable(
        name="重力加速度",
        symbol="g",
        value=9.8,
        uncertainty=0.05,
        unit="m/s²",
        description="本地重力加速度",
        variable_type=VariableType.CONSTANT,
        evidence_source="国家标准 GB/T 10184-2015",
        evidence_status=EvidenceStatus.CONFIRMED,
        metadata={"location": "北京", "altitude": "43.5 m"},
    ))
    
    samples.append(MeasurementVariable(
        name="下落时间",
        symbol="t",
        value=2.0,
        uncertainty=0.02,
        unit="s",
        description="用秒表测量小球下落时间",
        evidence_source="人工测量，已重复3次取平均",
        evidence_notes="测量人员反应时间约 0.1 s",
        evidence_status=EvidenceStatus.MISSING,
        metadata={
            "measurement_method": "秒表",
            "notes": "缺少秒表校准证书",
            "missing_evidence": "秒表校准证书",
        },
    ))
    
    return samples


def generate_demo_dataset() -> Dict[str, Any]:
    """生成完整的演示数据集（不太干净的演示数据）
    
    包含：
    - 3个正常样本（书的长宽高）
    - 1个边界样本（水杯半径，相对不确定度66.7%）
    - 1个重复样本（书的质量重复录入）
    - 1个证据缺失样本（下落时间）
    - 2个常量
    """
    samples = generate_daily_samples()
    
    formula_assignments = [
        {
            "formula": "矩形面积",
            "variables": ["a", "b"],
            "scenario": "计算书的封面面积",
        },
        {
            "formula": "密度计算",
            "variables": ["m", "V"],
            "scenario": "计算书的纸张密度",
            "notes": "V = a × b × h 需要先计算",
        },
        {
            "formula": "圆柱体体积",
            "variables": ["r", "h"],
            "scenario": "计算水杯容积",
            "notes": "包含边界样本 r，相对不确定度66.7%",
        },
        {
            "formula": "匀加速位移",
            "variables": ["v0", "a", "t"],
            "scenario": "计算自由落体下落距离",
            "notes": "a = g = 9.8 m/s²",
        },
    ]
    
    return {
        "description": "误差传播演示数据集 - 日常测量场景",
        "scenario": "通过日常物品测量演示误差传播原理",
        "samples": [s.to_dict() for s in samples],
        "formula_assignments": formula_assignments,
        "data_quality_notes": [
            "⚠️ 包含边界样本：水杯底面半径 r 的相对不确定度为 66.7%",
            "⚠️ 包含重复样本：书的质量 m 被录入两次",
            "⚠️ 包含证据缺失：下落时间 t 缺少秒表校准证书",
            "💡 建议：先处理重复和边界样本，再进行完整计算",
        ],
    }


def save_sample_data(output_dir: str, filename: str = "demo_samples.json") -> str:
    """保存样例数据到文件
    
    Args:
        output_dir: 输出目录
        filename: 文件名
        
    Returns:
        保存的文件路径
    """
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, filename)
    
    dataset = generate_demo_dataset()
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    
    return filepath


def load_samples_from_file(filepath: str) -> List[MeasurementVariable]:
    """从文件加载测量样本
    
    Args:
        filepath: JSON 文件路径
        
    Returns:
        测量变量列表
    """
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    samples = []
    for item in data.get("samples", []):
        var = MeasurementVariable(
            name=item["name"],
            symbol=item["symbol"],
            value=item["value"],
            uncertainty=item["uncertainty"],
            unit=item["unit"],
            variable_type=VariableType(item.get("variable_type", "direct_measurement")),
            evidence_status=EvidenceStatus(item.get("evidence_status", "confirmed")),
            evidence_source=item.get("evidence_source"),
            evidence_notes=item.get("evidence_notes"),
            description=item.get("description"),
            sample_id=item.get("sample_id"),
            is_boundary=item.get("is_boundary", False),
            is_duplicate=item.get("is_duplicate", False),
            duplicate_of=item.get("duplicate_of"),
            metadata=item.get("metadata", {}),
        )
        samples.append(var)
    
    return samples


def get_empty_input_sample() -> List[MeasurementVariable]:
    """获取空输入样本（用于测试空集合处理）"""
    return []


def print_sample_overview(samples: List[MeasurementVariable]) -> None:
    """打印样本概览（用于终端展示）"""
    print("\n" + "=" * 70)
    print("📊 样本数据概览")
    print("=" * 70)
    
    normal_count = 0
    boundary_count = 0
    duplicate_count = 0
    missing_evidence_count = 0
    
    for i, s in enumerate(samples, 1):
        status_icon = "✅"
        status_text = "正常"
        
        if s.is_boundary:
            status_icon = "⚠️"
            status_text = "边界"
            boundary_count += 1
        elif s.is_duplicate:
            status_icon = "🔄"
            status_text = "重复"
            duplicate_count += 1
        else:
            normal_count += 1
        
        if s.evidence_status == EvidenceStatus.MISSING:
            status_icon += " ❓"
            status_text += "+缺证据"
            missing_evidence_count += 1
        elif s.evidence_status == EvidenceStatus.PENDING:
            status_icon += " ⏳"
            status_text += "+待确认"
        
        ru = s.relative_uncertainty * 100 if s.relative_uncertainty != float('inf') else "∞"
        ru_str = f"{ru:.1f}%" if isinstance(ru, float) else ru
        
        print(f"\n{status_icon} [{i}] {s.name} ({s.symbol})")
        print(f"    数值: {s.value} ± {s.uncertainty} {s.unit}")
        print(f"    相对不确定度: {ru_str}")
        print(f"    状态: {status_text} | 样本ID: {s.sample_id}")
        if s.evidence_source:
            print(f"    证据来源: {s.evidence_source}")
        if s.description:
            print(f"    描述: {s.description}")
    
    print("\n" + "-" * 70)
    print(f"📈 统计: 正常={normal_count} | 边界={boundary_count} | "
          f"重复={duplicate_count} | 缺证据={missing_evidence_count} | 总计={len(samples)}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    samples = generate_daily_samples()
    print_sample_overview(samples)
