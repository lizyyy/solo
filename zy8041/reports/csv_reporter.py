import csv
from typing import List


def render_errors_csv(validation_results: List, output_path: str):
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "recipe_id",
            "error_type",
            "field",
            "expected",
            "actual",
            "message"
        ])

        for result in validation_results:
            for err in result.errors:
                writer.writerow([
                    result.recipe_id,
                    err.get("type", ""),
                    err.get("field", ""),
                    err.get("expected", ""),
                    err.get("actual", ""),
                    err.get("message", "")
                ])