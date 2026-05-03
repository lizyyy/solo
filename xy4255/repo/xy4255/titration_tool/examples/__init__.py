"""示例数据模块"""

import os
import shutil
from pathlib import Path
from typing import List


EXAMPLE_FILES = [
    "sample_001_strong_acid_base.csv",
    "sample_002_weak_acid_outlier.csv",
    "sample_003_blank_titration.csv",
    "sample_004_polyprotic.csv",
]


def get_examples_dir() -> Path:
    """获取示例数据目录路径"""
    return Path(__file__).parent


def list_example_files() -> List[str]:
    """列出所有示例数据文件"""
    return EXAMPLE_FILES


def copy_examples_to(target_dir: str, overwrite: bool = False) -> List[str]:
    """
    复制示例数据文件到目标目录
    
    Args:
        target_dir: 目标目录路径
        overwrite: 是否覆盖已存在的文件
    
    Returns:
        复制的文件路径列表
    """
    target_path = Path(target_dir)
    target_path.mkdir(parents=True, exist_ok=True)
    
    examples_dir = get_examples_dir()
    copied_files = []
    
    for filename in EXAMPLE_FILES:
        source = examples_dir / filename
        if not source.exists():
            continue
        
        target = target_path / filename
        if target.exists() and not overwrite:
            print(f"跳过已存在的文件: {target}")
            continue
        
        shutil.copy2(source, target)
        copied_files.append(str(target))
        print(f"已复制: {target}")
    
    return copied_files


def generate_strong_acid_base_curve(
    equivalence_volume: float = 10.0,
    initial_ph: float = 13.0,
    final_ph: float = 1.5,
    num_points: int = 50,
    noise: float = 0.02,
) -> List[List[float]]:
    """
    生成强酸滴定强碱的模拟曲线
    
    Args:
        equivalence_volume: 等当点体积 (mL)
        initial_ph: 初始pH
        final_ph: 最终pH
        num_points: 数据点数量
        noise: 噪声水平
    
    Returns:
        [[体积, pH], ...] 列表
    """
    import math
    import random
    
    points = []
    
    v_start = 0.0
    v_end = equivalence_volume * 1.5 if equivalence_volume > 0 else 15.0
    
    for i in range(num_points):
        fraction = i / (num_points - 1)
        volume = v_start + fraction * (v_end - v_start)
        
        if volume < equivalence_volume * 0.8:
            oh_conc = 0.1 * (equivalence_volume - volume) / (50 + volume)
            if oh_conc > 0:
                ph = 14 + math.log10(oh_conc)
            else:
                ph = 7.0
        elif volume < equivalence_volume * 0.95:
            ratio = (volume - equivalence_volume * 0.8) / (equivalence_volume * 0.15)
            ph = 11.0 - ratio * 3.0
        elif volume < equivalence_volume * 1.05:
            ratio = (volume - equivalence_volume * 0.95) / (equivalence_volume * 0.1)
            ph = 8.0 - ratio * 2.0
            if ratio > 0.5:
                ph = 6.0 - (ratio - 0.5) * 8.0
        elif volume < equivalence_volume * 1.2:
            h_conc = 0.1 * (volume - equivalence_volume) / (50 + volume)
            if h_conc > 0:
                ph = -math.log10(h_conc)
            else:
                ph = 7.0
        else:
            h_conc = 0.1 * (volume - equivalence_volume) / (50 + volume)
            if h_conc > 0:
                ph = max(-math.log10(h_conc), final_ph)
            else:
                ph = final_ph
        
        ph += random.uniform(-noise, noise)
        
        ph = max(0.0, min(14.0, ph))
        
        points.append([round(volume, 2), round(ph, 2)])
    
    return points


