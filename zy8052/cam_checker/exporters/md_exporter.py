from datetime import datetime
from ..validators.rules_validator import ValidationResult


def export_risk_report(validation_result: ValidationResult, output_path: str):
    high_risks = [r for r in validation_result.risks if r.severity == "high"]
    medium_risks = [r for r in validation_result.risks if r.severity == "medium"]
    warnings = [r for r in validation_result.risks if r.severity == "warning"]

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# CAM 派单预检风险报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 摘要\n\n")
        f.write(f"- 有效病例数: {len(validation_result.merged_cases)}\n")
        f.write(f"- 高风险: {len(high_risks)}\n")
        f.write(f"- 中风险: {len(medium_risks)}\n")
        f.write(f"- 警告: {len(warnings)}\n")
        f.write(f"- 缺失文件: {len(validation_result.missing_files)}\n\n")

        if high_risks:
            f.write("## 🔴 高风险\n\n")
            for risk in high_risks:
                f.write(f"- **{risk.case_id}**")
                if risk.tooth_number:
                    f.write(f" (牙位: {risk.tooth_number})")
                f.write(f": {risk.message}\n")
            f.write("\n")

        if medium_risks:
            f.write("## 🟡 中风险\n\n")
            for risk in medium_risks:
                f.write(f"- **{risk.case_id}**")
                if risk.tooth_number:
                    f.write(f" (牙位: {risk.tooth_number})")
                f.write(f": {risk.message}\n")
            f.write("\n")

        if warnings:
            f.write("## 🟢 警告\n\n")
            for risk in warnings:
                f.write(f"- **{risk.case_id}**")
                if risk.tooth_number:
                    f.write(f" (牙位: {risk.tooth_number})")
                f.write(f": {risk.message}\n")
            f.write("\n")

        f.write("## 病例清单\n\n")
        f.write("| 病例ID | 患者姓名 | 牙位数 | 诊所 |\n")
        f.write("|--------|----------|--------|------|\n")
        for case_id, case_data in validation_result.merged_cases.items():
            tooth_count = sum(len(rests) for rests in case_data["teeth"].values())
            f.write(f"| {case_id} | {case_data['patient_name']} | {tooth_count} | {case_data['clinic']} |\n")
