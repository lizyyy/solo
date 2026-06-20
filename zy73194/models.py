import uuid
import copy
from datetime import datetime
from enum import Enum


class Status(Enum):
    RELEASED = "已放行"
    PENDING_EVIDENCE = "待补证据"
    MANUALLY_EDITED = "人工改过"


class Unit(Enum):
    MILLIMETER = "毫米"
    CENTIMETER = "厘米"
    METER = "米"
    PIECE = "个"
    PERCENT = "%"


UNIT_CONVERSIONS = {
    ("毫米", "厘米"): 0.1,
    ("厘米", "毫米"): 10,
    ("厘米", "米"): 0.01,
    ("米", "厘米"): 100,
    ("毫米", "米"): 0.001,
    ("米", "毫米"): 1000,
}


class RecurrenceStore:
    def __init__(self):
        self.records = {}
        self.histories = {}
        self._init_sample_data()

    def _init_sample_data(self):
        sample = self.create_record(
            title="等差数列递推回放",
            formula="a_n = a_{n-1} + d",
            params={"a0": 10, "d": 3, "n": 20},
            unit="个",
            status=Status.PENDING_EVIDENCE.value,
            remark="初始版本，待确认公差d的单位",
            operator="阿宁",
            has_division_by_zero=False,
            screenshot_url=None,
        )
        self.update_record(
            record_id=sample["id"],
            params={"a0": 10, "d": 3, "n": 20},
            unit="厘米",
            status=Status.MANUALLY_EDITED.value,
            remark="单位从'个'改为'厘米'，d的含义由'个数'变为'长度增量'",
            operator="阿宁",
            screenshot_url="/static/screenshots/v2_length.png",
            unit_changed=True,
            old_unit="个",
            old_result_ref=sample["result_summary"],
        )
        rec = self.records[sample["id"]]
        rec["status"] = Status.RELEASED.value
        rec["lifecycle"].append({
            "action": "放行",
            "operator": "排班同事",
            "time": datetime.now().isoformat(),
            "remark": "核对无误，放行",
        })

        sample2 = self.create_record(
            title="等比数列除零边界测试",
            formula="a_n = a_{n-1} * r + c / (k - n)",
            params={"a0": 5, "r": 2, "c": 10, "k": 5, "n": 10},
            unit="个",
            status=Status.PENDING_EVIDENCE.value,
            remark="存在除零边界，k=5时分母为0",
            operator="阿宁",
            has_division_by_zero=True,
            screenshot_url="/static/screenshots/div_zero.png",
        )

        sample3 = self.create_record(
            title="斐波那契递推回放",
            formula="a_n = a_{n-1} + a_{n-2}",
            params={"a0": 0, "a1": 1, "n": 15},
            unit="个",
            status=Status.RELEASED.value,
            remark="经典斐波那契，已核对",
            operator="阿宁",
            has_division_by_zero=False,
            screenshot_url=None,
        )

    def create_record(self, title, formula, params, unit, status, remark,
                      operator, has_division_by_zero, screenshot_url):
        rid = str(uuid.uuid4())[:8]
        details = self._compute_details(formula, params, unit)
        summary = self._summarize(details, unit)

        record = {
            "id": rid,
            "title": title,
            "formula": formula,
            "params": copy.deepcopy(params),
            "unit": unit,
            "status": status,
            "current_version": 1,
            "has_division_by_zero": has_division_by_zero,
            "result_summary": summary,
            "result_details": details,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "lifecycle": [{
                "action": "创建",
                "operator": operator,
                "time": datetime.now().isoformat(),
                "remark": remark,
            }],
            "attachments": [],
            "screenshot_url": screenshot_url,
            "unit_change_log": [],
        }
        self.records[rid] = record
        self.histories[rid] = []
        self._snapshot_history(rid, operator, remark, "创建")
        return record

    def update_record(self, record_id, params=None, unit=None, status=None,
                      remark=None, operator=None, screenshot_url=None,
                      unit_changed=False, old_unit=None, old_result_ref=None):
        if record_id not in self.records:
            return None
        rec = self.records[record_id]
        old_version = rec["current_version"]

        if params is not None or unit is not None:
            new_params = params if params is not None else rec["params"]
            new_unit = unit if unit is not None else rec["unit"]
            details = self._compute_details(rec["formula"], new_params, new_unit)
            summary = self._summarize(details, new_unit)
            rec["params"] = copy.deepcopy(new_params)
            rec["unit"] = new_unit
            rec["result_details"] = details
            rec["result_summary"] = summary
            rec["has_division_by_zero"] = any(
                d.get("division_by_zero") for d in details
            )
            rec["current_version"] = old_version + 1

            if unit_changed and old_unit:
                rec["unit_change_log"].append({
                    "from_unit": old_unit,
                    "to_unit": new_unit,
                    "old_result_ref": old_result_ref,
                    "new_result_ref": summary,
                    "operator": operator,
                    "time": datetime.now().isoformat(),
                    "remark": remark or "单位变更",
                })

        if status is not None:
            rec["status"] = status

        if screenshot_url is not None:
            rec["screenshot_url"] = screenshot_url

        action = "修改"
        if status == Status.RELEASED.value and rec["status"] == Status.RELEASED.value:
            action = "放行"
        elif status == Status.PENDING_EVIDENCE.value:
            action = "退回待补证据"

        rec["lifecycle"].append({
            "action": action,
            "operator": operator,
            "time": datetime.now().isoformat(),
            "remark": remark,
        })
        rec["updated_at"] = datetime.now().isoformat()

        self._snapshot_history(
            record_id, operator, remark, action,
            unit_changed=unit_changed, old_unit=old_unit
        )
        return rec

    def recompute_with_attachment(self, record_id, attachment_name,
                                  attachment_url, params=None, operator=None):
        if record_id not in self.records:
            return None
        rec = self.records[record_id]
        rec["attachments"].append({
            "name": attachment_name,
            "url": attachment_url,
            "time": datetime.now().isoformat(),
            "operator": operator,
        })
        new_params = params if params is not None else rec["params"]
        return self.update_record(
            record_id=record_id,
            params=new_params,
            status=Status.MANUALLY_EDITED.value,
            remark=f"晚到附件【{attachment_name}】触发复算",
            operator=operator or "系统",
        )

    def _compute_details(self, formula, params, unit):
        details = []
        n = params.get("n", 10)
        a0 = params.get("a0", 0)
        a1 = params.get("a1")
        d = params.get("d", 0)
        r = params.get("r", 1)
        c = params.get("c", 0)
        k = params.get("k", 0)

        values = []
        for i in range(n + 1):
            div_zero = False
            val = None
            step_note = ""

            if "a_{n-1} + d" in formula and "a_{n-2}" not in formula:
                if i == 0:
                    val = a0
                else:
                    val = values[i - 1] + d
            elif "a_{n-2}" in formula:
                if i == 0:
                    val = a0
                elif i == 1:
                    val = a1 if a1 is not None else a0
                else:
                    val = values[i - 1] + values[i - 2]
            elif "a_{n-1} * r" in formula:
                denom = k - i
                if denom == 0 and c != 0:
                    div_zero = True
                    step_note = f"第{i}项分母 k-i = 0，除零边界"
                    val = float('inf')
                else:
                    if i == 0:
                        val = a0
                    else:
                        div_part = c / denom if denom != 0 else 0
                        val = values[i - 1] * r + div_part
            else:
                val = a0 + d * i

            values.append(val)
            details.append({
                "index": i,
                "value": val,
                "value_str": "∞ (除零)" if div_zero else str(val),
                "unit": unit,
                "division_by_zero": div_zero,
                "step_note": step_note,
            })
        return details

    def _summarize(self, details, unit):
        finite_vals = [d["value"] for d in details
                       if not d["division_by_zero"] and d["value"] not in (float('inf'), float('-inf'))]
        div_zero_count = sum(1 for d in details if d["division_by_zero"])
        return {
            "total_steps": len(details),
            "finite_steps": len(finite_vals),
            "division_by_zero_steps": div_zero_count,
            "first_value": finite_vals[0] if finite_vals else None,
            "last_finite_value": finite_vals[-1] if finite_vals else None,
            "unit": unit,
        }

    def _snapshot_history(self, record_id, operator, remark, action,
                          unit_changed=False, old_unit=None):
        rec = self.records[record_id]
        snapshot = {
            "version": rec["current_version"],
            "action": action,
            "operator": operator,
            "time": datetime.now().isoformat(),
            "remark": remark,
            "formula": rec["formula"],
            "params": copy.deepcopy(rec["params"]),
            "unit": rec["unit"],
            "status": rec["status"],
            "result_summary": copy.deepcopy(rec["result_summary"]),
            "screenshot_url": rec["screenshot_url"],
            "unit_changed": unit_changed,
            "old_unit": old_unit,
            "result_details_snapshot": copy.deepcopy(rec["result_details"]),
        }
        self.histories[record_id].append(snapshot)

    def get_record(self, record_id):
        return self.records.get(record_id)

    def list_records(self, status_filter=None):
        records = list(self.records.values())
        if status_filter:
            records = [r for r in records if r["status"] == status_filter]
        return sorted(records, key=lambda r: r["updated_at"], reverse=True)

    def get_history(self, record_id):
        return self.histories.get(record_id, [])

    def export_csv_rows(self, record_id):
        rec = self.records.get(record_id)
        if not rec:
            return [], []
        details = rec["result_details"]
        status = rec["status"]

        main_rows = []
        detail_rows = []

        main_rows.append([
            "回放ID", "标题", "公式", "当前版本", "状态",
            "单位", "总步数", "除零步数", "创建时间", "更新时间"
        ])
        main_rows.append([
            rec["id"], rec["title"], rec["formula"],
            rec["current_version"], status,
            rec["unit"], rec["result_summary"]["total_steps"],
            rec["result_summary"]["division_by_zero_steps"],
            rec["created_at"], rec["updated_at"],
        ])
        main_rows.append([])
        main_rows.append([
            "记录分类说明：",
            "已放行 = 核对完成可对外",
            "待补证据 = 需要补充材料",
            "人工改过 = 经过人工修改或复算",
        ])
        main_rows.append([])
        main_rows.append(["=== 明细数据 ==="])
        detail_rows.append([
            "序号", "值", "单位", "是否除零边界", "除零标记", "状态标签", "备注"
        ])
        for d in details:
            tag = status
            div_zero_str = "是" if d["division_by_zero"] else "否"
            marker = "⚠️ 除零" if d["division_by_zero"] else ""
            detail_rows.append([
                d["index"], d["value_str"], d["unit"],
                div_zero_str, marker, tag, d["step_note"],
            ])
        return main_rows, detail_rows

    def export_all_csv_rows(self, status_filter=None):
        records = self.list_records(status_filter)
        rows = []
        rows.append([
            "回放ID", "标题", "公式", "状态", "单位",
            "当前版本", "总步数", "除零步数",
            "是否含除零边界", "最近操作人", "更新时间", "记录分类标签"
        ])
        for rec in records:
            div = "是" if rec["has_division_by_zero"] else "否"
            last_op = rec["lifecycle"][-1]["operator"] if rec["lifecycle"] else ""
            rows.append([
                rec["id"], rec["title"], rec["formula"], rec["status"],
                rec["unit"], rec["current_version"],
                rec["result_summary"]["total_steps"],
                rec["result_summary"]["division_by_zero_steps"],
                div, last_op, rec["updated_at"], rec["status"],
            ])
        return rows


store = RecurrenceStore()
