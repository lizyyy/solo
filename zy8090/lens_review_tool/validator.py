def validate_order(order, duplicate_scan_times=None):
    issues = []
    prescription = order.get('prescription', {})
    scan = order.get('scan', {})
    tolerance = order.get('tolerance', {})

    if duplicate_scan_times is None:
        duplicate_scan_times = []

    warnings = []
    if prescription and scan:
        if prescription.get('right_sph') is not None and scan.get('right_sph') is not None:
            diff = abs(prescription['right_sph'] - scan['right_sph'])
            if diff > tolerance.get('sph_tolerance', 0.25):
                issues.append(f"右眼球镜偏差{diff:.2f}超过公差{tolerance.get('sph_tolerance', 0.25)}")

        if prescription.get('right_cyl') is not None and scan.get('right_cyl') is not None:
            diff = abs(prescription['right_cyl'] - scan['right_cyl'])
            if diff > tolerance.get('cyl_tolerance', 0.25):
                issues.append(f"右眼柱镜偏差{diff:.2f}超过公差{tolerance.get('cyl_tolerance', 0.25)}")

        if prescription.get('right_axis') is not None and scan.get('right_axis') is not None:
            diff = abs(prescription['right_axis'] - scan['right_axis'])
            if diff > tolerance.get('axis_tolerance', 5):
                issues.append(f"右眼散光轴位偏差{diff}超过公差{tolerance.get('axis_tolerance', 5)}")

        if prescription.get('left_sph') is not None and scan.get('left_sph') is not None:
            diff = abs(prescription['left_sph'] - scan['left_sph'])
            if diff > tolerance.get('sph_tolerance', 0.25):
                issues.append(f"左眼球镜偏差{diff:.2f}超过公差{tolerance.get('sph_tolerance', 0.25)}")

        if prescription.get('left_cyl') is not None and scan.get('left_cyl') is not None:
            diff = abs(prescription['left_cyl'] - scan['left_cyl'])
            if diff > tolerance.get('cyl_tolerance', 0.25):
                issues.append(f"左眼柱镜偏差{diff:.2f}超过公差{tolerance.get('cyl_tolerance', 0.25)}")

        if prescription.get('left_axis') is not None and scan.get('left_axis') is not None:
            diff = abs(prescription['left_axis'] - scan['left_axis'])
            if diff > tolerance.get('axis_tolerance', 5):
                issues.append(f"左眼散光轴位偏差{diff}超过公差{tolerance.get('axis_tolerance', 5)}")

        if prescription.get('pupil_distance') is not None and scan.get('pupil_distance') is not None:
            diff = abs(prescription['pupil_distance'] - scan['pupil_distance'])
            if diff > tolerance.get('pd_tolerance', 2):
                issues.append(f"瞳距偏差{diff:.1f}超过公差{tolerance.get('pd_tolerance', 2)}")

    if prescription:
        if prescription.get('right_sph') is None and prescription.get('right_cyl') is None and prescription.get('right_axis') is None:
            issues.append("右眼字段缺失（SPH/CYL/AXIS均为空）")
        if prescription.get('left_sph') is None and prescription.get('left_cyl') is None and prescription.get('left_axis') is None:
            issues.append("左眼字段缺失（SPH/CYL/AXIS均为空）")

    if duplicate_scan_times:
        warnings.append(f"重复扫码{len(duplicate_scan_times)}次")

    if scan and not scan.get('final_inspection', False):
        issues.append("缺少终检记录")

    if prescription and scan and not scan.get('inspection_passed', False):
        issues.append("加工检验未通过")

    all_issues = issues + warnings
    if issues:
        return "需返工", all_issues
    if warnings:
        return "待复核", all_issues
    return "可交付", all_issues

def suggest_status(order, duplicate_scan_times=None):
    status, issues = validate_order(order, duplicate_scan_times)
    if status == "需返工" and not issues:
        return "可交付"
    return status