from typing import List, Optional
from .models import (
    MeterRecord,
    ValidationError,
    ErrorType,
    ProcessingResult,
    Config,
    MeterType,
)
from .parser import CSVParser, load_reference_meters
from pathlib import Path


class MeterDataProcessor:
    def __init__(self, config: Config):
        self.config = config
        self.parser = CSVParser(
            encoding=config.encoding,
            delimiter=config.delimiter,
        )
    
    def process(self) -> ProcessingResult:
        result = ProcessingResult()
        result.input_file = str(Path(self.config.input_file).resolve())
        
        records, errors = self.parser.parse(self.config.input_file)
        result.invalid_records.extend(errors)
        
        valid_records = [r for r in records if r.is_valid_basic and not any(
            e.row_number == r.row_number for e in result.invalid_records
        )]
        
        reference_meters = set()
        if self.config.reference_file:
            reference_meters = load_reference_meters(self.config.reference_file)
        
        if reference_meters:
            actual_meters = {r.meter_number for r in records}
            missing_nums = reference_meters - actual_meters
            for meter_num in sorted(missing_nums):
                result.missing_meters.append({
                    "表号": meter_num,
                    "状态": "缺表未抄"
                })
        
        valid_usages = []
        for record in valid_records:
            usage = record.usage
            if usage is not None and usage >= 0:
                valid_usages.append((record, usage))
        
        if valid_usages:
            usages_only = [u for _, u in valid_usages]
            usages_only.sort()
            n = len(usages_only)
            if n >= 4:
                q1 = usages_only[n // 4]
                q3 = usages_only[(3 * n) // 4]
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                robust_usages = [u for u in usages_only if lower_bound <= u <= upper_bound]
                if robust_usages:
                    avg_usage = sum(robust_usages) / len(robust_usages)
                else:
                    avg_usage = sum(usages_only) / n
            else:
                avg_usage = sum(usages_only) / n
        else:
            avg_usage = None
        
        total_water = 0.0
        total_electric = 0.0
        
        for record, usage in valid_usages:
            is_abnormal = self._check_abnormal_usage(
                usage,
                avg_usage,
                self.config.abnormal_threshold
            )
            
            if is_abnormal:
                result.abnormal_records.append(record)
                result.invalid_records.append(ValidationError(
                    row_number=record.row_number,
                    error_type=ErrorType.ABNORMAL_USAGE,
                    message=f"用量异常: {usage:.2f}，偏离平均值超过{self.config.abnormal_threshold}倍",
                    raw_data=record.raw_data
                ))
            else:
                result.valid_records.append(record)
                if record.meter_type == MeterType.WATER:
                    total_water += usage
                else:
                    total_electric += usage
        
        result.total_usage_water = total_water
        result.total_usage_electric = total_electric
        
        return result
    
    def _check_abnormal_usage(
        self,
        usage: float,
        avg_usage: Optional[float],
        threshold: float
    ) -> bool:
        if avg_usage is None or avg_usage == 0:
            return False
        ratio = usage / avg_usage
        return ratio > threshold or ratio < (1 / threshold)


def process_file(
    input_file: str,
    output_dir: str = "./output",
    abnormal_threshold: float = 2.0,
    reference_file: Optional[str] = None,
    encoding: str = "utf-8",
    delimiter: str = ",",
) -> ProcessingResult:
    config = Config(
        input_file=input_file,
        output_dir=output_dir,
        abnormal_threshold=abnormal_threshold,
        reference_file=reference_file,
        encoding=encoding,
        delimiter=delimiter,
    )
    
    processor = MeterDataProcessor(config)
    return processor.process()
