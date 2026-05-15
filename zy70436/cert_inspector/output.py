import json
from pathlib import Path
from typing import Dict, Any


class OutputFormatter:
    @staticmethod
    def to_json(data: Dict[str, Any], pretty: bool = True) -> str:
        indent = 2 if pretty else None
        return json.dumps(data, ensure_ascii=False, indent=indent, default=str)

    @staticmethod
    def to_markdown(result: Dict[str, Any]) -> str:
        lines = []
        lines.append("# 证书过期巡检报告\n")
        lines.append(f"**巡检批次**: {result.get('batch_id', 'N/A')}\n")
        lines.append(f"**巡检人**: {result.get('inspector', 'N/A')}\n")
        lines.append(f"**巡检时间**: {result.get('inspection_time', 'N/A')}\n")
        lines.append(f"**证书总数**: {result.get('total_certs', 0)}\n")
        lines.append(f"**已过期证书**: {result.get('expired_count', 0)}\n")
        lines.append(f"**即将过期证书**: {result.get('expiring_soon_count', 0)}\n")
        lines.append("\n---\n")

        batch_conflicts = result.get("batch_conflicts", [])
        if batch_conflicts:
            lines.append("## 批次号冲突详情\n")
            for idx, conflict in enumerate(batch_conflicts, 1):
                lines.append(f"### 冲突 {idx}: {conflict['batch_no']}\n")
                lines.append(f"- 冲突分区数量: {conflict['conflict_count']}\n")
                lines.append("| 分区ID | 部门 | 提交人 | 环境 |\n")
                lines.append("|--------|------|--------|------|\n")
                for p in conflict["partitions"]:
                    lines.append(f"| {p['partition_id']} | {p['department']} | {p['submitter']} | {p['environment']} |\n")
                lines.append("\n")
        else:
            lines.append("## 批次号冲突: 无冲突\n\n")

        risk_details = result.get("risk_details", [])
        if risk_details:
            lines.append("## 风险证书详情\n")
            lines.append("| 证书ID | 证书编号 | 类型 | 持有人 | 到期日期 | 剩余天数 | 风险类型 | 部门 |\n")
            lines.append("|--------|----------|------|--------|----------|----------|----------|------|\n")
            for risk in risk_details:
                lines.append(
                    f"| {risk['cert_id']} | {risk['cert_no']} | {risk['cert_type']} | "
                    f"{risk['holder']} | {risk['expiry_date']} | {risk['days_until_expiry']} | "
                    f"{risk['risk_type']} | {risk['department']} |\n"
                )
            lines.append("\n")
        else:
            lines.append("## 风险证书: 无风险证书\n\n")

        manual_corrections = result.get("manual_corrections", [])
        if manual_corrections:
            lines.append("## 人工修正记录\n")
            lines.append("| 修正ID | 证书ID | 原始风险 | 修正后 | 操作者 | 备注 |\n")
            lines.append("|--------|--------|----------|--------|--------|------|\n")
            for corr in manual_corrections:
                lines.append(
                    f"| {corr['correction_id']} | {corr['cert_id']} | {corr['original_risk']} | "
                    f"{corr['corrected_risk']} | {corr['operator']} | {corr['remark']} |\n"
                )
            lines.append("\n")

        return "".join(lines)

    @staticmethod
    def save_json(data: Dict[str, Any], output_path: str, pretty: bool = True):
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(OutputFormatter.to_json(data, pretty), encoding='utf-8')

    @staticmethod
    def save_markdown(result: Dict[str, Any], output_path: str):
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(OutputFormatter.to_markdown(result), encoding='utf-8')

    @staticmethod
    def redemption_to_markdown(records) -> str:
        lines = []
        lines.append("# 发票红冲记录追溯报告\n\n")
        for idx, record in enumerate(records, 1):
            lines.append(f"## 记录 {idx}: {record.record_id}\n")
            lines.append(f"**发票号码**: {record.invoice_no}\n")
            lines.append(f"**红冲日期**: {record.redemption_date}\n")
            lines.append(f"**红冲金额**: {record.amount:,.2f}\n")
            lines.append(f"**操作人**: {record.operator}\n")
            lines.append(f"**所属部门**: {record.department}\n")
            lines.append(f"**环境**: {record.environment}\n")
            lines.append(f"**批次号**: {record.batch_no}\n")
            lines.append("\n### 原始输入数据\n")
            for key, value in record.original_input.items():
                lines.append(f"- **{key}**: {value}\n")
            lines.append(f"\n### 处理依据\n")
            lines.append(f"> {record.processing_basis}\n")
            lines.append("\n### 关联证书\n")
            for cert_id in record.related_cert_ids:
                lines.append(f"- {cert_id}\n")
            lines.append("\n---\n\n")
        return "".join(lines)
