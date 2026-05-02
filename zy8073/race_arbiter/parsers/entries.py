import csv
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Entry:
    bib: str
    name: str
    category: str
    chip_id: str


def parse_entries_csv(file_path: str) -> Dict[str, Entry]:
    entries = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry = Entry(
                bib=row['bib'],
                name=row['name'],
                category=row['category'],
                chip_id=row['chip_id']
            )
            entries[entry.bib] = entry
    return entries
