import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import pandas as pd

from .models import BuoyRecord, DuplicateGroup, CleanResult, AuditLogEntry
from .coordinate_parser import normalize_coordinates


class BuoyDataCleaner:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.records: List[BuoyRecord] = []
        self.audit_log: List[AuditLogEntry] = []
        self.existing_keys: Dict[str, BuoyRecord] = {}
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in ["input", "output", "state", "audit"]:
            os.makedirs(os.path.join(self.data_dir, d), exist_ok=True)

    def _parse_datetime(self, val) -> Optional[datetime]:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        if isinstance(val, datetime):
            return val
        try:
            return pd.to_datetime(str(val)).to_pydatetime()
        except Exception:
            return None

    def _parse_float(self, val) -> Optional[float]:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def _load_existing_records(self, existing_file: Optional[str] = None):
        if existing_file is None:
            existing_file = os.path.join(self.data_dir, "state", "cleaned_records.json")

        self.records = []
        self.existing_keys = {}

        if not os.path.exists(existing_file):
            return

        try:
            with open(existing_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    rec = BuoyRecord(**item)
                    if rec.collect_time:
                        rec.collect_time = datetime.fromisoformat(rec.collect_time) if isinstance(rec.collect_time, str) else rec.collect_time
                    if rec.import_time:
                        rec.import_time = datetime.fromisoformat(rec.import_time) if isinstance(rec.import_time, str) else rec.import_time
                    key = rec.unique_key()
                    self.existing_keys[key] = rec
                    self.records.append(rec)
        except Exception:
            pass

    def _load_audit_log(self):
        audit_file = os.path.join(self.data_dir, "audit", "audit_log.json")
        self.audit_log = []

        if not os.path.exists(audit_file):
            return

        try:
            with open(audit_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    entry = AuditLogEntry(**item)
                    if entry.timestamp:
                        entry.timestamp = datetime.fromisoformat(entry.timestamp)
                    self.audit_log.append(entry)
        except Exception:
            pass

    def import_data(self, input_file: str, source_name: Optional[str] = None) -> CleanResult:
        if source_name is None:
            source_name = os.path.basename(input_file)

        self._load_existing_records()
        self._load_audit_log()

        if input_file.endswith('.csv'):
            df = pd.read_csv(input_file)
        elif input_file.endswith('.xlsx'):
            df = pd.read_excel(input_file)
        else:
            raise ValueError(f"不支持的文件格式: {input_file}")

        new_records: List[BuoyRecord] = []
        import_time = datetime.now()

        for idx, row in df.iterrows():
            record_id = f"{source_name}_{idx}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

            collect_time = self._parse_datetime(row.get('采集时间', row.get('collect_time', row.get('时间', None))))

            rec = BuoyRecord(
                record_id=record_id,
                sample_bottle_no=str(row.get('采样瓶编号', row.get('sample_bottle_no', row.get('瓶号', f'UNKNOWN_{idx}')))).strip(),
                latitude_raw=str(row.get('纬度', row.get('latitude', row.get('lat', '')))).strip(),
                longitude_raw=str(row.get('经度', row.get('longitude', row.get('lon', '')))).strip(),
                water_temp=self._parse_float(row.get('水温', row.get('water_temp', row.get('temp', None)))),
                wave_height=self._parse_float(row.get('浪高', row.get('wave_height', None))),
                wind_speed=self._parse_float(row.get('风速', row.get('wind_speed', None))),
                collect_time=collect_time,
                source_file=source_name,
                import_time=import_time
            )

            lat_std, lon_std, fmt, needs_coord_confirm, coord_confirm_reason, lat_sug, lon_sug = normalize_coordinates(rec.latitude_raw, rec.longitude_raw)
            rec.latitude_std = lat_std
            rec.longitude_std = lon_std
            rec.latitude_suggested = lat_sug
            rec.longitude_suggested = lon_sug
            rec.lat_lon_format = fmt
            if needs_coord_confirm:
                rec.needs_confirmation = True
                if rec.confirmation_reason:
                    rec.confirmation_reason = rec.confirmation_reason + '; ' + coord_confirm_reason
                else:
                    rec.confirmation_reason = coord_confirm_reason

            new_records.append(rec)

        result = self._process_new_records(new_records)
        result.filter_criteria = {
            'source_file': source_name,
            'import_time': import_time.strftime('%Y-%m-%d %H:%M:%S'),
            'total_raw_records': str(len(new_records))
        }

        return result

    def _process_new_records(self, new_records: List[BuoyRecord]) -> CleanResult:
        result = CleanResult()
        result.total_records = len(new_records)

        bottle_groups: Dict[str, List[BuoyRecord]] = defaultdict(list)
        all_keys = set(self.existing_keys.keys())

        for rec in new_records:
            key = rec.unique_key()

            if key in self.existing_keys:
                existing = self.existing_keys[key]
                if existing.manual_note:
                    rec.manual_note = existing.manual_note
                rec.is_confirmed = existing.is_confirmed
                rec.record_id = existing.record_id
                rec.import_time = existing.import_time
                continue

            all_keys.add(key)
            bottle_groups[rec.sample_bottle_no].append(rec)

            has_coord_issue = (rec.latitude_std is None or rec.longitude_std is None) and not (rec.latitude_suggested or rec.longitude_suggested)
            has_coord_suggestion = rec.latitude_suggested is not None or rec.longitude_suggested is not None

            if has_coord_issue:
                result.invalid_records += 1
                rec.needs_confirmation = True
                if not rec.confirmation_reason:
                    rec.confirmation_reason = f"经纬度无法解析: lat={rec.latitude_raw}, lon={rec.longitude_raw}"
                result.pending_confirmation.append(rec)
                result.records.append(rec)
                continue

            result.valid_records += 1
            if rec.needs_confirmation and rec not in result.pending_confirmation:
                result.pending_confirmation.append(rec)
            result.records.append(rec)

        for bottle_no, records in bottle_groups.items():
            if len(records) > 1:
                dup_group = DuplicateGroup(
                    sample_bottle_no=bottle_no,
                    records=records,
                    reason=f"采样瓶号 {bottle_no} 出现 {len(records)} 条记录，疑似重复",
                    affected_count=len(records)
                )
                result.duplicate_groups.append(dup_group)
                for rec in records:
                    rec.is_duplicate = True
                    rec.duplicate_reason = dup_group.reason
                    rec.needs_confirmation = True
                    if rec not in result.pending_confirmation:
                        result.pending_confirmation.append(rec)

        for rec in result.records:
            key = rec.unique_key()
            if key not in self.existing_keys:
                self.existing_keys[key] = rec
                self.records.append(rec)

        return result

    def confirm_duplicate(self, record_id: str, operator: str, is_valid: bool, reason: str) -> Optional[BuoyRecord]:
        self._load_existing_records()
        self._load_audit_log()
        for rec in self.records:
            if rec.record_id == record_id:
                old_confirmed = str(rec.is_confirmed)
                old_needs_confirm = str(rec.needs_confirmation)
                old_note = rec.manual_note or ""
                old_lat_std = str(rec.latitude_std)
                old_lon_std = str(rec.longitude_std)
                old_dup = str(rec.is_duplicate)

                rec.is_confirmed = True
                rec.needs_confirmation = False

                if is_valid:
                    if rec.latitude_std is None and rec.latitude_suggested is not None:
                        rec.latitude_std = rec.latitude_suggested
                    if rec.longitude_std is None and rec.longitude_suggested is not None:
                        rec.longitude_std = rec.longitude_suggested
                    rec.is_duplicate = False
                    rec.duplicate_reason = None
                    rec.confirmation_reason = None
                else:
                    rec.is_duplicate = True

                new_note = f"[{operator} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {reason}"
                if old_note:
                    rec.manual_note = old_note + "\n" + new_note
                else:
                    rec.manual_note = new_note

                self._add_audit_log(rec, 'is_confirmed', old_confirmed, 'True', operator, reason)
                self._add_audit_log(rec, 'needs_confirmation', old_needs_confirm, 'False', operator, reason)
                self._add_audit_log(rec, 'manual_note', old_note, rec.manual_note, operator, reason)
                self._add_audit_log(rec, 'is_duplicate', old_dup, str(rec.is_duplicate), operator, reason)
                if old_lat_std != str(rec.latitude_std):
                    self._add_audit_log(rec, 'latitude_std', old_lat_std, str(rec.latitude_std), operator, reason)
                if old_lon_std != str(rec.longitude_std):
                    self._add_audit_log(rec, 'longitude_std', old_lon_std, str(rec.longitude_std), operator, reason)

                self._save_state()
                self._save_audit_log()
                return rec
        return None

    def _add_audit_log(self, rec: BuoyRecord, field: str, old_val: str, new_val: str, operator: str, reason: str):
        entry = AuditLogEntry(
            timestamp=datetime.now(),
            record_id=rec.record_id,
            sample_bottle_no=rec.sample_bottle_no,
            field_name=field,
            old_value=old_val,
            new_value=new_val,
            operator=operator,
            reason=reason
        )
        self.audit_log.append(entry)

    def _save_state(self):
        state_file = os.path.join(self.data_dir, "state", "cleaned_records.json")
        data = []
        for rec in self.records:
            d = rec.__dict__.copy()
            if d.get('collect_time'):
                d['collect_time'] = d['collect_time'].isoformat()
            if d.get('import_time'):
                d['import_time'] = d['import_time'].isoformat()
            data.append(d)
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _save_audit_log(self):
        audit_file = os.path.join(self.data_dir, "audit", "audit_log.json")
        data = []
        for entry in self.audit_log:
            d = entry.__dict__.copy()
            d['timestamp'] = d['timestamp'].isoformat()
            data.append(d)
        with open(audit_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def export_data(self, output_file: str, filter_criteria: Optional[Dict[str, str]] = None,
                    include_pending: bool = False) -> Tuple[str, int]:
        self._load_existing_records()
        self._load_audit_log()

        export_records = []
        for rec in self.records:
            if not include_pending and rec.needs_confirmation:
                continue
            export_records.append(rec)

        rows = []
        for rec in export_records:
            rows.append({
                '记录ID': rec.record_id,
                '采样瓶编号': rec.sample_bottle_no,
                '原始纬度': rec.latitude_raw,
                '原始经度': rec.longitude_raw,
                '建议纬度': round(rec.latitude_suggested, 6) if rec.latitude_suggested else None,
                '建议经度': round(rec.longitude_suggested, 6) if rec.longitude_suggested else None,
                '标准化纬度': round(rec.latitude_std, 6) if rec.latitude_std else None,
                '标准化经度': round(rec.longitude_std, 6) if rec.longitude_std else None,
                '坐标格式': rec.lat_lon_format,
                '水温(℃)': rec.water_temp,
                '浪高(m)': rec.wave_height,
                '风速(m/s)': rec.wind_speed,
                '采集时间': rec.collect_time.strftime('%Y-%m-%d %H:%M:%S') if rec.collect_time else None,
                '是否重复': '是' if rec.is_duplicate else '否',
                '重复原因': rec.duplicate_reason,
                '待确认': '是' if rec.needs_confirmation else '否',
                '待确认原因': rec.confirmation_reason,
                '已确认': '是' if rec.is_confirmed else '否',
                '人工备注': rec.manual_note,
                '来源文件': rec.source_file,
                '导入时间': rec.import_time.strftime('%Y-%m-%d %H:%M:%S') if rec.import_time else None
            })

        df = pd.DataFrame(rows)

        if output_file.endswith('.csv'):
            df.to_csv(output_file, index=False, encoding='utf-8-sig')
        elif output_file.endswith('.xlsx'):
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='清洗结果', index=False)

                filter_sheet = pd.DataFrame({
                    '筛选口径项': list(filter_criteria.keys()) if filter_criteria else [],
                    '筛选口径值': list(filter_criteria.values()) if filter_criteria else []
                })
                filter_sheet.to_excel(writer, sheet_name='筛选口径说明', index=False)

                if self.audit_log:
                    audit_rows = []
                    for entry in self.audit_log:
                        audit_rows.append({
                            '时间': entry.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                            '记录ID': entry.record_id,
                            '采样瓶编号': entry.sample_bottle_no,
                            '修改字段': entry.field_name,
                            '旧值': entry.old_value,
                            '新值': entry.new_value,
                            '操作人': entry.operator,
                            '原因': entry.reason
                        })
                    audit_df = pd.DataFrame(audit_rows)
                    audit_df.to_excel(writer, sheet_name='变更审计日志', index=False)
        else:
            raise ValueError(f"不支持的导出格式: {output_file}")

        return output_file, len(export_records)

    def get_pending_confirmation(self) -> List[BuoyRecord]:
        self._load_existing_records()
        return [r for r in self.records if r.needs_confirmation]

    def get_duplicate_groups(self) -> List[DuplicateGroup]:
        self._load_existing_records()
        pending = self.get_pending_confirmation()
        bottle_groups: Dict[str, List[BuoyRecord]] = defaultdict(list)
        for rec in pending:
            if rec.is_duplicate:
                bottle_groups[rec.sample_bottle_no].append(rec)

        groups = []
        for bottle_no, records in bottle_groups.items():
            groups.append(DuplicateGroup(
                sample_bottle_no=bottle_no,
                records=records,
                reason=f"采样瓶号 {bottle_no} 有 {len(records)} 条待确认记录",
                affected_count=len(records)
            ))
        return groups
