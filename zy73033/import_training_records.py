#!/usr/bin/env python3
"""
宠物训练课报告导入/重新导入脚本
=================================
功能：
1. 字段别名归一化（运营主管的"主人留言"→标准"主人微信备注"）
2. 生成稳定去重键（宠物姓名+主人姓名+上课日期+课程名称）
3. 查重逻辑：有则智能更新，无则新建
4. 人工字段保护：主人微信备注、人工确认理由、人工改判状态不被覆盖
5. 空字段补齐：已有记录为空的字段用新数据填充
6. 导入统计：新增/跳过/更新/保护条数，写入导入日志表
7. 异常记录自动生成：疫苗缺失、字段名不一致等

用法：
    python3 import_training_records.py <导入数据文件.json> [--source "前台Excel导入"]

导入数据文件格式：
{
  "fields": ["宠物姓名", "主人姓名", "上课日期", "主人留言", ...],
  "rows": [
    ["旺财", "张小强", "2025-04-02 10:00:00", "按时到，状态很好", ...],
    ...
  ]
}
"""

import json
import sys
import os
import subprocess
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple


class TrainingRecordImporter:
    def __init__(self, config_path: str = "import_config.json"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        
        self.base_token = self.config["base_token"]
        self.table_ids = self.config["tables"]
        self.dedup_fields = self.config["dedup_key_fields"]
        self.protected_fields = self.config["protected_fields"]
        self.auto_fill_fields = self.config["auto_fill_empty_fields"]
        self.non_override_fields = self.config["non_override_fields"]
        
        self.field_alias_map: Dict[str, str] = {}
        self.field_alias_used: Dict[str, str] = {}
        
        self.stats = {
            "total": 0,
            "new": 0,
            "skipped": 0,
            "updated": 0,
            "protected": 0,
            "exceptions": 0
        }
        
        self.exception_records: List[Dict] = []
        self.source = "系统导入"
        self.import_file_name = ""

    def _run_cli(self, cmd: List[str], as_user: bool = True) -> Dict:
        """运行 lark-cli 命令"""
        full_cmd = ["lark-cli"] + cmd
        if as_user:
            full_cmd += ["--as", "user"]
        
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            env={**os.environ, "LARK_CLI_NO_PROXY": "1"}
        )
        
        if result.returncode != 0:
            print(f"⚠️  命令失败: {' '.join(full_cmd)}")
            print(f"   stderr: {result.stderr[:500]}")
            print(f"   stdout: {result.stdout[:500]}")
            return {"ok": False, "error": result.stderr}
        
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"ok": False, "error": "invalid json", "raw": result.stdout}

    def load_field_aliases(self) -> Dict[str, str]:
        """从字段别名映射表加载所有启用的别名"""
        print("🔍 加载字段别名映射...")
        
        result = self._run_cli([
            "base", "+record-list",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["field_alias"],
            "--format", "json"
        ])
        
        alias_map = {}
        if result.get("ok") and "data" in result and "items" in result["data"]:
            for item in result["data"]["items"]:
                fields = item.get("fields", {})
                enabled = fields.get("是否启用", [False])[0] if isinstance(fields.get("是否启用"), list) else fields.get("是否启用", False)
                if enabled:
                    std_field = fields.get("标准字段名", [""])[0] if isinstance(fields.get("标准字段名"), list) else fields.get("标准字段名", "")
                    alias = fields.get("运营主管使用的别名", "")
                    if std_field and alias:
                        alias_map[alias] = std_field
                        print(f"   ✅ {alias} → {std_field}")
        
        self.field_alias_map = alias_map
        print(f"   共加载 {len(alias_map)} 条启用的别名映射")
        return alias_map

    def normalize_fields(self, input_fields: List[str]) -> Tuple[List[str], Dict[str, str]]:
        """将输入字段名归一化到标准字段名，返回归一化后的字段列表和使用的别名映射"""
        normalized = []
        used_aliases = {}
        
        for field in input_fields:
            if field in self.field_alias_map:
                std_field = self.field_alias_map[field]
                normalized.append(std_field)
                used_aliases[std_field] = field
                print(f"   🔀 字段别名归一化: '{field}' → '{std_field}'")
                
                if std_field == "主人微信备注":
                    self.exception_records.append({
                        "type": "field_alias_mismatch",
                        "original_name": field,
                        "standard_name": std_field,
                        "note": f"导入字段名'{field}'已归一化到标准字段'{std_field}'"
                    })
            else:
                normalized.append(field)
        
        self.field_alias_used = used_aliases
        return normalized, used_aliases

    def generate_dedup_key(self, record: Dict[str, Any]) -> str:
        """生成稳定去重键：宠物姓名_主人姓名_上课日期(YYYYMMDD)_课程名称"""
        parts = []
        for field in self.dedup_fields:
            val = record.get(field, "")
            if field == "上课日期" and val:
                try:
                    if isinstance(val, str):
                        dt = datetime.strptime(val[:10], "%Y-%m-%d")
                        val = dt.strftime("%Y%m%d")
                except (ValueError, IndexError):
                    val = str(val).replace("-", "")[:8]
            parts.append(str(val).strip())
        
        key = "_".join(parts)
        return key

    def search_existing_record(self, dedup_key: str) -> Optional[Dict]:
        """根据去重键查找已有记录"""
        search_result = self._run_cli([
            "base", "+record-search",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({
                "field_names": ["唯一去重键"],
                "filter": {
                    "conjunction": "and",
                    "conditions": [{
                        "field_name": "唯一去重键",
                        "operator": "is",
                        "value": dedup_key
                    }]
                }
            }, ensure_ascii=False)
        ])
        
        if search_result.get("ok") and search_result.get("data", {}).get("total", 0) > 0:
            items = search_result["data"].get("items", [])
            if items:
                return items[0]
        return None

    def is_field_protected(self, field_name: str, existing_record: Dict, new_value: Any) -> Tuple[bool, str]:
        """检查字段是否受保护，返回(是否保护, 保护原因)"""
        existing_fields = existing_record.get("fields", {})
        
        if field_name in self.protected_fields["main"]:
            protect_config = self.protected_fields["main"][field_name]
            
            if isinstance(protect_config, str):
                protect_flag = existing_fields.get(protect_config, False)
                if isinstance(protect_flag, list):
                    protect_flag = protect_flag[0]
                if protect_flag:
                    return True, f"人工备注保护标记已勾选"
            
            elif isinstance(protect_config, dict):
                protected_values = protect_config.get("protected_values", [])
                current_val = existing_fields.get(field_name, "")
                if isinstance(current_val, list):
                    current_val = current_val[0] if current_val else ""
                if current_val in protected_values:
                    return True, f"当前值'{current_val}'为受保护状态"
        
        return False, ""

    def merge_record(self, existing: Dict, new_record: Dict, used_aliases: Dict[str, str]) -> Tuple[Dict, bool, int, List[str]]:
        """
        合并新旧记录：
        - 空字段自动补齐
        - 非人工字段可更新
        - 受保护字段不覆盖
        返回(merged_fields, has_changes, protected_count, update_log)
        """
        existing_fields = existing.get("fields", {})
        merged = dict(existing_fields)
        has_changes = False
        protected_count = 0
        update_log = []
        
        for field_name, new_val in new_record.items():
            if field_name in ["唯一去重键", "疫苗缺失标记", "创建时间", "更新时间", "创建人", "更新人", "报告编号"]:
                continue
            
            current_val = existing_fields.get(field_name, None)
            
            is_protected, protect_reason = self.is_field_protected(field_name, existing, new_val)
            if is_protected:
                protected_count += 1
                update_log.append(f"🔒 {field_name}: 已保护（{protect_reason}），跳过更新")
                
                if field_name in used_aliases:
                    merged["微信备注原始字段名"] = used_aliases[field_name]
                    has_changes = True
                continue
            
            current_is_empty = current_val is None or (isinstance(current_val, list) and not current_val) or (isinstance(current_val, str) and not current_val.strip())
            new_is_empty = new_val is None or (isinstance(new_val, list) and not new_val) or (isinstance(new_val, str) and not new_val.strip())
            
            if field_name in self.non_override_fields and not current_is_empty:
                update_log.append(f"⏭️  {field_name}: 保留原值 '{current_val}'（非覆盖字段）")
                continue
            
            if current_is_empty and not new_is_empty:
                merged[field_name] = new_val
                has_changes = True
                update_log.append(f"➕ {field_name}: 空字段补齐 '{new_val}'")
            elif not current_is_empty and not new_is_empty and str(current_val) != str(new_val):
                if field_name in self.auto_fill_fields:
                    merged[field_name] = new_val
                    has_changes = True
                    update_log.append(f"🔄 {field_name}: '{current_val}' → '{new_val}'")
                else:
                    update_log.append(f"⏭️  {field_name}: 保留原值 '{current_val}'（非自动更新字段）")
            
            if field_name == "主人微信备注" and field_name in used_aliases:
                merged["微信备注原始字段名"] = used_aliases[field_name]
                has_changes = True
        
        merged["数据来源"] = self.source
        
        return merged, has_changes, protected_count, update_log

    def update_record(self, record_id: str, fields: Dict) -> bool:
        """更新已有记录"""
        result = self._run_cli([
            "base", "+record-batch-update",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({
                "records": [{
                    "record_id": record_id,
                    "fields": fields
                }]
            }, ensure_ascii=False)
        ])
        return result.get("ok", False)

    def create_record(self, fields: Dict, used_aliases: Dict[str, str]) -> bool:
        """创建新记录"""
        create_fields = dict(fields)
        
        if "主人微信备注" in used_aliases:
            create_fields["微信备注原始字段名"] = used_aliases["主人微信备注"]
        
        create_fields["数据来源"] = self.source
        
        if "处理状态" not in create_fields or not create_fields["处理状态"]:
            create_fields["处理状态"] = "已处理"
        
        create_fields["人工备注保护标记"] = create_fields.get("人工备注保护标记", False)
        
        field_names = list(create_fields.keys())
        field_values = [create_fields[k] for k in field_names]
        
        result = self._run_cli([
            "base", "+record-batch-create",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["main"],
            "--json", json.dumps({
                "fields": field_names,
                "rows": [field_values]
            }, ensure_ascii=False)
        ])
        return result.get("ok", False)

    def check_vaccine_exception(self, record: Dict, pet_name: str, report_no: str = ""):
        """检查疫苗日期是否缺失，生成异常记录"""
        vaccine_date = record.get("疫苗接种日期")
        is_missing = vaccine_date is None or (isinstance(vaccine_date, list) and not vaccine_date) or (isinstance(vaccine_date, str) and not vaccine_date.strip())
        
        if is_missing:
            print(f"   ⚠️  疫苗日期缺失，自动生成异常记录")
            self.exception_records.append({
                "type": "vaccine_missing",
                "pet_name": pet_name,
                "report_no": report_no,
                "description": f"宠物'{pet_name}'的疫苗接种日期为空，无法判断有效性",
                "default_reason": "请与主人确认疫苗接种情况，或在医院系统中查询",
                "default_impact": "本次课程报告标记为待补材料；需确认疫苗后才能判定训练有效性"
            })
            self.stats["exceptions"] += 1

    def write_exception_records(self):
        """批量写入异常记录到异常表"""
        if not self.exception_records:
            return
        
        print(f"\n📝 写入 {len(self.exception_records)} 条异常记录...")
        
        fields = ["关联报告编号", "关联宠物姓名", "异常类型", "异常描述", "人工确认理由", "影响范围", "处理状态", "原始字段名记录", "来源材料链接"]
        rows = []
        
        for exc in self.exception_records:
            exc_type = self.config["exception_types"].get(exc["type"], exc.get("type", "其他异常"))
            rows.append([
                exc.get("report_no", ""),
                exc.get("pet_name", ""),
                exc_type,
                exc.get("description", exc.get("note", "")),
                exc.get("default_reason", ""),
                exc.get("default_impact", ""),
                "待确认",
                exc.get("original_name", ""),
                f"https://pcnokj2bs6ug.feishu.cn/base/{self.base_token}"
            ])
        
        if rows:
            result = self._run_cli([
                "base", "+record-batch-create",
                "--base-token", self.base_token,
                "--table-id", self.table_ids["exception"],
                "--json", json.dumps({"fields": fields, "rows": rows}, ensure_ascii=False)
            ])
            if result.get("ok"):
                print(f"   ✅ 异常记录写入成功")
            else:
                print(f"   ❌ 异常记录写入失败: {result.get('error')}")

    def write_import_log(self, remark: str = ""):
        """写入导入日志"""
        print(f"\n📊 写入导入日志...")
        
        fields = ["导入文件名", "导入总条数", "新增条数", "跳过重复条数", "人工备注保护条数", "异常条数", "导入状态", "备注说明"]
        status = "已完成" if self.stats["exceptions"] == 0 else "部分完成"
        
        remark += f" | 导入源: {self.source}"
        
        rows = [[
            self.import_file_name,
            self.stats["total"],
            self.stats["new"],
            self.stats["skipped"],
            self.stats["protected"],
            self.stats["exceptions"],
            status,
            remark.strip()
        ]]
        
        result = self._run_cli([
            "base", "+record-batch-create",
            "--base-token", self.base_token,
            "--table-id", self.table_ids["import_log"],
            "--json", json.dumps({"fields": fields, "rows": rows}, ensure_ascii=False)
        ])
        
        if result.get("ok"):
            print(f"   ✅ 导入日志写入成功")
        else:
            print(f"   ❌ 导入日志写入失败: {result.get('error')}")

    def print_summary(self):
        """打印导入统计摘要"""
        print("\n" + "=" * 60)
        print("📊 导入结果统计")
        print("=" * 60)
        print(f"  总条数:     {self.stats['total']}")
        print(f"  ✅ 新增:    {self.stats['new']}")
        print(f"  ⏭️  跳过重复: {self.stats['skipped']}")
        print(f"  🔄 更新:    {self.stats['updated']}")
        print(f"  🔒 保护备注: {self.stats['protected']}")
        print(f"  ⚠️  异常:    {self.stats['exceptions']}")
        print("=" * 60)
        
        if self.exception_records:
            print("\n⚠️  异常摘要:")
            for exc in self.exception_records:
                exc_type = self.config["exception_types"].get(exc["type"], exc.get("type"))
                pet = exc.get("pet_name", exc.get("original_name", ""))
                print(f"  • [{exc_type}] {pet}: {exc.get('description', exc.get('note', ''))}")

    def import_file(self, file_path: str, source: str = "系统导入"):
        """执行完整导入流程"""
        self.source = source
        self.import_file_name = os.path.basename(file_path)
        
        print(f"\n🚀 开始导入: {file_path}")
        print(f"   数据源: {source}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        input_fields = data["fields"]
        rows = data["rows"]
        self.stats["total"] = len(rows)
        
        self.load_field_aliases()
        
        normalized_fields, used_aliases = self.normalize_fields(input_fields)
        print(f"\n📋 归一化后字段: {normalized_fields}")
        
        for i, row in enumerate(rows):
            record = dict(zip(normalized_fields, row))
            pet_name = record.get("宠物姓名", "未知")
            print(f"\n📍 [{i+1}/{len(rows)}] 处理: {pet_name}")
            
            dedup_key = self.generate_dedup_key(record)
            print(f"   去重键: {dedup_key}")
            
            existing = self.search_existing_record(dedup_key)
            
            if existing:
                self.stats["skipped"] += 1
                print(f"   ✅ 找到已有记录 (ID: {existing.get('record_id')})")
                
                merged, has_changes, protected_count, update_log = self.merge_record(
                    existing, record, used_aliases
                )
                
                for log in update_log:
                    print(f"   {log}")
                
                if protected_count > 0:
                    self.stats["protected"] += protected_count
                    self.exception_records.append({
                        "type": "note_conflict",
                        "pet_name": pet_name,
                        "description": f"记录'{pet_name}'有{protected_count}个字段被人工备注保护，重复导入时未覆盖",
                        "default_reason": "该记录的人工备注保护标记已勾选，包含主管手工改判内容",
                        "default_impact": "仅本记录指定字段不被更新；其他字段按规则覆盖"
                    })
                    self.stats["exceptions"] += 1
                
                if has_changes:
                    if self.update_record(existing["record_id"], merged):
                        self.stats["updated"] += 1
                        print(f"   🔄 记录已更新")
                    else:
                        print(f"   ❌ 更新失败")
                else:
                    print(f"   ⏭️  无变化，不更新")
                
                self.check_vaccine_exception(merged, pet_name)
            else:
                print(f"   🆕 无重复，创建新记录")
                if self.create_record(record, used_aliases):
                    self.stats["new"] += 1
                    print(f"   ✅ 新记录已创建")
                else:
                    print(f"   ❌ 创建失败")
                
                self.check_vaccine_exception(record, pet_name)
        
        self.write_exception_records()
        self.write_import_log()
        self.print_summary()
        
        return self.stats


def main():
    parser = argparse.ArgumentParser(description="宠物训练课报告导入工具")
    parser.add_argument("input_file", help="导入数据JSON文件路径")
    parser.add_argument("--source", default="系统导入", help="数据来源（默认: 系统导入）")
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"❌ 错误: 文件不存在: {args.input_file}")
        sys.exit(1)
    
    importer = TrainingRecordImporter()
    importer.import_file(args.input_file, args.source)


if __name__ == "__main__":
    main()
