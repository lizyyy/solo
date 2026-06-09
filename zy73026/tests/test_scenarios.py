#!/usr/bin/env python3
"""
集成测试脚本 —— 覆盖全部用户场景:
  T1. 重复导入温控提醒 → 不翻倍
  T2. 重复导入用药/照片 → 不覆盖、不翻倍
  T3. 人工备注重复导入 → 不覆盖、不翻倍
  T4. 用药剂量变更 → 提醒进入 PENDING_REVIEW，页面/报告可见原因
  T5. 疫苗照片分批次追加 → 早先判断不被无声覆盖
  T6. 结论修改 → 状态历史可追溯（阿岑当天改过的能翻到）
  T7. 疫苗-用药关系 → 能留存
  T8. CLI 帮助与 dirs 命令 → 项目经理不问材料放哪
"""
import sys
import os
import subprocess
from pathlib import Path
import json
import tempfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TEST_DB = ROOT / "data" / "test_alertdb.sqlite3"


def clean_env():
    if TEST_DB.exists():
        TEST_DB.unlink()
    os.environ["_TEST_DB_OVERRIDE"] = str(TEST_DB)


def run_cli(*args, expect_exit=None):
    """调用 CLI，返回 (exit_code, stdout, stderr)"""
    cmd = [sys.executable, "-m", "src.cli"] + list(args)
    # 通过环境变量注入测试用 DB（需要修改 database.py 才能生效，
    # 这里我们用直接调 importer 函数进行纯逻辑测试，CLI 层单独测 help）
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    p = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=ROOT)
    if expect_exit is not None and p.returncode != expect_exit:
        raise AssertionError(
            f"CLI {' '.join(args)} 期望 exit={expect_exit}，"
            f"实际 {p.returncode}\nstdout={p.stdout}\nstderr={p.stderr}")
    return p.returncode, p.stdout, p.stderr


# ---------- 逻辑层（importer）测试 ----------

def setup_test_db():
    """将测试期间的 DB 指向测试文件"""
    from src import database, config, importer
    # monkey-patch DB_PATH
    TEST_DB.parent.mkdir(parents=True, exist_ok=True)
    if TEST_DB.exists():
        TEST_DB.unlink()
    config.DB_PATH = TEST_DB
    database.DB_PATH = TEST_DB
    # 重新初始化
    import importlib
    importlib.reload(database)
    importlib.reload(importer)
    importer.init_db()


def T1_重复导入提醒不翻倍():
    setup_test_db()
    from src import importer
    r1 = importer.import_temp_alert("PET001", "SRC-A",
                                     "2026-06-09 10:00", 31.5)
    r2 = importer.import_temp_alert("PET001", "SRC-A",
                                     "2026-06-09 10:00", 31.5)
    assert r1["skipped"] is False, "首次导入不应被跳过"
    assert r2["skipped"] is True, "重复导入必须幂等跳过"
    assert r1["alert_id"] == r2["alert_id"], "重复导入应返回同一 alert_id"
    alerts = importer.list_alerts("PET001")
    assert len(alerts) == 1, f"重复导入后数量={len(alerts)}，应为 1"
    print("✅ T1 通过: 重复导入温控提醒不翻倍")


def T2_照片用药重复导入不覆盖():
    setup_test_db()
    from src import importer
    # 造一个临时照片
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"fake jpg")
        photo_file = f.name
    try:
        p1 = importer.import_vaccine_photo(
            "PET001", "PHOTO-SRC-1", photo_file,
            batch="2026W23", notes="第一针照片")
        p2 = importer.import_vaccine_photo(
            "PET001", "PHOTO-SRC-1", photo_file, batch="2026W23")
        assert p1["skipped"] is False
        assert p2["skipped"] is True
        assert p1["photo_id"] == p2["photo_id"]

        m1 = importer.import_medication(
            "PET001", "MED-SRC-1", "阿莫西林",
            dosage="10mg/次", frequency="每日两次")
        m2 = importer.import_medication(
            "PET001", "MED-SRC-1", "阿莫西林",
            dosage="10mg/次", frequency="每日两次")
        assert m1["skipped"] is False
        assert m2["skipped"] is True
    finally:
        Path(photo_file).unlink(missing_ok=True)
    print("✅ T2 通过: 照片/用药重复导入不覆盖、不翻倍")


