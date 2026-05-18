from pathlib import Path
from typing import Dict, List, Tuple, Any

import pandas as pd
from rich.table import Table


REQUIRED_COLUMNS = {
    "观看记录": [
        "用户ID", "用户姓名", "课程ID", "课程名称", "观看时间", "观看时长(秒)"
    ],
    "订单记录": [
        "订单ID", "用户ID", "用户姓名", "课程ID", "课程名称", "订单状态",
        "下单时间", "支付时间", "退款时间", "订单类型"
    ],
    "授权名单": [
        "用户ID", "用户姓名", "课程ID", "课程名称", "授权开始时间", "授权结束时间", "授权类型"
    ]
}


class DataReader:
    def __init__(self, console):
        self.console = console

    def read(self, input_path: Path) -> Tuple[Dict[str, pd.DataFrame], Dict[str, List[str]]]:
        datasets = {}
        data_issues = {
            "文件问题": [],
            "空目录": [],
            "缺列": [],
            "重复行": [],
            "文件损坏": []
        }

        if input_path.is_dir():
            files = list(input_path.glob("*.csv")) + list(input_path.glob("*.xlsx"))
            if not files:
                data_issues["空目录"].append(f"输入目录 {input_path} 中没有找到 CSV 或 Excel 文件")
                self.console.print("警告: 输入目录为空", style="bold red")
                return datasets, data_issues

            self.console.print(f"找到 {len(files)} 个数据文件")
            for file in files:
                self._read_single_file(file, datasets, data_issues)
        else:
            self._read_single_file(input_path, datasets, data_issues)

        self._display_data_issues(data_issues)
        return datasets, data_issues

    def _read_single_file(self, file_path: Path, datasets: Dict, data_issues: Dict):
        try:
            file_name = file_path.stem

            if file_path.suffix.lower() == ".csv":
                df = pd.read_csv(file_path, dtype=str)
            elif file_path.suffix.lower() == ".xlsx":
                df = pd.read_excel(file_path, dtype=str)
            else:
                data_issues["文件问题"].append(f"不支持的文件格式: {file_path.name}")
                return

            dataset_type = self._detect_dataset_type(file_name, df.columns.tolist())

            if dataset_type:
                missing_cols = [col for col in REQUIRED_COLUMNS[dataset_type] if col not in df.columns]
                if missing_cols:
                    data_issues["缺列"].append(
                        f"{file_path.name} ({dataset_type}) 缺少必需列: {', '.join(missing_cols)}"
                    )
                    self.console.print(f"警告: {file_path.name} 缺少列", style="bold yellow")

                duplicate_count = df.duplicated().sum()
                if duplicate_count > 0:
                    data_issues["重复行"].append(
                        f"{file_path.name} ({dataset_type}) 包含 {duplicate_count} 行重复数据"
                    )
                    self.console.print(f"警告: {file_path.name} 有 {duplicate_count} 行重复", style="bold yellow")

                if dataset_type not in datasets:
                    datasets[dataset_type] = []
                datasets[dataset_type].append(df)
                self.console.print(f"✓ 已加载 {file_path.name} -> {dataset_type} ({len(df)} 行)", style="green")
            else:
                data_issues["文件问题"].append(f"无法识别文件类型: {file_path.name}")
                self.console.print(f"✗ 无法识别 {file_path.name} 的数据类型", style="bold red")

        except pd.errors.EmptyDataError:
            data_issues["文件损坏"].append(f"{file_path.name} 文件为空或格式损坏")
            self.console.print(f"✗ {file_path.name} 文件损坏", style="bold red")
        except Exception as e:
            data_issues["文件损坏"].append(f"{file_path.name} 读取失败: {str(e)}")
            self.console.print(f"✗ {file_path.name} 读取错误: {str(e)[:50]}", style="bold red")

    def _detect_dataset_type(self, file_name: str, columns: List[str]) -> str:
        file_name_lower = file_name.lower()

        if "观看" in file_name or "playback" in file_name_lower or "watch" in file_name_lower:
            return "观看记录"
        if "订单" in file_name or "order" in file_name_lower:
            return "订单记录"
        if "授权" in file_name or "permission" in file_name_lower or "auth" in file_name_lower:
            return "授权名单"

        col_set = set(columns)
        for dtype, required_cols in REQUIRED_COLUMNS.items():
            match_count = sum(1 for col in required_cols if col in col_set)
            if match_count >= len(required_cols) * 0.6:
                return dtype

        return None

    def _display_data_issues(self, data_issues: Dict[str, List[str]]):
        total_issues = sum(len(issues) for issues in data_issues.values())
        if total_issues == 0:
            self.console.print("✓ 所有数据文件校验通过", style="green")
            return

        table = Table(title="数据质量问题汇总", show_header=True)
        table.add_column("问题类型", style="cyan")
        table.add_column("问题数量", style="magenta")
        table.add_column("详情", style="yellow")

        for issue_type, issues in data_issues.items():
            if issues:
                table.add_row(
                    issue_type,
                    str(len(issues)),
                    issues[0][:50] + "..." if len(issues[0]) > 50 else issues[0]
                )

        self.console.print(table)
