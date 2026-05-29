import os
import csv
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Iterator, Optional
import pandas as pd

from ..core.models import CloudProvider, BillRecord
from ..core.config import Config
from ..utils.validators import validate_bill_record
from ..utils.security import get_masked_logger


class BillParser(ABC):
    provider: CloudProvider
    config: Config

    def __init__(self, config: Config):
        self.config = config
        self.logger = get_masked_logger(config, f"parser.{self.provider.value}")

    @abstractmethod
    def detect(self, filepath: str) -> bool:
        pass

    @abstractmethod
    def _extract_tags(self, row: Dict[str, Any]) -> Dict[str, str]:
        pass

    @abstractmethod
    def _detect_ri_credit(self, row: Dict[str, Any]) -> bool:
        pass

    def parse(self, filepath: str) -> List[BillRecord]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Bill file not found: {filepath}")

        self.logger.info(f"Parsing {self.provider.value} bill: {filepath}")
        records: List[BillRecord] = []

        _, ext = os.path.splitext(filepath)
        ext = ext.lower()

        if ext == ".csv":
            records = self._parse_csv(filepath)
        elif ext in [".xlsx", ".xls"]:
            records = self._parse_excel(filepath)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        self.logger.info(f"Parsed {len(records)} records from {filepath}")
        return records

    def _parse_csv(self, filepath: str) -> List[BillRecord]:
        records: List[BillRecord] = []
        with open(filepath, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                record = self._row_to_record(row, filepath, line_num)
                records.append(record)
        return records

    def _parse_excel(self, filepath: str) -> List[BillRecord]:
        records: List[BillRecord] = []
        df = pd.read_excel(filepath)
        for line_num, row in enumerate(df.to_dict("records"), start=2):
            record = self._row_to_record(row, filepath, line_num)
            records.append(record)
        return records

    def _row_to_record(
        self,
        row: Dict[str, Any],
        filepath: str,
        line_num: int,
    ) -> BillRecord:
        row_clean = {k: v for k, v in row.items() if v is not None}
        missing_fields, issues = validate_bill_record(
            row_clean,
            self.config.required_tags,
            self._get_tag_prefix(),
        )
        has_ri = self._detect_ri_credit(row_clean)
        return BillRecord(
            provider=self.provider,
            raw_data=row_clean,
            source_file=filepath,
            line_number=line_num,
            tag_issues=issues,
            has_ri_credit=has_ri,
        )

    def _get_tag_prefix(self) -> str:
        return "tag:"


def get_parser(
    filepath: str,
    config: Config,
    provider_hint: Optional[CloudProvider] = None,
) -> BillParser:
    from .aws import AWSParser
    from .aliyun import AliyunParser
    from .volcengine import VolcengineParser

    parsers = [
        AWSParser(config),
        AliyunParser(config),
        VolcengineParser(config),
    ]

    if provider_hint:
        for parser in parsers:
            if parser.provider == provider_hint:
                return parser

    for parser in parsers:
        if parser.detect(filepath):
            return parser

    raise ValueError(
        f"Could not determine cloud provider for file: {filepath}. "
        "Please specify provider with --provider option."
    )
