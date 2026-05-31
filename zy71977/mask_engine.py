import re
import json
from pathlib import Path
from config import SENSITIVE_PATTERNS, MASK_REPLACEMENTS, SOURCE_TYPES
from database import Database


class MaskEngine:
    def __init__(self):
        self.db = Database()
        self.patterns = SENSITIVE_PATTERNS
        self.replacements = MASK_REPLACEMENTS

    def mask_text(self, text):
        if not text:
            return text, []

        masked_text = text
        found_types = []

        type_mapping = {
            "phone": "phone",
            "id_card": "id_card",
            "email": "email",
            "name_catch": "name",
            "address_catch": "address",
            "order_no_catch": "order_no",
            "account_catch": "account",
        }

        for pattern_name, pattern in self.patterns.items():
            base_type = type_mapping.get(pattern_name, pattern_name)
            
            if pattern_name.endswith("_catch"):
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    found_types.append(base_type)
                    for match in matches:
                        if isinstance(match, tuple):
                            match = match[0]
                        if match:
                            replacement = self.replacements[base_type](match)
                            masked_text = masked_text.replace(match, replacement)
            else:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    found_types.append(base_type)
                    def replace_func(match_obj, t=base_type):
                        matched = match_obj.group(0)
                        return self.replacements[t](matched)
                    masked_text = re.sub(pattern, replace_func, masked_text, flags=re.IGNORECASE)

        return masked_text, list(set(found_types))

    def mask_customer_service(self, conversation):
        results = []
        for msg in conversation:
            masked_content, types = self.mask_text(msg.get("content", ""))
            results.append({
                "id": msg.get("id"),
                "sender": msg.get("sender"),
                "timestamp": msg.get("timestamp"),
                "original_content": msg.get("content", ""),
                "masked_content": masked_content,
                "sensitive_types": types
            })
        return results

    def mask_manual_review(self, records):
        results = []
        for record in records:
            fields = ["question", "answer", "remark", "reason"]
            masked_record = record.copy()
            all_types = []
            for field in fields:
                if field in record:
                    masked, types = self.mask_text(str(record[field]))
                    masked_record[f"masked_{field}"] = masked
                    all_types.extend(types)
            masked_record["sensitive_types"] = list(set(all_types))
            results.append(masked_record)
        return results

    def mask_gray_record(self, records):
        results = []
        for record in records:
            masked_record = record.copy()
            all_types = []
            for key, value in record.items():
                if isinstance(value, str):
                    masked, types = self.mask_text(value)
                    masked_record[f"masked_{key}"] = masked
                    all_types.extend(types)
            masked_record["sensitive_types"] = list(set(all_types))
            results.append(masked_record)
        return results

    def process_file(self, file_path, source_type):
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if source_type not in SOURCE_TYPES:
            raise ValueError(f"不支持的来源类型: {source_type}，支持类型: {SOURCE_TYPES}")

        with open(file_path, 'r', encoding='utf-8') as f:
            content = json.load(f)

        batch_id, is_duplicate = self.db.create_batch(
            batch_name=file_path.stem,
            source_type=source_type,
            file_content=content,
            total_records=len(content) if isinstance(content, list) else 1
        )

        if is_duplicate:
            self.db.add_log(batch_id, None, "INFO", f"重复批次检测，跳过处理")
            return {
                "batch_id": batch_id,
                "status": "duplicate",
                "message": "该文件已处理过，跳过重复处理",
                "is_duplicate": True
            }

        self.db.update_batch_status(batch_id, "processing")
        self.db.add_log(batch_id, None, "INFO", f"开始处理 {source_type} 类型文件")

        masked_results = []
        masked_count = 0
        warning_count = 0

        try:
            if source_type == "customer_service":
                masked_results = self.mask_customer_service(content)
            elif source_type == "manual_review":
                masked_results = self.mask_manual_review(content)
            elif source_type == "gray_record":
                masked_results = self.mask_gray_record(content)

            for result in masked_results:
                original = json.dumps(result, ensure_ascii=False, sort_keys=True)
                masked = result.get("masked_content", "") or result.get("masked_answer", "") or result.get("masked_detail", "") or json.dumps(result, ensure_ascii=False)
                sensitive_types = result.get("sensitive_types", [])
                
                biz_id = self._extract_biz_id(result, source_type)
                
                record_id, has_changes = self.db.add_record(
                    batch_id=batch_id,
                    source_type=source_type,
                    original_content=original,
                    masked_content=masked,
                    sensitive_types=sensitive_types,
                    biz_id=biz_id
                )
                
                if sensitive_types:
                    masked_count += 1
                if has_changes:
                    warning_count += 1
                    self.db.add_log(batch_id, record_id, "WARNING", f"记录内容有变更，版本已更新 (业务ID: {biz_id})")

            final_status = "warning" if warning_count > 0 else "success"
            self.db.update_batch_status(batch_id, final_status, masked_count=masked_count)
            self.db.add_log(batch_id, None, "INFO", f"处理完成，共 {len(masked_results)} 条记录，{masked_count} 条含敏感信息，{warning_count} 条有变更")

            return {
                "batch_id": batch_id,
                "status": final_status,
                "total_records": len(masked_results),
                "masked_count": masked_count,
                "warning_count": warning_count,
                "results": masked_results,
                "is_duplicate": False
            }

        except Exception as e:
            self.db.update_batch_status(batch_id, "failed", remark=str(e))
            self.db.add_log(batch_id, None, "ERROR", f"处理失败: {str(e)}")
            raise

    def _extract_biz_id(self, record, source_type):
        if source_type == "customer_service":
            return record.get("id", "")
        elif source_type == "manual_review":
            return record.get("case_id", "")
        elif source_type == "gray_record":
            return record.get("test_id", "")
        return ""

    def get_batch_status(self, batch_id):
        batch = self.db.get_batch(batch_id)
        if not batch:
            return None
        
        warning_records = self.db.get_warning_records(batch_id)
        
        return {
            "batch_info": batch,
            "warning_count": len(warning_records),
            "warning_records": warning_records
        }

    def get_record_history(self, record_id):
        changes = self.db.get_record_changes(record_id)
        return {
            "record_id": record_id,
            "change_count": len(changes),
            "changes": changes
        }
