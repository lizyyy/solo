import json
from tour_meal_allowance import TourMealAllowanceChecker, STANDARD_COLUMNS, normalize_column_name

def test_csv_import():
    c = TourMealAllowanceChecker()
    r = c.add_source("合唱团巡演餐补台账_CSV.csv")
    assert r["file_type"] == "csv", f"Expected csv, got {r['file_type']}"
    assert r["row_count"] == 10, f"Expected 10 rows, got {r['row_count']}"
    assert len(r["unmapped"]) == 0, f"Unmapped columns: {r['unmapped']}"
    mapped_to = list(r["mapped"].values())
    for std in STANDARD_COLUMNS:
        assert std in mapped_to, f"Missing standard column: {std}"
    print("PASS: CSV import with auto column mapping")

def test_excel_import():
    c = TourMealAllowanceChecker()
    r = c.add_source("合唱团巡演曲目表.xlsx")
    assert r["file_type"] == "excel"
    assert r["row_count"] == 13
    print("PASS: Excel import")

def test_multi_source():
    c = TourMealAllowanceChecker()
    c.add_source("合唱团巡演餐补台账_CSV.csv")
    c.add_source("合唱团巡演曲目表.xlsx")
    assert len(c.df) == 23, f"Expected 23, got {len(c.df)}"
    csv_rows = c.df[c.df["_来源文件"] == "合唱团巡演餐补台账_CSV.csv"]
    xlsx_rows = c.df[c.df["_来源文件"] == "合唱团巡演曲目表.xlsx"]
    assert len(csv_rows) == 10
    assert len(xlsx_rows) == 13
    print("PASS: Multi-source merge")

def test_column_normalization():
    assert normalize_column_name("track_id") == "曲目编号"
    assert normalize_column_name("venue") == "演出地点"
    assert normalize_column_name("meal_allowance") == "餐补标准"
    assert normalize_column_name("曲目编号") == "曲目编号"
    print("PASS: Column name normalization")

def test_source_row_preservation():
    c = TourMealAllowanceChecker()
    c.add_source("合唱团巡演餐补台账_CSV.csv")
    assert c.df.iloc[0]["_来源行号"] == 2
    assert c.df.iloc[9]["_来源行号"] == 11
    assert c.df.iloc[0]["_来源文件"] == "合唱团巡演餐补台账_CSV.csv"
    print("PASS: Source row preservation")

def test_annotation_and_supplement():
    c = TourMealAllowanceChecker()
    c.add_source("合唱团巡演餐补台账_CSV.csv")
    c.set_annotation(0, "test_annotation")
    assert c.df.iloc[0]["_标注"] == "test_annotation"
    c.supplement_field(5, "参演人数", "45")
    assert c.df.iloc[5]["参演人数"] == "45"
    assert "补录" in c.df.iloc[5]["_标注"]
    print("PASS: Annotation and supplement")

def test_check_flow():
    c = TourMealAllowanceChecker()
    c.add_source("合唱团巡演餐补台账_CSV.csv")
    c.add_source("合唱团巡演曲目表.xlsx")
    ok = c.run_all_checks()
    assert ok
    s = c.get_summary()
    assert s["总记录数"] == 23
    assert s["问题总数"] > 0
    assert s["顺利记录数"] > 0
    print(f"PASS: Check flow (issues={s['问题总数']}, smooth={s['顺利记录数']})")

def test_cli_csv_mode():
    c = TourMealAllowanceChecker(excel_path="合唱团巡演餐补台账_CSV.csv")
    ok = c.run_all_checks()
    assert ok
    assert len(c.df) == 10
    print("PASS: CLI CSV mode")

def test_cli_excel_mode():
    c = TourMealAllowanceChecker(excel_path="合唱团巡演曲目表.xlsx")
    ok = c.run_all_checks()
    assert ok
    assert len(c.df) == 13
    print("PASS: CLI Excel mode")

def test_export():
    c = TourMealAllowanceChecker()
    c.add_source("合唱团巡演餐补台账_CSV.csv")
    c.run_all_checks()
    result = c.export_meal_allowance_list("/tmp/test_meal_export.xlsx")
    assert "已导出" in result
    print("PASS: Export")

if __name__ == "__main__":
    test_column_normalization()
    test_csv_import()
    test_excel_import()
    test_multi_source()
    test_source_row_preservation()
    test_annotation_and_supplement()
    test_check_flow()
    test_cli_csv_mode()
    test_cli_excel_mode()
    test_export()
    print("\n=== ALL TESTS PASSED ===")
