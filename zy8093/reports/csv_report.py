import csv
from typing import List


def generate_issues_csv(issues: List[dict], output_path: str) -> None:
    fieldnames = ["issue_type", "severity", "image_id", "annotation_id", "category_id", "message"]
    
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for issue in issues:
            row = {
                "issue_type": issue.get("issue_type", ""),
                "severity": issue.get("severity", ""),
                "image_id": issue.get("image_id", ""),
                "annotation_id": issue.get("annotation_id", ""),
                "category_id": issue.get("category_id", ""),
                "message": issue.get("message", "")
            }
            writer.writerow(row)