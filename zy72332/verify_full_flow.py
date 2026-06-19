#!/usr/bin/env python3
"""端到端验证脚本 - 覆盖国贸商城店完整链路

检查点：
  0. 语法检查（9个源文件）
  1. 初始化 demo - 3条记录，国贸商城店 = 待运营复核
  2. list / summary / show 视图一致性
  3. 导出报告（待复核状态）- JSON + SH + assets/PNG
  4. 待复核状态下 run-grouping 被阻止
     静态检查 PENDING 状态 SH：REC_ID 单行创建、review-duplicate 注释示例、无硬编码ID
  5. 原数据上：运营复核 + 分群 → 状态/分群/误差说明/reviewed_by 一致
  6. 复核后再次导出 → JSON/SH/summary_report 全部引用同一条最新记录
  7. 干净目录下按复核后 SH 完整重放
     - bash -n 通过
     - bash 执行返回0，最后一行输出 REC_ID
     - 干净目录只有 1 条记录，record_id / store / status / group 全正确
     - 重新 export，再生成的报告里 asset、record_id 也是新 REC_ID
  8. 三里屯店：补录批注 → 人工修正 → 重跑 → 误差说明历史齐全
  9. 望京店：顺利记录完整性检查
"""
import sys
import os
import subprocess
import shutil
import json
import tempfile
import re
import hashlib

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
os.chdir(WORKSPACE)

PY = sys.executable
CLI = [PY, "cli.py"]
_checked_ok = 0
_checked_fail = 0


