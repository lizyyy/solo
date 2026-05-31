import os
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    ProofRecord,
    MaterialPackage,
    AuthorizationFile,
    MaterialSource,
    RecordStatus,
    AbnormalType,
)


class MaterialPackageParser:
    def __init__(self, package_path: str):
        self.package_path = package_path
        self.package_id = os.path.basename(package_path)
        self.raw_files: List[str] = []
        self.records: List[ProofRecord] = []
        self.authorization_files: List[AuthorizationFile] = []

    def scan_files(self) -> List[str]:
        all_files = []
        for root, dirs, files in os.walk(self.package_path):
            for file in files:
                file_path = os.path.join(root, file)
                all_files.append(file_path)
        self.raw_files = all_files
        return all_files

    def parse_authorization_files(self) -> List[AuthorizationFile]:
        auth_files = []
        for file_path in self.raw_files:
            if "授权" in file_path or "authorization" in file_path.lower():
                if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
                    auth = self._parse_authorization_excel(file_path)
                    if auth:
                        auth_files.append(auth)
        self.authorization_files = auth_files
        return auth_files

    def _parse_authorization_excel(self, file_path: str) -> Optional[AuthorizationFile]:
        try:
            df = pd.read_excel(file_path)
            auth_no = ""
            valid_until = datetime.now() + timedelta(days=365)
            color_versions = []
            specs = []

            for col in df.columns:
                if "授权编号" in col or "authorization" in col.lower():
                    auth_no = str(df.iloc[0][col])
                if "有效期" in col or "valid" in col.lower():
                    try:
                        valid_until = pd.to_datetime(df.iloc[0][col]).to_pydatetime()
                    except:
                        pass
                if "颜色" in col or "color" in col.lower():
                    color_versions.extend([str(x) for x in df[col].dropna().tolist()])
                if "规格" in col or "spec" in col.lower():
                    specs.extend([str(x) for x in df[col].dropna().tolist()])

            return AuthorizationFile(
                file_path=file_path,
                authorization_no=auth_no,
                valid_until=valid_until,
                authorized_color_versions=color_versions,
                authorized_specs=specs,
            )
        except Exception as e:
            print(f"解析授权文件失败 {file_path}: {e}")
            return None

    def parse_proof_records(self) -> List[ProofRecord]:
        records = []
        record_id_counter = 1

        for file_path in self.raw_files:
            if "打样" in file_path or "proof" in file_path.lower():
                if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
                    file_records = self._parse_proof_excel(
                        file_path, record_id_counter
                    )
                    records.extend(file_records)
                    record_id_counter += len(file_records)

        records = self._process_duplicates(records)
        records = self._process_late_attachments(records)
        records = self._process_manual_corrections(records)

        self.records = records
        return records

    def _parse_proof_excel(
        self, file_path: str, start_id: int
    ) -> List[ProofRecord]:
        records = []
        try:
            xls = pd.ExcelFile(file_path)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                for idx, row in df.iterrows():
                    record = self._row_to_record(
                        row, start_id + len(records), file_path, sheet_name, idx + 2
                    )
                    if record:
                        records.append(record)
        except Exception as e:
            print(f"解析打样文件失败 {file_path}: {e}")
        return records

    def _row_to_record(
        self,
        row: pd.Series,
        record_id: int,
        file_path: str,
        sheet_name: str,
        line_number: int,
    ) -> Optional[ProofRecord]:
        try:
            material_name = self._get_value_by_keywords(
                row, ["物料名称", "material", "名称"]
            )
            color_version = self._get_value_by_keywords(
                row, ["颜色版本", "颜色", "color", "version"]
            )
            spec = self._get_value_by_keywords(
                row, ["规格", "spec", "尺寸", "size"]
            )
            authorization_no = self._get_value_by_keywords(
                row, ["授权编号", "授权", "authorization"]
            )
            auth_valid_str = self._get_value_by_keywords(
                row, ["授权有效期", "有效期", "valid"]
            )
            submitted_str = self._get_value_by_keywords(
                row, ["提交时间", "提交", "submitted"]
            )

            if not material_name:
                return None

            try:
                auth_valid_until = (
                    pd.to_datetime(auth_valid_str).to_pydatetime()
                    if auth_valid_str
                    else datetime.now() + timedelta(days=30)
                )
            except:
                auth_valid_until = datetime.now() + timedelta(days=30)

            try:
                submitted_at = (
                    pd.to_datetime(submitted_str).to_pydatetime()
                    if submitted_str
                    else datetime.now()
                )
            except:
                submitted_at = datetime.now()

            return ProofRecord(
                record_id=f"REC{record_id:04d}",
                material_name=str(material_name),
                color_version=str(color_version or "未指定"),
                spec=str(spec or "标准"),
                authorization_no=str(authorization_no or "未授权"),
                authorization_valid_until=auth_valid_until,
                submitted_at=submitted_at,
                source=MaterialSource(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    line_number=line_number,
                    original_value=str(row.to_dict()),
                ),
            )
        except Exception as e:
            print(f"解析行失败: {e}")
            return None

    def _get_value_by_keywords(self, row: pd.Series, keywords: List[str]) -> Optional[str]:
        for col in row.index:
            for keyword in keywords:
                if keyword in str(col):
                    val = row[col]
                    if pd.notna(val):
                        return str(val)
        return None

    def _process_duplicates(self, records: List[ProofRecord]) -> List[ProofRecord]:
        key_map: Dict[str, List[ProofRecord]] = defaultdict(list)

        for record in records:
            key = f"{record.material_name}_{record.color_version}_{record.spec}"
            key_map[key].append(record)

        for key, group in key_map.items():
            if len(group) > 1:
                group.sort(key=lambda r: r.submitted_at)
                original = group[0]
                for duplicate in group[1:]:
                    duplicate.is_duplicate = True
                    duplicate.duplicate_of = original.record_id
                    duplicate.abnormal_types.append(AbnormalType.DUPLICATE)
                    duplicate.status = RecordStatus.PENDING

        return records

    def _process_late_attachments(
        self, records: List[ProofRecord]
    ) -> List[ProofRecord]:
        deadline = datetime.now() - timedelta(hours=24)

        for record in records:
            if record.attachment_arrived_at:
                if record.attachment_arrived_at > deadline:
                    record.abnormal_types.append(AbnormalType.LATE_ATTACHMENT)
                    record.status = RecordStatus.PENDING

        return records

    def _process_manual_corrections(
        self, records: List[ProofRecord]
    ) -> List[ProofRecord]:
        for record in records:
            if record.source and record.source.original_value:
                if (
                    "更正" in record.source.original_value
                    or "修正" in record.source.original_value
                    or "correction" in record.source.original_value.lower()
                ):
                    record.has_manual_correction = True
                    record.correction_note = "检测到人工更正标记"
                    record.abnormal_types.append(AbnormalType.MANUAL_CORRECTION)

        return records

    def parse(self) -> MaterialPackage:
        self.scan_files()
        self.parse_authorization_files()
        self.parse_proof_records()

        return MaterialPackage(
            package_id=self.package_id,
            package_name=self.package_id,
            received_at=datetime.now(),
            records=self.records,
            authorization_files=self.authorization_files,
            raw_files=self.raw_files,
        )
