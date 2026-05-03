"""
示例数据生成模块
"""

import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any

import yaml

from .models import SampleType


def generate_sample_batch(
    output_dir: str,
    has_is_missing: bool = False,
    has_chain_break: bool = False,
    has_duplicate_sample: bool = False,
    has_cross_midnight: bool = False,
) -> None:
    """
    生成示例批次数据
    
    Args:
        output_dir: 输出目录
        has_is_missing: 是否包含缺内标的样本
        has_chain_break: 是否包含交接记录断链
        has_duplicate_sample: 是否包含重复样本编号
        has_cross_midnight: 是否包含跨午夜进样
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    base_time = datetime(2026, 5, 2, 8, 0, 0)
    
    calibrators = [
        ("CAL_005", 0.05, SampleType.CALIBRATOR),
        ("CAL_010", 0.1, SampleType.CALIBRATOR),
        ("CAL_050", 0.5, SampleType.CALIBRATOR),
        ("CAL_100", 1.0, SampleType.CALIBRATOR),
        ("CAL_500", 5.0, SampleType.CALIBRATOR),
        ("CAL_1000", 10.0, SampleType.CALIBRATOR),
    ]
    
    qc_samples = [
        ("QC_LOW", 0.5, SampleType.QC),
        ("QC_MID", 2.5, SampleType.QC),
        ("QC_HIGH", 8.0, SampleType.QC),
    ]
    
    unknown_samples = [
        ("UNK_001", 3.2, SampleType.UNKNOWN),
        ("UNK_002", 0.0, SampleType.UNKNOWN),
        ("UNK_003", 0.8, SampleType.UNKNOWN),
        ("UNK_004", 0.0, SampleType.UNKNOWN),
        ("UNK_005", 5.6, SampleType.UNKNOWN),
    ]
    
    if has_duplicate_sample:
        unknown_samples.append(("UNK_001", 3.1, SampleType.UNKNOWN))
    
    blanks = [("BLANK_001", 0.0, SampleType.BLANK)]
    
    all_samples = []
    vial_positions = []
    
    all_samples.extend(calibrators)
    for i in range(len(calibrators)):
        vial_positions.append(f"A{i+1}")
    
    all_samples.extend(qc_samples)
    for i in range(len(qc_samples)):
        vial_positions.append(f"B{i+1}")
    
    all_samples.extend(blanks)
    vial_positions.append("C1")
    
    all_samples.extend(unknown_samples)
    for i in range(len(unknown_samples)):
        vial_positions.append(f"C{i+2}")
    
    injection_times = []
    current_time = base_time
    for i in range(len(all_samples)):
        if has_cross_midnight and i == len(all_samples) - 1:
            current_time = datetime(2026, 5, 3, 1, 30, 0)
        else:
            current_time = current_time + timedelta(minutes=15 + random.randint(-2, 2))
        injection_times.append(current_time)
    
    run_sequence = []
    for i, sample in enumerate(all_samples):
        sample_id = sample[0]
        sample_type = sample[2] if len(sample) > 2 else SampleType.UNKNOWN
        
        run_sequence.append({
            "sample_id": sample_id,
            "vial_position": vial_positions[i],
            "injection_time": injection_times[i].strftime("%Y-%m-%d %H:%M:%S"),
            "sample_type": sample_type.value,
        })
    
    with open(output_path / "run_sequence.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sample_id", "vial_position", "injection_time", "sample_type"])
        writer.writeheader()
        writer.writerows(run_sequence)
    
    compounds = {
        "Morphine": {
            "internal_standard": "IS_Morphine",
            "min_r_squared": 0.99,
            "calibration_levels": [
                {"name": "CAL_005", "concentration": 0.05},
                {"name": "CAL_010", "concentration": 0.1},
                {"name": "CAL_050", "concentration": 0.5},
                {"name": "CAL_100", "concentration": 1.0},
                {"name": "CAL_500", "concentration": 5.0},
                {"name": "CAL_1000", "concentration": 10.0},
            ],
        },
        "Codeine": {
            "internal_standard": "IS_Codeine",
            "min_r_squared": 0.99,
            "calibration_levels": [
                {"name": "CAL_005", "concentration": 0.05},
                {"name": "CAL_010", "concentration": 0.1},
                {"name": "CAL_050", "concentration": 0.5},
                {"name": "CAL_100", "concentration": 1.0},
                {"name": "CAL_500", "concentration": 5.0},
                {"name": "CAL_1000", "concentration": 10.0},
            ],
        },
        "6-MAM": {
            "internal_standard": "IS_6MAM",
            "min_r_squared": 0.99,
            "calibration_levels": [
                {"name": "CAL_005", "concentration": 0.05},
                {"name": "CAL_010", "concentration": 0.1},
                {"name": "CAL_050", "concentration": 0.5},
                {"name": "CAL_100", "concentration": 1.0},
                {"name": "CAL_500", "concentration": 5.0},
                {"name": "CAL_1000", "concentration": 10.0},
            ],
        },
    }
    
    qc_samples_config = {
        "QC_LOW": {
            "expected_concentration": {
                "Morphine": 0.5,
                "Codeine": 0.5,
                "6-MAM": 0.5,
            }
        },
        "QC_MID": {
            "expected_concentration": {
                "Morphine": 2.5,
                "Codeine": 2.5,
                "6-MAM": 2.5,
            }
        },
        "QC_HIGH": {
            "expected_concentration": {
                "Morphine": 8.0,
                "Codeine": 8.0,
                "6-MAM": 8.0,
            }
        },
    }
    
    qc_parameters = {
        "max_internal_standard_drift_percent": 20.0,
        "max_qc_deviation_percent": 15.0,
    }
    
    calibration_config = {
        "batch_info": {
            "batch_id": f"BATCH_{datetime.now().strftime('%Y%m%d')}",
            "instrument": "Agilent 6460",
            "analyst": "Zhang San",
        },
        "compounds": compounds,
        "qc_samples": qc_samples_config,
        "qc_parameters": qc_parameters,
    }
    
    with open(output_path / "calibration.yaml", "w", encoding="utf-8") as f:
        yaml.dump(calibration_config, f, default_flow_style=False, allow_unicode=True)
    
    peak_table_data = []
    
    slope_morphine = 50000.0
    slope_codeine = 60000.0
    slope_6mam = 75000.0
    
    is_baseline = {
        "IS_Morphine": 200000.0,
        "IS_Codeine": 220000.0,
        "IS_6MAM": 190000.0,
    }
    
    missing_is_sample = "UNK_003" if has_is_missing else None
    
    for sample in all_samples:
        sample_id = sample[0]
        conc = sample[1] if len(sample) > 1 else 0.0
        sample_type = sample[2] if len(sample) > 2 else SampleType.UNKNOWN
        
        if sample_type == SampleType.CALIBRATOR:
            for cal_name, cal_conc, _ in calibrators:
                if sample_id == cal_name:
                    conc = cal_conc
                    break
        
        is_morphine = is_baseline["IS_Morphine"] * (1 + random.uniform(-0.1, 0.1))
        is_codeine = is_baseline["IS_Codeine"] * (1 + random.uniform(-0.1, 0.1))
        is_6mam = is_baseline["IS_6MAM"] * (1 + random.uniform(-0.1, 0.1))
        
        if has_is_missing and sample_id == missing_is_sample:
            is_morphine = 0.0
            is_codeine = 0.0
            is_6mam = 0.0
        
        morphine_area = conc * slope_morphine * (1 + random.uniform(-0.05, 0.05))
        codeine_area = conc * slope_codeine * (1 + random.uniform(-0.05, 0.05))
        mam6_area = conc * slope_6mam * (1 + random.uniform(-0.05, 0.05))
        
        if sample_type == SampleType.BLANK:
            morphine_area = random.uniform(0, 100)
            codeine_area = random.uniform(0, 100)
            mam6_area = random.uniform(0, 100)
        
        peak_table_data.append({
            "sample_id": sample_id,
            "Morphine": morphine_area,
            "Codeine": codeine_area,
            "6-MAM": mam6_area,
            "IS_Morphine": is_morphine,
            "IS_Codeine": is_codeine,
            "IS_6MAM": is_6mam,
        })
    
    with open(output_path / "peak_table.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, 
            fieldnames=["sample_id", "Morphine", "Codeine", "6-MAM", "IS_Morphine", "IS_Codeine", "IS_6MAM"]
        )
        writer.writeheader()
        for row in peak_table_data:
            writer.writerow({
                k: (f"{v:.0f}" if isinstance(v, float) else v)
                for k, v in row.items()
            })
    
    chain_of_custody = []
    custody_start_time = base_time - timedelta(hours=24)
    
    all_sample_ids = set(s[0] for s in all_samples)
    
    actions = ["收到样本", "前处理", "进样分析", "数据审核"]
    locations = ["样本接收室", "前处理室", "仪器室", "数据审核室"]
    actors = ["李警官", "王技术员", "张分析员", "赵主管"]
    
    for sample_id in all_sample_ids:
        sample_time = custody_start_time
        
        if has_chain_break and sample_id == "UNK_005":
            chain_of_custody.append({
                "sample_id": sample_id,
                "timestamp": sample_time.strftime("%Y-%m-%d %H:%M:%S"),
                "action": "收到样本",
                "actor": "李警官",
                "location": "样本接收室",
            })
            chain_of_custody.append({
                "sample_id": sample_id,
                "timestamp": (sample_time + timedelta(hours=48)).strftime("%Y-%m-%d %H:%M:%S"),
                "action": "进样分析",
                "actor": "张分析员",
                "location": "仪器室",
            })
        else:
            for i, (action, location, actor) in enumerate(zip(actions, locations, actors)):
                if i > 0:
                    sample_time = sample_time + timedelta(hours=2 + random.uniform(0, 1))
                
                chain_of_custody.append({
                    "sample_id": sample_id,
                    "timestamp": sample_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "action": action,
                    "actor": actor,
                    "location": location,
                })
    
    random.shuffle(chain_of_custody)
    
    with open(output_path / "chain_of_custody.jsonl", "w", encoding="utf-8") as f:
        for entry in chain_of_custody:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
