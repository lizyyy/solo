"""示例数据生成 - 包含各种数据质量问题"""

import pandas as pd
import numpy as np


def create_sample_dataframe(include_issues: bool = True) -> pd.DataFrame:
    """创建包含各种问题的示例数据"""
    np.random.seed(42)

    data = []

    data.extend([
        {"sample_id": "BLANK-001", "sample_type": "空白样", "parameter": "COD", "value": 0.002, "unit": "mg/L"},
        {"sample_id": "BLANK-002", "sample_type": "空白样", "parameter": "COD", "value": 0.005, "unit": "mg/L"},
        {"sample_id": "BLANK-003", "sample_type": "空白样", "parameter": "COD", "value": 0.05, "unit": "mg/L"},
        {"sample_id": "BLANK-004", "sample_type": "空白样", "parameter": "总磷", "value": 0.001, "unit": "mg/L"},
        {"sample_id": "BLANK-005", "sample_type": "空白样", "parameter": "氨氮", "value": 0.02, "unit": "mg/L"},
    ])

    data.extend([
        {"sample_id": "PARA-A-001", "sample_type": "平行样", "parameter": "COD", "value": 45.2, "unit": "mg/L"},
        {"sample_id": "PARA-A-001", "sample_type": "平行样", "parameter": "COD", "value": 44.8, "unit": "mg/L"},
        {"sample_id": "PARA-A-002", "sample_type": "平行样", "parameter": "COD", "value": 32.1, "unit": "mg/L"},
        {"sample_id": "PARA-A-002", "sample_type": "平行样", "parameter": "COD", "value": 40.5, "unit": "mg/L"},
        {"sample_id": "PARA-B-001", "sample_type": "平行样", "parameter": "总磷", "value": 0.35, "unit": "mg/L"},
        {"sample_id": "PARA-B-001", "sample_type": "平行样", "parameter": "总磷", "value": 0.36, "unit": "mg/L"},
        {"sample_id": "PARA-C-001", "sample_type": "平行样", "parameter": "氨氮", "value": 1.25, "unit": "mg/L"},
    ])

    data.extend([
        {"sample_id": "S-001", "sample_type": "样品", "parameter": "COD", "value": 42.0, "unit": "mg/L",
         "spike_amount": 50.0, "original_concentration": 42.0},
        {"sample_id": "SPIKE-001", "sample_type": "加标回收", "parameter": "COD", "value": 88.0, "unit": "mg/L",
         "spike_amount": 50.0, "original_concentration": 42.0},
        {"sample_id": "S-002", "sample_type": "样品", "parameter": "总磷", "value": 0.30, "unit": "mg/L",
         "spike_amount": 0.5, "original_concentration": 0.30},
        {"sample_id": "SPIKE-002", "sample_type": "加标回收", "parameter": "总磷", "value": 0.95, "unit": "mg/L",
         "spike_amount": 0.5, "original_concentration": 0.30},
        {"sample_id": "S-003", "sample_type": "样品", "parameter": "氨氮", "value": 1.50, "unit": "mg/L",
         "spike_amount": 1.0, "original_concentration": 1.50},
        {"sample_id": "SPIKE-003", "sample_type": "加标回收", "parameter": "氨氮", "value": 2.20, "unit": "mg/L",
         "spike_amount": 1.0, "original_concentration": 1.50},
    ])

    data.extend([
        {"sample_id": "S-001", "sample_type": "样品", "parameter": "COD", "value": 42.0, "unit": "mg/L"},
        {"sample_id": "S-002", "sample_type": "样品", "parameter": "COD", "value": 55.5, "unit": "mg/L"},
        {"sample_id": "S-003", "sample_type": "样品", "parameter": "COD", "value": 38.2, "unit": "mg/L"},
        {"sample_id": "S-004", "sample_type": "样品", "parameter": "COD", "value": 48.7, "unit": "mg/L"},
        {"sample_id": "S-005", "sample_type": "样品", "parameter": "COD", "value": 150.0, "unit": "mg/L"},
        {"sample_id": "S-006", "sample_type": "样品", "parameter": "COD", "value": 44.3, "unit": "mg/L"},
        {"sample_id": "S-007", "sample_type": "样品", "parameter": "COD", "value": 41.9, "unit": "mg/L"},
        {"sample_id": "S-008", "sample_type": "样品", "parameter": "COD", "value": 39.8, "unit": "mg/L"},
        {"sample_id": "S-001", "sample_type": "样品", "parameter": "总磷", "value": 0.32, "unit": "mg/L"},
        {"sample_id": "S-002", "sample_type": "样品", "parameter": "总磷", "value": 0.28, "unit": "mg/L"},
        {"sample_id": "S-003", "sample_type": "样品", "parameter": "总磷", "value": 0.45, "unit": "mg/L"},
        {"sample_id": "S-001", "sample_type": "样品", "parameter": "氨氮", "value": 1.45, "unit": "mg/L"},
        {"sample_id": "S-002", "sample_type": "样品", "parameter": "氨氮", "value": 1.22, "unit": "mg/L"},
        {"sample_id": "S-003", "sample_type": "样品", "parameter": "氨氮", "value": 1.68, "unit": "mg/L"},
    ])

    if include_issues:
        data.extend([
            {"sample_id": "S-009", "sample_type": "样品", "parameter": "COD", "value": "N/A", "unit": "mg/L"},
            {"sample_id": "S-010", "sample_type": "样品", "parameter": "COD", "value": "<0.1", "unit": "mg/L"},
        ])

        data.append({"sample_id": None, "sample_type": "样品", "parameter": "COD", "value": 45.0, "unit": "mg/L"})

        data.append({"sample_id": "S-011", "sample_type": "样品", "parameter": "COD", "value": 52.0, "unit": "ug/L"})
        data.append({"sample_id": "S-012", "sample_type": "样品", "parameter": "总磷", "value": 200.0, "unit": "ug/L"})

        data.append({"sample_id": "S-013", "sample_type": "未知类型", "parameter": "COD", "value": 43.0, "unit": "mg/L"})

        data.extend([
            {"sample_id": "S-004", "sample_type": "样品", "parameter": "COD", "value": 48.7, "unit": "mg/L"},
            {"sample_id": "S-004", "sample_type": "样品", "parameter": "COD", "value": 48.9, "unit": "mg/L"},
        ])

    df = pd.DataFrame(data)
    return df


def save_sample_data(output_dir: str):
    """保存示例数据到文件"""
    from pathlib import Path
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    df = create_sample_dataframe(include_issues=True)
    csv_path = out_path / "sample_data_with_issues.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    xlsx_path = out_path / "sample_data_with_issues.xlsx"
    df.to_excel(xlsx_path, index=False, sheet_name="水质检测数据")

    clean_df = create_sample_dataframe(include_issues=False)
    clean_csv_path = out_path / "sample_data_clean.csv"
    clean_df.to_csv(clean_csv_path, index=False, encoding="utf-8-sig")

    return {
        "with_issues_csv": str(csv_path),
        "with_issues_xlsx": str(xlsx_path),
        "clean_csv": str(clean_csv_path),
    }


if __name__ == "__main__":
    paths = save_sample_data("./examples")
    print("示例数据已生成:")
    for name, path in paths.items():
        print(f"  {name}: {path}")
