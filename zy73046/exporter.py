import json
import pandas as pd
from datetime import datetime
from models import get_conn


def export_anomaly_queue(run_id: int = None, output_path: str = None) -> dict:
    conn = get_conn()
    try:
        sql = """
        SELECT
            wr.id as record_id,
            wr.run_id,
            wrun.run_no,
            sp.batch_no,
            sp.material_code,
            sp.material_name,
            sp.spec_model,
            sp.measured_value,
            sp.unit,
            sp.supplier,
            sp.raw_remark,
            sp.manual_remark,
            wr.level,
            wr.anomaly_type,
            wr.detected_value,
            wr.threshold_value,
            wr.deviation,
            wr.step_detected,
            wr.status as record_status,
            wr.handle_remark,
            wr.conclusion,
            aq.queue_status,
            aq.priority,
            aq.file_conclusion
        FROM anomaly_queue aq
        JOIN warning_record wr ON aq.warning_record_id = wr.id
        JOIN warning_run wrun ON wr.run_id = wrun.id
        JOIN spare_parts sp ON wr.spare_part_id = sp.id
        """
        params = []
        if run_id:
            sql += " WHERE wr.run_id = ?"
            params.append(run_id)
        sql += " ORDER BY aq.priority DESC, wr.level DESC, wr.id"

        df = pd.read_sql_query(sql, conn, params=params)
        if df.empty:
            return {"success": False, "error": "无异常队列数据"}

        mismatch = []
        for _, r in df.iterrows():
            rs = str(r["record_status"])
            qs = str(r["queue_status"])
            fc = str(r["file_conclusion"]) if pd.notna(r["file_conclusion"]) else ""
            concl = str(r["conclusion"]) if pd.notna(r["conclusion"]) else ""

            aligned = True
            if rs == "已放行":
                if qs not in ["已结案"] or (concl and concl not in fc and fc not in concl):
                    aligned = False
            elif rs == "需补货":
                if qs not in ["已结案-补货"] or concl != fc:
                    aligned = False
            elif rs == "待处理":
                if qs not in ["待分派"]:
                    aligned = False
            elif rs == "处理中":
                if qs not in ["处理中", "已分配"]:
                    aligned = False

            if not aligned:
                mismatch.append({
                    "record_id": r["record_id"],
                    "record_status": rs,
                    "queue_status": qs,
                    "conclusion": concl,
                    "file_conclusion": fc
                })

        rename_map = {
            "record_id": "预警记录ID",
            "run_no": "预警批次号",
            "batch_no": "材料批次号",
            "material_code": "材料编码",
            "material_name": "材料名称",
            "spec_model": "规格型号",
            "measured_value": "测量值",
            "unit": "单位",
            "supplier": "供应商",
            "raw_remark": "原始备注",
            "manual_remark": "人工备注",
            "level": "异常级别",
            "anomaly_type": "异常类型",
            "detected_value": "检出值",
            "threshold_value": "阈值",
            "deviation": "偏差量",
            "step_detected": "检出步骤",
            "record_status": "预警记录状态",
            "handle_remark": "处理备注",
            "conclusion": "记录结论",
            "queue_status": "队列状态",
            "priority": "优先级",
            "file_conclusion": "文件结论"
        }
        df_out = df.rename(columns=rename_map)

        if not output_path:
            stamp = datetime.now().strftime("%Y%m%d%H%M%S")
            output_path = f"异常队列导出_{stamp}.xlsx"

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df_out.to_excel(writer, index=False, sheet_name="异常队列明细")

            if mismatch:
                pd.DataFrame(mismatch).rename(columns={
                    "record_id": "预警ID", "record_status": "记录状态",
                    "queue_status": "队列状态", "conclusion": "记录结论",
                    "file_conclusion": "文件结论"
                }).to_excel(writer, index=False, sheet_name="一致性告警")

        return {
            "success": True,
            "output_path": output_path,
            "total": len(df),
            "by_level": df["level"].value_counts().to_dict(),
            "by_status": df["record_status"].value_counts().to_dict(),
            "consistency_mismatch_count": len(mismatch),
            "consistency_mismatch": mismatch
        }
    finally:
        conn.close()


