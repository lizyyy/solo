import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from .models import (
    ProjectState, Asset, License, Risk,
    RiskType, RiskLevel, AssetType
)
from .checker import group_risks_by_type, group_risks_by_level, get_risk_summary
from .storage import DateTimeEncoder


RISK_TYPE_DISPLAY = {
    RiskType.MISSING_LICENSE: "缺少授权",
    RiskType.EXPIRED: "授权过期",
    RiskType.USAGE_MISMATCH: "用途不匹配",
    RiskType.INSUFFICIENT_SEATS: "授权人数不足",
    RiskType.NAME_HASH_MISMATCH: "同名不同哈希",
    RiskType.DUPLICATE_ASSET: "重复素材",
    RiskType.RENAMED_ASSET: "素材重命名",
}

RISK_LEVEL_DISPLAY = {
    RiskLevel.CRITICAL: "严重",
    RiskLevel.HIGH: "高",
    RiskLevel.MEDIUM: "中",
    RiskLevel.LOW: "低",
}

ASSET_TYPE_DISPLAY = {
    AssetType.IMAGE: "图片",
    AssetType.FONT: "字体",
    AssetType.AUDIO: "音频",
    AssetType.VIDEO: "视频",
    AssetType.DOCUMENT: "文档",
    AssetType.OTHER: "其他",
}