def T3_备注重复导入不覆盖():
    setup_test_db()
    from src import importer
    importer.ensure_pet("PET001")
    r = importer.import_temp_alert("PET001", "SRC-B",
                                   "2026-06-09 11:00", 32.0)
    aid = r["alert_id"]
    # 第一次（带 source_note_id）
    n1 = importer.add_alert_note(
        aid, "主人说早上喂过食了",
        author="岑", source_note_id="NOTE-SRC-1")
    # 重复导入同样的 source
    n2 = importer.add_alert_note(
        aid, "主人说早上喂过食了（会重复？）",
        author="岑", source_note_id="NOTE-SRC-1")
    # 另一条不同的
    n3 = importer.add_alert_note(
        aid, "13:00 复测温度降至 28.5",
        author="岑", source_note_id="NOTE-SRC-2")
    assert n1["skipped"] is False
    assert n2["skipped"] is True, "同来源备注必须跳过"
    assert n3["skipped"] is False
    notes = importer.get_alert_notes(aid)
    assert len(notes) == 2, f"备注数量={len(notes)}，应为 2"
    # 内容必须是第一次的，不能被第二次覆盖
    assert notes[0]["note_content"] == "主人说早上喂过食了"
    print("✅ T3 通过: 人工备注不被覆盖、不翻倍")


def T4_剂量变更触发待复核_原因可见():
    setup_test_db()
    from src import importer
    importer.ensure_pet("PET001")
    # 先建提醒（PENDING）
    r = importer.import_temp_alert("PET001", "SRC-C",
                                   "2026-06-09 09:00", 31.2)
    aid = r["alert_id"]
    # 第一次导用药
    importer.import_medication(
        "PET001", "MED-D", "布洛芬",
        dosage="5mg/次", frequency="每日一次")
    # 再次确认提醒还是 PENDING（第一次导入不影响）
    alerts = importer.list_alerts("PET001")
    assert alerts[0]["status"] == "PENDING", alerts[0]["status"]
    # 现在改剂量 → 触发 E005
    m = importer.import_medication(
        "PET001", "MED-D", "布洛芬",
        dosage="15mg/次", frequency="每日一次")
    assert m["updated"] is True
    assert m["reason"].startswith("[E005]")
    # 提醒自动进入 PENDING_REVIEW
    alerts = importer.list_alerts("PET001")
    assert alerts[0]["status"] == "PENDING_REVIEW", alerts[0]["status"]
    # 原因要能看到
    reason = importer.get_pending_review_reason(aid)
    assert reason and "剂量变更" in reason, f"原因={reason}"
    assert "5mg/次" in reason and "15mg/次" in reason, f"原因={reason}"
    print("✅ T4 通过: 用药剂量变更 → 待确认状态 + 可见原因")


def T5_疫苗照片分批次追加不覆盖早先判断():
    setup_test_db()
    from src import importer
    importer.ensure_pet("PET001")
    r = importer.import_temp_alert("PET001", "SRC-E",
                                   "2026-06-09 08:00", 30.8)
    aid = r["alert_id"]
    # 阿岑先给出 CONFIRMED 结论
    importer.update_alert_status(
        aid, "CONFIRMED", reason="初判由环境过热引起",
        author="岑", conclusion="降温处理观察")
    # 第一次导入疫苗照片（batch1）
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"photo1"); p1 = f.name
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"photo2"); p2 = f.name
    try:
        pr1 = importer.import_vaccine_photo(
            "PET001", "P-B1", p1, batch="batch1", notes="3月前的疫苗")
        pr2 = importer.import_vaccine_photo(
            "PET001", "P-B2", p2, batch="batch2", notes="上周补打的")
        assert not pr1["skipped"] and not pr2["skipped"]
    finally:
        Path(p1).unlink(); Path(p2).unlink()
    # 早先判断（状态=CONFIRMED，结论=降温处理观察）必须仍在
    alerts = importer.list_alerts("PET001")
    assert alerts[0]["status"] == "CONFIRMED", (
        f"补材料后状态被改成了 {alerts[0]['status']}！早先判断不应被覆盖")
    assert alerts[0]["conclusion"] == "降温处理观察", (
        f"早先结论被覆盖为: {alerts[0]['conclusion']}")
    print("✅ T5 通过: 分批次补材料无声覆盖保护 —— 早先判断保留")