def export_manager_report(run_id: int, output_path: str = None) -> dict:
    conn = get_conn()
    try:
        run = conn.execute("SELECT * FROM warning_run WHERE id=?", (run_id,)).fetchone()
        if not run:
            return {"success": False, "error": f"预警批次#{run_id}不存在"}

        cfg = conn.execute("SELECT * FROM threshold_config WHERE id=?", (run["config_id"],)).fetchone()

        sql = """
        SELECT
            sp.material_name, sp.spec_model, sp.batch_no, sp.material_code,
            sp.measured_value, sp.unit, sp.raw_remark, sp.manual_remark,
            wr.level, wr.anomaly_type, wr.threshold_value, wr.deviation,
            wr.status, wr.handle_remark, wr.conclusion,
            aq.queue_status, aq.file_conclusion, aq.priority
        FROM warning_record wr
        JOIN spare_parts sp ON wr.spare_part_id = sp.id
        JOIN anomaly_queue aq ON aq.warning_record_id = wr.id
        WHERE wr.run_id = ?
        ORDER BY
            CASE aq.priority WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END,
            CASE wr.level WHEN '严重' THEN 1 WHEN '警告' THEN 2 ELSE 3 END
        """
        rows = [dict(r) for r in conn.execute(sql, (run_id,)).fetchall()]

        need_supply = []
        can_release = []
        pending = []

        for r in rows:
            action_suggest = ""
            if r["status"] == "需补货" or r["file_conclusion"] == "补货":
                action_suggest = "需补货/换件"
            elif r["status"] == "已放行" or r["file_conclusion"] == "放行":
                action_suggest = "可放行"
            elif r["level"] == "严重":
                action_suggest = "【紧急】优先复核，建议暂缓放行"
            elif r["level"] == "警告":
                action_suggest = "复核测量数据/厂家，确认后放行或补货"
            elif r["anomaly_type"] == "数据缺失":
                action_suggest = "补齐测量值后再判定"
            r["action_suggest"] = action_suggest

            if "补货" in action_suggest or r["status"] == "需补货":
                need_supply.append(r)
            elif "放行" in action_suggest or r["status"] == "已放行":
                can_release.append(r)
            else:
                pending.append(r)

        summary_data = [
            {"项目": "预警批次号", "内容": run["run_no"]},
            {"项目": "阈值配置", "内容": cfg["config_name"] if cfg else "-"},
            {"项目": "配置说明", "内容": cfg["remark"] if cfg else "-"},
            {"项目": "运行开始", "内容": run["started_at"]},
            {"项目": "运行结束", "内容": run["finished_at"] or "-"},
            {"项目": "异常总数", "内容": len(rows)},
            {"项目": "  - 严重", "内容": sum(1 for r in rows if r["level"] == "严重")},
            {"项目": "  - 警告", "内容": sum(1 for r in rows if r["level"] == "警告")},
            {"项目": "  - 一般", "内容": sum(1 for r in rows if r["level"] == "一般")},
            {"项目": "建议补货数", "内容": len(need_supply)},
            {"项目": "建议放行数", "内容": len(can_release)},
            {"项目": "待判定数", "内容": len(pending)},
        ]

        manager_cols = [
            "批次号/材料", "材料名称", "规格型号", "当前测量值", "阈值",
            "偏差(%)", "异常级别", "异常类型", "检出步骤",
            "处理建议(给维保主管)", "当前状态", "处理备注", "结论/文件结论", "人工备注"
        ]

        def to_manager_row(r):
            return {
                "批次号/材料": f"{r['batch_no']} / {r['material_code'] or '-'}",
                "材料名称": r["material_name"],
                "规格型号": r["spec_model"] or "-",
                "当前测量值": f"{r['measured_value']} {r['unit'] or ''}" if r["measured_value"] is not None else "(缺，需后补)",
                "阈值": r["threshold_value"],
                "偏差(%)": f"{r['deviation']}%" if r["deviation"] is not None else "-",
                "异常级别": r["level"],
                "异常类型": r["anomaly_type"],
                "检出步骤": r["step_detected"] if "step_detected" in r else "-",
                "处理建议(给维保主管)": r["action_suggest"],
                "当前状态": r["status"],
                "处理备注": r["handle_remark"] or "",
                "结论/文件结论": " | ".join(filter(None, [r.get("conclusion") or "", r.get("file_conclusion") or ""])),
                "人工备注": r["manual_remark"] or r["raw_remark"] or ""
            }

        def _df(rows_list):
            return pd.DataFrame([to_manager_row(r) for r in rows_list]) if rows_list else pd.DataFrame(columns=manager_cols)

        if not output_path:
            stamp = datetime.now().strftime("%Y%m%d%H%M%S")
            output_path = f"维保主管报告_{run['run_no']}_{stamp}.xlsx"

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name="0-总览(给阿敏)")
            _df(need_supply).to_excel(writer, index=False, sheet_name="1-需补货清单")
            _df(can_release).to_excel(writer, index=False, sheet_name="2-可放行清单")
            _df(pending).to_excel(writer, index=False, sheet_name="3-待判定清单")
            if run["step_logs_json"]:
                logs = json.loads(run["step_logs_json"])
                log_rows = [{"步骤#": i+1, "步骤名": l["step"], "时间": l["time"],
                             "详情摘要": json.dumps(l["detail"], ensure_ascii=False)[:200]}
                            for i, l in enumerate(logs)]
                pd.DataFrame(log_rows).to_excel(writer, index=False, sheet_name="4-算法步骤(值班人用)")

        return {
            "success": True,
            "output_path": output_path,
            "run_no": run["run_no"],
            "need_supply_count": len(need_supply),
            "can_release_count": len(can_release),
            "pending_count": len(pending)
        }
    finally:
        conn.close()