def generate_weak_acid_curve(
    equivalence_volume: float = 10.0,
    pka: float = 4.76,
    initial_ph: float = 2.87,
    num_points: int = 50,
    noise: float = 0.02,
    add_outlier: bool = False,
) -> List[List[float]]:
    """
    生成弱酸滴定的模拟曲线
    
    Args:
        equivalence_volume: 等当点体积 (mL)
        pka: 酸的pKa值
        initial_ph: 初始pH
        num_points: 数据点数量
        noise: 噪声水平
        add_outlier: 是否添加离群点
    
    Returns:
        [[体积, pH], ...] 列表
    """
    import math
    import random
    
    points = []
    
    v_start = 0.0
    v_end = equivalence_volume * 1.5
    
    outlier_index = int(num_points * 0.6) if add_outlier else -1
    
    for i in range(num_points):
        fraction = i / (num_points - 1)
        volume = v_start + fraction * (v_end - v_start)
        
        if volume < 1e-6:
            ph = initial_ph
        elif volume < equivalence_volume:
            ratio = volume / equivalence_volume
            if ratio < 0.05:
                ph = initial_ph + ratio * (pka - 1 - initial_ph)
            elif ratio < 0.95:
                ph = pka + math.log10(ratio / (1 - ratio))
            else:
                excess_ratio = (ratio - 0.95) / 0.05
                ph = pka + 1.3 + excess_ratio * 2.0
        elif abs(volume - equivalence_volume) < 1e-6:
            kb = 1e-14 / (10 ** (-pka))
            c = 0.1 * equivalence_volume / (50 + equivalence_volume)
            oh_conc = math.sqrt(kb * c)
            ph = 14 + math.log10(oh_conc)
        else:
            excess_volume = volume - equivalence_volume
            total_volume = 50 + volume
            oh_conc = 0.1 * excess_volume / total_volume
            if oh_conc > 0:
                ph = 14 + math.log10(oh_conc)
            else:
                ph = 7.0
            ph = min(ph, 13.0)
        
        if i == outlier_index:
            ph = 3.0
        else:
            ph += random.uniform(-noise, noise)
        
        ph = max(0.0, min(14.0, ph))
        
        points.append([round(volume, 2), round(ph, 2)])
    
    return points


def generate_blank_curve(
    max_volume: float = 15.0,
    initial_ph: float = 7.0,
    final_ph: float = 6.2,
    num_points: int = 30,
) -> List[List[float]]:
    """
    生成空白滴定曲线
    
    Args:
        max_volume: 最大体积 (mL)
        initial_ph: 初始pH
        final_ph: 最终pH
        num_points: 数据点数量
    
    Returns:
        [[体积, pH], ...] 列表
    """
    import math
    
    points = []
    
    for i in range(num_points):
        fraction = i / (num_points - 1)
        volume = fraction * max_volume
        
        ph = initial_ph - fraction * (initial_ph - final_ph)
        ph += 0.02 * math.sin(volume * 0.5)
        
        points.append([round(volume, 2), round(ph, 2)])
    
    return points


def generate_polyprotic_curve(
    equivalence_volumes: List[float] = None,
    pka_values: List[float] = None,
    num_points: int = 60,
    noise: float = 0.02,
) -> List[List[float]]:
    """
    生成多元酸/碱滴定曲线（如磷酸）
    
    Args:
        equivalence_volumes: 各等当点体积列表
        pka_values: pKa值列表
        num_points: 数据点数量
        noise: 噪声水平
    
    Returns:
        [[体积, pH], ...] 列表
    """
    import math
    import random
    
    if equivalence_volumes is None:
        equivalence_volumes = [10.0, 20.0, 30.0]
    if pka_values is None:
        pka_values = [2.15, 7.20, 12.35]
    
    points = []
    
    v_end = max(equivalence_volumes) * 1.2
    
    for i in range(num_points):
        fraction = i / (num_points - 1)
        volume = fraction * v_end
        
        if volume < equivalence_volumes[0] * 0.5:
            ph = pka_values[0] - 0.5
        elif volume < equivalence_volumes[0]:
            ratio = volume / equivalence_volumes[0]
            ph = pka_values[0] + math.log10(ratio / (1 - ratio))
        elif volume < (equivalence_volumes[0] + equivalence_volumes[1]) / 2:
            ph = (pka_values[0] + pka_values[1]) / 2
        elif volume < equivalence_volumes[1]:
            ratio = (volume - equivalence_volumes[0]) / (equivalence_volumes[1] - equivalence_volumes[0])
            ph = pka_values[1] + math.log10(ratio / (1 - ratio))
        elif volume < (equivalence_volumes[1] + equivalence_volumes[2]) / 2:
            ph = (pka_values[1] + pka_values[2]) / 2
        elif volume < equivalence_volumes[2]:
            ratio = (volume - equivalence_volumes[1]) / (equivalence_volumes[2] - equivalence_volumes[1])
            ph = pka_values[2] + math.log10(ratio / (1 - ratio))
        else:
            excess = (volume - equivalence_volumes[2]) / v_end
            ph = pka_values[2] + 1.0 + excess * 0.5
        
        ph += random.uniform(-noise, noise)
        ph = max(0.0, min(14.0, ph))
        
        points.append([round(volume, 2), round(ph, 2)])
    
    return points
