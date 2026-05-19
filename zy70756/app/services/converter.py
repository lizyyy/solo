import hashlib
import csv
import json
import re
import os
from typing import Dict, List, Any, Tuple, Optional
from io import StringIO
import chardet
from datetime import datetime


def detect_encoding(file_content: bytes) -> Tuple[str, float]:
    result = chardet.detect(file_content)
    return result['encoding'], result['confidence']


def normalize_column_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s-]+', '_', name)
    name = name.lower()
    return name


def compute_file_hash(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()


def parse_csv_with_encoding(
    file_content: bytes,
    encoding: str,
    null_values: Optional[Dict[str, List[str]]] = None
) -> Tuple[List[str], List[Dict[str, Any]], List[Tuple[int, str, str]]]:
    if null_values is None:
        null_values = {}

    try:
        content = file_content.decode(encoding)
    except UnicodeDecodeError:
        content = file_content.decode('utf-8', errors='replace')

    reader = csv.reader(StringIO(content))
    headers = next(reader)
    normalized_headers = [normalize_column_name(h) for h in headers]

    rows = []
    bad_rows = []

    for row_num, row in enumerate(reader, start=2):
        try:
            if len(row) != len(headers):
                bad_rows.append((
                    row_num,
                    ','.join(row),
                    f'Column count mismatch: expected {len(headers)}, got {len(row)}'
                ))
                continue

            row_dict = {}
            for i, (header, norm_header) in enumerate(zip(headers, normalized_headers)):
                value = row[i].strip()
                col_nulls = null_values.get(norm_header, ['', 'NA', 'N/A', 'null', 'NULL'])
                if value in col_nulls:
                    row_dict[norm_header] = None
                else:
                    row_dict[norm_header] = value

            rows.append(row_dict)
        except Exception as e:
            bad_rows.append((
                row_num,
                ','.join(row) if isinstance(row, list) else str(row),
                str(e)
            ))

    return normalized_headers, rows, bad_rows


def convert_to_ndjson(rows: List[Dict[str, Any]], output_path: str) -> int:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    count = 0
    with open(output_path, 'w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
            count += 1

    return count


def get_default_null_rules() -> Dict[str, List[str]]:
    return {
        "*": ["", "NA", "N/A", "null", "NULL", "NaN", "nan", "-"]
    }