class MarkdownReporter:
    def __init__(self, state: ProjectState):
        self.state = state

    def generate(self) -> str:
        lines: List[str] = []
        
        lines.extend(self._generate_header())
        lines.append("")
        
        lines.extend(self._generate_summary())
        lines.append("")
        
        lines.extend(self._generate_risk_summary())
        lines.append("")
        
        lines.extend(self._generate_risks_by_level())
        lines.append("")
        
        lines.extend(self._generate_risks_by_type())
        lines.append("")
        
        lines.extend(self._generate_asset_list())
        lines.append("")
        
        lines.extend(self._generate_license_list())
        lines.append("")
        
        lines.extend(self._generate_footer())
        
        return "\n".join(lines)

    def _generate_header(self) -> List[str]:
        return [
            "# 素材授权包风险报告",
            "",
            f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 项目名称: {self.state.project_name}",
            f"> 扫描时间: {self.state.scan_date.strftime('%Y-%m-%d %H:%M:%S')}",
        ]

    def _generate_summary(self) -> List[str]:
        lines = [
            "## 统计概览",
            "",
            "| 项目 | 数量 |",
            "|------|------|",
            f"| 扫描素材总数 | {len(self.state.assets)} |",
            f"| 导入授权总数 | {len(self.state.licenses)} |",
            f"| 发现风险总数 | {len(self.state.risks)} |",
            "",
        ]
        
        by_type = {}
        for asset in self.state.assets:
            type_name = ASSET_TYPE_DISPLAY.get(asset.asset_type, asset.asset_type.value)
            by_type[type_name] = by_type.get(type_name, 0) + 1
        
        if by_type:
            lines.append("### 素材类型分布")
            lines.append("")
            lines.append("| 类型 | 数量 |")
            lines.append("|------|------|")
            for type_name, count in sorted(by_type.items()):
                lines.append(f"| {type_name} | {count} |")
            lines.append("")
        
        return lines

    def _generate_risk_summary(self) -> List[str]:
        lines = ["## 风险汇总", ""]
        
        by_level = group_risks_by_level(self.state.risks)
        
        level_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]
        
        lines.append("### 按严重程度")
        lines.append("")
        lines.append("| 严重程度 | 数量 | 说明 |")
        lines.append("|----------|------|------|")
        
        for level in level_order:
            count = len(by_level.get(level, []))
            display = RISK_LEVEL_DISPLAY.get(level, level.value)
            
            if level == RiskLevel.CRITICAL:
                note = "需立即处理"
            elif level == RiskLevel.HIGH:
                note = "建议尽快处理"
            elif level == RiskLevel.MEDIUM:
                note = "需要关注"
            else:
                note = "建议检查"
            
            lines.append(f"| **{display}** | {count} | {note} |")
        lines.append("")
        
        return lines

    def _generate_risks_by_level(self) -> List[str]:
        lines = []
        by_level = group_risks_by_level(self.state.risks)
        
        level_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]
        
        for level in level_order:
            risks = by_level.get(level, [])
            if not risks:
                continue
            
            display = RISK_LEVEL_DISPLAY.get(level, level.value)
            lines.append(f"### {display}风险 ({len(risks)}个)")
            lines.append("")
            
            for i, risk in enumerate(risks, 1):
                type_display = RISK_TYPE_DISPLAY.get(risk.risk_type, risk.risk_type.value)
                lines.append(f"#### {i}. [{type_display}] {risk.message}")
                lines.append("")
                
                if risk.asset:
                    lines.append(f"- **素材文件**: `{risk.asset.file_path}`")
                    lines.append(f"- **文件哈希**: `{risk.asset.file_hash[:16]}...`")
                
                if risk.license:
                    lines.append(f"- **授权ID**: `{risk.license.license_id}`")
                    lines.append(f"- **授权名称**: {risk.license.asset_name}")
                
                if risk.details:
                    lines.append("")
                    lines.append("**详情**:")
                    for key, value in risk.details.items():
                        if isinstance(value, list):
                            value_str = ", ".join(str(v) for v in value)
                        else:
                            value_str = str(value)
                        lines.append(f"- {key}: {value_str}")
                
                lines.append("")
        
        return lines

    def _generate_risks_by_type(self) -> List[str]:
        lines = []
        by_type = group_risks_by_type(self.state.risks)
        
        if not by_type:
            return lines
        
        lines.append("## 风险类型详情")
        lines.append("")
        
        for risk_type, risks in sorted(by_type.items(), key=lambda x: x[0].value):
            type_display = RISK_TYPE_DISPLAY.get(risk_type, risk_type.value)
            lines.append(f"### {type_display} ({len(risks)}个)")
            lines.append("")
            
            for risk in risks[:5]:
                asset_name = risk.asset.file_name if risk.asset else "N/A"
                lines.append(f"- `{asset_name}`: {risk.message}")
            
            if len(risks) > 5:
                lines.append(f"- ... 还有 {len(risks) - 5} 个同类风险")
            
            lines.append("")
        
        return lines

    def _generate_asset_list(self) -> List[str]:
        lines = ["## 素材台账", ""]
        
        lines.append("### 有授权素材")
        lines.append("")
        lines.append("| 文件名 | 类型 | 大小 | 哈希(前16位) | 授权状态 |")
        lines.append("|--------|------|------|--------------|----------|")
        
        licensed_assets = [a for a in self.state.assets if len(a.matched_licenses) > 0]
        
        for asset in sorted(licensed_assets, key=lambda a: a.file_name):
            type_display = ASSET_TYPE_DISPLAY.get(asset.asset_type, asset.asset_type.value)
            size_str = self._format_size(asset.file_size)
            hash_short = asset.file_hash[:16]
            license_count = len(asset.matched_licenses)
            status = f"已匹配 {license_count} 个授权"
            
            lines.append(f"| {asset.file_name} | {type_display} | {size_str} | `{hash_short}` | {status} |")
        
        lines.append("")
        
        unlicensed_assets = [a for a in self.state.assets if len(a.matched_licenses) == 0]
        
        if unlicensed_assets:
            lines.append("### 无授权素材 (需关注)")
            lines.append("")
            lines.append("| 文件名 | 类型 | 大小 | 哈希(前16位) |")
            lines.append("|--------|------|------|--------------|")
            
            for asset in sorted(unlicensed_assets, key=lambda a: a.file_name):
                type_display = ASSET_TYPE_DISPLAY.get(asset.asset_type, asset.asset_type.value)
                size_str = self._format_size(asset.file_size)
                hash_short = asset.file_hash[:16]
                
                lines.append(f"| {asset.file_name} | {type_display} | {size_str} | `{hash_short}` |")
            
            lines.append("")
        
        return lines

    def _generate_license_list(self) -> List[str]:
        lines = ["## 授权清单", ""]
        
        if not self.state.licenses:
            lines.append("*暂无导入的授权记录*")
            lines.append("")
            return lines
        
        lines.append("| 授权ID | 素材名称 | 供应商 | 有效期 | 授权人数 | 匹配状态 |")
        lines.append("|--------|----------|--------|--------|----------|----------|")
        
        for lic in sorted(self.state.licenses, key=lambda l: l.license_id):
            vendor = lic.vendor or "-"
            
            if lic.expiry_date:
                expiry_str = lic.expiry_date.strftime('%Y-%m-%d')
            else:
                expiry_str = "永久"
            
            seats = str(lic.seats) if lic.seats is not None else "不限"
            
            matched_assets = [a for a in self.state.assets if lic in a.matched_licenses]
            if matched_assets:
                status = f"已匹配 {len(matched_assets)} 个素材"
            else:
                status = "未匹配素材"
            
            lines.append(f"| `{lic.license_id}` | {lic.asset_name} | {vendor} | {expiry_str} | {seats} | {status} |")
        
        lines.append("")
        
        return lines

    def _generate_footer(self) -> List[str]:
        return [
            "---",
            "",
            "> 本报告由「素材授权包巡检员」生成",
            f"> 工具版本: v0.1.0",
        ]

    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


