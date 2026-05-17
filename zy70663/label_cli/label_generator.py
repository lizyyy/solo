import hashlib
import re
from datetime import datetime
from typing import List, Dict
from .data_reader import LabelRecord


class LabelGenerator:
    LABEL_PREFIX = "WMS"
    LABEL_VERSION = "V2"

    def __init__(self):
        self.old_to_new: Dict[str, str] = {}
        self.new_to_old: Dict[str, str] = {}

    def generate_new_label(self, record: LabelRecord) -> str:
        if not record.is_valid:
            return ""

        key = f"{record.sku}-{record.location}-{record.batch or 'DEFAULT'}"
        hash_part = self._generate_hash(key)

        new_label = f"{self.LABEL_PREFIX}-{self.LABEL_VERSION}-{record.sku[:8]}-{hash_part[:8]}"

        if record.old_label in self.old_to_new:
            return self.old_to_new[record.old_label]

        self.old_to_new[record.old_label] = new_label
        self.new_to_old[new_label] = record.old_label

        return new_label

    def _generate_hash(self, key: str) -> str:
        hash_obj = hashlib.md5(key.encode('utf-8'))
        return hash_obj.hexdigest().upper()

    def generate_labels_batch(self, records: List[LabelRecord]) -> List[LabelRecord]:
        for record in records:
            if record.is_valid:
                record.new_label = self.generate_new_label(record)
        return records

    def get_mapping(self) -> Dict[str, str]:
        return self.old_to_new.copy()

    def get_reverse_mapping(self) -> Dict[str, str]:
        return self.new_to_old.copy()

    def validate_label_format(self, label: str) -> bool:
        pattern = r"^WMS-V2-[A-Z0-9-]{1,8}-[A-F0-9]{8}$"
        return bool(re.match(pattern, label))
