from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

from .models import (
    ProofRecord,
    MaterialPackage,
    AuthorizationFile,
    VerificationInfo,
    MaterialSource,
    RecordStatus,
    AbnormalType,
)


class AbnormalityDetector:
    def __init__(self, material_package: MaterialPackage):
        self.package = material_package
        self.records = material_package.records
        self.auth_files = material_package.authorization_files
        self.auth_map: Dict[str, AuthorizationFile] = {
            auth.authorization_no: auth for auth in self.auth_files
        }

    def detect_all(self) -> List[ProofRecord]:
        for record in self.records:
            self._check_authorization_expired(record)
            self._check_color_version_mixed(record)
            self._check_export_spec_missed(record)

        return self.records

    def _check_authorization_expired(self, record: ProofRecord) -> None:
        auth_file = self.auth_map.get(record.authorization_no)
        check_date = record.submitted_at

        if auth_file:
            valid_until = auth_file.valid_until
        else:
            valid_until = record.authorization_valid_until

        is_expired = check_date > valid_until

        if is_expired:
            record.status = RecordStatus.PENDING
            record.abnormal_types.append(AbnormalType.AUTHORIZATION_EXPIRED)

            evidence = [
                f"记录提交日期: {check_date.strftime('%Y-%m-%d')}",
                f"授权有效期至: {valid_until.strftime('%Y-%m-%d')}",
                f"超期天数: {(check_date - valid_until).days} 天",
            ]

            source_files = []
            if record.source:
                source_files.append(record.source)
            if auth_file:
                source_files.append(
                    MaterialSource(
                        file_path=auth_file.file_path,
                        original_value=f"授权编号: {auth_file.authorization_no}, 有效期至: {valid_until}",
                    )
                )

            record.verification = VerificationInfo(
                reason=f"授权已过期 - 提交时授权已失效 {(check_date - valid_until).days} 天",
                evidence=evidence,
                source_files=source_files,
            )

    def _check_color_version_mixed(self, record: ProofRecord) -> None:
        auth_file = self.auth_map.get(record.authorization_no)

        if not auth_file or not auth_file.authorized_color_versions:
            record.status = RecordStatus.PENDING
            record.abnormal_types.append(AbnormalType.COLOR_VERSION_MIXED)

            evidence = [
                f"记录使用颜色版本: {record.color_version}",
                "未找到对应授权文件中的颜色版本列表",
                "无法确认颜色版本是否在授权范围内",
            ]

            source_files = []
            if record.source:
                source_files.append(record.source)

            record.verification = VerificationInfo(
                reason="颜色版本待确认 - 缺少授权文件中的颜色版本对照",
                evidence=evidence,
                source_files=source_files,
            )
            return

        record_color = record.color_version.strip()
        authorized_colors = [c.strip() for c in auth_file.authorized_color_versions]

        is_match = False
        match_details = []

        for auth_color in authorized_colors:
            if record_color == auth_color:
                is_match = True
                match_details.append(f"精确匹配: {record_color}")
                break
            elif record_color in auth_color or auth_color in record_color:
                match_details.append(f"模糊匹配: 记录={record_color}, 授权={auth_color}")

        if not is_match:
            record.status = RecordStatus.PENDING
            record.abnormal_types.append(AbnormalType.COLOR_VERSION_MIXED)

            evidence = [
                f"记录使用颜色版本: {record_color}",
                f"授权允许的颜色版本: {', '.join(authorized_colors)}",
            ]
            if match_details:
                evidence.append(f"检测到的模糊匹配: {'; '.join(match_details)}")
            else:
                evidence.append("无匹配项")

            source_files = []
            if record.source:
                source_files.append(record.source)
            source_files.append(
                MaterialSource(
                    file_path=auth_file.file_path,
                    original_value=f"授权颜色: {', '.join(authorized_colors)}",
                )
            )

            record.verification = VerificationInfo(
                reason="颜色版本混用待确认 - 记录颜色与授权颜色列表不匹配",
                evidence=evidence,
                source_files=source_files,
            )

    def _check_export_spec_missed(self, record: ProofRecord) -> None:
        auth_file = self.auth_map.get(record.authorization_no)

        if not auth_file or not auth_file.authorized_specs:
            record.status = RecordStatus.PENDING
            record.abnormal_types.append(AbnormalType.EXPORT_SPEC_MISSED)

            evidence = [
                f"记录使用规格: {record.spec}",
                "未找到对应授权文件中的规格列表",
                "无法确认导出规格是否正确",
            ]

            source_files = []
            if record.source:
                source_files.append(record.source)

            record.verification = VerificationInfo(
                reason="导出规格待确认 - 缺少授权文件中的规格对照",
                evidence=evidence,
                source_files=source_files,
            )
            return

        record_spec = record.spec.strip()
        authorized_specs = [s.strip() for s in auth_file.authorized_specs]

        is_match = False
        for auth_spec in authorized_specs:
            if record_spec == auth_spec:
                is_match = True
                break

        if not is_match:
            record.status = RecordStatus.PENDING
            record.abnormal_types.append(AbnormalType.EXPORT_SPEC_MISSED)

            evidence = [
                f"记录使用规格: {record_spec}",
                f"授权允许的规格: {', '.join(authorized_specs)}",
                "请确认是否漏改导出规格",
            ]

            source_files = []
            if record.source:
                source_files.append(record.source)
            source_files.append(
                MaterialSource(
                    file_path=auth_file.file_path,
                    original_value=f"授权规格: {', '.join(authorized_specs)}",
                )
            )

            record.verification = VerificationInfo(
                reason="导出规格漏改待确认 - 记录规格与授权规格不匹配",
                evidence=evidence,
                source_files=source_files,
            )


class CrossRecordChecker:
    def __init__(self, records: List[ProofRecord]):
        self.records = records

    def check_color_consistency(self) -> List[ProofRecord]:
        material_color_map: Dict[str, Dict[str, List[ProofRecord]]] = defaultdict(
            lambda: defaultdict(list)
        )

        for record in self.records:
            material_color_map[record.material_name][record.color_version].append(
                record
            )

        for material, color_groups in material_color_map.items():
            if len(color_groups) > 1:
                color_versions = list(color_groups.keys())
                all_records = [r for records in color_groups.values() for r in records]

                for record in all_records:
                    has_mixed = any(
                        at == AbnormalType.COLOR_VERSION_MIXED
                        for at in record.abnormal_types
                    )
                    if not has_mixed:
                        record.status = RecordStatus.PENDING
                        record.abnormal_types.append(AbnormalType.COLOR_VERSION_MIXED)

                        evidence = [
                            f"物料名称: {material}",
                            f"该物料检测到多种颜色版本混用: {', '.join(color_versions)}",
                            f"各版本数量: {', '.join([f'{c}={len(rs)}条' for c, rs in color_groups.items()])}",
                        ]

                        source_files = []
                        if record.source:
                            source_files.append(record.source)

                        for color, recs in color_groups.items():
                            for r in recs[:2]:
                                if r.source and r.source != record.source:
                                    source_files.append(r.source)

                        if record.verification:
                            record.verification.reason = (
                                "颜色版本混用待确认 - 同一物料存在多个颜色版本"
                            )
                            record.verification.evidence.extend(evidence[1:])
                        else:
                            record.verification = VerificationInfo(
                                reason="颜色版本混用待确认 - 同一物料存在多个颜色版本",
                                evidence=evidence,
                                source_files=source_files,
                            )

        return self.records
