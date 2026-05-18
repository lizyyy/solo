#!/usr/bin/env python3
import click
import pandas as pd
import chardet
import csv
import re
from pathlib import Path
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ValidationError:
    error_type: str
    category: str
    message: str
    file: str
    line: int
    details: Dict[str, Any] = field(default_factory=dict)


class ReagentInventoryValidator:
    REQUIRED_COLUMNS = {
        '试剂编号', '试剂名称', '规格', '浓度', '浓度单位',
        '生产厂家', '批号', '有效期', '存放位置', '剩余量',
        '是否空瓶', '使用人', '盘点日期'
    }

    VALID_UNITS = {'mol/L', 'mmol/L', 'μg/mL', 'mg/mL', 'g/L', '%', 'M', 'mM', 'μM'}

    CATEGORIES = {
        '浓度单位异常': 'concentration_unit',
        '空瓶未报废': 'empty_bottle',
        '可复跑输出': 'retryable',
        '格式错误': 'format_error'
    }

    def __init__(self):
        self.errors: List[ValidationError] = []
        self.stats: Dict[str, int] = defaultdict(int)

    def detect_encoding(self, filepath: Path) -> str:
        with open(filepath, 'rb') as f:
            result = chardet.detect(f.read(10000))
        return result['encoding'] or 'utf-8'

    def validate_file(self, filepath: Path) -> Tuple[pd.DataFrame, List[ValidationError]]:
        self.errors = []
        self.stats = defaultdict(int)

        try:
            encoding = self.detect_encoding(filepath)
        except Exception as e:
            self._add_error(
                '编码异常', 'format_error',
                f'无法检测文件编码: {str(e)}',
                str(filepath), 0
            )
            return pd.DataFrame(), self.errors

        try:
            df = pd.read_csv(filepath, encoding=encoding, dtype=str)
        except UnicodeDecodeError:
            self._add_error(
                '编码异常', 'format_error',
                '文件编码格式不正确，请使用UTF-8或GBK编码',
                str(filepath), 0
            )
            return pd.DataFrame(), self.errors
        except Exception as e:
            self._add_error(
                '文件读取失败', 'format_error',
                f'文件读取失败: {str(e)}',
                str(filepath), 0
            )
            return pd.DataFrame(), self.errors

        self._validate_columns(df, filepath)
        if not self.errors:
            self._validate_rows(df, filepath)

        return df, self.errors

    def _validate_columns(self, df: pd.DataFrame, filepath: Path):
        missing_cols = self.REQUIRED_COLUMNS - set(df.columns)
        if missing_cols:
            for col in missing_cols:
                self._add_error(
                    '缺少必要列', 'format_error',
                    f'缺少必要列: {col}',
                    str(filepath), 1
                )

        extra_cols = set(df.columns) - self.REQUIRED_COLUMNS
        if extra_cols:
            for col in extra_cols:
                self._add_error(
                    '未知列', 'format_error',
                    f'发现未知列: {col}',
                    str(filepath), 1
                )

    def _validate_rows(self, df: pd.DataFrame, filepath: Path):
        seen_identifiers = set()

        for idx, row in df.iterrows():
            line_num = idx + 2
            row_key = f"{row.get('试剂编号', '')}-{row.get('批号', '')}-{row.get('存放位置', '')}"

            if row_key in seen_identifiers:
                self._add_error(
                    '重复行', 'format_error',
                    f'发现重复记录: 试剂编号={row.get("试剂编号")}, 批号={row.get("批号")}',
                    filepath, line_num,
                    {'试剂编号': row.get('试剂编号'), '批号': row.get('批号')}
                )
            else:
                seen_identifiers.add(row_key)

            self._validate_concentration_unit(row, filepath, line_num)
            self._validate_retryable_fields(row, filepath, line_num)
            self._validate_empty_bottle(row, filepath, line_num)

    def _validate_concentration_unit(self, row: pd.Series, filepath: str, line_num: int):
        unit = str(row.get('浓度单位', '')).strip()
        concentration = str(row.get('浓度', '')).strip()

        if concentration and not unit:
            self._add_error(
                '浓度单位缺失', '浓度单位异常',
                f'试剂 {row.get("试剂名称")} 有浓度但缺少单位',
                filepath, line_num,
                {'试剂名称': row.get('试剂名称'), '浓度': concentration}
            )
            return

        if unit and unit not in self.VALID_UNITS:
            similar_units = [u for u in self.VALID_UNITS if u.lower() == unit.lower()]
            if similar_units:
                suggestion = similar_units[0]
                self._add_error(
                    '浓度单位大小写不规范', '浓度单位异常',
                    f'浓度单位 "{unit}" 大小写不规范，建议改为 "{suggestion}"',
                    filepath, line_num,
                    {'当前单位': unit, '建议单位': suggestion, '试剂名称': row.get('试剂名称')}
                )
            else:
                self._add_error(
                    '浓度单位未知', '浓度单位异常',
                    f'未知浓度单位: {unit}，有效单位: {", ".join(sorted(self.VALID_UNITS))}',
                    filepath, line_num,
                    {'当前单位': unit, '试剂名称': row.get('试剂名称')}
                )

    def _validate_empty_bottle(self, row: pd.Series, filepath: str, line_num: int):
        is_empty = str(row.get('是否空瓶', '')).strip()
        remaining = str(row.get('剩余量', '')).strip()

        try:
            remaining_float = float(remaining) if remaining else None
        except ValueError:
            return

        if is_empty in ['是', 'yes', 'true', '1']:
            if remaining_float is not None and remaining_float > 0:
                self._add_error(
                    '空瓶但有剩余量', '空瓶未报废',
                    f'试剂 {row.get("试剂名称")} 标记为空瓶但剩余量={remaining} > 0',
                    filepath, line_num,
                    {'试剂名称': row.get('试剂名称'), '剩余量': remaining}
                )
        elif is_empty in ['否', 'no', 'false', '0']:
            if remaining_float is not None and remaining_float <= 0:
                self._add_error(
                    '非空瓶但无剩余量', '空瓶未报废',
                    f'试剂 {row.get("试剂名称")} 标记为非空瓶但剩余量={remaining}',
                    filepath, line_num,
                    {'试剂名称': row.get('试剂名称'), '剩余量': remaining}
                )

    def _validate_retryable_fields(self, row: pd.Series, filepath: str, line_num: int):
        date_fields = ['有效期', '盘点日期']
        for field in date_fields:
            value = str(row.get(field, '')).strip()
            if value:
                if not re.match(r'^\d{4}-\d{2}-\d{2}$', value):
                    self._add_error(
                        f'{field}格式错误', '可复跑输出',
                        f'{field}格式不正确: {value}，应为YYYY-MM-DD格式',
                        filepath, line_num,
                        {'字段': field, '值': value}
                    )

        remaining = str(row.get('剩余量', '')).strip()
        if remaining:
            try:
                float(remaining)
            except ValueError:
                self._add_error(
                    '剩余量格式错误', '可复跑输出',
                    f'剩余量格式不正确: {remaining}，应为数字',
                    filepath, line_num,
                    {'值': remaining}
                )

    def _add_error(self, error_type: str, category: str, message: str, file: str, line: int, details: Dict = None):
        self.errors.append(ValidationError(
            error_type=error_type,
            category=category,
            message=message,
            file=file,
            line=line,
            details=details or {}
        ))
        self.stats[category] += 1

    def generate_report(self) -> str:
        report = []
        report.append("=" * 80)
        report.append("高校实验室实验试剂盘点 - 校验报告")
        report.append("=" * 80)
        report.append(f"总计异常数: {len(self.errors)}")
        report.append("")

        report.append("分类统计:")
        report.append(f"  浓度单位异常: {self.stats.get('浓度单位异常', 0)} 项")
        report.append(f"  空瓶未报废: {self.stats.get('空瓶未报废', 0)} 项")
        report.append(f"  可复跑输出: {self.stats.get('可复跑输出', 0)} 项")
        report.append(f"  格式错误: {self.stats.get('format_error', 0)} 项")
        report.append("")

        report.append("异常详情:")
        report.append("-" * 80)

        for category in ['浓度单位异常', '空瓶未报废', '可复跑输出', 'format_error']:
            cat_errors = [e for e in self.errors if e.category == category]
            if cat_errors:
                display_cat = '格式错误' if category == 'format_error' else category
                report.append(f"\n【{display_cat}】({len(cat_errors)}项):")
                for err in cat_errors:
                    report.append(f"  行 {err.line}: {err.message}")
                    if err.details:
                        details_str = ", ".join([f"{k}={v}" for k, v in err.details.items()])
                        report.append(f"    详情: {details_str}")

        report.append("")
        report.append("=" * 80)
        return "\n".join(report)


