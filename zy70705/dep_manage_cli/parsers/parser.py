import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd

from ..models import (
    Repository,
    Dependency,
    OwnerOpinion,
    ExtensionRequest,
    UpgradeBatch,
    SourceLocation,
    BadRow,
    OpinionType,
    ExtensionStatus,
    BatchStatus,
)


@dataclass
class ParseResult:
    repositories: List[Repository]
    dependencies: List[Dependency]
    owner_opinions: List[OwnerOpinion]
    extension_requests: List[ExtensionRequest]
    upgrade_batches: List[UpgradeBatch]
    bad_rows: List[BadRow]

    def __post_init__(self):
        self._sort_all()

    def _sort_all(self):
        self.repositories.sort(key=lambda r: r.name)
        self.dependencies.sort(key=lambda d: d.package_name)
        self.owner_opinions.sort(key=lambda o: (o.repo_name, o.owner))
        self.extension_requests.sort(key=lambda e: (e.repo_name, e.requested_date))
        self.upgrade_batches.sort(key=lambda b: b.batch_id)
        self.bad_rows.sort(key=lambda b: (b.source.file_path, b.source.row_number or 0))


class DataParser:
    def __init__(self):
        self.bad_rows: List[BadRow] = []

    def parse_all(
        self,
        repos_file: Optional[str] = None,
        deps_file: Optional[str] = None,
        opinions_file: Optional[str] = None,
        extensions_file: Optional[str] = None,
        batches_file: Optional[str] = None,
    ) -> ParseResult:
        self.bad_rows = []

        return ParseResult(
            repositories=self._parse_repositories(repos_file) if repos_file else [],
            dependencies=self._parse_dependencies(deps_file) if deps_file else [],
            owner_opinions=self._parse_owner_opinions(opinions_file) if opinions_file else [],
            extension_requests=self._parse_extensions(extensions_file) if extensions_file else [],
            upgrade_batches=self._parse_batches(batches_file) if batches_file else [],
            bad_rows=self.bad_rows,
        )

    def _read_sheet(self, file_path: str, sheet_name: Optional[str] = None) -> Tuple[pd.DataFrame, str]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            if sheet_name:
                df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
                return df, sheet_name
            else:
                df = pd.read_excel(file_path, dtype=str)
                return df, "Sheet1"
        elif ext == '.csv':
            df = pd.read_csv(file_path, dtype=str)
            return df, "N/A"
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _parse_repositories(self, file_path: str) -> List[Repository]:
        repos = []
        df, sheet_name = self._read_sheet(file_path)

        for idx, row in df.iterrows():
            row_num = idx + 2
            source = SourceLocation(file_path=file_path, sheet_name=sheet_name, row_number=row_num)
            try:
                row_dict = row.to_dict()
                name = self._get_required(row_dict, ['name', 'repo_name', 'repository', '仓库名'], source, row_dict)
                owner = self._get_required(row_dict, ['owner', '负责人', '维护者'], source, row_dict)
                current_version = self._get_required(row_dict, ['current_version', 'version', '当前版本'], source, row_dict)

                repos.append(Repository(
                    name=name,
                    owner=owner,
                    current_version=current_version,
                    source=source,
                    metadata=row_dict,
                ))
            except Exception as e:
                self._add_bad_row(source, row.to_dict(), str(e), "RepositoryParseError")

        return repos

    def _parse_dependencies(self, file_path: str) -> List[Dependency]:
        deps = []
        df, sheet_name = self._read_sheet(file_path)

        for idx, row in df.iterrows():
            row_num = idx + 2
            source = SourceLocation(file_path=file_path, sheet_name=sheet_name, row_number=row_num)
            try:
                row_dict = row.to_dict()
                package_name = self._get_required(row_dict, ['package_name', 'package', '依赖包'], source, row_dict)
                target_version = self._get_required(row_dict, ['target_version', '目标版本'], source, row_dict)
                min_version = self._get_optional(row_dict, ['min_version', '最低版本'])

                deps.append(Dependency(
                    package_name=package_name,
                    target_version=target_version,
                    min_version=min_version,
                    source=source,
                ))
            except Exception as e:
                self._add_bad_row(source, row.to_dict(), str(e), "DependencyParseError")

        return deps

    def _parse_owner_opinions(self, file_path: str) -> List[OwnerOpinion]:
        opinions = []
        df, sheet_name = self._read_sheet(file_path)

        for idx, row in df.iterrows():
            row_num = idx + 2
            source = SourceLocation(file_path=file_path, sheet_name=sheet_name, row_number=row_num)
            try:
                row_dict = row.to_dict()
                repo_name = self._get_required(row_dict, ['repo_name', 'repository', '仓库名'], source, row_dict)
                owner = self._get_required(row_dict, ['owner', '负责人'], source, row_dict)
                opinion_str = self._get_required(row_dict, ['opinion', '意见', '态度'], source, row_dict)
                opinion = self._parse_opinion(opinion_str)

                comment = self._get_optional(row_dict, ['comment', '备注', '说明'])
                opinion_date = self._parse_date(self._get_optional(row_dict, ['date', 'opinion_date', '日期']))

                opinions.append(OwnerOpinion(
                    repo_name=repo_name,
                    owner=owner,
                    opinion=opinion,
                    comment=comment,
                    opinion_date=opinion_date,
                    source=source,
                ))
            except Exception as e:
                self._add_bad_row(source, row.to_dict(), str(e), "OwnerOpinionParseError")

        return opinions

    def _parse_extensions(self, file_path: str) -> List[ExtensionRequest]:
        extensions = []
        df, sheet_name = self._read_sheet(file_path)

        for idx, row in df.iterrows():
            row_num = idx + 2
            source = SourceLocation(file_path=file_path, sheet_name=sheet_name, row_number=row_num)
            try:
                row_dict = row.to_dict()
                repo_name = self._get_required(row_dict, ['repo_name', 'repository', '仓库名'], source, row_dict)
                owner = self._get_required(row_dict, ['owner', '负责人'], source, row_dict)
                requested_by = self._get_required(row_dict, ['requested_by', '申请人'], source, row_dict)
                reason = self._get_required(row_dict, ['reason', '原因', '理由'], source, row_dict)
                requested_date = self._parse_date(self._get_required(row_dict, ['requested_date', '申请日期'], source, row_dict))
                new_target_date = self._parse_date(self._get_required(row_dict, ['new_target_date', '新目标日期'], source, row_dict))

                status_str = self._get_optional(row_dict, ['status', '状态'])
                status = self._parse_extension_status(status_str) if status_str else ExtensionStatus.REQUESTED

                approver = self._get_optional(row_dict, ['approver', '审批人'])
                approval_date = self._parse_date(self._get_optional(row_dict, ['approval_date', '审批日期']))

                extensions.append(ExtensionRequest(
                    repo_name=repo_name,
                    owner=owner,
                    requested_by=requested_by,
                    reason=reason,
                    requested_date=requested_date,
                    new_target_date=new_target_date,
                    status=status,
                    approver=approver,
                    approval_date=approval_date,
                    source=source,
                ))
            except Exception as e:
                self._add_bad_row(source, row.to_dict(), str(e), "ExtensionParseError")

        return extensions

    def _parse_batches(self, file_path: str) -> List[UpgradeBatch]:
        batches = []
        df, sheet_name = self._read_sheet(file_path)

        for idx, row in df.iterrows():
            row_num = idx + 2
            source = SourceLocation(file_path=file_path, sheet_name=sheet_name, row_number=row_num)
            try:
                row_dict = row.to_dict()
                batch_id = self._get_required(row_dict, ['batch_id', 'id', '批次ID'], source, row_dict)
                name = self._get_required(row_dict, ['name', '批次名', '名称'], source, row_dict)
                target_date = self._parse_date(self._get_required(row_dict, ['target_date', '目标日期'], source, row_dict))
                packages_str = self._get_required(row_dict, ['packages', '依赖包', '包列表'], source, row_dict)
                packages = [p.strip() for p in packages_str.split(',') if p.strip()]

                status_str = self._get_optional(row_dict, ['status', '状态'])
                status = self._parse_batch_status(status_str) if status_str else BatchStatus.PLANNED

                description = self._get_optional(row_dict, ['description', '描述', '说明'])

                batches.append(UpgradeBatch(
                    batch_id=batch_id,
                    name=name,
                    target_date=target_date,
                    packages=packages,
                    status=status,
                    description=description,
                    source=source,
                ))
            except Exception as e:
                self._add_bad_row(source, row.to_dict(), str(e), "BatchParseError")

        return batches

    def _get_required(self, row_dict: Dict[str, Any], possible_keys: List[str], source: SourceLocation, raw_data: Dict[str, Any]) -> str:
        for key in possible_keys:
            for actual_key in row_dict:
                if key.lower() in actual_key.lower() and pd.notna(row_dict[actual_key]):
                    val = str(row_dict[actual_key]).strip()
                    if val:
                        return val
        raise ValueError(f"缺少必填字段，尝试的键: {possible_keys}")

    def _get_optional(self, row_dict: Dict[str, Any], possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            for actual_key in row_dict:
                if key.lower() in actual_key.lower() and pd.notna(row_dict[actual_key]):
                    val = str(row_dict[actual_key]).strip()
                    if val:
                        return val
        return None

    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        if not date_str:
            return None
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%d-%m-%Y']:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def _parse_opinion(self, opinion_str: str) -> OpinionType:
        s = opinion_str.strip().lower()
        mapping = {
            'agree': OpinionType.AGREE,
            '同意': OpinionType.AGREE,
            '是': OpinionType.AGREE,
            'disagree': OpinionType.DISAGREE,
            '不同意': OpinionType.DISAGREE,
            '否': OpinionType.DISAGREE,
            'need_extension': OpinionType.NEED_EXTENSION,
            'extension': OpinionType.NEED_EXTENSION,
            '延期': OpinionType.NEED_EXTENSION,
            '需要延期': OpinionType.NEED_EXTENSION,
            'pending': OpinionType.PENDING,
            '待定': OpinionType.PENDING,
            '待确认': OpinionType.PENDING,
        }
        if s in mapping:
            return mapping[s]
        raise ValueError(f"无法解析意见类型: {opinion_str}")

    def _parse_extension_status(self, status_str: str) -> ExtensionStatus:
        s = status_str.strip().lower()
        mapping = {
            'requested': ExtensionStatus.REQUESTED,
            '已申请': ExtensionStatus.REQUESTED,
            '申请中': ExtensionStatus.REQUESTED,
            'approved': ExtensionStatus.APPROVED,
            '已批准': ExtensionStatus.APPROVED,
            '通过': ExtensionStatus.APPROVED,
            'rejected': ExtensionStatus.REJECTED,
            '已拒绝': ExtensionStatus.REJECTED,
            '驳回': ExtensionStatus.REJECTED,
        }
        if s in mapping:
            return mapping[s]
        raise ValueError(f"无法解析延期状态: {status_str}")

    def _parse_batch_status(self, status_str: str) -> BatchStatus:
        s = status_str.strip().lower()
        mapping = {
            'planned': BatchStatus.PLANNED,
            '已规划': BatchStatus.PLANNED,
            '规划中': BatchStatus.PLANNED,
            'in_progress': BatchStatus.IN_PROGRESS,
            '进行中': BatchStatus.IN_PROGRESS,
            '执行中': BatchStatus.IN_PROGRESS,
            'completed': BatchStatus.COMPLETED,
            '已完成': BatchStatus.COMPLETED,
            '完成': BatchStatus.COMPLETED,
            'delayed': BatchStatus.DELAYED,
            '已延期': BatchStatus.DELAYED,
            '延期': BatchStatus.DELAYED,
        }
        if s in mapping:
            return mapping[s]
        raise ValueError(f"无法解析批次状态: {status_str}")

    def _add_bad_row(self, source: SourceLocation, raw_data: Dict[str, Any], error_msg: str, error_type: str):
        self.bad_rows.append(BadRow(
            source=source,
            raw_data=raw_data,
            error_message=error_msg,
            error_type=error_type,
        ))
