from typing import List, Dict, Any, Tuple
from pydantic import ValidationError as PydanticValidationError
from ..models import CustomerRecord, ValidationError


class DataValidator:
    def __init__(self):
        self.errors: List[ValidationError] = []

    def validate_row(
        self, row_data: Dict[str, Any], row_number: int
    ) -> Tuple[CustomerRecord, List[ValidationError]]:
        row_errors = []

        try:
            record = CustomerRecord(**row_data)
            return record, row_errors
        except PydanticValidationError as e:
            for error in e.errors():
                field = error["loc"][0] if error["loc"] else "unknown"
                row_errors.append(
                    ValidationError(
                        row_number=row_number,
                        field=field,
                        error_type=error["type"],
                        message=str(error["msg"]),
                        value=error.get("input"),
                    )
                )
            return None, row_errors

    def validate_batch(
        self, data_rows: List[Dict[str, Any]]
    ) -> Tuple[List[CustomerRecord], List[ValidationError]]:
        valid_records = []
        all_errors = []

        for idx, row in enumerate(data_rows, start=1):
            record, errors = self.validate_row(row, idx)
            if record:
                valid_records.append(record)
            all_errors.extend(errors)

        return valid_records, all_errors

    def check_duplicate_customer_ids(
        self, records: List[CustomerRecord]
    ) -> List[ValidationError]:
        seen = {}
        duplicates = []

        for idx, record in enumerate(records, start=1):
            if record.customer_id in seen:
                duplicates.append(
                    ValidationError(
                        row_number=idx,
                        field="customer_id",
                        error_type="duplicate",
                        message=f"客户ID重复，首次出现于第{seen[record.customer_id]}行",
                        value=record.customer_id,
                    )
                )
            else:
                seen[record.customer_id] = idx

        return duplicates

    def check_volume_outliers(
        self, records: List[CustomerRecord], threshold: float = 1000.0
    ) -> List[ValidationError]:
        outliers = []

        for idx, record in enumerate(records, start=1):
            if record.volume > threshold:
                outliers.append(
                    ValidationError(
                        row_number=idx,
                        field="volume",
                        error_type="outlier",
                        message=f"体积{record.volume}m³超过预警阈值{threshold}m³，请核实",
                        value=record.volume,
                    )
                )

        return outliers

    def check_free_rent_anomalies(
        self, records: List[CustomerRecord], max_free_days: int = 60
    ) -> List[ValidationError]:
        anomalies = []

        for idx, record in enumerate(records, start=1):
            if record.free_rent_days > max_free_days:
                anomalies.append(
                    ValidationError(
                        row_number=idx,
                        field="free_rent_days",
                        error_type="anomaly",
                        message=f"免租天数{record.free_rent_days}天超过最大预警值{max_free_days}天，请核实",
                        value=record.free_rent_days,
                    )
                )
            if record.free_rent_days > record.occupancy_days:
                anomalies.append(
                    ValidationError(
                        row_number=idx,
                        field="free_rent_days",
                        error_type="logic_conflict",
                        message=f"免租天数{record.free_rent_days}天超过实际占用天数{record.occupancy_days}天",
                        value=record.free_rent_days,
                    )
                )

        return anomalies

    def run_all_validations(
        self, records: List[CustomerRecord]
    ) -> List[ValidationError]:
        all_errors = []
        all_errors.extend(self.check_duplicate_customer_ids(records))
        all_errors.extend(self.check_volume_outliers(records))
        all_errors.extend(self.check_free_rent_anomalies(records))
        return all_errors