class CSVReporter:
    def __init__(self, state: ProjectState):
        self.state = state

    def export_assets(self, file_path: str) -> str:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '文件名', '文件路径', '类型', '大小(字节)', '文件哈希',
                '修改时间', '授权状态', '匹配的授权ID', '备注'
            ])

            for asset in sorted(self.state.assets, key=lambda a: a.file_name):
                type_display = ASSET_TYPE_DISPLAY.get(asset.asset_type, asset.asset_type.value)
                license_count = len(asset.matched_licenses)
                
                if license_count == 0:
                    license_status = "无授权"
                else:
                    license_status = f"已匹配{license_count}个授权"
                
                matched_ids = ",".join([lic.license_id for lic in asset.matched_licenses])
                
                writer.writerow([
                    asset.file_name,
                    asset.file_path,
                    type_display,
                    asset.file_size,
                    asset.file_hash,
                    asset.modified_time.strftime('%Y-%m-%d %H:%M:%S') if asset.modified_time else "",
                    license_status,
                    matched_ids,
                    ""
                ])

        return str(path)

    def export_risks(self, file_path: str) -> str:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '风险ID', '风险类型', '严重程度', '消息',
                '关联素材文件', '关联授权ID', '详情JSON'
            ])

            for risk in self.state.risks:
                type_display = RISK_TYPE_DISPLAY.get(risk.risk_type, risk.risk_type.value)
                level_display = RISK_LEVEL_DISPLAY.get(risk.risk_level, risk.risk_level.value)
                
                asset_file = risk.asset.file_path if risk.asset else ""
                license_id = risk.license.license_id if risk.license else ""
                details_json = json.dumps(risk.details, ensure_ascii=False)
                
                writer.writerow([
                    risk.risk_id,
                    type_display,
                    level_display,
                    risk.message,
                    asset_file,
                    license_id,
                    details_json
                ])

        return str(path)