def T6_结论修改历史可追溯():
    setup_test_db()
    from src import importer
    importer.ensure_pet("PET001")
    r = importer.import_temp_alert("PET001", "SRC-F",
                                   "2026-06-09 07:00", 30.5)
    aid = r["alert_id"]
    # 阿岑当天改两次
    importer.update_alert_status(
        aid, "CONFIRMED", reason="现场复核温度 31.2°C",
        author="岑", conclusion="温控器故障已更换")
    importer.update_alert_status(
        aid, "RESOLVED", reason="2h后复测 26.8°C，稳定",
        author="岑", conclusion="已恢复正常")
    hist = importer.get_alert_history(aid)
    # 应至少 3 条: PENDING(创建)→PENDING→CONFIRMED→RESOLVED
    assert len(hist) >= 3, f"历史数量={len(hist)}"
    # 按时间正序，最后两条作者应该都是岑
    authors = [h["author"] for h in hist]
    assert authors[-1] == "岑" and authors[-2] == "岑", authors
    # 原因字段必须完整
    reasons = {h["new_status"]: h.get("reason") or "" for h in hist}
    assert "现场复核" in reasons["CONFIRMED"], reasons
    assert "2h后复测" in reasons["RESOLVED"], reasons
    print("✅ T6 通过: 阿岑当天改过的结论能在历史里翻到")


def T7_疫苗用药关系留存():
    setup_test_db()
    from src import importer
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"img"); p = f.name
    try:
        pr = importer.import_vaccine_photo(
            "PET001", "P-G", p, batch="b1")
        mr = importer.import_medication(
            "PET001", "M-G", "多维电解质", "1ml/次")
        importer.link_vaccine_medication(
            photo_id=pr["photo_id"], med_id=mr["med_id"],
            pet_id="PET001", relation_type="疫苗后需补电解质")
        # 再 link 一次（UNIQUE 保护）
        importer.link_vaccine_medication(
            photo_id=pr["photo_id"], med_id=mr["med_id"],
            pet_id="PET001", relation_type="疫苗后需补电解质")
    finally:
        Path(p).unlink()
    rels = importer.get_vaccine_medication_relations("PET001")
    assert len(rels) == 1, f"关联数量={len(rels)}，应为 1"
    assert rels[0]["med_name"] == "多维电解质"
    assert rels[0]["relation_type"] == "疫苗后需补电解质"
    print("✅ T7 通过: 疫苗-用药关系留存 + 重复关联不翻倍")


def T8_CLI帮助与dirs命令():
    """项目经理一看就知道材料放哪，参数名稳定"""
    # 测 help
    code, out, err = run_cli("--help")
    assert code == 0
    assert "异宠温控异常提醒" in out
    for cmd in ["photo-import", "med-import", "alert-import",
                "alert-status", "alert-note", "list", "report",
                "dirs", "web"]:
        assert cmd in out, f"help 中缺少 {cmd}"

    # 测各子命令参数名是否在 help 中
    code, out, _ = run_cli("photo-import", "--help")
    assert code == 0
    for pn in ["--pet-id", "--photo-source-id", "--photo-path",
               "--photo-batch"]:
        assert pn in out, f"photo-import help 缺少 {pn}"

    code, out, _ = run_cli("alert-note", "--help")
    for pn in ["--alert-id", "--note", "--author", "--source-note-id"]:
        assert pn in out

    # 测 dirs 命令
    code, out, _ = run_cli("dirs")
    assert code == 0
    for key in ["疫苗本照片归档目录", "报告输出目录", "数据库文件"]:
        assert key in out, f"dirs 输出缺少 {key}"

    # 测稳定错误码：缺少参数时
    code, out, stderr = run_cli("alert-import")
    assert code != 0  # click 缺参数会非 0 退出
    # 缺 pet-id
    print("✅ T8 通过: CLI 帮助/参数名/dirs 命令完备，项目经理不问材料放哪")