def run(cmd, capture=True, env=None, cwd=None, **kw):
    if cwd is None:
        cwd = WORKSPACE
    print(f"\n$ (cwd={os.path.basename(cwd)}) {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    if isinstance(cmd, str):
        r = subprocess.run(cmd, shell=True, capture_output=capture, text=True,
                           env=merged_env, cwd=cwd, **kw)
    else:
        r = subprocess.run(cmd, capture_output=capture, text=True,
                           env=merged_env, cwd=cwd, **kw)
    if r.stdout:
        head = "\n".join(r.stdout.strip().split("\n")[:25])
        print("  " + head.replace("\n", "\n  "))
        tot = len(r.stdout.strip().split("\n"))
        if tot > 25:
            print(f"  ... ({tot} lines total)")
    if r.returncode != 0 and r.stderr:
        print(f"  STDERR tail: {r.stderr[-500:]}")
    return r


def check(name, actual, expected=None, pred=None):
    global _checked_ok, _checked_fail
    if pred is not None:
        ok = pred(actual)
    elif expected is not None:
        ok = actual == expected
    else:
        ok = bool(actual)
    if ok:
        _checked_ok += 1
        print(f"  ✔  {name}")
        return True
    else:
        _checked_fail += 1
        msg = f"  ❌ {name}"
        if expected is not None:
            msg += f" (实际={actual!r}, 期望={expected!r})"
        else:
            msg += f" (实际={actual!r})"
        print(msg)
        return False


def main():
    # ============== 0. 语法检查 ==============
    print("\n" + "=" * 70)
    print("[0/9] 安装 - 语法检查")
    print("=" * 70)
    for f in ["models.py", "store.py", "importer.py", "annotation.py",
              "grouping.py", "auditor.py", "demo_data.py", "cli.py", "run_demo.py"]:
        r = subprocess.run([PY, "-m", "py_compile", f], capture_output=True, text=True)
        check(f"{f} 语法", r.returncode, 0)

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("audit_reports"):
        shutil.rmtree("audit_reports")

    # ============== 1. 初始化 demo ==============
    print("\n" + "=" * 70)
    print("[1/9] 初始化演示数据")
    print("=" * 70)
    r = run(CLI + ["init-demo"])
    check("init-demo 返回码", r.returncode, 0)

    from store import DataStore
    from models import ProcessingType, RecordStatus
    ds = DataStore("data")
    all_records = ds.get_all_records()
    check("共3条记录", len(all_records), 3)

    guomao = next(rr for rr in all_records if rr.processing_type == ProcessingType.DUPLICATE)
    wangjing = next(rr for rr in all_records if rr.processing_type == ProcessingType.SMOOTH)
    sanlitun = next(rr for rr in all_records if rr.processing_type == ProcessingType.OLD_STANDARD_SUPPLEMENT)
    print(f"  国贸商城店 record_id = {guomao.record_id}")
    check("国贸商城店 状态 待业务运营复核", guomao.status, RecordStatus.PENDING_REVIEW)
    check("国贸商城店 有2条学生答案", len(guomao.student_answers), 2)
    check("国贸商城店 2条答案都标记重复",
          all(a.is_duplicate for a in guomao.student_answers), True)

    # ============== 2. list / summary / show 视图一致性 ==============
    print("\n" + "=" * 70)
    print("[2/9] list/summary/show 视图一致性（待运营复核状态）")
    print("=" * 70)

    r_list = run(CLI + ["list"])
    check("list 包含 '待业务运营复核'", "待业务运营复核" in r_list.stdout, True)
    check("list 包含 '国贸商城店'", "国贸商城店" in r_list.stdout, True)
    idx = r_list.stdout.find("国贸商城店")
    before = r_list.stdout[max(0, idx-40): idx]
    check("list 不把国贸商城店显示成 [正常]", "[正常]" not in before, True)

    r_summary = run(CLI + ["summary"])
    check("summary 含 '待业务运营复核'", "待业务运营复核" in r_summary.stdout, True)

    r_show = run(CLI + ["show", "--record-id", guomao.record_id])
    for kw in ["待业务运营复核", "⚠️", "原始说法", "处理原因", "下一步找谁",
               "review-duplicate --record-id", "可直接复制粘贴的重跑命令"]:
        check(f"show 含关键字 '{kw}'", kw in r_show.stdout, True)
    check("show 显示截图校验状态", "校验" in r_show.stdout and "hash" in r_show.stdout, True)
    check("show 显示截图处理原因", "业务运营晚上催结果" in r_show.stdout, True)

    check(f"截图 stored_path 真实存在",
          os.path.exists(guomao.screenshot_refs[0].stored_path or ""), True)
    stored = guomao.screenshot_refs[0].stored_path
    sz = os.path.getsize(stored)
    with open(stored, "rb") as fh:
        h = hashlib.sha256(fh.read()).hexdigest()
    check("截图 file_size 一致", guomao.screenshot_refs[0].file_size, sz)
    check("截图 file_hash 一致", guomao.screenshot_refs[0].file_hash, h)

    # ============== 3. 导出（待复核状态） ==============
    print("\n" + "=" * 70)
    print("[3/9] 导出报告（待运营复核状态）- JSON + SH + assets/PNG")
    print("=" * 70)
    r_exp = run(CLI + ["export-all"])
    check("export-all 返回码", r_exp.returncode, 0)

    audit_dir = "audit_reports"
    files = os.listdir(audit_dir)
    sh_file = [f for f in files if f.startswith("replay_国贸商城店_") and f.endswith(".sh")]
    json_file = [f for f in files if f.startswith(f"audit_{guomao.record_id}_") and f.endswith(".json")]
    assets_dir = os.path.join(audit_dir, "assets", guomao.record_id)
    check(f"重放脚本 replay_国贸商城店_*.sh 存在", len(sh_file) == 1, True)
    check(f"JSON audit_{guomao.record_id}_*.json 存在", len(json_file) == 1, True)
    check(f"assets/<记录ID>/ 目录存在", os.path.isdir(assets_dir), True)
    pngs = [f for f in os.listdir(assets_dir) if f.endswith(".png")]
    check(f"assets/ 下至少1个PNG", len(pngs) >= 1, True)
    copied_path = os.path.join(assets_dir, pngs[0])
    with open(copied_path, "rb") as fh:
        copied_hash = hashlib.sha256(fh.read()).hexdigest()
    check(f"复制的PNG hash 与 record.file_hash 一致", copied_hash, guomao.screenshot_refs[0].file_hash)

    with open(os.path.join(audit_dir, json_file[0]), encoding="utf-8") as fp:
        j = json.load(fp)
    check("JSON.record_summary.is_pending_review = true",
          j["record_summary"].get("is_pending_review"), True)
    check("JSON 含 pending_review_info", j.get("pending_review_info") is not None, True)
    check("pending_review_info 含 原始说法/处理原因/下一步找谁/可用命令",
          all(k in j["pending_review_info"]
              for k in ["原始说法", "处理原因", "下一步找谁", "可用命令"]), True)
    ss = j["screenshots"][0]
    for k in ["file_hash", "file_size", "stored_path", "validation_status",
              "processing_reason", "asset_copy_path"]:
        check(f"JSON.screenshots[0].{k} 存在且非空", bool(ss.get(k)), True)
    check("JSON.screenshots[0].validation_status = 校验通过", ss["validation_status"], "校验通过")

    rc = j["replay_commands"]
    check("JSON.replay_commands[0] = bash shebang", rc[0], "#!/usr/bin/env bash")
    # REC_ID 单行形式
    rec_line_ok = any(
        re.match(r'^\s*REC_ID=\$\(.*create.*--print-id\)\s*$', c) for c in rc
    )
    check("replay_commands 含 REC_ID 单行创建 (create+--print-id)", rec_line_ok, True)
    hardcoded = []
    for c in rc:
        if "--record-id" in c and guomao.record_id in c and not c.lstrip().startswith("#"):
            hardcoded.append(c)
    check(f"replay_commands 中非注释 --record-id 用 $REC_ID，不用 {guomao.record_id}",
          len(hardcoded), 0)
    check("replay_commands 没有依赖 data/records/*.json",
          all("data/records" not in c for c in rc), True)

    # ============== 4. 待复核阻止 + PENDING SH 静态检查 ==============
    print("\n" + "=" * 70)
    print("[4/9] 待运营复核状态下尝试分群 → 被阻止；PENDING SH 静态检查")
    print("=" * 70)
    r_blocked = run(CLI + ["run-grouping", "--record-id", guomao.record_id])
    check("分群被阻止 输出含 '被阻止'", "被阻止" in r_blocked.stdout, True)
    ds2 = DataStore("data")
    guomao2 = ds2.get_record(guomao.record_id)
    check("被阻止后 状态仍为 待业务运营复核", guomao2.status, RecordStatus.PENDING_REVIEW)
    check("被阻止后 final_group 仍然 None", guomao2.final_group is None, True)

    with open(os.path.join(audit_dir, sh_file[0]), encoding="utf-8") as fp:
        sh_lines = [ln.rstrip("\n") for ln in fp.readlines()]
    # 单行 REC_ID 创建
    has_rec_sh = any(re.match(r'^\s*REC_ID=\$\(.*create.*--print-id\)\s*$', l)
                     for l in sh_lines)
    check("PENDING SH REC_ID 单行创建正确", has_rec_sh, True)
    has_cmt_rev = any(l.lstrip().startswith("#") and "review-duplicate" in l for l in sh_lines)
    check("PENDING SH 含注释的 review-duplicate 示例", has_cmt_rev, True)
    no_hard = True
    for i, l in enumerate(sh_lines):
        if not l.lstrip().startswith("#") and "--record-id" in l and guomao.record_id in l:
            no_hard = False
            print(f"    [debug] 硬编码行#{i}: {l!r}")
    check(f"PENDING SH 非注释行不用固定 {guomao.record_id}", no_hard, True)
    # import-screenshot 附近要有 ASSET_DIR
    asset_ok = False
    for i, l in enumerate(sh_lines):
        if "import-screenshot" in l and not l.lstrip().startswith("#"):
            win = "\n".join(sh_lines[max(0, i-15): i+10])
            if "ASSET_DIR" in win:
                asset_ok = True
                break
    check("PENDING SH import-screenshot 引用 $ASSET_DIR", asset_ok, True)

    # ============== 5. 原数据上：运营复核 + 分群 ==============
    print("\n" + "=" * 70)
    print("[5/9] 原数据：运营复核国贸商城店 + 分群")
    print("=" * 70)
    approved = [a for a in guomao2.student_answers if a.version == 2][0]
    run(CLI + ["review-duplicate", "--record-id", guomao.record_id,
               "--approved-answer-id", approved.answer_id, "--reviewer", "张运营"])
    r_group = run(CLI + ["run-grouping", "--record-id", guomao.record_id])
    check("分群完成含 '类'", "类" in r_group.stdout, True)

    ds3 = DataStore("data")
    gm3 = ds3.get_record(guomao.record_id)
    check("复核后 status = 正常", gm3.status, RecordStatus.NORMAL)
    check("复核后 final_group 已赋值", bool(gm3.final_group), True)
    check("复核后 误差说明 含 '张运营'", "张运营" in gm3.error_explanation.current_text, True)
    gr = ds3.get_grouping_result(guomao.record_id)
    check("GroupingResult.reviewed_by = 张运营", gr.reviewed_by, "张运营")
    check("GroupingResult.status = 正常", gr.status, RecordStatus.NORMAL)
    check("GroupingResult.final_group == record.final_group",
          gr.final_group, gm3.final_group)
    check("GroupingResult.error_explanation == record.error_explanation",
          gr.error_explanation, gm3.error_explanation.current_text)

    r_show2 = run(CLI + ["show", "--record-id", guomao.record_id])
    check("复核后 show 含 '✅ 已采纳'", "已采纳" in r_show2.stdout, True)
    check("复核后 show 含 '张运营'", "张运营" in r_show2.stdout, True)
    check("复核后 show 含 final_group", gm3.final_group in r_show2.stdout, True)

    r_list2 = run(CLI + ["list"])
    check("复核后 list 显示 [正常]", "[正常]" in r_list2.stdout, True)

    # ============== 6. 复核后再次导出 ==============
    print("\n" + "=" * 70)
    print("[6/9] 复核后再次导出 - JSON/SH/summary 全一致")
    print("=" * 70)
    if os.path.exists("audit_reports"):
        shutil.rmtree("audit_reports")
    run(CLI + ["export-all"])
    jf = [f for f in os.listdir("audit_reports")
          if f.startswith(f"audit_{guomao.record_id}_") and f.endswith(".json")][0]
    with open(f"audit_reports/{jf}", encoding="utf-8") as fp:
        j2 = json.load(fp)
    rs = j2["record_summary"]
    check("JSON.record_summary.record_id = 国贸商城店记录ID", rs["record_id"], guomao.record_id)
    check("JSON.record_summary.current_status = 正常", rs["current_status"], "正常")
    check("JSON.record_summary.final_group == record.final_group",
          rs["final_group"], gm3.final_group)
    check("JSON.review_completed_info.运营复核人 = 张运营",
          j2.get("review_completed_info", {}).get("运营复核人"), "张运营")
    check("JSON.grouping_result.final_group 一致",
          j2["grouping_result"]["final_group"], gm3.final_group)
    check("JSON.grouping_result.reviewed_by = 张运营",
          j2["grouping_result"]["reviewed_by"], "张运营")

    rc2 = j2["replay_commands"]
    joined2 = "\n".join(rc2)
    # 有非注释 review-duplicate 命令
    has_rev_cmd = bool(re.search(
        r'(?m)^\s*\$CLI_CMD\b.*\breview-duplicate\b', joined2
    )) and not all(
        (l.lstrip().startswith("#") or "review-duplicate" not in l) for l in rc2
    )
    # 更精确：存在至少一行非注释含 review-duplicate
    has_rev_cmd = any(
        (not l.lstrip().startswith("#")) and "review-duplicate" in l for l in rc2
    )
    check("replay_commands 含 非注释 review-duplicate 命令", has_rev_cmd, True)
    has_run_cmd = any("run-grouping" in l and "$REC_ID" in l for l in rc2)
    check("replay_commands 含 实际 run-grouping 命令", has_run_cmd, True)

    sf = [f for f in os.listdir("audit_reports") if f.startswith("summary_report")][0]
    with open(f"audit_reports/{sf}", encoding="utf-8") as fp:
        sm = json.load(fp)
    for comp in sm["results_comparison"]:
        if comp["record_id"] == guomao.record_id:
            check("summary_report 国贸 status = 正常", comp["status"], "正常")
            check("summary_report 国贸 final_group 一致",
                  comp["final_group"], gm3.final_group)
            check("summary_report 国贸 reviewed_by = 张运营",
                  comp.get("reviewed_by"), "张运营")
            check("summary_report 国贸 error_explanation 最新",
                  comp["error_explanation"], gm3.error_explanation.current_text)
            break

    # ============== 7. 干净目录下完整重放 ==============
    print("\n" + "=" * 70)
    print("[7/9] 干净目录按（复核后）重放脚本完整执行 → 从头到尾同一个 REC_ID")
    print("=" * 70)

    clean_root = tempfile.mkdtemp(prefix="guomao_clean_")
    print(f"  干净目录: {clean_root}")
    shutil.copytree(WORKSPACE, os.path.join(clean_root, "src"),
                    ignore=shutil.ignore_patterns(
                        "data", "audit_reports", "__pycache__", "*.pyc"))
    clean_src = os.path.join(clean_root, "src")
    clean_audit = os.path.join(clean_src, "audit_reports")
    os.makedirs(clean_audit, exist_ok=True)
    shutil.copytree(os.path.join(WORKSPACE, "audit_reports", "assets"),
                    os.path.join(clean_audit, "assets"))
    sh_file_post = [f for f in os.listdir("audit_reports")
                    if f.startswith("replay_国贸商城店_") and f.endswith(".sh")][0]
    shutil.copy2(os.path.join(WORKSPACE, "audit_reports", sh_file_post),
                 os.path.join(clean_audit, sh_file_post))
    for x in os.listdir("audit_reports"):
        if x.endswith(".json") and not os.path.exists(os.path.join(clean_audit, x)):
            shutil.copy2(os.path.join(WORKSPACE, "audit_reports", x), clean_audit)

    replay_sh = os.path.join(clean_audit, sh_file_post)
    bashn = run(["bash", "-n", replay_sh])
    check("SH脚本 bash -n 语法检查通过", bashn.returncode, 0)

    r_replay = run(["bash", replay_sh], capture=True, cwd=clean_src, env={"PYTHON": PY})
    check("SH重放脚本 返回码 0", r_replay.returncode, 0)
    if r_replay.stderr:
        print(f"  STDERR (可忽略): {r_replay.stderr[-300:]}")

    last_lines = [ln for ln in r_replay.stdout.strip().split("\n") if ln]
    new_rec_id = last_lines[-1].strip()
    check(f"SH脚本最后一行输出 REC_ID ({new_rec_id}) 格式正确",
          new_rec_id.startswith("rec_") and len(new_rec_id) > 8, True)
    print(f"  SH脚本 新建记录ID = {new_rec_id}")

    clean_ds = DataStore(os.path.join(clean_src, "data"))
    clean_records = clean_ds.get_all_records()
    check(f"干净数据目录只有1条记录（$REC_ID）", len(clean_records), 1)
    clean_guomao = clean_records[0]
    check("干净数据 record_id == SH输出 REC_ID", clean_guomao.record_id, new_rec_id)
    check("干净数据 门店名 = 国贸商城店", clean_guomao.store_name, "国贸商城店")
    check("干净数据 processing_type = DUPLICATE",
          clean_guomao.processing_type, ProcessingType.DUPLICATE)
    check("干净数据 final_group 非空", bool(clean_guomao.final_group), True)
    check("干净数据 status = 正常", clean_guomao.status, RecordStatus.NORMAL)
    check("干净数据 误差说明含 '业务运营' + '已复核'",
          ("业务运营" in clean_guomao.error_explanation.current_text and
           "已复核" in clean_guomao.error_explanation.current_text), True)
    clean_gr = clean_ds.get_grouping_result(new_rec_id)
    check("干净数据 GroupingResult 存在且 reviewed_by 非空",
          bool(clean_gr and clean_gr.reviewed_by), True)
    if clean_gr:
        check("干净数据 GroupingResult.status = 正常", clean_gr.status, RecordStatus.NORMAL)
        check("干净数据 GroupingResult.final_group == record.final_group",
              clean_gr.final_group, clean_guomao.final_group)
        check("干净数据 GroupingResult.error_explanation == record.error_explanation",
              clean_gr.error_explanation, clean_guomao.error_explanation.current_text)

    check("干净数据 screenshot 已导入", len(clean_guomao.screenshot_refs) >= 1, True)
    clean_shot = clean_guomao.screenshot_refs[0]
    check("干净数据 screenshot.validation_status = 校验通过",
          clean_shot.validation_status, "校验通过")
    check("干净数据 screenshot.processing_reason 含 晚上催结果",
          "晚上催结果" in (clean_shot.processing_reason or ""), True)
    shot_path = clean_shot.stored_path
    if shot_path and not os.path.isabs(shot_path):
        shot_path = os.path.join(clean_src, shot_path)
    check("干净数据 screenshot stored_path 真实存在",
          shot_path and os.path.exists(shot_path), True)

    v1 = [a for a in clean_guomao.student_answers if a.version == 1][0]
    v2 = [a for a in clean_guomao.student_answers if a.version == 2][0]
    check("干净数据 v1.is_duplicate = True（未采纳）", v1.is_duplicate, True)
    check("干净数据 v2.is_duplicate = False（已采纳）", v2.is_duplicate, False)

    # 在干净目录下再次导出
    run(CLI + ["export-all"], cwd=clean_src)
    new_jfs = [f for f in os.listdir(os.path.join(clean_src, "audit_reports"))
               if f.startswith(f"audit_{new_rec_id}_") and f.endswith(".json")]
    check(f"干净目录再次导出 存在 audit_{new_rec_id}_*.json", len(new_jfs) >= 1, True)
    if new_jfs:
        with open(os.path.join(clean_src, "audit_reports", new_jfs[0]), encoding="utf-8") as fp:
            new_j = json.load(fp)
        check("二次导出 JSON record_id = $REC_ID",
              new_j["record_summary"]["record_id"], new_rec_id)
        check("二次导出 JSON store_name = 国贸商城店",
              new_j["record_summary"]["store_name"], "国贸商城店")
        check("二次导出 JSON screenshots[0].asset_copy_path 指向新记录ID",
              new_rec_id in new_j["screenshots"][0]["asset_copy_path"], True)
        check("二次导出 JSON final_group == record.final_group",
              new_j["record_summary"]["final_group"], clean_guomao.final_group)

    # ============== 8. 三里屯店（旧口径） ==============
    print("\n" + "=" * 70)
    print("[8/9] 三里屯店：补录批注→人工修正→重跑→误差说明历史齐全")
    print("=" * 70)
    slt = ds3.get_record(sanlitun.record_id)
    check("三里屯店 有1次老师批注", len(slt.annotations) >= 1, True)
    check("三里屯店 status = 重跑完成", slt.status, RecordStatus.RE_RUN)
    check("三里屯店 re_run_count = 2", slt.re_run_count, 2)
    check("三里屯店 manual_correction_note 含 '旧口径'",
          "旧口径" in (slt.manual_correction_note or ""), True)
    check("三里屯店 误差说明历史 >= 1条",
          len(slt.error_explanation.history) >= 1, True)
    check("三里屯店 final_group 是 B类 或 C类",
          any(c in (slt.final_group or "") for c in ["B类", "C类"]), True)

    r_slt = run(CLI + ["show", "--record-id", sanlitun.record_id])
    for kw in ["旧口径", "误差说明变更历史", "人工修正", "李老师", "校验通过"]:
        check(f"三里屯 show 含 '{kw}'", kw in r_slt.stdout, True)

    # ============== 9. 望京店（顺利记录） ==============
    print("\n" + "=" * 70)
    print("[9/9] 望京SOHO店：顺利记录完整性检查")
    print("=" * 70)
    wj = ds3.get_record(wangjing.record_id)
    check("望京店 status = 正常", wj.status, RecordStatus.NORMAL)
    check("望京店 processing_type = SMOOTH", wj.processing_type, ProcessingType.SMOOTH)
    check("望京店 final_group = A类高潜门店", wj.final_group, "A类高潜门店")
    wj_gr = ds3.get_grouping_result(wangjing.record_id)
    check("望京店 GroupingResult 置信度 >= 0.9", wj_gr.confidence >= 0.9, True)
    r_wj = run(CLI + ["show", "--record-id", wangjing.record_id])
    for kw in ["顺利记录", "校验通过", "置信度"]:
        check(f"望京店 show 含 '{kw}'", kw in r_wj.stdout, True)

    # ============== 总结 ==============
    print("\n" + "=" * 70)
    print(f"✅ 端到端验证完成: 通过 {_checked_ok} / {_checked_ok + _checked_fail}")
    print("=" * 70)
    if _checked_fail == 0:
        print("""
检查点覆盖：
  0. 9 个源文件语法检查 ✅
  1. init-demo 生成国贸商城店（待运营复核） ✅
  2. list/summary/show 视图一致，待复核信息齐全 ✅
  3. 导出 JSON+SH+assets/PNG，hash/size/processing_reason 完整 ✅
  4. 待运营复核 → 分群被阻止；PENDING SH 结构正确 ✅
  5. 运营复核+分群 → status/group/error/reviewed_by 全一致 ✅
  6. 复核后再次导出 → JSON/SH/summary 引用同一条最新记录 ✅
  7. 干净目录 SH 重放
       - bash -n 语法通过 ✅
       - bash 执行全程使用同一个 $REC_ID ✅
       - 新建记录ID = 脚本最后一行输出 ✅
       - 数据/截图/答案/分群/报告 全落在新 REC_ID 上 ✅
       - 在干净目录再 export，报告的 asset/record_id 仍是新 ID ✅
  8. 三里屯店：旧口径补录→人工修正→重跑，误差说明历史齐全 ✅
  9. 望京店：顺利记录完整性检查 ✅
""")
    return 0 if _checked_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
