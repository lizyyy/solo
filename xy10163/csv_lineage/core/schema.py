import pandas as pd
from typing import Dict, List, Any, Optional
import json

class SchemaAnalyzer:
    def analyze_csv(self, file_path: str) -> Dict[str, Any]:
        df = pd.read_csv(file_path, nrows=100)
        
        fields = []
        for col in df.columns:
            col_data = df[col].dropna()
            field_info = {
                "name": col,
                "dtype": str(df[col].dtype),
                "null_count": int(df[col].isnull().sum()),
                "non_null_count": int(col_data.count()),
                "unique_count": int(col_data.nunique()) if len(col_data) > 0 else 0
            }
            
            if len(col_data) > 0:
                if pd.api.types.is_numeric_dtype(df[col]):
                    field_info["min"] = float(col_data.min()) if not col_data.empty else None
                    field_info["max"] = float(col_data.max()) if not col_data.empty else None
                    field_info["mean"] = float(col_data.mean()) if not col_data.empty else None
                elif pd.api.types.is_object_dtype(df[col]):
                    field_info["sample_values"] = col_data.head(5).tolist()
                    field_info["max_length"] = int(col_data.str.len().max()) if len(col_data) > 0 else None
            
            fields.append(field_info)
        
        return {
            "file_path": file_path,
            "row_count": len(df),
            "field_count": len(fields),
            "fields": fields
        }

    def compare_schemas(self, old_schema: Dict, new_schema: Dict, 
                       alias_manager=None) -> Dict[str, Any]:
        old_fields = {f["name"]: f for f in old_schema.get("fields", [])}
        new_fields = {f["name"]: f for f in new_schema.get("fields", [])}
        
        old_field_names = set(old_fields.keys())
        new_field_names = set(new_fields.keys())
        
        added_fields = []
        removed_fields = []
        changed_fields = []
        unchanged_fields = []
        
        for name in new_field_names - old_field_names:
            added_fields.append({
                "field": name,
                "new_schema": new_fields[name],
                "reason": f"字段 '{name}' 在新版本中新增，类型为 {new_fields[name]['dtype']}"
            })
        
        for name in old_field_names - new_field_names:
            removed_fields.append({
                "field": name,
                "old_schema": old_fields[name],
                "reason": f"字段 '{name}' 在新版本中缺失，原类型为 {old_fields[name]['dtype']}"
            })
        
        for name in old_field_names & new_field_names:
            old_field = old_fields[name]
            new_field = new_fields[name]
            
            changes = self._compare_fields(old_field, new_field)
            if changes:
                changed_fields.append({
                    "field": name,
                    "old_schema": old_field,
                    "new_schema": new_field,
                    "changes": changes,
                    "reason": "; ".join([c["reason"] for c in changes])
                })
            else:
                unchanged_fields.append({
                    "field": name,
                    "schema": new_field
                })
        
        return {
            "added": added_fields,
            "removed": removed_fields,
            "changed": changed_fields,
            "unchanged": unchanged_fields,
            "summary": {
                "added_count": len(added_fields),
                "removed_count": len(removed_fields),
                "changed_count": len(changed_fields),
                "unchanged_count": len(unchanged_fields),
                "total_old": len(old_fields),
                "total_new": len(new_fields)
            }
        }

    def _compare_fields(self, old_field: Dict, new_field: Dict) -> List[Dict]:
        changes = []
        
        if old_field.get("dtype") != new_field.get("dtype"):
            changes.append({
                "type": "dtype_change",
                "old": old_field.get("dtype"),
                "new": new_field.get("dtype"),
                "reason": f"数据类型从 {old_field.get('dtype')} 变为 {new_field.get('dtype')}"
            })
        
        old_null_ratio = old_field.get("null_count", 0) / (old_field.get("non_null_count", 1) + old_field.get("null_count", 0))
        new_null_ratio = new_field.get("null_count", 0) / (new_field.get("non_null_count", 1) + new_field.get("null_count", 0))
        
        if abs(old_null_ratio - new_null_ratio) > 0.3:
            changes.append({
                "type": "null_ratio_change",
                "old": round(old_null_ratio, 2),
                "new": round(new_null_ratio, 2),
                "reason": f"空值比例从 {round(old_null_ratio, 2)} 变为 {round(new_null_ratio, 2)}"
            })
        
        if "unique_count" in old_field and "unique_count" in new_field:
            old_unique_ratio = old_field["unique_count"] / max(old_field.get("non_null_count", 1), 1)
            new_unique_ratio = new_field["unique_count"] / max(new_field.get("non_null_count", 1), 1)
            
            if old_unique_ratio > 0.9 and new_unique_ratio < 0.5:
                changes.append({
                    "type": "unique_ratio_drop",
                    "old": round(old_unique_ratio, 2),
                    "new": round(new_unique_ratio, 2),
                    "reason": f"唯一值比例大幅下降（从 {round(old_unique_ratio, 2)} 到 {round(new_unique_ratio, 2)}），可能存在数据质量问题"
                })
        
        return changes
