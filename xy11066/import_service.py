import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Tuple
from models import (
    ColdChainClaim,
    ClaimStatus,
    TemperatureProbeStatus,
    BadRowInfo,
    ImportResult
)


class ColdChainClaimImportService:
    def __init__(self):
        self.existing_claims: Dict[str, ColdChainClaim] = {}
        self.status_transition_rules = {
            ClaimStatus.DRAFT: [ClaimStatus.SUBMITTED, ClaimStatus.REJECTED],
            ClaimStatus.SUBMITTED: [ClaimStatus.REVIEWING, ClaimStatus.REJECTED],
            ClaimStatus.REVIEWING: [ClaimStatus.SUPPLEMENT_REQUESTED, ClaimStatus.APPROVED, ClaimStatus.REJECTED],
            ClaimStatus.SUPPLEMENT_REQUESTED: [ClaimStatus.SUPPLEMENTED, ClaimStatus.REJECTED],
            ClaimStatus.SUPPLEMENTED: [ClaimStatus.REVIEWING, ClaimStatus.REJECTED],
            ClaimStatus.REJECTED: [ClaimStatus.SUBMITTED],
            ClaimStatus.APPROVED: [ClaimStatus.COMPLETED],
            ClaimStatus.COMPLETED: []
        }

    REQUEST_FIELDS = [
        "索赔单号", "仓库编码", "仓库名称", "运单号", "货物名称",
        "货物批次", "货物数量", "计量单位", "温度要求", "实际平均温度",
        "温度探头编号", "探头状态", "测温开始时间", "测温结束时间",
        "异常持续时长(小时)", "责任方", "索赔金额", "申请人",
        "申请时间", "状态"
    ]

    def validate_required_fields(self, row_data: Dict[str, Any], row_index: int) -> Tuple[bool, List[str]]:
        missing_fields = []
        for field in self.REQUEST_FIELDS:
            if field not in row_data or pd.isna(row_data[field]) or str(row_data[field]).strip() == "":
                missing_fields.append(field)
        return len(missing_fields) == 0, missing_fields

    def validate_status_transition(self, claim_id: str, new_status: ClaimStatus) -> Tuple[bool, str]:
        if claim_id not in self.existing_claims:
            return True, ""
        
        current_status = self.existing_claims[claim_id].status
        if new_status == current_status:
            return True, ""
        if new_status not in self.status_transition_rules.get(current_status, []):
            return False, f"状态不允许从'{current_status}'直接变更为'{new_status}'"
        return True, ""

    def parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if pd.isna(value):
            raise ValueError("日期值为空")
        return pd.to_datetime(value).to_pydatetime()

    def parse_probe_status(self, value: str) -> TemperatureProbeStatus:
        status_map = {
            "正常": TemperatureProbeStatus.NORMAL,
            "缺段": TemperatureProbeStatus.MISSING_SEGMENT,
            "超温": TemperatureProbeStatus.DEVIATION,
            "数据无效": TemperatureProbeStatus.INVALID
        }
        if value not in status_map:
            raise ValueError(f"无效的探头状态: {value}")
        return status_map[value]

    def parse_claim_status(self, value: str) -> ClaimStatus:
        status_map = {
            "草稿": ClaimStatus.DRAFT,
            "已提交": ClaimStatus.SUBMITTED,
            "审核中": ClaimStatus.REVIEWING,
            "要求补录": ClaimStatus.SUPPLEMENT_REQUESTED,
            "已补录": ClaimStatus.SUPPLEMENTED,
            "已驳回": ClaimStatus.REJECTED,
            "已通过": ClaimStatus.APPROVED,
            "已完成": ClaimStatus.COMPLETED
        }
        if value not in status_map:
            raise ValueError(f"无效的索赔状态: {value}")
        return status_map[value]

    def process_row(self, row_data: Dict[str, Any], row_index: int) -> Tuple[ColdChainClaim, List[BadRowInfo], List[BadRowInfo]]:
        bad_rows = []
        warning_rows = []
        claim = None

        is_valid, missing_fields = self.validate_required_fields(row_data, row_index)
        if not is_valid:
            bad_rows.append(BadRowInfo(
                row_index=row_index,
                original_data=row_data,
                error_reason=f"缺少必填字段: {', '.join(missing_fields)}",
                suggestion="请补充完整必填字段后重新导入"
            ))
            return None, bad_rows, warning_rows

        try:
            claim_id = str(row_data["索赔单号"]).strip()
            
            if claim_id in self.existing_claims:
                warning_rows.append(BadRowInfo(
                    row_index=row_index,
                    original_data=row_data,
                    error_reason=f"索赔单号 '{claim_id}' 已存在，将覆盖原有数据",
                    suggestion="请确认是否需要覆盖，如不需要请修改索赔单号后重新导入"
                ))

            new_status = self.parse_claim_status(str(row_data["状态"]).strip())
            status_valid, status_error = self.validate_status_transition(claim_id, new_status)
            if not status_valid:
                bad_rows.append(BadRowInfo(
                    row_index=row_index,
                    original_data=row_data,
                    error_reason=status_error,
                    suggestion="请按照状态流转规则设置正确的状态，或先进行中间状态的更新"
                ))
                return None, bad_rows, warning_rows

            probe_status = self.parse_probe_status(str(row_data["探头状态"]).strip())
            
            if probe_status == TemperatureProbeStatus.MISSING_SEGMENT:
                warning_rows.append(BadRowInfo(
                    row_index=row_index,
                    original_data=row_data,
                    error_reason="温度探头数据缺段，可能影响责任划分和索赔材料一致性",
                    suggestion="建议添加人工备注说明情况后继续推进流程"
                ))

            claim = ColdChainClaim(
                claim_id=claim_id,
                warehouse_code=str(row_data["仓库编码"]).strip(),
                warehouse_name=str(row_data["仓库名称"]).strip(),
                waybill_no=str(row_data["运单号"]).strip(),
                goods_name=str(row_data["货物名称"]).strip(),
                goods_batch=str(row_data["货物批次"]).strip(),
                goods_quantity=int(row_data["货物数量"]),
                goods_unit=str(row_data["计量单位"]).strip(),
                temperature_requirement=str(row_data["温度要求"]).strip(),
                actual_temperature_avg=float(row_data["实际平均温度"]),
                probe_id=str(row_data["温度探头编号"]).strip(),
                probe_status=probe_status,
                temperature_start_time=self.parse_datetime(row_data["测温开始时间"]),
                temperature_end_time=self.parse_datetime(row_data["测温结束时间"]),
                abnormal_duration_hours=float(row_data["异常持续时长(小时)"]),
                responsible_party=str(row_data["责任方"]).strip(),
                claim_amount=float(row_data["索赔金额"]),
                applicant=str(row_data["申请人"]).strip(),
                application_time=self.parse_datetime(row_data["申请时间"]),
                status=new_status,
                reviewer=str(row_data.get("审核人", "")).strip() or None,
                review_time=self.parse_datetime(row_data.get("审核时间")) if row_data.get("审核时间") and not pd.isna(row_data.get("审核时间")) else None,
                review_opinion=str(row_data.get("审核意见", "")).strip() or None,
                manual_remark=str(row_data.get("人工备注", "")).strip() or None,
                supplement_count=int(row_data.get("补录次数", 0))
            )

        except ValueError as e:
            bad_rows.append(BadRowInfo(
                row_index=row_index,
                original_data=row_data,
                error_reason=f"数据格式错误: {str(e)}",
                suggestion="请检查数据格式是否正确，特别是数字、日期和枚举字段"
            ))
            return None, bad_rows, warning_rows
        except Exception as e:
            bad_rows.append(BadRowInfo(
                row_index=row_index,
                original_data=row_data,
                error_reason=f"未知错误: {str(e)}",
                suggestion="请联系技术支持排查问题"
            ))
            return None, bad_rows, warning_rows

        return claim, bad_rows, warning_rows

    def import_from_dataframe(self, df: pd.DataFrame) -> ImportResult:
        result = ImportResult(success_count=0, fail_count=0, warning_count=0)
        
        for idx, row in df.iterrows():
            row_data = row.to_dict()
            row_index = idx + 2
            
            claim, bad_rows, warning_rows = self.process_row(row_data, row_index)
            
            result.bad_rows.extend(bad_rows)
            result.warning_rows.extend(warning_rows)
            
            if claim:
                self.existing_claims[claim.claim_id] = claim
                result.imported_claims.append(claim)
                result.success_count += 1
            else:
                result.fail_count += 1
            
            result.warning_count += len(warning_rows)

        return result

    def handle_probe_missing_segment(self, claim_id: str, manual_remark: str, operator: str) -> Tuple[bool, str]:
        if claim_id not in self.existing_claims:
            return False, "索赔单不存在"
        
        claim = self.existing_claims[claim_id]
        if claim.probe_status != TemperatureProbeStatus.MISSING_SEGMENT:
            return False, "该索赔单不存在探头缺段问题"
        
        claim.manual_remark = manual_remark
        claim.updated_at = datetime.now()
        
        if claim.status == ClaimStatus.REVIEWING:
            pass
        
        return True, "人工备注已添加，可继续推进索赔流程"
