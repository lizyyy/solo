"""
配电柜温升预警 - HTTP 接口验收脚本
用法：
    # 1. 先安装依赖
    pip install -r requirements.txt

    # 2. 直接运行（脚本会自动启动/重启/停止服务）
    python3 acceptance_test.py
"""
import os
import sys
import json
import time
import signal
import subprocess
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "acceptance_test.db"
LOG_PATH = BASE_DIR / "acceptance_server.log"
PORT = 5099
BASE_URL = f"http://127.0.0.1:{PORT}"

# 进程句柄
_server_proc: subprocess.Popen = None  # type: ignore
_results = []


# ============================================================
def divider(title, char="─"):
    print("\n" + char * 90)
    print(f"  {title}")
    print(char * 90)


def step(num, title):
    _results.append(None)
    divider(f"步骤 {num} | {title}", "═")


def check(desc: str, cond, detail: str = ""):
    ok = bool(cond)
    mark = "✅" if ok else "❌"
    _results[-1] = (_results[-1] if _results[-1] is not None else []) + [(desc, ok, detail)]
    print(f"  {mark} {desc}" + (f"  — {detail}" if detail and not ok else ""))
    return ok


# ============================================================
# 服务生命周期
# ============================================================
def _wait_server(timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            r = requests.get(f"{BASE_URL}/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def start_server(reset_db: bool = True):
    global _server_proc
    stop_server()
    # 清空旧 DB 只在 reset_db=True 时执行
    if reset_db and DB_PATH.exists():
        DB_PATH.unlink()
    LOG_PATH.write_text("", encoding="utf-8")
    env = os.environ.copy()
    env["CABINET_WARNING_DB"] = str(DB_PATH)
    env["CABINET_WARNING_PORT"] = str(PORT)
    # 用无缓冲模式
    cmd = [sys.executable, "-u", str(BASE_DIR / "app.py")]
    _server_proc = subprocess.Popen(
        cmd, env=env, cwd=str(BASE_DIR),
        stdout=LOG_PATH.open("a", encoding="utf-8"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    ok = _wait_server()
    print(f"  [服务] PID={_server_proc.pid} 启动={'成功' if ok else '失败'}  DB={DB_PATH.name}")
    if not ok:
        print(f"  服务日志:\n{LOG_PATH.read_text(encoding='utf-8')}")
    return ok


def stop_server():
    global _server_proc
    if _server_proc and _server_proc.poll() is None:
        try:
            os.killpg(os.getpgid(_server_proc.pid), signal.SIGTERM)
        except Exception:
            pass
        try:
            _server_proc.wait(timeout=5)
        except Exception:
            try:
                os.killpg(os.getpgid(_server_proc.pid), signal.SIGKILL)
            except Exception:
                pass
    _server_proc = None


# ============================================================
# HTTP 辅助
# ============================================================
def post(path, json_body):
    r = requests.post(f"{BASE_URL}{path}", json=json_body, timeout=10)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}
    return r.status_code, data


def get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", params=params, timeout=10)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}
    return r.status_code, data


def pj(data, indent=2, prefix="    "):
    text = json.dumps(data, ensure_ascii=False, indent=indent)
    for line in text.split("\n"):
        print(prefix + line)


# ============================================================
# 验收数据
# ============================================================
TEST_DATE = "2026-06-21"

OLD_MATERIALS = [
    {
        "material_type": "sensor_log",
        "title": f"{TEST_DATE}配电柜A温升传感器连续日志",
        "detail": (
            f"[{TEST_DATE} 08:00:15] 62.3℃/65℃ 正常；[08:15] 63.1℃；[08:30] 64.0℃；"
            "[08:42:51] 传感器探头更换：型号由PT100-A2更换为PT100-B3；"
            "[09:00:03] 温度67.8℃ 超限3.8℃；[09:15] 68.2℃；"
            "备注：part change PT100-A2 to PT100-B3 后读数基线偏移+2.1℃"
        ),
    },
    {
        "material_type": "manual_note",
        "title": "配电柜A巡检记录-一切正常",
        "detail": (
            "巡检时间09:20，发现配电柜A温度异常偏高，有焦糊气味，"
            "顶部通风扇停转，进线铜牌温度目测超标，已通知维修班待处理"
        ),
        "mismatch_flag": True,
        "mismatch_detail": "标题写'一切正常'，但明细描述温度异常、焦糊味、风扇停转",
    },
    {
        "material_type": "manual_note",
        "title": "安全员现场确认",
        "detail": "现场确认温升属实，09:32测得外壳温度58℃，建议拉闸冷却30分钟",
    },
]

RENAMED_SUBMIT_1 = [
    {
        "material_type": "supplementary",
        "title": "PDG-A现场补拍照片与维修说明",
        "detail": (
            "09:45维修班到场，确认为通风扇电机烧毁，"
            "已更换通风扇（备件型号FAN-120B替换原FAN-120A），"
            "10:10温度回落至51.2℃，建议观察2小时再恢复满载运行"
        ),
    },
]

RENAMED_SUBMIT_2 = [
    {
        "material_type": "manual_note",
        "title": "1#配电柜现场值班记录",
        "detail": "10:18确认通风扇运行正常，风速1800rpm，值班员签字：小李",
    },
]

SUPPLEMENT_MATERIALS = [
    {
        "material_type": "sensor_log",
        "title": "维修后配电柜A温度恢复记录",
        "detail": (
            "[10:15] 48.3℃；[10:30] 49.1℃；[10:45] 50.2℃；[11:00] 51.0℃；"
            "校准验证：新旧PT100-B3探头与第三方测温枪偏差<0.5℃，校准通过"
        ),
    },
    {
        "material_type": "manual_note",
        "title": "老唐复核签名",
        "detail": "维修后连续观察1小时温度稳定，PT100-B3探头校准已验证通过",
    },
]


# ============================================================
# 主流程
# ============================================================
def run_acceptance():
    global _results
    _results = []

    # -------- 启动服务 --------
    step(0, "启动本地 API 服务（空数据库）")
    ok = start_server()
    check("服务启动成功并 /health 返回 200", ok)
    if not ok:
        return

    sc, hp = get("/health")
    check(f"record_count=0（空库）", hp.get("record_count") == 0, f"实际={hp.get('record_count')}")

    # -------- 步骤1：导入旧材料 --------
    step(1, "导入旧材料 —— 对象称呼='一号配电柜'（应归一化为配电柜A）")
    sc, r1 = post("/api/warning/import", {
        "object_name": "一号配电柜",
        "submit_date": TEST_DATE,
        "materials": OLD_MATERIALS,
        "initial_conclusion": "abnormal",
        "operator": "安全员老唐",
    })
    pj({
        "action": r1.get("action"),
        "去重提示": r1.get("duplicate_info", {}).get("message"),
        "record_id": r1.get("record_id"),
        "结论": r1.get("manager_view", {}).get("当前结论"),
        "卡点状态": r1.get("manager_view", {}).get("卡点状态"),
        "材料数": r1.get("manager_view", {}).get("材料清单") and len(r1["manager_view"]["材料清单"]),
    })
    rid1 = r1.get("record_id")
    mv1 = r1.get("manager_view", {})

    check("HTTP 200", sc == 200, f"status={sc}")
    check("action=created（首条新建）", r1.get("action") == "created", f"实际={r1.get('action')}")
    check("归一化为标准名'配电柜A'", mv1.get("对象标准名") == "配电柜A", f"实际={mv1.get('对象标准名')}")
    check("卡点命中：PT100-A2→PT100-B3 备件型号替换",
          mv1.get("卡点状态") and ("PT100" in str(mv1.get("卡点状态"))) and "已解除" not in str(mv1.get("卡点状态")),
          f"实际={mv1.get('卡点状态')}")
    check("结论为⛔卡点阻塞（或等价 blocked）",
          "卡点" in str(mv1.get("当前结论", "")) or mv1.get("当前结论") == "⛔ 卡点阻塞",
          f"实际={mv1.get('当前结论')}")
    check("含暂不放行项", len(mv1.get("暂不放行项") or []) >= 1)

    # -------- 步骤2：两次等价但称呼不同的请求（压测去重） --------
    step(2, "压测去重：连续两次提交同一对象但称呼不同 —— 'PDG-A' 和 '1#配电柜'")
    sc, r2a = post("/api/warning/import", {
        "object_name": "PDG-A",
        "submit_date": TEST_DATE,
        "materials": RENAMED_SUBMIT_1,
        "operator": "值班员小李",
    })
    rid2a = r2a.get("record_id")
    sc, r2b = post("/api/warning/import", {
        "object_name": "1#配电柜",
        "submit_date": TEST_DATE,
        "materials": RENAMED_SUBMIT_2,
        "operator": "值班员小王",
    })
    rid2b = r2b.get("record_id")

    print("  第1次等价请求（PDG-A）：")
    pj({
        "action": r2a.get("action"),
        "去重提示": r2a.get("duplicate_info", {}).get("message"),
        "record_id": rid2a,
        "是否合并": rid2a == rid1,
    })
    print("  第2次等价请求（1#配电柜）：")
    pj({
        "action": r2b.get("action"),
        "去重提示": r2b.get("duplicate_info", {}).get("message"),
        "record_id": rid2b,
        "是否合并": rid2b == rid1,
    })

    check("第1次 action=merged", r2a.get("action") == "merged")
    check("第1次 record_id 与第1步相同（不新建）", rid2a == rid1, f"第1步={rid1} 本步={rid2a}")
    check("第2次 action=merged", r2b.get("action") == "merged")
    check("第2次 record_id 与第1步相同（不新建）", rid2b == rid1, f"第1步={rid1} 本步={rid2b}")

    # -------- 步骤3：查当前总量（必须仍是1） --------
    step(3, "查负责人汇总接口 —— 确认总记录数仍=1，合并痕迹可见")
    sc, mgr = get("/api/warning/manager")
    total = mgr.get("total_records", -1)
    merged_count = mgr.get("duplicate_merged_count", -1)
    rec = (mgr.get("records") or [{}])[0]
    print(f"  总记录数={total}  别名合并次数={merged_count}")
    pj({
        "record_id": rec.get("record_id"),
        "标准名/提交名": f"{rec.get('对象标准名')} / {rec.get('本次提交名称')}",
        "当前结论": rec.get("当前结论"),
        "结论标记": rec.get("结论标记"),
        "是否补录过": rec.get("是否补录过"),
        "是否改判过": rec.get("是否改判过"),
        "材料总数": len(rec.get("材料清单") or []),
        "历史总数": len(rec.get("历史追溯摘要") or []),
        "验收辅助": rec.get("_验收辅助"),
    })

    check("total_records=1（去重没产生多条）", total == 1, f"实际={total}")
    check("duplicate_merged_count=2（两次别名请求都被合并）", merged_count == 2, f"实际={merged_count}")
    check("材料总数=3+1+1=5", len(rec.get("材料清单") or []) == 5,
          f"实际={len(rec.get('材料清单') or [])}")
    check("is_supplemented=✅是", "是" in str(rec.get("是否补录过") or ""))

    # -------- 步骤4：补录 + 改判 --------
    step(4, "补录说明 + 改判 —— 提供校准凭证让卡点解除，并把结论改到 pending")
    sc, r4 = post("/api/warning/supplement", {
        "record_id": rid1,
        "materials": SUPPLEMENT_MATERIALS,
        "new_conclusion": "pending",
        "change_reason": (
            "通风扇已更换FAN-120B；PT100-B3传感器校准偏差<0.5℃，第三方校准通过；"
            "温度连续1小时稳定；原卡点解除，改为待观察"
        ),
        "operator": "安全员老唐",
    })
    mv4 = r4.get("manager_view", {})
    pj({
        "action": r4.get("action"),
        "结论变化": f"{r4.get('conclusion_before')} → {r4.get('conclusion_after')}",
        "结论是否变化": r4.get("conclusion_changed"),
        "当前结论": mv4.get("当前结论"),
        "结论标记": mv4.get("结论标记"),
        "卡点状态": mv4.get("卡点状态"),
        "暂不放行项": mv4.get("暂不放行项"),
        "是否改判过": mv4.get("是否改判过"),
    })

    check("HTTP 200", sc == 200)
    check("结论变化=True", r4.get("conclusion_changed") is True, f"实际={r4.get('conclusion_changed')}")
    check("改判前=blocked，改判后=pending",
          r4.get("conclusion_before") == "blocked" and r4.get("conclusion_after") == "pending",
          f"{r4.get('conclusion_before')}→{r4.get('conclusion_after')}")
    check("卡点已解除（不含'暂不放行'且含'已解除'或为空）",
          "已解除" in str(mv4.get("卡点状态") or "") or len(mv4.get("暂不放行项") or []) == 0,
          f"实际卡点={mv4.get('卡点状态')}  暂不放行={mv4.get('暂不放行项')}")
    check("is_judgment_changed=✅是", "是" in str(mv4.get("是否改判过") or ""))

    # -------- 步骤5：查单条历史 —— 旧材料/新备注/原结论/新结论/改判原因 --------
    step(5, "查单条历史接口 —— 验证旧材料→新备注→原结论→新结论→改判原因全链路可见")
    sc, hist = get(f"/api/warning/history/{rid1}")
    print(f"  总历史条目={hist.get('历史总条数')}  对象={hist.get('对象标准名')}")
    for idx, h in enumerate(hist.get("历史条目", []), 1):
        print(f"\n  [{idx}] v{h['version']} {h['event']} @ {h['操作人']}")
        print(f"      结论：{h['旧结论']} → {h['新结论']}  "
              f"{'🔄变化' if h['结论是否变化'] else '➖不变'}")
        print(f"      原因：{h['改判/操作原因']}")
        if h.get("新增材料详情"):
            print(f"      新增材料 ({len(h['新增材料详情'])}条):")
            for mm in h["新增材料详情"]:
                tag = "⚠️标题不符" if mm.get("mismatch_flag") else ""
                print(f"        - [{mm['material_type']}] {mm['title']} {tag}")

    check("历史条目数≥4（创建+两次合并+补录改判）", hist.get("历史总条数", 0) >= 4,
          f"实际={hist.get('历史总条数')}")
    entries = hist.get("历史条目", [])
    # 最后一条应是改判
    last = entries[-1] if entries else {}
    check("最后一条=结论改判（modify_conclusion 或含'改判'）",
          "改判" in last.get("event", "") or last.get("结论是否变化") is True,
          f"实际event={last.get('event')}  变化={last.get('结论是否变化')}")
    check("改判原因可追溯", len(last.get("改判/操作原因") or "") > 20,
          f"实际原因长度={len(last.get('改判/操作原因') or '')}")

    # -------- 步骤6：最终负责人视图 --------
    step(6, "最终负责人汇总 —— 一眼看出补录/改判/卡点状态")
    sc, mgr_final = get("/api/warning/manager")
    rec = (mgr_final.get("records") or [{}])[0]
    pj({
        "record_id": rec.get("record_id"),
        "对象": f"{rec.get('对象标准名')} ({rec.get('本次提交名称')})",
        "当前结论": rec.get("当前结论"),
        "结论标记": rec.get("结论标记"),
        "补录过": rec.get("是否补录过"),
        "改判过": rec.get("是否改判过"),
        "卡点状态": rec.get("卡点状态"),
        "验收辅助": rec.get("_验收辅助"),
    })

    flags = rec.get("结论标记") or []
    check("负责人视图含'📝有补录'标记", any("补录" in f for f in flags), f"实际={flags}")
    check("负责人视图含'🔄有改判'标记", any("改判" in f for f in flags), f"实际={flags}")
    aux = rec.get("_验收辅助") or {}
    check("验收辅助=疑点状态已解除", aux.get("疑点状态") == "卡点已解除", f"实际={aux.get('疑点状态')}")
    check("验收辅助=别名合并次数=2", aux.get("别名合并次数") == 2, f"实际={aux.get('别名合并次数')}")

    # -------- 步骤7：持久化验证 —— 重启服务 --------
    step(7, "持久化验证 —— 重启服务后查库，数据必须仍在")
    print("  停止服务…")
    stop_server()
    time.sleep(1)
    print("  重新启动服务（复用同一 DB）…")
    ok = start_server(reset_db=False)
    check("重启后服务启动成功", ok)

    sc, hp2 = get("/health")
    check(f"重启后 record_count=1", hp2.get("record_count") == 1, f"实际={hp2.get('record_count')}")

    sc, mgr2 = get("/api/warning/manager")
    rec2 = (mgr2.get("records") or [{}])[0]
    sc2, hist2 = get(f"/api/warning/history/{rid1}")

    check("重启后负责人视图：同一record_id", rec2.get("record_id") == rid1)
    check("重启后负责人视图：补录/改判标记保留",
          "是" in str(rec2.get("是否补录过") or "") and "是" in str(rec2.get("是否改判过") or ""))
    check("重启后历史接口：历史条目数一致（≥4）", hist2.get("历史总条数", 0) >= 4)

    stop_server()

    # -------- 打印总结果 --------
    all_checks = []
    for bucket in _results:
        if bucket:
            all_checks.extend(bucket)

    divider("验收总览")
    passed = sum(1 for _, ok, _ in all_checks if ok)
    total_c = len(all_checks)
    print(f"  共 {total_c} 项断言   ✅ 通过 {passed}   ❌ 失败 {total_c - passed}")
    for i, (desc, ok, detail) in enumerate(all_checks, 1):
        mark = "✅" if ok else "❌"
        print(f"  {mark} #{i:02d} {desc}" + (f"  ⚠ {detail}" if detail else ""))

    print()
    if passed == total_c:
        print("  🎉🎉🎉  全部验收通过  🎉🎉🎉")
    else:
        print(f"  ❌ 有 {total_c - passed} 项失败，请检查")

    return passed == total_c


if __name__ == "__main__":
    try:
        ok = run_acceptance()
    finally:
        stop_server()
    sys.exit(0 if ok else 1)
