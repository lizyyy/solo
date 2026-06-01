from typing import List
from ..models.bond import BondRecord, CalculationResult, ProcessStatus
from ..models.params import CalculationParams
from ..core import BondCalculator, BoundaryJudge
from .cleaner import DataCleaner


class CalculationPipeline:
    def __init__(self, params: CalculationParams = None):
        self.params = params or CalculationParams()
        self.calculator = BondCalculator(self.params)
        self.judge = BoundaryJudge(self.params)
        self.cleaner = DataCleaner()

    def run(self, records: List[BondRecord]) -> List[CalculationResult]:
        all_results = []

        cleaning_results = self.cleaner.check_duplicates(records)
        self.cleaner.check_empty_fields(records)
        self.cleaner.check_unit_mixed(records)

        for i, record in enumerate(records):
            pre_result = cleaning_results[i]

            if pre_result.status == ProcessStatus.SKIPPED:
                all_results.append(pre_result)
                continue

            if pre_result.status == ProcessStatus.SUCCESS and pre_result.warnings:
                calc_result = self.calculator.calculate(record)
                calc_result.warnings.extend(pre_result.warnings)
                calc_result = self.judge.judge(calc_result)
                all_results.append(calc_result)
                continue

            calc_result = self.calculator.calculate(record)

            for line_num, code, fields in self.cleaner.empty_field_records:
                if line_num == record.line_number:
                    if calc_result.status != ProcessStatus.FAILED:
                        calc_result.warnings.append(
                            f"空值处理：原始数据缺少{', '.join(fields)}，已在计算阶段处理"
                        )
                    break

            for line_num, code, units in self.cleaner.unit_mixed_records:
                if line_num == record.line_number:
                    calc_result.warnings.append(
                        f"单位混用：检测到{', '.join(units)}，已自动转换为统一单位"
                    )
                    break

            calc_result = self.judge.judge(calc_result)
            all_results.append(calc_result)

        return all_results

    def get_cleaning_summary(self) -> dict:
        return self.cleaner.get_cleaning_summary()
