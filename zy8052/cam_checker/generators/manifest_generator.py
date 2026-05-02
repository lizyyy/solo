from typing import Dict, List
from ..validators.rules_validator import ValidationResult


def generate_manifest(validation_result: ValidationResult) -> Dict:
    manifest = {
        "version": "1.0.0",
        "generated_at": "",
        "total_cases": len(validation_result.merged_cases),
        "has_risks": len(validation_result.risks) > 0,
        "missing_files_count": len(validation_result.missing_files),
        "cases": []
    }

    for case_id, case_data in validation_result.merged_cases.items():
        case_manifest = {
            "case_id": case_id,
            "patient_name": case_data["patient_name"],
            "doctor": case_data["doctor"],
            "clinic": case_data["clinic"],
            "teeth": []
        }

        for tooth_num, restorations in case_data["teeth"].items():
            for rest in restorations:
                case_manifest["teeth"].append({
                    "tooth_number": tooth_num,
                    "restoration_type": rest["restoration_type"],
                    "material": rest["material"]
                })

        manifest["cases"].append(case_manifest)

    return manifest