class JSONReporter:
    def __init__(self, state: ProjectState):
        self.state = state

    def export_audit_package(self, file_path: str) -> str:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        audit_data = {
            "audit_info": {
                "generated_at": datetime.now().isoformat(),
                "tool_version": "0.1.0",
                "project_name": self.state.project_name,
                "scan_date": self.state.scan_date.isoformat() if self.state.scan_date else None,
            },
            "summary": {
                "total_assets": len(self.state.assets),
                "total_licenses": len(self.state.licenses),
                "total_risks": len(self.state.risks),
                "risk_counts_by_level": self._get_risk_counts_by_level(),
                "risk_counts_by_type": self._get_risk_counts_by_type(),
            },
            "assets": [self._asset_to_audit_dict(a) for a in self.state.assets],
            "licenses": [self._license_to_audit_dict(l) for l in self.state.licenses],
            "risks": [self._risk_to_audit_dict(r) for r in self.state.risks],
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)

        return str(path)

    def _get_risk_counts_by_level(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for risk in self.state.risks:
            level = risk.risk_level.value
            counts[level] = counts.get(level, 0) + 1
        return counts

    def _get_risk_counts_by_type(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for risk in self.state.risks:
            risk_type = risk.risk_type.value
            counts[risk_type] = counts.get(risk_type, 0) + 1
        return counts

    def _asset_to_audit_dict(self, asset: Asset) -> Dict[str, Any]:
        return {
            "file_name": asset.file_name,
            "file_path": asset.file_path,
            "file_size": asset.file_size,
            "file_hash": asset.file_hash,
            "asset_type": asset.asset_type.value,
            "extension": asset.extension,
            "modified_time": asset.modified_time.isoformat() if asset.modified_time else None,
            "created_time": asset.created_time.isoformat() if asset.created_time else None,
            "has_license": len(asset.matched_licenses) > 0,
            "matched_license_ids": [lic.license_id for lic in asset.matched_licenses],
        }

    def _license_to_audit_dict(self, license: License) -> Dict[str, Any]:
        matched_assets = [
            a.file_path for a in self.state.assets 
            if license in a.matched_licenses
        ]
        
        return {
            "license_id": license.license_id,
            "asset_name": license.asset_name,
            "asset_type": license.asset_type.value if license.asset_type else None,
            "vendor": license.vendor,
            "license_type": license.license_type,
            "purchase_date": license.purchase_date.isoformat() if license.purchase_date else None,
            "expiry_date": license.expiry_date.isoformat() if license.expiry_date else None,
            "seats": license.seats,
            "allowed_usage": license.allowed_usage,
            "restrictions": license.restrictions,
            "original_file": license.original_file,
            "asset_hash": license.asset_hash,
            "notes": license.notes,
            "source": license.source,
            "matched_asset_files": matched_assets,
            "is_matched": len(matched_assets) > 0,
        }

    def _risk_to_audit_dict(self, risk: Risk) -> Dict[str, Any]:
        return {
            "risk_id": risk.risk_id,
            "risk_type": risk.risk_type.value,
            "risk_type_display": RISK_TYPE_DISPLAY.get(risk.risk_type, risk.risk_type.value),
            "risk_level": risk.risk_level.value,
            "risk_level_display": RISK_LEVEL_DISPLAY.get(risk.risk_level, risk.risk_level.value),
            "message": risk.message,
            "asset_file": risk.asset.file_path if risk.asset else None,
            "asset_hash": risk.asset.file_hash if risk.asset else None,
            "license_id": risk.license.license_id if risk.license else None,
            "details": risk.details,
        }


def generate_markdown_report(state: ProjectState, output_path: str) -> str:
    reporter = MarkdownReporter(state)
    content = reporter.generate()
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return str(path)


def export_assets_csv(state: ProjectState, output_path: str) -> str:
    reporter = CSVReporter(state)
    return reporter.export_assets(output_path)


def export_risks_csv(state: ProjectState, output_path: str) -> str:
    reporter = CSVReporter(state)
    return reporter.export_risks(output_path)


def export_audit_json(state: ProjectState, output_path: str) -> str:
    reporter = JSONReporter(state)
    return reporter.export_audit_package(output_path)
