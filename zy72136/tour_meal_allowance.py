import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
import os
import json

STANDARD_COLUMNS = {
    "曲目编号": ["曲目编号", "track_id", "编号", "曲目ID", "ID", "曲目编号（必填"],
    "曲目名称": ["曲目名称", "track_name", "名称", "曲目", "曲名"],
    "版本": ["版本", "version", "版本号", "曲版本"],
    "时长": ["时长", "duration", "时间", "播放时长"],
    "开始时间": ["开始时间", "start_time", "起始时间", "开演时间"],
    "结束时间": ["结束时间", "end_time", "终止时间", "收尾时间"],
    "授权状态": ["授权状态", "license_status", "授权", "版权状态"],
    "授权到期日": ["授权到期日", "license_expiry", "到期日", "授权到期", "有效期至"],
    "演出地点": ["演出地点", "venue", "地点", "巡演城市", "演出城市"],
    "参演人数": ["参演人数", "performers", "人数", "合唱人数"],
    "餐补标准": ["餐补标准", "meal_allowance", "餐补", "补贴标准", "餐标"],
    "备注": ["备注", "remarks", "说明", "注释", "附注"]
}

COLUMN_ALIAS_MAP = {}
for std, aliases in STANDARD_COLUMNS.items():
    for a in aliases:
        COLUMN_ALIAS_MAP[a.strip().lower()] = std


def normalize_column_name(col: str) -> str:
    col_clean = col.strip().lower()
    if col_clean in COLUMN_ALIAS_MAP:
        return COLUMN_ALIAS_MAP[col_clean]
    return col


NUMERIC_FIELDS = ["参演人数", "餐补标准"]


def _coerce_to_int_str(val) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    if s == "" or s == "nan" or s == "None":
        return ""
    try:
        f = float(s)
        if f == int(f):
            return str(int(f))
        return s
    except (ValueError, TypeError):
        return s


