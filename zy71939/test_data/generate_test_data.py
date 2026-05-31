import os
import pandas as pd
from datetime import datetime, timedelta


def generate_test_package(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)

    auth_file = os.path.join(output_dir, "品牌授权_2024Q1.xlsx")
    _create_authorization_file(auth_file)

    proof_file1 = os.path.join(output_dir, "打样记录_01.xlsx")
    _create_proof_records_1(proof_file1)

    proof_file2 = os.path.join(output_dir, "打样记录_02.xlsx")
    _create_proof_records_2(proof_file2)

    print(f"测试数据已生成到: {output_dir}")
    print(f"  - {auth_file}")
    print(f"  - {proof_file1}")
    print(f"  - {proof_file2}")


def _create_authorization_file(file_path: str) -> None:
    data = {
        "授权编号": ["AUTH-2024-Q1-001"],
        "有效期至": [(datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")],
        "颜色版本1": ["C01-经典蓝"],
        "颜色版本2": ["C02-活力橙"],
        "颜色版本3": ["C03-自然绿"],
        "规格1": ["85x54mm"],
        "规格2": ["90x54mm"],
        "备注": ["2024年第一季度品牌使用授权"],
    }

    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False, sheet_name="授权信息")


def _create_proof_records_1(file_path: str) -> None:
    today = datetime.now()

    data = {
        "物料名称": [
            "品牌名片-标准版",
            "品牌名片-标准版",
            "信封-大号",
            "信纸-A4",
            "文件夹-蓝色",
        ],
        "颜色版本": [
            "C01-经典蓝",
            "C01-经典蓝",
            "C02-活力橙",
            "C99-神秘紫",
            "C03-自然绿",
        ],
        "规格": [
            "85x54mm",
            "85x54mm",
            "90x54mm",
            "210x297mm",
            "85x54mm",
        ],
        "授权编号": [
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-001",
        ],
        "授权有效期": [
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
        ],
        "提交时间": [
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
        ],
        "备注": [
            "",
            "重复提交",
            "",
            "人工更正: 颜色调整",
            "",
        ],
    }

    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False, sheet_name="打样明细")


def _create_proof_records_2(file_path: str) -> None:
    today = datetime.now()

    data = {
        "物料名称": [
            "品牌名片-标准版",
            "工作证-员工",
            "信封-大号",
        ],
        "颜色版本": [
            "C02-活力橙",
            "C01-经典蓝",
            "C04-深灰",
        ],
        "规格": [
            "85x54mm",
            "85x54mm",
            "100x60mm",
        ],
        "授权编号": [
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-001",
            "AUTH-2024-Q1-002",
        ],
        "授权有效期": [
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            (today + timedelta(days=30)).strftime("%Y-%m-%d"),
        ],
        "提交时间": [
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
        ],
        "备注": [
            "",
            "",
            "correction: updated spec",
        ],
    }

    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False, sheet_name="打样明细")


if __name__ == "__main__":
    output_dir = os.path.join(os.path.dirname(__file__), "sample_package")
    generate_test_package(output_dir)
