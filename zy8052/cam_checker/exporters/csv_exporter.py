import csv
from typing import List, Dict


def export_missing_files(missing_files: List[Dict], output_path: str):
    if not missing_files:
        with open(output_path, "w", encoding="utf-8-sig") as f:
            f.write("case_id,tooth_number,patient_name,restoration_type,material\n")
        return

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        fieldnames = ["case_id", "tooth_number", "patient_name", "restoration_type", "material"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in missing_files:
            writer.writerow(item)