class DataSource:
    def __init__(self, file_path: str, source_name: str = ""):
        self.file_path = file_path
        self.source_name = source_name or os.path.basename(file_path)
        self.raw_df = None
        self.normalized_df = None
        self.column_mapping = {}
        self.unmapped_columns = []
        self.row_count = 0
        self.import_errors = []

    def detect_file_type(self) -> str:
        ext = os.path.splitext(self.file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            return 'excel'
        elif ext in ['.csv']:
            return 'csv'
        return 'unknown'

    def load_raw(self) -> bool:
        try:
            ftype = self.detect_file_type()
            if ftype == 'excel':
                self.raw_df = pd.read_excel(self.file_path, engine='openpyxl')
            elif ftype == 'csv':
                self.raw_df = pd.read_csv(self.file_path, dtype=str, keep_default_na=False)
            else:
                self.import_errors.append(f"不支持的文件格式: {os.path.splitext(self.file_path)[1]}")
                return False
            self.raw_df = self.raw_df.fillna("")
            self.row_count = len(self.raw_df)
            return True
        except Exception as e:
            self.import_errors.append(f"加载文件失败: {e}")
            return False

    def auto_map_columns(self) -> Dict[str, str]:
        if self.raw_df is None:
            return {}
        mapping = {}
        unmapped = []
        for col in self.raw_df.columns:
            normalized = normalize_column_name(col)
            if normalized in STANDARD_COLUMNS:
                mapping[col] = normalized
            else:
                unmapped.append(col)
        self.column_mapping = mapping
        self.unmapped_columns = unmapped
        return mapping

    def apply_mapping(self, manual_mapping: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        if self.raw_df is None:
            return pd.DataFrame()
        final_mapping = dict(self.column_mapping)
        if manual_mapping:
            for src_col, tgt_col in manual_mapping.items():
                if src_col in self.raw_df.columns:
                    final_mapping[src_col] = tgt_col
        rename_dict = {src: tgt for src, tgt in final_mapping.items() if src != tgt}
        self.normalized_df = self.raw_df.rename(columns=rename_dict)
        for col in NUMERIC_FIELDS:
            if col in self.normalized_df.columns:
                self.normalized_df[col] = self.normalized_df[col].apply(_coerce_to_int_str)
        self.normalized_df["_来源文件"] = self.source_name
        self.normalized_df["_来源行号"] = range(2, len(self.normalized_df) + 2)
        return self.normalized_df

    def get_mapping_summary(self) -> Dict[str, Any]:
        return {
            "source_name": self.source_name,
            "file_type": self.detect_file_type(),
            "row_count": self.row_count,
            "raw_columns": list(self.raw_df.columns) if self.raw_df is not None else [],
            "mapped": self.column_mapping,
            "unmapped": self.unmapped_columns,
            "import_errors": self.import_errors
        }


class TourMealAllowanceChecker:
    STANDARD_FIELDS = list(STANDARD_COLUMNS.keys())

    def __init__(self, data: Optional[pd.DataFrame] = None, excel_path: Optional[str] = None):
        self.df = data
        self.excel_path = excel_path
        self.sources: List[DataSource] = []
        self.merged_df = None
        self.annotations = {}
        self.issues = {
            "duplicate_tracks": [],
            "expired_license": [],
            "missing_license": [],
            "old_master_tapes": [],
            "timecode_mismatch": [],
            "empty_values": [],
            "manual_rename": [],
            "old_format": [],
            "need_confirmation": []
        }
        self.smooth_records = []
        self.processing_suggestions = []

    def load_data(self) -> bool:
        if self.df is not None:
            self._ensure_columns()
            return True
        if self.excel_path:
            ext = os.path.splitext(self.excel_path)[1].lower()
            try:
                if ext in ['.xlsx', '.xls']:
                    self.df = pd.read_excel(self.excel_path, engine='openpyxl')
                elif ext == '.csv':
                    self.df = pd.read_csv(self.excel_path, dtype=str, keep_default_na=False)
                else:
                    print(f"不支持的文件格式: {ext}")
                    return False
                self.df = self.df.fillna("")
                col_mapping = {}
                for col in list(self.df.columns):
                    normalized = normalize_column_name(col)
                    if normalized != col and normalized in STANDARD_COLUMNS:
                        col_mapping[col] = normalized
                if col_mapping:
                    self.df = self.df.rename(columns=col_mapping)
                for col in NUMERIC_FIELDS:
                    if col in self.df.columns:
                        self.df[col] = self.df[col].apply(_coerce_to_int_str)
                self._ensure_columns()
                return True
            except Exception as e:
                print(f"加载数据失败: {e}")
                return False
        return False

    def _ensure_columns(self):
        for field in self.STANDARD_FIELDS:
            if field not in self.df.columns:
                self.df[field] = ""
        if "_来源文件" not in self.df.columns:
            self.df["_来源文件"] = ""
        if "_来源行号" not in self.df.columns:
            self.df["_来源行号"] = range(2, len(self.df) + 2)
        if "_标注" not in self.df.columns:
            self.df["_标注"] = ""

    def add_source(self, file_path: str, manual_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        ds = DataSource(file_path)
        if not ds.load_raw():
            return ds.get_mapping_summary()
        ds.auto_map_columns()
        ds.apply_mapping(manual_mapping)
        self.sources.append(ds)
        self._merge_sources()
        return ds.get_mapping_summary()

    def _merge_sources(self):
        frames = []
        for ds in self.sources:
            if ds.normalized_df is not None and len(ds.normalized_df) > 0:
                frames.append(ds.normalized_df)
        if frames:
            self.merged_df = pd.concat(frames, ignore_index=True)
            self.df = self.merged_df
            self._ensure_columns()
        else:
            self.merged_df = pd.DataFrame()

    def set_annotation(self, row_index: int, annotation: str):
        if self.df is not None and 0 <= row_index < len(self.df):
            self.df.at[row_index, "_标注"] = annotation
            self.annotations[row_index] = annotation

    def supplement_field(self, row_index: int, field: str, value: str):
        if self.df is not None and 0 <= row_index < len(self.df):
            if field in self.df.columns:
                old_val = str(self.df.at[row_index, field])
                self.df.at[row_index, field] = value
                ann = self.df.at[row_index, "_标注"]
                supplement_note = f"补录[{field}]: {old_val}→{value}"
                if ann:
                    ann += "; " + supplement_note
                else:
                    ann = supplement_note
                self.df.at[row_index, "_标注"] = ann

    def check_duplicates(self):
        if '曲目编号' not in self.df.columns:
            return
        id_counts = self.df['曲目编号'].value_counts()
        duplicate_ids = id_counts[id_counts > 1].index.tolist()
        for track_id in duplicate_ids:
            records = self.df[self.df['曲目编号'] == track_id]
            self.issues["duplicate_tracks"].append({
                "曲目编号": track_id,
                "重复次数": len(records),
                "涉及曲目": records['曲目名称'].tolist(),
                "版本": records['版本'].tolist() if '版本' in records.columns else [],
                "建议": "请核对保留最新版本，删除重复记录或重新分配曲目编号"
            })

    def check_license(self):
        today = datetime.now()
        for idx, row in self.df.iterrows():
            track_id = str(row.get('曲目编号', ''))
            track_name = str(row.get('曲目名称', ''))
            license_status = str(row.get('授权状态', '')).strip()
            expiry_date = str(row.get('授权到期日', '')).strip()
            if license_status == "过期":
                self.issues["expired_license"].append({
                    "曲目编号": track_id,
                    "曲目名称": track_name,
                    "授权到期日": expiry_date if expiry_date else "未填写",
                    "建议": "请立即联系版权方更新授权，避免演出风险"
                })
            elif license_status == "待确认":
                self.issues["missing_license"].append({
                    "曲目编号": track_id,
                    "曲目名称": track_name,
                    "建议": "请林老师或行政确认授权状态后再安排演出"
                })
            elif expiry_date:
                try:
                    expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
                    days_left = (expiry - today).days
                    if days_left < 30:
                        self.issues["expired_license"].append({
                            "曲目编号": track_id,
                            "曲目名称": track_name,
                            "授权到期日": expiry_date,
                            "剩余天数": days_left,
                            "建议": f"授权即将到期（剩余{days_left}天），请提前安排续约"
                        })
                except:
                    pass

    def check_old_masters(self):
        old_patterns = ['母带', '典藏版', '2022', '2023', '旧版']
        for idx, row in self.df.iterrows():
            version = str(row.get('版本', '')).strip()
            remarks = str(row.get('备注', '')).strip()
            full_text = version + " " + remarks
            if any(p in full_text for p in old_patterns) and "2024巡演版" not in version:
                self.issues["old_master_tapes"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "版本": version,
                    "建议": "请确认是否需要使用2024巡演新版，旧版母带音质可能不适合现场演出"
                })

    def check_timecode(self):
        def time_to_seconds(t: str) -> Optional[int]:
            if not t or not isinstance(t, str):
                return None
            parts = t.split(':')
            try:
                if len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                elif len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
            except:
                return None
            return None

        for idx, row in self.df.iterrows():
            remarks = str(row.get('备注', '')).strip()
            if "时码错位" in remarks:
                self.issues["timecode_mismatch"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "开始时间": str(row.get('开始时间', '')),
                    "结束时间": str(row.get('结束时间', '')),
                    "标注时长": str(row.get('时长', '')),
                    "问题": "备注中标记有时码错位，请核对",
                    "建议": "请音频组核对时码，确保节目单时间准确"
                })

    def check_empty_values(self):
        critical_fields = ['参演人数', '餐补标准', '授权到期日']
        for idx, row in self.df.iterrows():
            empty_fields = []
            for field in critical_fields:
                val = str(row.get(field, '')).strip()
                if val == "" or val == "nan":
                    empty_fields.append(field)
            if empty_fields:
                self.issues["empty_values"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "缺失字段": empty_fields,
                    "建议": "请补充完整信息后再计算餐补"
                })

    def check_manual_rename(self):
        for idx, row in self.df.iterrows():
            remarks = str(row.get('备注', '')).strip()
            if "改名" in remarks or "原名" in remarks:
                self.issues["manual_rename"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "备注": remarks,
                    "建议": "已记录人工改名，请在最终节目单中使用新名称"
                })

    def check_old_format(self):
        for idx, row in self.df.iterrows():
            version = str(row.get('版本', '')).strip()
            remarks = str(row.get('备注', '')).strip()
            if "旧口径" in version or "旧口径" in remarks:
                old_name = row.get('曲目名称（旧）', '')
                self.issues["old_format"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "旧名称": str(old_name) if old_name else "未知",
                    "版本": version,
                    "建议": "从旧口径导入的数据，请确认曲目名称和版本是否正确"
                })

    def check_need_confirmation(self):
        for idx, row in self.df.iterrows():
            remarks = str(row.get('备注', '')).strip()
            if "人工确认" in remarks or ("林老师" in remarks and "确认" in remarks):
                self.issues["need_confirmation"].append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "备注": remarks,
                    "建议": "请林老师亲自确认后再继续处理"
                })

    def find_smooth_records(self):
        for idx, row in self.df.iterrows():
            remarks = str(row.get('备注', '')).strip()
            if "顺利" in remarks or "正常" in remarks:
                self.smooth_records.append({
                    "曲目编号": str(row.get('曲目编号', '')),
                    "曲目名称": str(row.get('曲目名称', '')),
                    "状态": "正常",
                    "说明": remarks
                })

    def generate_suggestions(self):
        suggestions = []
        total_issues = sum(len(v) for v in self.issues.values())
        if total_issues == 0:
            suggestions.append("✅ 所有曲目检查通过，可以直接安排演出和餐补发放")
            self.processing_suggestions = suggestions
            return
        if self.issues["duplicate_tracks"]:
            suggestions.append(f"⚠️ 发现 {len(self.issues['duplicate_tracks'])} 组重复曲目编号，请先核对去重")
        if self.issues["expired_license"]:
            suggestions.append(f"🔴 发现 {len(self.issues['expired_license'])} 个授权过期或即将到期，请立即处理")
        if self.issues["missing_license"]:
            suggestions.append(f"🟡 发现 {len(self.issues['missing_license'])} 个授权待确认，请联系林老师")
        if self.issues["old_master_tapes"]:
            suggestions.append(f"🔵 发现 {len(self.issues['old_master_tapes'])} 个旧版母带曲目，请确认是否使用新版")
        if self.issues["timecode_mismatch"]:
            suggestions.append(f"⚡ 发现 {len(self.issues['timecode_mismatch'])} 个时码错位问题，请音频组核对")
        if self.issues["empty_values"]:
            suggestions.append(f"📝 发现 {len(self.issues['empty_values'])} 条记录缺少关键字段，请补全")
        if self.issues["manual_rename"]:
            suggestions.append(f"📋 已记录 {len(self.issues['manual_rename'])} 个人工改名，注意节目单同步")
        if self.issues["old_format"]:
            suggestions.append(f"📚 发现 {len(self.issues['old_format'])} 条旧口径数据，请核对名称")
        if self.issues["need_confirmation"]:
            suggestions.append(f"👀 发现 {len(self.issues['need_confirmation'])} 条需要林老师确认的记录")
        suggestions.append(f"✅ 另有 {len(self.smooth_records)} 条记录检查顺利，可直接使用")
        self.processing_suggestions = suggestions

    def run_all_checks(self):
        if not self.load_data():
            return False
        self.issues = {k: [] for k in self.issues}
        self.smooth_records = []
        self.processing_suggestions = []
        self.check_duplicates()
        self.check_license()
        self.check_old_masters()
        self.check_timecode()
        self.check_empty_values()
        self.check_manual_rename()
        self.check_old_format()
        self.check_need_confirmation()
        self.find_smooth_records()
        self.generate_suggestions()
        return True

    def get_summary(self) -> Dict[str, Any]:
        return {
            "总记录数": len(self.df) if self.df is not None else 0,
            "问题总数": sum(len(v) for v in self.issues.values()),
            "顺利记录数": len(self.smooth_records),
            "问题分类": {k: len(v) for k, v in self.issues.items()},
            "处理建议": self.processing_suggestions
        }

    def get_source_diff(self) -> List[Dict[str, Any]]:
        if self.df is None:
            return []
        diffs = []
        for ds in self.sources:
            summary = ds.get_mapping_summary()
            diffs.append({
                "来源": summary["source_name"],
                "类型": summary["file_type"],
                "原始行数": summary["row_count"],
                "列映射": summary["mapped"],
                "未映射列": summary["unmapped"],
                "导入错误": summary["import_errors"]
            })
        return diffs

    def export_meal_allowance_list(self, output_path: str) -> str:
        if self.df is None:
            return "没有数据可导出"
        export_data = []
        confirmed_count = 0
        for idx, row in self.df.iterrows():
            track_id = str(row.get('曲目编号', ''))
            track_name = str(row.get('曲目名称', ''))
            location = str(row.get('演出地点', ''))
            people = str(row.get('参演人数', ''))
            standard = str(row.get('餐补标准', ''))
            remarks = str(row.get('备注', ''))
            source_file = str(row.get('_来源文件', ''))
            source_row = str(row.get('_来源行号', ''))
            annotation = str(row.get('_标注', ''))

            status = "待确认"
            issue_notes = []

            if any(t['曲目编号'] == track_id for t in self.issues['expired_license']):
                status = "暂停"
                issue_notes.append("授权问题")
            if any(t['曲目编号'] == track_id for t in self.issues['missing_license']):
                status = "待确认"
                issue_notes.append("授权待确认")
            if any(t['曲目编号'] == track_id for t in self.issues['duplicate_tracks']):
                status = "待确认"
                issue_notes.append("编号重复")
            if any(t['曲目编号'] == track_id for t in self.issues['timecode_mismatch']):
                issue_notes.append("时码待核对")
            if any(t['曲目编号'] == track_id for t in self.issues['empty_values']):
                status = "待确认"
                issue_notes.append("信息不全")

            if status == "待确认" and not issue_notes:
                status = "可发放"
                confirmed_count += 1

            try:
                people_count = int(float(people)) if people else 0
            except (ValueError, TypeError):
                people_count = 0
            try:
                standard_amount = int(float(standard)) if standard else 0
            except (ValueError, TypeError):
                standard_amount = 0
            total = people_count * standard_amount

            export_data.append({
                "曲目编号": track_id,
                "曲目名称": track_name,
                "演出地点": location,
                "参演人数": people_count if people_count else "",
                "餐补标准": standard_amount if standard_amount else "",
                "预计餐补总额": total if total > 0 else "",
                "状态": status,
                "备注": remarks,
                "问题说明": "、".join(issue_notes) if issue_notes else "无",
                "来源文件": source_file,
                "来源行号": source_row,
                "标注": annotation
            })

        export_df = pd.DataFrame(export_data)
        ext = os.path.splitext(output_path)[1].lower()
        if ext == '.csv':
            export_df.to_csv(output_path, index=False, encoding='utf-8-sig')
        else:
            export_df.to_excel(output_path, index=False, engine='openpyxl')

        return f"已导出 {len(export_data)} 条记录，其中 {confirmed_count} 条可直接发放餐补"