def T9_CLI_错误码稳定性_缺失参数():
    """验证参数缺失时 E001 出现"""
    # alert-note 缺少 note 参数 —— 从 importer 层验证更直接
    setup_test_db()
    from src import importer
    importer.ensure_pet("PET001")
    r = importer.import_temp_alert("PET001", "SRC-H",
                                   "2026-06-09 12:00", 30.1)
    try:
        importer.add_alert_note(r["alert_id"], "", author="岑")
    except ValueError as e:
        assert "E001" in str(e), f"缺少参数未返回E001: {e}"
    else:
        raise AssertionError("空备注应该抛 E001")
    print("✅ T9 通过: 稳定错误码 —— 参数缺失 → E001")


def T10_Web报告渲染():
    setup_test_db()
    from src import importer
    # 造数据：一个 PENDING_REVIEW 的提醒
    importer.ensure_pet("PET001", "小绿", "变色龙")
    r = importer.import_temp_alert("PET001", "SRC-W",
                                   "2026-06-09 08:30", 31.8)
    importer.add_alert_note(r["alert_id"], "观察一下",
                            author="岑", source_note_id="WN1")
    importer.import_medication(
        "PET001", "MED-W", "钙粉", "1g/次", "每日一次")
    importer.import_medication(
        "PET001", "MED-W", "钙粉", "3g/次", "每日一次")  # 剂量改 → PENDING_REVIEW
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(b"x"); p = f.name
    try:
        pr = importer.import_vaccine_photo(
            "PET001", "P-W", p, batch="2026-06")
        importer.link_vaccine_medication(
            photo_id=pr["photo_id"], med_id=None, pet_id="PET001")
    finally:
        Path(p).unlink()

    from src import webapp
    html = webapp.render_report(pet_id="PET001")
    for must in ["小绿", "变色龙", "PENDING_REVIEW",
                 "剂量变更", "钙粉", "观察一下",
                 "疫苗本照片 ↔ 用药记录 关联关系",
                 "状态变更历史", "人工备注"]:
        assert must in html, f"报告缺失: {must}"
    print("✅ T10 通过: Web/HTML 报告渲染正确，待确认原因与历史均可见")


def main():
    print("=" * 60)
    print("🧪 异宠温控异常提醒 —— 集成测试套件")
    print("=" * 60)
    all_tests = [
        T1_重复导入提醒不翻倍,
        T2_照片用药重复导入不覆盖,
        T3_备注重复导入不覆盖,
        T4_剂量变更触发待复核_原因可见,
        T5_疫苗照片分批次追加不覆盖早先判断,
        T6_结论修改历史可追溯,
        T7_疫苗用药关系留存,
        T8_CLI帮助与dirs命令,
        T9_CLI_错误码稳定性_缺失参数,
        T10_Web报告渲染,
    ]
    failed = 0
    for t in all_tests:
        try:
            t()
        except Exception as e:
            failed += 1
            print(f"❌ {t.__name__} 失败: {e}")
            import traceback; traceback.print_exc()
    print("=" * 60)
    if failed:
        print(f"💥 共 {len(all_tests)} 项，失败 {failed} 项")
        sys.exit(1)
    else:
        print(f"🎉 全部 {len(all_tests)} 项通过")


if __name__ == "__main__":
    main()
