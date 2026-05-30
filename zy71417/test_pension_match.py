from __future__ import annotations

import io
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pension_match.models import (
    ArrivalStatus,
    BadDataCategory,
    ProblemCategory,
)
from pension_match.parsers import parse_bujiao_dan, parse_can_bao_ren, parse_dan_wei_hui_kuan
from pension_match.matcher import run_match
from pension_match.reporter import (
    _categorize_results,
    print_report,
    write_csv_bad,
    write_csv_normal,
    write_csv_problems,
)


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def _open_data(filename: str):
    return open(os.path.join(DATA_DIR, filename), encoding="utf-8-sig")


def test_parse_bujiao_dan():
    with _open_data("补缴单.csv") as f:
        records, bad = parse_bujiao_dan("补缴单.csv", f)
    assert len(records) == 9, f"期望 9 条正常补缴单，实际 {len(records)}"
    assert len(bad) == 4, f"期望 4 条坏数据，实际 {len(bad)}"

    missing_name = [b for b in bad if b.category == BadDataCategory.MISSING_FIELD]
    assert len(missing_name) == 1
    assert "姓名" in missing_name[0].detail

    invalid_id = [b for b in bad if "身份证号格式错误" in b.detail]
    assert len(invalid_id) == 1
    assert "not_an_id" in invalid_id[0].raw_line

    invalid_amount = [b for b in bad if b.category == BadDataCategory.INVALID_AMOUNT]
    assert len(invalid_amount) == 1

    invalid_date = [b for b in bad if b.category == BadDataCategory.INVALID_DATE]
    assert len(invalid_date) == 1

    for r in bad:
        assert r.source_file == "补缴单.csv"
        assert r.source_line > 0


def test_parse_can_bao_ren():
    with _open_data("参保人.csv") as f:
        records, bad = parse_can_bao_ren("参保人.csv", f)
    assert len(records) == 10, f"期望 10 条参保人，实际 {len(records)}"
    assert len(bad) == 0


def test_parse_huikuan():
    with _open_data("单位汇款.csv") as f:
        records, bad = parse_dan_wei_hui_kuan("单位汇款.csv", f)
    assert len(records) == 6, f"期望 6 条汇款，实际 {len(records)}"
    assert len(bad) == 0

    has_no_arrival = [r for r in records if r.arrival_date is None]
    assert len(has_no_arrival) == 1


def test_match_late_arrival():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)

    late = [r for r in results if ProblemCategory.LATE_ARRIVAL in r.problems]
    assert len(late) > 0, "应检测到到账晚于申报的记录"

    for r in late:
        assert "天" in r.arrival_status_reason, f"到账晚于申报应说明晚了多少天: {r.arrival_status_reason}"
        assert r.arrival_status == ArrivalStatus.LATE


def test_match_duplicate_name():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)

    dup_name = [r for r in results if ProblemCategory.DUPLICATE_NAME in r.problems]
    assert len(dup_name) > 0, "应检测到人员重名"

    for r in dup_name:
        assert "同名" in r.person_match_reason or "重名" in r.person_match_reason


def test_match_duplicate_month():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)

    dup_month = [r for r in results if ProblemCategory.DUPLICATE_MONTH in r.problems]
    assert len(dup_month) > 0, "应检测到补缴月份重复"

    for r in dup_month:
        assert "重复" in r.month_validation_reason


def test_no_remittee():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)

    no_rem = [r for r in results if r.arrival_status == ArrivalStatus.NO_REMITTANCE]
    assert len(no_rem) > 0, "应检测到无对应汇款的记录"


def test_categorize_results():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)
    normal, problematic = _categorize_results(results)

    assert len(normal) + len(problematic) == len(results)
    for r in normal:
        assert not r.problems
    for r in problematic:
        assert r.problems


def test_report_output():
    with _open_data("补缴单.csv") as f:
        bujiao, bad_bujiao = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, bad_cbr = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, bad_hk = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    all_bad = bad_bujiao + bad_cbr + bad_hk
    results = run_match(bujiao, cbr, hk)

    buf = io.StringIO()
    print_report(results, all_bad, out=buf)
    text = buf.getvalue()

    assert "正常记录" in text
    assert "问题记录" in text
    assert "坏数据" in text
    assert "到账晚于申报" in text
    assert "人员重名" in text
    assert "补缴月份重复" in text


def test_csv_outputs():
    with _open_data("补缴单.csv") as f:
        bujiao, bad_bujiao = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, bad_cbr = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, bad_hk = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    all_bad = bad_bujiao + bad_cbr + bad_hk
    results = run_match(bujiao, cbr, hk)

    with tempfile.TemporaryDirectory() as tmpdir:
        normal_path = os.path.join(tmpdir, "正常记录.csv")
        problems_path = os.path.join(tmpdir, "问题记录.csv")
        bad_path = os.path.join(tmpdir, "坏数据.csv")

        write_csv_normal(results, normal_path)
        write_csv_problems(results, problems_path)
        write_csv_bad(all_bad, bad_path)

        assert os.path.isfile(normal_path)
        assert os.path.isfile(problems_path)
        assert os.path.isfile(bad_path)

        with open(normal_path, encoding="utf-8-sig") as f:
            lines = f.readlines()
        assert len(lines) >= 2

        with open(problems_path, encoding="utf-8-sig") as f:
            lines = f.readlines()
        assert len(lines) >= 2
        assert "问题类型" in lines[0]

        with open(bad_path, encoding="utf-8-sig") as f:
            lines = f.readlines()
        assert len(lines) >= 2
        assert "错误类型" in lines[0]


def test_every_result_has_business_reasons():
    with _open_data("补缴单.csv") as f:
        bujiao, _ = parse_bujiao_dan("补缴单.csv", f)
    with _open_data("参保人.csv") as f:
        cbr, _ = parse_can_bao_ren("参保人.csv", f)
    with _open_data("单位汇款.csv") as f:
        hk, _ = parse_dan_wei_hui_kuan("单位汇款.csv", f)

    results = run_match(bujiao, cbr, hk)
    for r in results:
        assert r.person_match_reason, f"单号 {r.bujiao_dan.dan_hao} 缺少人员匹配说明"
        assert r.month_validation_reason, f"单号 {r.bujiao_dan.dan_hao} 缺少月份校验说明"
        assert r.arrival_status_reason, f"单号 {r.bujiao_dan.dan_hao} 缺少到账状态说明"


if __name__ == "__main__":
    test_parse_bujiao_dan()
    print("✓ test_parse_bujiao_dan")

    test_parse_can_bao_ren()
    print("✓ test_parse_can_bao_ren")

    test_parse_huikuan()
    print("✓ test_parse_huikuan")

    test_match_late_arrival()
    print("✓ test_match_late_arrival")

    test_match_duplicate_name()
    print("✓ test_match_duplicate_name")

    test_match_duplicate_month()
    print("✓ test_match_duplicate_month")

    test_no_remittee()
    print("✓ test_no_remittee")

    test_categorize_results()
    print("✓ test_categorize_results")

    test_report_output()
    print("✓ test_report_output")

    test_csv_outputs()
    print("✓ test_csv_outputs")

    test_every_result_has_business_reasons()
    print("✓ test_every_result_has_business_reasons")

    print("\n全部测试通过！")
