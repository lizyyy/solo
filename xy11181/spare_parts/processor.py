import csv
import os
from datetime import datetime
from typing import List, Optional
import yaml

from .models import SparePart, PurchaseSuggestion, ProcessingResult, PartIssue, ExitCode


class PartProcessor:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.result = ProcessingResult()

    def _load_config(self, config_path: Optional[str] = None) -> dict:
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "config",
                "default_rules.yaml"
            )
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                yaml_content = '\n'.join(lines[2:]) if len(lines) > 2 else content
                return yaml.safe_load(yaml_content) or {}
        except Exception as e:
            print(f"配置加载失败: {e}")
            return {}

    def _parse_alternative_parts(self, alt_str: str) -> List[str]:
        if not alt_str or alt_str.strip() == "":
            return []
        return [p.strip() for p in alt_str.replace('，', ',').split(',') if p.strip()]

    def process_file(self, input_path: str) -> ProcessingResult:
        if not os.path.exists(input_path):
            self.result.errors.append(f"输入文件不存在: {input_path}")
            return self.result

        if os.path.isdir(input_path):
            if not os.listdir(input_path):
                self.result.errors.append(f"输入目录为空: {input_path}")
                return self.result

        try:
            with open(input_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    self.result.errors.append("CSV文件没有表头")
                    return self.result

                required_cols = self.config.get('验证规则', {}).get('required_columns', [])
                missing_cols = [col for col in required_cols if col not in reader.fieldnames]
                if missing_cols:
                    self.result.errors.append(f"缺少必需列: {', '.join(missing_cols)}")
                    return self.result

                for row_num, row in enumerate(reader, start=2):
                    try:
                        part = self._parse_row(row, row_num)
                        self._process_part(part)
                    except Exception as e:
                        self.result.errors.append(f"第{row_num}行解析失败: {str(e)}")

        except csv.Error as e:
            self.result.errors.append(f"CSV格式错误: {str(e)}")
        except Exception as e:
            self.result.errors.append(f"处理文件时发生错误: {str(e)}")

        return self.result

    def _parse_row(self, row: dict, row_num: int) -> SparePart:
        try:
            part_code = row['备件编码'].strip()
            part_name = row['备件名称'].strip()
            quantity = int(row['数量'] or 0)
            unit = row['单位'].strip()
            min_stock = int(row['最小库存'] or 0)
            current_stock = int(row['当前库存'] or 0)

            if not part_code:
                raise ValueError("备件编码不能为空")
            if not part_name:
                raise ValueError("备件名称不能为空")

            min_package = int(row.get('最小包装量') or 1)
            if min_package < 1:
                min_package = 1

            alternative_parts = self._parse_alternative_parts(row.get('替代件', ''))

            return SparePart(
                part_code=part_code,
                part_name=part_name,
                quantity=quantity,
                unit=unit,
                min_stock=min_stock,
                current_stock=current_stock,
                supplier=row.get('供应商', ''),
                price=float(row.get('单价') or 0),
                min_package=min_package,
                alternative_parts=alternative_parts
            )
        except ValueError as e:
            raise ValueError(f"数据格式错误: {str(e)}")

    def _process_part(self, part: SparePart):
        self.result.total_parts += 1

        if part.min_package > 1:
            self.result.parts_with_min_package += 1
            if part.min_package > self.config.get('最小包装量规则', {}).get('package_warning_threshold', 10):
                part.add_issue(
                    "大包装警告",
                    f"最小包装量({part.min_package})超过警告阈值",
                    "warning"
                )

        if part.alternative_parts:
            self.result.parts_with_alternatives += 1
            part.add_issue(
                "替代件提示",
                f"可用替代件: {', '.join(part.alternative_parts)}",
                "info"
            )

        suggested_qty = part.suggested_purchase
        if suggested_qty > 0:
            self.result.parts_needing_purchase += 1
            actual_packages = suggested_qty // part.min_package if part.min_package > 0 else 0

            if part.min_package > 1 and actual_packages > 1:
                part.add_issue(
                    "包装取整",
                    f"需求{part.min_stock - part.current_stock}{part.unit}，按最小包装{part.min_package}{part.unit}取整",
                    "info"
                )

            suggestion = PurchaseSuggestion(
                part_code=part.part_code,
                part_name=part.part_name,
                suggested_quantity=suggested_qty,
                unit=part.unit,
                min_package=part.min_package,
                actual_packages=actual_packages,
                alternative_parts=part.alternative_parts,
                issues=part.issues
            )
            self.result.suggestions.append(suggestion)

    def generate_output(self, output_dir: str, prefix: str = "备件采购建议") -> str:
        os.makedirs(output_dir, exist_ok=True)

        timestamp_fmt = self.config.get('输出配置', {}).get('timestamp_format', "%Y%m%d_%H%M%S")
        timestamp = datetime.now().strftime(timestamp_fmt)
        suffix = self.config.get('输出配置', {}).get('output_suffix', '')

        filename = f"{prefix}_{timestamp}{suffix}.csv"
        output_path = os.path.join(output_dir, filename)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '备件编码', '备件名称', '建议采购量', '单位',
                '最小包装量', '实际包装数', '替代件', '问题说明'
            ])

            for sug in self.result.suggestions:
                issues_desc = '; '.join([f"{i.issue_type}:{i.description}" for i in sug.issues])
                writer.writerow([
                    sug.part_code,
                    sug.part_name,
                    sug.suggested_quantity,
                    sug.unit,
                    sug.min_package,
                    sug.actual_packages,
                    ','.join(sug.alternative_parts),
                    issues_desc
                ])

        return output_path

    def get_exit_code(self) -> int:
        if self.result.errors:
            if "输入文件不存在" in str(self.result.errors):
                return ExitCode.INPUT_NOT_FOUND.value
            if "缺少必需列" in str(self.result.errors) or "CSV格式错误" in str(self.result.errors):
                return ExitCode.DATA_FORMAT_ERROR.value
            return ExitCode.GENERAL_ERROR.value
        return ExitCode.SUCCESS.value