@click.group()
def cli():
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True, path_type=Path))
@click.option('--output', '-o', type=click.Path(path_type=Path), help='输出报告文件路径')
def validate(input_file: Path, output: Path = None):
    validator = ReagentInventoryValidator()
    df, errors = validator.validate_file(input_file)

    report = validator.generate_report()

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report)
        click.echo(f"报告已保存至: {output}")
    else:
        click.echo(report)

    if errors:
        click.echo(f"\n发现 {len(errors)} 个异常，请检查数据后重新提交。")
    else:
        click.echo("\n数据校验通过！")


@cli.command()
@click.argument('input_file', type=click.Path(exists=True, path_type=Path))
@click.argument('output_file', type=click.Path(path_type=Path))
def clean(input_file: Path, output_file: Path):
    validator = ReagentInventoryValidator()
    df, errors = validator.validate_file(input_file)

    if df.empty:
        click.echo("无法读取输入文件，无法清洗数据。")
        return

    cleaned = df.copy()

    if '浓度单位' in cleaned.columns:
        unit_mapping = {
            'mol/l': 'mol/L', 'Mol/L': 'mol/L', 'MOL/L': 'mol/L',
            'mmol/l': 'mmol/L', 'Mg/ml': 'mg/mL', 'UG/ml': 'μg/mL',
            'm': 'M', 'mm': 'mM', 'um': 'μM'
        }
        cleaned['浓度单位'] = cleaned['浓度单位'].str.strip().map(
            lambda x: unit_mapping.get(x, x) if isinstance(x, str) else x
        )

    date_fields = ['有效期', '盘点日期']
    for field in date_fields:
        if field in cleaned.columns:
            cleaned[field] = cleaned[field].astype(str).str.replace('/', '-')

    cleaned.to_csv(output_file, index=False, encoding='utf-8-sig')
    click.echo(f"清洗后的数据已保存至: {output_file}")
    click.echo(validator.generate_report())


if __name__ == '__main__':
    cli()
