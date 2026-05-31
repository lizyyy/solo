"""示例数据生成。

生成各种场景的示例数据，包括正常记录、晚到附件、
重复项、人工更正和采样缺口，用于测试和演示。
"""

from pathlib import Path
from typing import List
import numpy as np
import pandas as pd


TRUE_K = 20.0
TRUE_M0 = 0.005


def generate_example_files(output_dir: str = "./examples") -> List[Path]:
    """生成示例数据文件。

    Args:
        output_dir: 输出目录

    Returns:
        生成的文件路径列表
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    files = []

    files.append(_generate_main_experiment_data(output_path))
    files.append(_generate_late_attachment(output_path))
    files.append(_generate_duplicate_data(output_path))
    files.append(_generate_manual_correction(output_path))
    files.append(_generate_calibration_data(output_path))
    files.append(_generate_incomplete_data(output_path))

    return files


def _generate_main_experiment_data(output_path: Path) -> Path:
    """生成主实验数据（包含正常数据和一些小问题）。"""
    np.random.seed(42)

    masses = np.array([0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35])

    ideal_periods = 2 * np.pi * np.sqrt((masses + TRUE_M0) / TRUE_K)
    noise = np.random.normal(0, 0.005, size=len(masses))
    measured_periods = ideal_periods + noise

    extensions = masses * 9.8 / TRUE_K * 1000 + np.random.normal(0, 0.5, size=len(masses))

    amplitudes = np.array([1.8, 1.9, 2.0, 1.7, 2.1, 1.8, 1.9])

    df = pd.DataFrame({
        "学号": ["2024001"] * len(masses),
        "姓名": ["张三"] * len(masses),
        "日期": ["2024-03-15"] * len(masses),
        "质量(kg)": [f"{m:.3f}" for m in masses],
        "周期(秒)": [f"{T:.4f}" for T in measured_periods],
        "振幅(cm)": [f"{A:.1f}" for A in amplitudes],
        "伸长量(mm)": [f"{e:.1f}" for e in extensions],
        "备注": [""] * len(masses),
    })

    df.loc[3, "备注"] = "计时器反应稍慢"
    df.loc[5, "周期(秒)"] = ""
    df.loc[5, "备注"] = "数据待补"

    file_path = output_path / "experiment_data.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


def _generate_late_attachment(output_path: Path) -> Path:
    """生成晚到附件数据。"""
    np.random.seed(123)

    masses = np.array([0.30, 0.40])
    ideal_periods = 2 * np.pi * np.sqrt((masses + TRUE_M0) / TRUE_K)
    noise = np.random.normal(0, 0.003, size=len(masses))
    measured_periods = ideal_periods + noise

    df = pd.DataFrame({
        "学号": ["2024001"] * len(masses),
        "姓名": ["张三"] * len(masses),
        "日期": ["2024-03-16"] * len(masses),
        "质量(kg)": [f"{m:.3f}" for m in masses],
        "周期(秒)": [f"{T:.4f}" for T in measured_periods],
        "振幅(cm)": ["1.8", "1.9"],
        "伸长量(mm)": ["14.7", "19.6"],
        "备注": ["晚交数据", "补充测量"],
    })

    file_path = output_path / "late_attachment.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


def _generate_duplicate_data(output_path: Path) -> Path:
    """生成包含重复项的数据。"""
    np.random.seed(456)

    masses = np.array([0.10, 0.10, 0.20, 0.20, 0.20, 0.30])
    ideal_periods = 2 * np.pi * np.sqrt((masses + TRUE_M0) / TRUE_K)
    noise = np.random.normal(0, 0.008, size=len(masses))
    measured_periods = ideal_periods + noise

    df = pd.DataFrame({
        "学号": ["2024002"] * len(masses),
        "姓名": ["李四"] * len(masses),
        "日期": ["2024-03-15"] * len(masses),
        "质量(kg)": [f"{m:.3f}" for m in masses],
        "周期(秒)": [f"{T:.4f}" for T in measured_periods],
        "振幅(cm)": ["1.8", "1.9", "2.0", "1.7", "1.8", "1.9"],
        "备注": ["第一次测量", "重复测量", "", "", "", ""],
    })

    file_path = output_path / "duplicate_data.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


def _generate_manual_correction(output_path: Path) -> Path:
    """生成包含人工更正标记的数据。"""
    np.random.seed(789)

    masses = np.array([0.05, 0.10, 0.15, 0.20, 0.25])
    ideal_periods = 2 * np.pi * np.sqrt((masses + TRUE_M0) / TRUE_K)
    noise = np.random.normal(0, 0.004, size=len(masses))
    measured_periods = ideal_periods + noise

    measured_periods[2] = 1.5
    measured_periods[4] = 0.8

    df = pd.DataFrame({
        "学号": ["2024003"] * len(masses),
        "姓名": ["王五"] * len(masses),
        "日期": ["2024-03-15"] * len(masses),
        "质量(kg)": [f"{m:.3f}" for m in masses],
        "周期(秒)": [f"{T:.4f}" for T in measured_periods],
        "振幅(cm)": ["1.8", "1.9", "5.0", "1.7", "1.9"],
        "状态": ["已确认", "已确认", "人工更正", "已确认", "人工更正"],
        "备注": ["", "", "原记录1.2s，笔误更正为1.5s", "", "原记录0.8s，单位换算错误"],
    })

    file_path = output_path / "manual_correction.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


def _generate_calibration_data(output_path: Path) -> Path:
    """生成标定表数据。"""
    nominal_masses = np.array([0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40])
    actual_masses = nominal_masses + np.random.normal(0, 0.0002, size=len(nominal_masses))

    df = pd.DataFrame({
        "弹簧编号": ["SPR-001"] * len(nominal_masses),
        "标定日期": ["2024-03-01"] * len(nominal_masses),
        "标称质量(kg)": [f"{m:.3f}" for m in nominal_masses],
        "实际质量(kg)": [f"{m:.4f}" for m in actual_masses],
        "劲度系数(N/m)": [f"{TRUE_K:.2f}"] * len(nominal_masses),
        "备注": [""] * len(nominal_masses),
    })

    df.loc[2, "备注"] = "砝码表面有轻微磨损"

    file_path = output_path / "calibration_data.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


def _generate_incomplete_data(output_path: Path) -> Path:
    """生成不完整数据（有采样缺口）。"""
    np.random.seed(321)

    masses = np.array([0.05, 0.15, 0.25, 0.35])
    ideal_periods = 2 * np.pi * np.sqrt((masses + TRUE_M0) / TRUE_K)
    noise = np.random.normal(0, 0.006, size=len(masses))
    measured_periods = ideal_periods + noise

    df = pd.DataFrame({
        "学号": ["2024004"] * len(masses),
        "姓名": ["赵六"] * len(masses),
        "日期": ["2024-03-15"] * len(masses),
        "质量(kg)": [f"{m:.3f}" for m in masses],
        "周期(秒)": [f"{T:.4f}" for T in measured_periods],
        "振幅(cm)": ["1.8", "1.9", "2.0", "1.7"],
        "备注": ["", "", "", ""],
    })

    file_path = output_path / "incomplete_data.csv"
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path


if __name__ == "__main__":
    files = generate_example_files("./examples")
    print("生成的示例文件：")
    for f in files:
        print(f"  - {f}")
