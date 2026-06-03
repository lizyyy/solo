from decimal import Decimal
from datetime import date
from models import ExposureRecord, Source
from engine import ExposureEngine


def build_demo_tail_adjust():
    return [
        ExposureRecord(
            business_no="BIZ20260601-001",
            bond_code="138567.SZ",
            bond_name="21深控01",
            face_value=Decimal("500000.00"),
            source=Source.TAIL_ADJUST,
            trade_date=date(2026, 6, 1),
        ),
        ExposureRecord(
            business_no="BIZ20260601-002",
            bond_code="188923.SH",
            bond_name="22锡交01",
            face_value=Decimal("1000125.00"),
            fee_line=Decimal("125.00"),
            principal_line=Decimal("1000000.00"),
            source=Source.TAIL_ADJUST,
            trade_date=date(2026, 6, 1),
        ),
    ]


def build_demo_custody():
    return [
        ExposureRecord(
            business_no="BIZ20260601-001",
            bond_code="138567.SZ",
            bond_name="21深控01",
            face_value=Decimal("500000.00"),
            source=Source.CUSTODY_CONFIRM,
            trade_date=date(2026, 6, 1),
        ),
        ExposureRecord(
            business_no="BIZ20260601-002",
            bond_code="188923.SH",
            bond_name="22锡交01",
            face_value=Decimal("1000125.00"),
            source=Source.CUSTODY_CONFIRM,
            trade_date=date(2026, 6, 1),
        ),
        ExposureRecord(
            business_no="BIZ20260520-003",
            bond_code="102183.SH",
            bond_name="20蓉轨01",
            face_value=Decimal("800000.00"),
            source=Source.CUSTODY_CONFIRM,
            trade_date=date(2026, 5, 20),
        ),
    ]


def run_normal():
    print("\n" + "█" * 60)
    print("▎ 正常材料跑一遍 — 林姐和结算主管的日常交接")
    print("█" * 60)

    eng = ExposureEngine()

    tail_records = build_demo_tail_adjust()
    eng.import_tail_adjust(tail_records, operator="林姐")

    custody_records = build_demo_custody()
    eng.check_custody_confirm(custody_records, operator="林姐")

    eng.update_diff_list(operator="林姐")

    print("\n--- 拆行那条，结算主管先复核再重跑 ---")
    eng.review_split("BIZ20260601-002", passed=True, operator="结算主管")
    eng.rerun(operator="结算主管")

    eng.print_summary()
    eng.print_history()

    return eng


def run_wrong_caliber():
    print("\n" + "█" * 60)
    print("▎ 错口径材料跑一遍 — 尾差调整条和托管确认页面值对不上")
    print("█" * 60)

    eng = ExposureEngine()

    tail_records = build_demo_tail_adjust()
    tail_records[0] = ExposureRecord(
        business_no="BIZ20260601-001",
        bond_code="138567.SZ",
        bond_name="21深控01",
        face_value=Decimal("499500.00"),
        source=Source.TAIL_ADJUST,
        trade_date=date(2026, 6, 1),
    )
    tail_records[1] = ExposureRecord(
        business_no="BIZ20260601-002",
        bond_code="188923.SH",
        bond_name="22锡交01",
        face_value=Decimal("1000125.00"),
        fee_line=Decimal("125.00"),
        principal_line=Decimal("999000.00"),
        source=Source.TAIL_ADJUST,
        trade_date=date(2026, 6, 1),
    )
    eng.import_tail_adjust(tail_records, operator="林姐")

    custody_records = build_demo_custody()
    eng.check_custody_confirm(custody_records, operator="林姐")

    eng.update_diff_list(operator="林姐")

    print("\n--- 林姐对BIZ20260601-001做人工修正 ---")
    eng.manual_fix("BIZ20260601-001", Decimal("500000.00"), operator="林姐")

    eng.update_diff_list(operator="林姐")

    eng.rerun(operator="结算主管")

    eng.print_summary()
    eng.print_history()

    return eng


def run_supplement():
    print("\n" + "█" * 60)
    print("▎ 补录材料跑一遍 — 只有托管确认页，尾差调整条没有的旧口径")
    print("█" * 60)

    eng = ExposureEngine()

    custody_only = [
        ExposureRecord(
            business_no="BIZ20260520-003",
            bond_code="102183.SH",
            bond_name="20蓉轨01",
            face_value=Decimal("800000.00"),
            source=Source.CUSTODY_CONFIRM,
            trade_date=date(2026, 5, 20),
        ),
        ExposureRecord(
            business_no="BIZ20260515-004",
            bond_code="155612.SH",
            bond_name="19武信01",
            face_value=Decimal("300000.00"),
            source=Source.CUSTODY_CONFIRM,
            trade_date=date(2026, 5, 15),
        ),
    ]
    eng.check_custody_confirm(custody_only, operator="林姐")

    eng.update_diff_list(operator="林姐")

    eng.rerun(operator="结算主管")

    eng.print_summary()
    eng.print_history()

    return eng


if __name__ == "__main__":
    run_normal()
    run_wrong_caliber()
    run_supplement()

    print("\n" + "█" * 60)
    print("▎ 三种材料跑完。重点看：")
    print("▎  1. 正常材料里，拆行那条在结算主管复核之前不能自动归正常")
    print("▎  2. 错口径材料里，差异清单能抓出面值不一致和拆行合计不符")
    print("▎  3. 补录材料里，旧口径记录不会被漏掉，也不会自动匹配通过")
    print("▎  三条演示数据：001顺利、002拆行、003旧口径，处理结果各不同")
    print("█" * 60)
