#!/usr/bin/env python3
"""
宠物训练课报告导入/重新导入脚本（实际可运行链路版本 V2
=====================================================

✅ 返回体判断、去重键对齐、人工字段保护、异常计数闭环
"""

import json
import sys
import os
import re
import subprocess
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple


def _unwrap(val: Any) -> Any:
    """把 Base 返回值从 list 包装里取出来（单选/复选框等会是 [value]）"""
    if isinstance(val, list):
        return val[0] if len(val) > 0 else None
    return val


class TrainingRecordImporter:
    OK_KEY = "ok"
    DATA_KEY = "data"
    ERROR_KEY = "error"

    def __init__(self, config_path: str = "import_config.json"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

        self.base_token = self.config["base_token"]
        self.table_ids = self.config["tables"]
        self.dedup_fields = self.config["dedup_key_fields"]
        self.protected_fields_cfg = self.config["protected_fields"]
        self.auto_fill_fields = self.config["auto_fill_empty_fields"]
        self.non_override_fields = self.config["non_override_fields"]
        self.exception_types = self.config["exception_types"]

        self.field_alias_map: Dict[str, str] = {}
        self.field_alias_used: Dict[str, str] = {}

        self.stats = {
            "total": 0,
            "new": 0,
            "skipped": 0,
            "updated": 0,
            "protected": 0,
            "exceptions": 0,
        }

        self.exception_records: List[Dict] = []
        self.source = "系统导入"
        self.import_file_name = ""
        self.import_remark: List[str] = []
        self.as_user = True

    # ========== CLI 封装层 ==========

    def _extract_json(self, raw: str) -> Tuple[Optional[Dict], str]:
        """从 CLI 原始输出中提取 JSON（去掉 ANSI / 代理 warning 等杂音）"""
        clean = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", raw)
        lines = clean.splitlines()
        candidate = "\n".join(l for l in lines if not l.startswith("[lark-cli]"))
        start = candidate.find("{")
        if start < 0:
            return None, candidate
        try:
            return json.loads(candidate[start:]), candidate[start:]
        except json.JSONDecodeError:
            return None, candidate

    def _ok(self, payload: Dict) -> bool:
        """按已有项目脚本风格：ok=True 且有 data 层才认为成功"""
        if not isinstance(payload, dict):
            return False
        top_ok = payload.get(self.OK_KEY, False)
        return bool(top_ok and self.DATA_KEY in payload)

    def _run_cli(self, cmd: List[str]) -> Dict:
        """运行 lark-cli，返回解析后的 JSON（含 data / error 结构"""
        full_cmd = ["lark-cli"] + cmd
        if self.as_user:
            full_cmd += ["--as", "user"]
        env = {**os.environ, "LARK_CLI_NO_PROXY": "1"}
        result = subprocess.run(full_cmd, capture_output=True, text=True, env=env)
        stdout = (result.stdout or "") + (result.stderr or "")

        payload, raw = self._extract_json(stdout)
        if payload is None:
            if result.returncode != 0 or not stdout.strip():
                return {self.OK_KEY: False, self.ERROR_KEY: {"message": f"exit {result.returncode}", "raw": result.stderr[:200]}}
            return {self.OK_KEY: False, self.ERROR_KEY: {"message": "no_json", "raw": raw[:200]}}
        if not self._ok(payload):
            err = payload.get(self.ERROR_KEY, {})
            msg = err.get("message", "unknown") if isinstance(err, dict) else str(err)
            print(f"   [cli 🔴 CLI 返回异常: {msg}")
        return payload

    # ========== 工具方法 ==========

    @staticmethod
    def _fmt_val(v: Any) -> str:
        """把单元格值格式化成可打印的样子（解决 list/None）"""
        if v is None:
            return ""
        if isinstance(v, list):
            return TrainingRecordImporter._fmt_val(v[0]) if v else ""
        return str(v)[:30]

    @staticmethod
    def _is_empty(v: Any) -> bool:
        if v is None:
            return True
        if isinstance(v, list):
            return len(v) == 0 or all(TrainingRecordImporter._is_empty(x) for x in v)
        if isinstance(v, str):
            return not v.strip()
        return False

    # ========== 1. 加载字段别名 ==========

    def load_field_aliases(self) -> Dict[str, str]:
        print("🔍 从 Base 读取「字段别名映射表」...")
        payload = self._run_cli([
            "base", "+record-list",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["field_alias"],
            "--format", "json",
        ])

        alias_map: Dict[str, str] = {}
        if not self._ok(payload):
            print(f"   ⚠️  别名映射表读取失败，本次导入仍可继续（只用标准字段）")
            self.field_alias_map = alias_map
            return alias_map

        items = (payload.get(self.DATA_KEY, {}).get("items") or [])
        for item in items:
            fields = item.get("fields", {})
            enabled = _unwrap(fields.get("是否启用")) or False
            if not enabled:
                continue
            std_field = _unwrap(fields.get("标准字段名")) or ""
            alias = _unwrap(fields.get("运营主管使用的别名"))
            if isinstance(alias, list):
                alias = alias[0] if alias else ""
            if std_field and alias:
                alias_map[alias] = std_field
                print(f"   ✅ 「{alias}」 → 「{std_field}」")

        self.field_alias_map = alias_map
        total = len(alias_map)
        print(f"   共加载 {total} 条已启用别名映射")
        return alias_map

    # ========== 2. 字段归一化 ==========

    def normalize_fields(self, input_fields: List[str]) -> Tuple[List[str], Dict[str, str]]:
        """把 Excel 列名归一化成标准字段；发现不一致就登记异常并递增计数"""
        normalized: List[str] = []
        used: Dict[str, str] = {}

        for col in input_fields:
            if col in self.field_alias_map:
                std = self.field_alias_map[col]
                normalized.append(std)
                used[std] = col
                print(f"   🔀 归一化:「{col}」→「{std}」")
                self.exception_records.append({
                    "type": self.exception_types["field_alias_mismatch"],
                    "original_name": col,
                    "pet_name": "",
                    "description": f"导入列名「{col}」已归一化到标准「{std}」",
                    "default_reason": f"运营主管习惯使用别名「{col}」，在映射表中已登记，系统自动匹配",
                    "default_impact": "仅影响本次导入该列；标准字段无偏差",
                    "report_no": "",
                })
                self.stats["exceptions"] += 1
                self.import_remark.append(f"字段别名归一化:{col}→{std}")
            else:
                normalized.append(col)
        self.field_alias_used = used
        return normalized, used

    # ========== 3. 稳定去重键（与 Base 公式对齐：4 段） ==========

    def generate_dedup_key(self, record: Dict[str, Any]) -> str:
        """稳定键：宠物姓名_主人姓名_上课日期(YYYYMMDD)_课程名称（4 段，与 import_config + Base 公式对齐"""
        parts: List[str] = []
        for fname in self.dedup_fields:
            raw = record.get(fname, "")
            val = _unwrap(raw) or ""
            if fname == "上课日期":
                s = str(val).strip()
                try:
                    dt = datetime.strptime(s[:10], "%Y-%m-%d")
                    val = dt.strftime("%Y%m%d")
                except (ValueError, IndexError):
                    val = re.sub(r"\D", "", s)[:8]
            parts.append(str(val).strip())
        return "_".join(parts)

    # ========== 4. 查重 ==========

    def search_existing_record(self, dedup_key: str) -> Optional[Dict]:
        """按「唯一去重键」搜索已有记录，命中即返回第一条"""
        payload = self._run_cli([
            "base", "+record-search",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({
                "field_names": ["唯一去重键"],
                "filter": {"conjunction": "and", "conditions": [
                    {"field_name": "唯一去重键", "operator": "is", "value": dedup_key}
                ]},
            }, ensure_ascii=False),
        ])
        if not self._ok(payload):
            return None
        data = payload[self.DATA_KEY]
        total = data.get("total", 0)
        items = data.get("items", [])
        if total and items and len(items) > 0:
            hit = items[0]
            rid = hit.get("record_id", "")
            pet = self._fmt_val((hit.get("fields", {}).get("宠物姓名")))
            print(f"   🎯 命中已有记录 (id={rid}, pet={pet})")
            return hit
        return None

    # ========== 5. 人工字段保护判定 ==========

    def _field_protection_info(self, field_name: str, existing_fields: Dict) -> Tuple[bool, str]:
        """判断某字段在已有记录里是否应被保护"""
        protect_cfg = (self.protected_fields_cfg.get("main", {}).get(field_name))
        if protect_cfg is None:
            return False, ""

        if isinstance(protect_cfg, str):
            flag_field = protect_cfg
            flag_val = _unwrap(existing_fields.get(flag_field))
            if flag_val:
                return True, f"「{flag_field}」已勾选"
            return False, ""

        if isinstance(protect_cfg, dict):
            protected_values = protect_cfg.get("protected_values", [])
            cur = _unwrap(existing_fields.get(field_name)) or ""
            if cur in protected_values:
                return True, f"当前值「{cur}」是受保护状态"
        return False, ""

    # ========== 6. 合并新旧记录 ==========

    def merge_for_update(self, existing: Dict, new_rec: Dict, used_aliases: Dict[str, str]
    ) -> Tuple[Dict[str, Any], bool, int, List[str]]:
        """合并策略：
        - 跳过系统字段
        - 受保护字段 → 不覆盖（计数+1
        - 非覆盖字段（来源/处理状态）→ 已有非空则保留
        - 空字段 → 补齐
        - 自动更新字段 → 允许覆盖
        """
        old = existing.get("fields", {})
        merged: Dict[str, Any] = dict(old)
        has_changes = False
        protect_cnt = 0
        logs: List[str] = []

        sys_fields = {"唯一去重键", "疫苗缺失标记", "创建时间", "更新时间", "创建人", "更新人", "报告编号"}
        for fname, new_val in new_rec.items():
            if fname in sys_fields:
                continue

            is_protected, why = self._field_protection_info(fname, old)
            if is_protected:
                protect_cnt += 1
                logs.append(f"🔒 「{fname}」保护（{why}）→ 跳过")
                if fname == "主人微信备注" and "主人微信备注" in used_aliases:
                    orig = merged.get("微信备注原始字段名")
                    new_orig = used_aliases["主人微信备注"]
                    if orig != new_orig:
                        merged["微信备注原始字段名"] = new_orig
                        has_changes = True
                        logs.append(f"➕ 「微信备注原始字段名」→「{new_orig}」")
                continue

            old_val = old.get(fname)
            old_empty = self._is_empty(old_val)
            new_empty = self._is_empty(new_val)
            old_str = self._fmt_val(old_val)
            new_str = self._fmt_val(new_val)

            # 非覆盖字段：处理状态、数据来源 —— 只要原来非空就不动
            if fname in self.non_override_fields and not old_empty:
                logs.append(f"⏭️ 「{fname}」→ 保留「{old_str}」(非覆盖字段)")
                continue

            # 来源字段：写当前导入的来源始终覆盖（避免"历史来源始终覆盖（便于审计）—— 但只在不一样的时候才改
            if fname == "数据来源":
                if _unwrap(old_val) != self.source:
                    merged[fname] = self.source
                    has_changes = True
                    logs.append(f"🔄 「数据来源」→「{self.source}」")
                continue

            # 主人微信备注的原始列名更新
            if fname == "主人微信备注" and fname in used_aliases:
                merged["微信备注原始字段名"] = used_aliases[fname]
                has_changes = True

            # 主逻辑：空补齐 / 非空在 auto_fill 就覆盖
            if old_empty and not new_empty:
                merged[fname] = new_val
                has_changes = True
                logs.append(f"➕ 「{fname}」空补齐 →「{new_str}」")
            elif (not old_empty and not new_empty
                  and old_str != new_str
                  and fname in self.auto_fill_fields):
                merged[fname] = new_val
                has_changes = True
                logs.append(f"🔄 「{fname}」「{old_str}」→「{new_str}」")
            else:
                logs.append(f"⏭️ 「{fname}」保留「{old_str}」")

        # 处理状态在"待补材料" 但疫苗缺失补上了 → 自动切已处理
        v_old_status = _unwrap(old.get("处理状态")) or ""
        v_new_vaccine = _unwrap(new_rec.get("疫苗接种日期")) or ""
        if (v_old_status == "待补材料"
            and not self._is_empty(v_new_vaccine)
            and self._is_empty(old.get("疫苗接种日期"))):
            merged["处理状态"] = v_old_status  # 保持待补材料(需人工确认后再改)

        return merged, has_changes, protect_cnt, logs

    # ========== 7. 更新记录 ==========

    def update_record(self, record_id: str, fields: Dict) -> bool:
        payload = self._run_cli([
            "base", "+record-batch-update",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({
                "records": [{"record_id": record_id, "fields": fields}],
            }, ensure_ascii=False),
        ])
        if not self._ok(payload):
            return False
        data = payload[self.DATA_KEY]
        records_updated = data.get("records") or data.get("record_id_list")
        return bool(records_updated is not None and (
            (isinstance(records_updated, list) and len(records_updated) > 0)
            or (isinstance(records_updated, int) and records_updated > 0)
        ))

    # ========== 8. 创建记录 ==========

    def create_record(self, fields: Dict, used_aliases: Dict[str, str]) -> bool:
        out = dict(fields)
        if "主人微信备注" in used_aliases:
            out["微信备注原始字段名"] = used_aliases["主人微信备注"]
        out["数据来源"] = self.source
        if self._is_empty(out.get("处理状态")):
            out["处理状态"] = "已处理"
        out["人工备注保护标记"] = False if self._is_empty(out.get("人工备注保护标记")) else out["人工备注保护标记"]

        fnames = list(out.keys())
        fvals = [out[k] for k in fnames]
        payload = self._run_cli([
            "base", "+record-batch-create",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({"fields": fnames, "rows": [fvals]}, ensure_ascii=False),
        ])
        if not self._ok(payload):
            return False
        rec_ids = payload[self.DATA_KEY].get("record_id_list")
        return bool(rec_ids and len(rec_ids) > 0)

    # ========== 9. 疫苗缺失异常 ==========

    def detect_vaccine_missing(self, rec: Dict, pet: str) -> None:
        v = rec.get("疫苗接种日期")
        if self._is_empty(v):
            # 未找到：待查：
            print(f"   ⚠️  「{pet}」疫苗日期缺失 → 登记异常")
            self.exception_records.append({
                "type": self.exception_types["vaccine_missing"],
                "pet_name": pet,
                "report_no": "",
                "description": f"宠物「{pet}」的疫苗接种日期为空",
                "default_reason": "需要主管与主人确认或在医院系统内查询接种记录",
                "default_impact": "本次课程报告标记待补材料；补到疫苗后方可判定训练合规性",
                "original_name": "疫苗接种日期",
            })
            self.stats["exceptions"] += 1
            # 处理状态若为空则设为待补材料
            if self._is_empty(rec.get("处理状态")):
                rec["处理状态"] = "待补材料"

    # ========== 10. 写异常记录 ==========

    def flush_exceptions(self) -> None:
        if not self.exception_records:
            return
        print(f"\n📝 写入 {len(self.exception_records)} 条异常记录...")
        fields = ["关联报告编号", "关联宠物姓名", "异常类型", "异常描述",
                  "人工确认理由", "影响范围", "处理状态", "原始字段名记录",
                  "来源材料链接"]
        rows = []
        for e in self.exception_records:
            rows.append([
                e.get("report_no", ""),
                e.get("pet_name", ""),
                e.get("type", "其他异常"),
                e.get("description", ""),
                e.get("default_reason", ""),
                e.get("default_impact", ""),
                "待确认",
                e.get("original_name", ""),
                f"https://pcnokj2bs6ug.feishu.cn/base/{self.base_token}",
            ])
        payload = self._run_cli([
            "base", "+record-batch-create",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["exception"],
            "--json", json.dumps({"fields": fields, "rows": rows}, ensure_ascii=False),
        ])
        if self._ok(payload):
            ids = payload[self.DATA_KEY].get("record_id_list") or []
            print(f"   ✅ 异常记录写入 {len(ids)} 条")
        else:
            print(f"   ❌ 异常记录写入失败: {payload.get(self.ERROR_KEY, {}).get('message', 'unknown') if isinstance(payload.get(self.ERROR_KEY), dict) else payload.get(self.ERROR_KEY)}")

    # ========== 11. 写导入日志 ==========

    def flush_import_log(self) -> None:
        print(f"\n📊 写入导入日志...")
        fields = ["导入文件名", "导入总条数", "新增条数", "跳过重复条数",
                  "人工备注保护条数", "异常条数", "导入状态", "备注说明"]
        status = "已完成" if self.stats["exceptions"] == 0 else "部分完成"
        remark = " | ".join([f"导入源:{self.source}"] + self.import_remark)
        rows = [[
            self.import_file_name,
            self.stats["total"],
            self.stats["new"],
            self.stats["skipped"],
            self.stats["protected"],
            self.stats["exceptions"],
            status,
            remark,
        ]]
        payload = self._run_cli([
            "base", "+record-batch-create",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["import_log"],
            "--json", json.dumps({"fields": fields, "rows": rows}, ensure_ascii=False),
        ])
        if self._ok(payload):
            ids = payload[self.DATA_KEY].get("record_id_list") or []
            print(f"   ✅ 导入日志写入 {len(ids)} 条")
        else:
            print(f"   ❌ 导入日志写入失败: {payload.get(self.ERROR_KEY, {}).get('message', 'unknown') if isinstance(payload.get(self.ERROR_KEY), dict) else payload.get(self.ERROR_KEY)}")

    # ========== 12. 摘要输出 ==========

    def print_summary(self) -> None:
        bar = "=" * 62
        print("\n" + bar)
        print("📊 导入结果统计")
        print(bar)
        print(f"  总条数      : {self.stats['total']}")
        print(f"  ✅ 新增      : {self.stats['new']}")
        print(f"  ⏭️  跳过重复  : {self.stats['skipped']}")
        print(f"  🔄 更新      : {self.stats['updated']}")
        print(f"  🔒 保护人工字段: {self.stats['protected']}")
        print(f"  ⚠️  异常数量  : {self.stats['exceptions']}")
        print(bar)
        if self.exception_records:
            print("\n⚠️  异常摘要 (详情见「异常记录表」)")
            for i, e in enumerate(self.exception_records, 1):
                tp = e.get("type", "?")
                who = e.get("pet_name") or e.get("original_name") or ""
                desc = e.get("description", "")
                print(f"  {i:>2}. [{tp}] {who} | {desc[:60]}")
        print(bar)

    # ========== 主流程 ==========

    def import_file(self, file_path: str, source: str = "系统导入", as_user: bool = True) -> Dict:
        self.as_user = as_user
        self.source = source
        self.import_file_name = os.path.basename(file_path)
        print(f"\n{'=' * 62}")
        print(f"🚀 开始导入: {file_path}")
        print(f"   数据源标记: {source}")
        print(f"   身份: {'用户(user)' if as_user else '应用(bot)'}")
        print(f"{'=' * 62}")

        with open(file_path, "r", encoding="utf-8") as f:
            blob = json.load(f)
        in_fields = blob["fields"]
        in_rows = blob["rows"]
        self.stats["total"] = len(in_rows)

        # 1) 加载别名
        self.load_field_aliases()
        # 2) 归一化
        norm_fields, used_aliases = self.normalize_fields(in_fields)
        print(f"\n📋 归一化后标准字段列表: {norm_fields}")
        if used_aliases:
            print(f"   使用的别名映射: {used_aliases}")

        # 3) 逐条处理
        for idx, row in enumerate(in_rows, 1):
            rec = dict(zip(norm_fields, row))
            pet = _unwrap(rec.get("宠物姓名")) or "未知"
            print(f"\n📍 [{idx}/{len(in_rows)} 宠物「{pet}」")
            # 4) 生成稳定去重键
            dk = self.generate_dedup_key(rec)
            print(f"   去重键(4段): {dk}")
            # 5) 查重
            hit = self.search_existing_record(dk)
            if hit is not None:
                self.stats["skipped"] += 1
                merged, changed, pcnt, ulogs = self.merge_for_update(hit, rec, used_aliases)
                for ul in ulogs:
                    print(f"   {ul}")
                if pcnt:
                    self.stats["protected"] += pcnt
                    who = _unwrap(hit["fields"].get("宠物姓名")) or pet
                    self.exception_records.append({
                        "type": self.exception_types["note_conflict"],
                        "pet_name": who,
                        "report_no": "",
                        "description": f"「{who}」有 {pcnt} 个人工字段在重复导入时被保护，未被覆盖",
                        "default_reason": f"人工备注保护标记已勾选 或 处理状态为人工改判",
                        "default_impact": "仅本记录指定字段不更新；其余字段按规则补齐/覆盖",
                    })
                    self.stats["exceptions"] += 1
                    self.import_remark.append(f"保护:{who}x{pcnt}")
                if changed:
                    ok = self.update_record(hit["record_id"], merged)
                    if ok:
                        self.stats["updated"] += 1
                        print(f"   ✅ 记录已更新")
                    else:
                        print(f"   ❌ 更新失败")
                else:
                    print(f"   ⏭️  无变化不更新")
                # 疫苗缺失再次确认
                self.detect_vaccine_missing(merged, pet)
            else:
                print(f"   🆕 无重复 → 创建新记录")
                # 处理状态若空 & 疫苗缺失先标记待补
                self.detect_vaccine_missing(rec, pet)
                ok = self.create_record(rec, used_aliases)
                if ok:
                    self.stats["new"] += 1
                    print(f"   ✅ 新记录已创建")
                else:
                    print(f"   ❌ 创建失败")

        # 异常 & 日志落盘 & 摘要
        self.flush_exceptions()
        self.flush_import_log()
        self.print_summary()
        return dict(self.stats)


def main() -> None:
    parser = argparse.ArgumentParser(description="宠物训练课报告导入工具 v2")
    parser.add_argument("input_file", help="导入数据文件路径 (.json)")
    parser.add_argument("--source", default="系统导入", help="数据来源 (默认系统导入)")
    parser.add_argument("--as-bot", action="store_true", help="使用应用(bot)身份导入（默认用户身份）")
    args = parser.parse_args()
    if not os.path.exists(args.input_file):
        print(f"❌ 文件不存在: {args.input_file}")
        sys.exit(1)
    importer = TrainingRecordImporter()
    importer.import_file(args.input_file, args.source, as_user=not args.as_bot)


if __name__ == "__main__":
    main()
