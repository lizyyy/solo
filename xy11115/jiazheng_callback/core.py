import os
import re
from typing import List, Dict, Tuple
import pandas as pd

from .exceptions import (
    FileReadError,
    MissingColumnError,
    EmptyFileError,
    OutputWriteError,
)

REQUIRED_COLUMNS = [
    "客户姓名",
    "手机号码",
    "服务日期",
    "服务类型",
    "服务人员",
    "回访状态",
    "回访结果",
]

PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")


def mask_phone(phone: str) -> str:
    if pd.isna(phone) or phone == "":
        return ""
    phone_str = str(phone).strip()
    if len(phone_str) == 11 and PHONE_PATTERN.match(phone_str):
        return phone_str[:3] + "****" + phone_str[7:]
    return phone_str


def read_excel_file(file_path: str) -> pd.DataFrame:
    if not os.path.exists(file_path):
        raise FileReadError(f"文件不存在: {file_path}")

    try:
        df = pd.read_excel(file_path, dtype={"手机号码": str})
    except Exception as e:
        raise FileReadError(f"读取文件失败 {file_path}: {str(e)}")

    if df.empty:
        raise EmptyFileError(f"文件为空: {file_path}")

    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        raise MissingColumnError(
            f"文件缺少必要列 {file_path}: {', '.join(missing_columns)}"
        )

    return df


def process_files(file_paths: List[str]) -> Dict[str, pd.DataFrame]:
    all_data = []
    failed = []

    for file_path in file_paths:
        try:
            df = read_excel_file(file_path)
            df["来源文件"] = os.path.basename(file_path)
            all_data.append(df)

        except Exception as e:
            failed.append({"file": file_path, "error": str(e)})

    if not all_data:
        return {
            "success": [],
            "failed": failed,
            "duplicates": [],
            "rerun": [],
        }

    combined_df = pd.concat(all_data, ignore_index=True)
    combined_df["手机号码"] = combined_df["手机号码"].apply(mask_phone)

    combined_df["_customer_key"] = combined_df.apply(
        lambda x: f"{x['客户姓名']}_{x['手机号码']}", axis=1
    )

    duplicates = combined_df[combined_df.duplicated(subset=["_customer_key"], keep=False)]
    duplicates = duplicates.sort_values("_customer_key")
    duplicates = duplicates.drop(columns=["_customer_key"])

    unique_df = combined_df.drop_duplicates(subset=["_customer_key"], keep="first")
    unique_df = unique_df.drop(columns=["_customer_key"])

    rerun_df = combined_df.drop_duplicates(subset=["_customer_key"], keep="last")
    rerun_df = rerun_df.drop(columns=["_customer_key"])

    return {
        "success": [unique_df],
        "failed": failed,
        "duplicates": [duplicates],
        "rerun": [rerun_df],
    }


def write_results(results: Dict[str, pd.DataFrame], output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)

    try:
        if results["success"]:
            final_df = pd.concat(results["success"], ignore_index=True)
            output_path = os.path.join(output_dir, "家政回访汇总结果.xlsx")
            final_df.to_excel(output_path, index=False, engine="openpyxl")

        if results["duplicates"]:
            dup_df = pd.concat(results["duplicates"], ignore_index=True)
            dup_path = os.path.join(output_dir, "重复客户记录.xlsx")
            dup_df.to_excel(dup_path, index=False, engine="openpyxl")

        if results["rerun"]:
            rerun_df = pd.concat(results["rerun"], ignore_index=True)
            rerun_path = os.path.join(output_dir, "可复跑输出.xlsx")
            rerun_df.to_excel(rerun_path, index=False, engine="openpyxl")

        if results["failed"]:
            failed_path = os.path.join(output_dir, "处理失败文件.txt")
            with open(failed_path, "w", encoding="utf-8") as f:
                for item in results["failed"]:
                    f.write(f"文件: {item['file']}\n")
                    f.write(f"错误: {item['error']}\n")
                    f.write("-" * 50 + "\n")

    except Exception as e:
        raise OutputWriteError(f"写入输出文件失败: {str(e)}")
