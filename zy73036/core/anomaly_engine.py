from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime
import json
import os
from .models import (WeightRecord, AnomalyRecord, AnomalyType,
                     ProcessingStatus, HistoryChange, WeightCurveSnapshot,
                     stable_anomaly_id)
from .weight_curve import WeightCurveManager


class AnomalyEngine:
    def __init__(self, curve_manager: WeightCurveManager):
        self.curve_manager = curve_manager
        self.anomalies: List[AnomalyRecord] = []
        self.anomalies_by_pet: Dict[str, List[AnomalyRecord]] = defaultdict(list)
        self.history: List[HistoryChange] = []
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(base, "config", "system_config.json"), "r", encoding="utf-8") as f:
            self.sys_cfg = json.load(f)

    def detect_all(self) -> List[AnomalyRecord]:
        self.anomalies.clear()
        self.anomalies_by_pet.clear()
        self._detect_unit_mismatch()
        self._detect_field_missing()
        self._detect_weight_jump_and_conflict()
        return self.anomalies

    def _make_anomaly(self, **kwargs) -> AnomalyRecord:
        a = AnomalyRecord(**kwargs)
        a.ensure_stable_id()
        self.anomalies.append(a)
        if a.pet_id:
            self.anomalies_by_pet[a.pet_id].append(a)
        return a

    def _detect_unit_mismatch(self):
        for rec in self.curve_manager.records:
            if rec.processing_status == ProcessingStatus.UNIT_CONFIRM_REQUIRED:
                roles = self.sys_cfg["responsible_roles"]["unit_mismatch"]
                norm_info = self.curve_manager.unit_normalizer.full_normalize(
                    rec.raw_weight_value, rec.raw_unit_value)
                self._make_anomaly(
                    anomaly_type=AnomalyType.UNIT_MIXED,
                    severity="high",
                    pet_id=rec.pet_id,
                    pet_name=rec.pet_name,
                    description=f"宠物{rec.pet_name}({rec.pet_id})体重单位异常："
                                f"原始值='{rec.raw_weight_value}'，单位字段='{rec.raw_unit_value}'",
                    block_reason=norm_info.get("block_reason", "单位无法确定"),
                    next_step=roles["instruction"],
                    responsible_role=roles["role"],
                    responsible_contact=roles["contact"],
                    involved_record_ids=[rec.record_id],
                    weight_curve_ref=f"pet={rec.pet_id}",
                    calc_formula="单位识别：字段值匹配 + 内嵌单位正则匹配；冲突即告警",
                    status=ProcessingStatus.UNIT_CONFIRM_REQUIRED,
                    extra={"raw_numeric": norm_info.get("raw_numeric"),
                           "source_file": rec.source_file, "source_row": rec.source_row,
                           "original_weight_field": rec.raw_fields},
                )

    def _detect_field_missing(self):
        roles = self.sys_cfg["responsible_roles"]["missing_field"]
        for rec in self.curve_manager.records:
            if rec.processing_status == ProcessingStatus.FIELD_MISSING:
                self._make_anomaly(
                    anomaly_type=AnomalyType.FIELD_MISSING,
                    severity="medium",
                    pet_id=rec.pet_id,
                    pet_name=rec.pet_name,
                    description=f"宠物{rec.pet_name}({rec.pet_id})必填字段缺失",
                    block_reason="体重量无法解析或为空",
                    next_step=roles["instruction"],
                    responsible_role=roles["role"],
                    responsible_contact=roles["contact"],
                    involved_record_ids=[rec.record_id],
                    weight_curve_ref=f"pet={rec.pet_id}",
                    calc_formula="检测规则：非空 + 数值可解析",
                    status=ProcessingStatus.FIELD_MISSING,
                    extra={"source_file": rec.source_file, "source_row": rec.source_row},
                )
            elif not rec.measure_date:
                self._make_anomaly(
                    anomaly_type=AnomalyType.FIELD_MISSING,
                    severity="medium",
                    pet_id=rec.pet_id,
                    pet_name=rec.pet_name,
                    description=f"宠物{rec.pet_name}({rec.pet_id})测量日期缺失或无法解析",
                    block_reason="日期格式不支持或为空",
                    next_step=roles["instruction"],
                    responsible_role=roles["role"],
                    responsible_contact=roles["contact"],
                    involved_record_ids=[rec.record_id],
                    weight_curve_ref=f"pet={rec.pet_id}",
                    calc_formula="支持 YYYY-MM-DD、YYYY/MM/DD、ISO等",
                    status=ProcessingStatus.FIELD_MISSING,
                    extra={"source_file": rec.source_file, "source_row": rec.source_row,
                           "raw_date": rec.raw_fields.get("measure_date", rec.raw_fields)},
                )

    def _detect_weight_jump_and_conflict(self):
        threshold = self.sys_cfg["anomaly_threshold"]["weight_jump_ratio"]
        roles = self.sys_cfg["responsible_roles"]["data_conflict"]
        curves = self.curve_manager.build_all_curves()
        for pet_id, snap in curves.items():
            points = snap.points
            for i in range(1, len(points)):
                prev = points[i - 1]
                curr = points[i]
                p_w = prev["weight_kg"]
                c_w = curr["weight_kg"]
                if not p_w or not c_w:
                    continue
                ratio = abs(c_w - p_w) / p_w
                if ratio >= threshold:
                    involved = [prev["record_id"], curr["record_id"]]
                    self._make_anomaly(
                        anomaly_type=AnomalyType.WEIGHT_JUMP,
                        severity="high",
                        pet_id=pet_id,
                        pet_name=snap.pet_name,
                        description=f"宠物{snap.pet_name}({pet_id})从{prev['date']}到{curr['date']}"
                                    f"体重骤变：{p_w}kg → {c_w}kg，变化率={round(ratio*100,2)}%",
                        block_reason=f"两次相邻称重相差超过阈值{threshold*100}%，疑似数据冲突或主人补充信息与旧记录不一致",
                        next_step=roles["instruction"],
                        responsible_role=roles["role"],
                        responsible_contact=roles["contact"],
                        involved_record_ids=involved,
                        weight_curve_ref=f"pet={pet_id}#points[{i-1},{i}]",
                        calc_formula=f"abs(prev-curr)/prev ≥ {threshold}；本次计算：abs({p_w}-{c_w})/{p_w}={round(ratio,4)}",
                        status=ProcessingStatus.DATA_CONFLICT,
                        extra={"prev_weight": p_w, "curr_weight": c_w,
                               "prev_date": prev["date"], "curr_date": curr["date"],
                               "prev_source": prev["source_file"],
                               "curr_source": curr["source_file"],
                               "prev_row": prev["source_row"],
                               "curr_row": curr["source_row"]},
                    )
            if len(points) >= 2:
                sources_map = defaultdict(list)
                for p in points:
                    src = p["source_file"] or p["source"] or "unknown"
                    sources_map[src].append(p)
                if len(sources_map) > 1:
                    for i, p in enumerate(points):
                        for j, q in enumerate(points):
                            if j <= i:
                                continue
                            if p["date"] == q["date"] and p["source_file"] != q["source_file"]:
                                involved = [p["record_id"], q["record_id"]]
                                diff = abs(p["weight_kg"] - q["weight_kg"])
                                self._make_anomaly(
                                    anomaly_type=AnomalyType.DATA_CONFLICT,
                                    severity="high",
                                    pet_id=pet_id,
                                    pet_name=snap.pet_name,
                                    description=f"同日不同来源数据冲突：日期{p['date']}，"
                                                f"来源1={p['source_file']}({p['weight_kg']}kg)，"
                                                f"来源2={q['source_file']}({q['weight_kg']}kg)，相差{diff}kg",
                                    block_reason="同一天来自不同文件/来源的数据对不上，疑似主人补充信息和旧记录冲突",
                                    next_step=roles["instruction"],
                                    responsible_role=roles["role"],
                                    responsible_contact=roles["contact"],
                                    involved_record_ids=involved,
                                    weight_curve_ref=f"pet={pet_id}#points[{i},{j}]",
                                    calc_formula=f"同日同pet + 来源不同 + 体重差>0 => 冲突告警",
                                    status=ProcessingStatus.DATA_CONFLICT,
                                    extra={"p1": p, "p2": q, "diff_kg": diff},
                                )

    def confirm_unit(self, anomaly_id: str, confirmed_unit: str,
                     operator: str = "阿岑", remark: str = "") -> AnomalyRecord:
        anomaly = self._find_anomaly(anomaly_id)
        if not anomaly:
            return None
        anomaly_id = anomaly.anomaly_id
        rec_ids = anomaly.involved_record_ids
        old_vals = {}
        new_vals = {}
        for rid in rec_ids:
            rec = self._find_record(rid)
            if not rec:
                continue
            old_vals[rid] = {
                "processing_status": rec.processing_status.value,
                "weight_kg": rec.weight_kg,
                "weight_unit": rec.weight_unit,
                "unit_normalized": rec.unit_normalized,
            }
            raw = rec.raw_weight_value
            norm = self.curve_manager.unit_normalizer.full_normalize(raw, confirmed_unit)
            rec.weight_kg = norm["weight_kg"]
            rec.weight_unit = norm["std_unit"] or confirmed_unit
            rec.unit_normalized = norm["unit_normalized"]
            if norm["unit_normalized"]:
                rec.processing_status = ProcessingStatus.CONFIRMED
            rec.updated_at = datetime.now()
            if remark:
                rec.remark = (rec.remark + " | " if rec.remark else "") + remark
            new_vals[rid] = {
                "processing_status": rec.processing_status.value,
                "weight_kg": rec.weight_kg,
                "weight_unit": rec.weight_unit,
                "unit_normalized": rec.unit_normalized,
            }
        change = HistoryChange(
            anomaly_id=anomaly_id,
            changed_by=operator,
            action="确认单位",
            old_values=old_vals,
            new_values=new_vals,
            revision_reason=f"人工确认单位为: {confirmed_unit}",
            previous_conclusion=anomaly.status.value,
            new_conclusion="已确认单位，重新计算体重曲线",
            old_remark=anomaly.block_reason,
            new_remark=remark or anomaly.block_reason,
        )
        change.ensure_stable_id()
        self.history.append(change)
        anomaly.status = ProcessingStatus.RESOLVED
        anomaly.resolved_at = datetime.now()
        anomaly.resolved_by = operator
        anomaly.updated_at = datetime.now()
        return anomaly

    def revise_conclusion(self, anomaly_id: str, new_conclusion: str,
                          revision_reason: str, operator: str = "阿岑",
                          new_remark: str = "", override_values: Dict = None) -> AnomalyRecord:
        anomaly = self._find_anomaly(anomaly_id)
        if not anomaly:
            return None
        anomaly_id = anomaly.anomaly_id
        old_vals = {}
        new_vals = {}
        if override_values:
            for rid in anomaly.involved_record_ids:
                rec = self._find_record(rid)
                if not rec:
                    continue
                old_vals[rid] = {
                    "weight_kg": rec.weight_kg,
                    "processing_status": rec.processing_status.value,
                    "remark": rec.remark,
                }
                if "weight_kg" in override_values:
                    rec.weight_kg = override_values["weight_kg"]
                    rec.unit_normalized = True
                rec.processing_status = ProcessingStatus.REVISED
                if new_remark:
                    rec.remark = (rec.remark + " | " if rec.remark else "") + new_remark
                rec.updated_at = datetime.now()
                new_vals[rid] = {
                    "weight_kg": rec.weight_kg,
                    "processing_status": rec.processing_status.value,
                    "remark": rec.remark,
                }
        prev_conc = anomaly.status.value
        change = HistoryChange(
            anomaly_id=anomaly_id,
            changed_by=operator,
            action="改判结论",
            old_values=old_vals,
            new_values=new_vals,
            revision_reason=revision_reason,
            previous_conclusion=prev_conc,
            new_conclusion=new_conclusion,
            old_remark=anomaly.block_reason,
            new_remark=new_remark or anomaly.block_reason,
            source_materials_ref=anomaly.involved_record_ids,
        )
        change.ensure_stable_id()
        self.history.append(change)
        anomaly.status = ProcessingStatus.REVISED
        anomaly.block_reason = f"[原]{anomaly.block_reason} [改判原因]{revision_reason}"
        anomaly.updated_at = datetime.now()
        anomaly.resolved_at = datetime.now()
        anomaly.resolved_by = operator
        return anomaly

    def get_history_for_anomaly(self, anomaly_id: str) -> List[HistoryChange]:
        return [
            h for h in self.history
            if h.anomaly_id == anomaly_id
            or anomaly_id.startswith(h.anomaly_id)
            or h.anomaly_id.startswith(anomaly_id)
        ]

    def get_history_for_pet(self, pet_id: str) -> List[HistoryChange]:
        target_anom_ids = {a.anomaly_id for a in self.anomalies_by_pet.get(pet_id, [])}
        return [h for h in self.history if h.anomaly_id in target_anom_ids]

    def _find_anomaly(self, aid: str) -> AnomalyRecord:
        exact = [a for a in self.anomalies if a.anomaly_id == aid]
        if exact:
            return exact[0]
        for a in self.anomalies:
            if a.anomaly_id.startswith(aid):
                return a
        return None

    def _find_record(self, rid: str) -> WeightRecord:
        for r in self.curve_manager.records:
            if r.record_id == rid:
                return r
        return None

    def anomaly_queue_to_dicts(self, filters: Dict = None) -> List[Dict]:
        filters = filters or {}
        out = []
        for a in self.anomalies:
            include = True
            if "status" in filters and a.status.value != filters["status"]:
                include = False
            if "anomaly_type" in filters and a.anomaly_type.value != filters["anomaly_type"]:
                include = False
            if "pet_id" in filters and a.pet_id != filters["pet_id"]:
                include = False
            if "responsible_role" in filters and a.responsible_role != filters["responsible_role"]:
                include = False
            if not include:
                continue
            d = a.to_dict()
            d["来源文件清单"] = "; ".join(sorted({
                str(x.get("source_file", ""))
                for x in [a.extra.get("p1", {}), a.extra.get("p2", {}), a.extra]
                if x.get("source_file")
            })) or (a.extra.get("source_file") if a.extra else "")
            d["处理状态"] = a.status.value
            d["异常类型"] = a.anomaly_type.value
            d["责任人-角色"] = a.responsible_role
            d["责任人-联系人"] = a.responsible_contact
            out.append(d)
        return out

    def save_anomaly_queue(self, out_path: str, filters: Dict = None):
        data = self.anomaly_queue_to_dicts(filters)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return out_path

    def save_anomaly_objects(self, out_path: str):
        data = [a.to_dict() for a in self.anomalies]
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return out_path

    def load_anomaly_objects(self, path: str) -> Dict[str, AnomalyRecord]:
        if not os.path.exists(path):
            return {}
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        saved = {}
        for item in raw:
            try:
                a = AnomalyRecord.from_dict(item)
                a.ensure_stable_id()
                saved[a.anomaly_id] = a
            except Exception:
                continue
        self._merge_saved_anomaly_status(saved)
        return saved

    def _merge_saved_anomaly_status(self, saved: Dict[str, AnomalyRecord]):
        for live in self.anomalies:
            s = saved.get(live.anomaly_id)
            if not s:
                continue
            if s.status.value != live.status.value:
                live.status = s.status
            if s.block_reason and s.block_reason != live.block_reason:
                live.block_reason = s.block_reason
            if s.resolved_at:
                live.resolved_at = s.resolved_at
            if s.resolved_by:
                live.resolved_by = s.resolved_by
            if s.updated_at:
                live.updated_at = s.updated_at
            if s.extra:
                for k, v in s.extra.items():
                    live.extra.setdefault(k, v)

    def save_history(self, out_path: str):
        data = [h.to_dict() for h in self.history]
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return out_path

    def load_history(self, history_path: str):
        if not os.path.exists(history_path):
            self.history = []
            return []
        with open(history_path, "r", encoding="utf-8") as f:
            raw_items = json.load(f)
        self.history = []
        for item in raw_items:
            try:
                h = HistoryChange.from_dict(item)
                h.ensure_stable_id()
                self.history.append(h)
            except Exception:
                continue
        self.apply_history()
        return self.history

    def apply_history(self):
        dedup = {}
        unique = []
        for change in self.history:
            if change.change_id not in dedup:
                dedup[change.change_id] = True
                unique.append(change)
        self.history = unique
        for change in self.history:
            anomaly = self._find_anomaly(change.anomaly_id)
            for record_id, values in change.new_values.items():
                rec = self._find_record(record_id)
                if rec:
                    self._apply_record_values(rec, values)
            if not anomaly:
                continue
            if change.action == "确认单位":
                anomaly.status = ProcessingStatus.RESOLVED
            elif change.action == "改判结论":
                anomaly.status = ProcessingStatus.REVISED
                if change.revision_reason and "[改判原因]" not in anomaly.block_reason:
                    anomaly.block_reason = f"[原]{anomaly.block_reason} [改判原因]{change.revision_reason}"
            if change.changed_at:
                anomaly.resolved_at = change.changed_at
                anomaly.updated_at = change.changed_at
            if change.changed_by:
                anomaly.resolved_by = change.changed_by

    @staticmethod
    def _apply_record_values(rec: WeightRecord, values: Dict[str, Any]):
        if "weight_kg" in values:
            rec.weight_kg = values["weight_kg"]
        if "weight_unit" in values:
            rec.weight_unit = values["weight_unit"]
        if "unit_normalized" in values:
            rec.unit_normalized = bool(values["unit_normalized"])
        if "processing_status" in values:
            try:
                rec.processing_status = ProcessingStatus(values["processing_status"])
            except ValueError:
                pass
        if "remark" in values:
            rec.remark = values["remark"]
