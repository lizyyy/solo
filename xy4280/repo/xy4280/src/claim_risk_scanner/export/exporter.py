import csv
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

from claim_risk_scanner.storage import ReviewRecord, InvoiceRecord, ClaimRecord
from claim_risk_scanner.model import PredictionResult
from claim_risk_scanner.rules import RuleResult, RiskLevel


class MarkdownExporter:
    def __init__(self):
        self.generation_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    def export(
        self,
        output_path: Path,
        reviews: List[ReviewRecord],
        invoices: Optional[List[InvoiceRecord]] = None,
        claims: Optional[List[ClaimRecord]] = None,
        statistics: Optional[Dict[str, Any]] = None,
        title: str = "票据篡改线索筛查报告"
    ) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        high_risk = [r for r in reviews if r.risk_level == 'critical' or r.risk_level == 'high']
        medium_risk = [r for r in reviews if r.risk_level == 'medium']
        low_risk = [r for r in reviews if r.risk_level == 'low']
        pending = [r for r in reviews if r.status == 'pending']
        confirmed = [r for r in reviews if r.status == 'confirmed']
        
        content = []
        
        content.append(f"# {title}")
        content.append("")
        content.append(f"**生成时间**: {self.generation_time}")
        content.append("")
        content.append("---")
        content.append("")
        
        if statistics:
            content.append("## 统计概览")
            content.append("")
            content.append("| 指标 | 数值 |")
            content.append("|------|------|")
            content.append(f"| 总票据数 | {statistics.get('invoices', 0)} |")
            content.append(f"| 理赔单数 | {statistics.get('claims', 0)} |")
            content.append(f"| 风险样本数 | {statistics.get('risk_samples', 0)} |")
            content.append(f"| 高风险票据 | {statistics.get('high_risk_count', 0)} |")
            content.append("")
            
            risk_dist = statistics.get('risk_distribution', {})
            if risk_dist:
                content.append("### 风险等级分布")
                content.append("")
                content.append("| 风险等级 | 数量 |")
                content.append("|----------|------|")
                for level, count in risk_dist.items():
                    level_display = {
                        'critical': '🔴 极高风险',
                        'high': '🟠 高风险',
                        'medium': '🟡 中风险',
                        'low': '🟢 低风险'
                    }.get(level, level)
                    content.append(f"| {level_display} | {count} |")
                content.append("")
            
            status_dist = statistics.get('status_distribution', {})
            if status_dist:
                content.append("### 复核状态分布")
                content.append("")
                content.append("| 状态 | 数量 |")
                content.append("|------|------|")
                for status, count in status_dist.items():
                    status_display = {
                        'pending': '⏳ 待复核',
                        'reviewing': '🔍 复核中',
                        'confirmed': '✅ 已确认',
                        'dismissed': '❌ 已驳回',
                        'escalated': '⚠️ 已升级'
                    }.get(status, status)
                    content.append(f"| {status_display} | {count} |")
                content.append("")
        
        if high_risk:
            content.append("---")
            content.append("")
            content.append("## 🔴 高风险票据详情")
            content.append("")
            
            for idx, review in enumerate(high_risk, 1):
                risk_icon = '🔴' if review.risk_level == 'critical' else '🟠'
                content.append(f"### {risk_icon} 票据 {idx}: {review.invoice_number}")
                content.append("")
                content.append(f"**风险分数**: {review.risk_score:.2%}")
                content.append(f"**风险等级**: {self._level_display(review.risk_level)}")
                content.append(f"**复核状态**: {self._status_display(review.status)}")
                content.append("")
                
                if review.rule_matches:
                    content.append("**触发规则**:")
                    content.append("")
                    content.append("| 规则名称 | 风险等级 | 证据 |")
                    content.append("|----------|----------|------|")
                    for rule in review.rule_matches:
                        level = rule.get('risk_level', 'unknown')
                        content.append(f"| {rule.get('rule_name', 'N/A')} | {self._level_display(level)} | {rule.get('evidence', 'N/A')} |")
                    content.append("")
                
                if review.top_features:
                    content.append("**主要风险特征**:")
                    content.append("")
                    for feat_name, contribution in review.top_features:
                        if abs(contribution) > 0:
                            display_name = self._feature_display_name(feat_name)
                            content.append(f"- {display_name}: 贡献度 {abs(contribution):.4f}")
                    content.append("")
                
                if review.reviewer_notes:
                    content.append(f"**复核备注**: {review.reviewer_notes}")
                    content.append("")
        
        if medium_risk:
            content.append("---")
            content.append("")
            content.append("## 🟡 中风险票据汇总")
            content.append("")
            content.append("| 序号 | 发票号 | 风险分数 | 复核状态 |")
            content.append("|------|--------|----------|----------|")
            for idx, review in enumerate(medium_risk, 1):
                content.append(f"| {idx} | {review.invoice_number} | {review.risk_score:.2%} | {self._status_display(review.status)} |")
            content.append("")
        
        if low_risk:
            content.append("---")
            content.append("")
            content.append("## 🟢 低风险票据汇总")
            content.append("")
            content.append(f"共 {len(low_risk)} 张低风险票据，风险分数均低于 40%。")
            content.append("")
        
        if pending:
            content.append("---")
            content.append("")
            content.append("## ⏳ 待复核清单")
            content.append("")
            content.append("建议优先级：按风险分数从高到低依次复核")
            content.append("")
            content.append("| 优先级 | 发票号 | 风险分数 | 风险等级 |")
            content.append("|--------|--------|----------|----------|")
            sorted_pending = sorted(pending, key=lambda r: r.risk_score, reverse=True)
            for idx, review in enumerate(sorted_pending, 1):
                content.append(f"| {idx} | {review.invoice_number} | {review.risk_score:.2%} | {self._level_display(review.risk_level)} |")
            content.append("")
        
        content.append("---")
        content.append("")
        content.append("## 风险等级说明")
        content.append("")
        content.append("| 等级 | 分数范围 | 说明 |")
        content.append("|------|----------|------|")
        content.append("| 🔴 极高风险 | ≥ 90% | 存在明确的篡改证据或严重违规，需立即处理 |")
        content.append("| 🟠 高风险 | 70% - 89% | 存在多项风险特征，需重点复核 |")
        content.append("| 🟡 中风险 | 40% - 69% | 存在可疑特征，建议进一步检查 |")
        content.append("| 🟢 低风险 | < 40% | 无明显风险特征，可正常处理 |")
        content.append("")
        
        content.append("---")
        content.append("")
        content.append("*本报告由票据篡改线索筛查器自动生成*")
        content.append("")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        return output_path
    
    def _level_display(self, level: str) -> str:
        return {
            'critical': '🔴 极高风险',
            'high': '🟠 高风险',
            'medium': '🟡 中风险',
            'low': '🟢 低风险'
        }.get(level, level)
    
    def _status_display(self, status: str) -> str:
        return {
            'pending': '⏳ 待复核',
            'reviewing': '🔍 复核中',
            'confirmed': '✅ 已确认',
            'dismissed': '❌ 已驳回',
            'escalated': '⚠️ 已升级'
        }.get(status, status)
    
    def _feature_display_name(self, feature: str) -> str:
        names = {
            'amount_anomaly_score': '金额异常度',
            'date_anomaly_score': '日期异常度',
            'ocr_confidence_score': 'OCR置信度风险',
            'item_amount_mismatch_score': '明细金额不一致',
            'tax_ratio_anomaly_score': '税率比例异常',
            'amount_roundness_score': '金额凑整特征',
            'risk_sample_match_score': '风险样本匹配',
            'vendor_appearance_frequency': '商户出现频率',
            'vendor_risk_level_num': '商户风险等级',
            'name_variation_count': '商户名称变体',
            'tax_id_mismatch_score': '税号不一致',
            'exact_duplicate_count': '精确重复次数',
            'partial_duplicate_count': '部分重复次数',
            'amount_variation_score': '金额变化比例',
            'date_variation_score': '日期不一致',
            'duplicate_claim_count': '多理赔单关联',
        }
        return names.get(feature, feature)


class CSVExporter:
    def export(
        self,
        output_path: Path,
        reviews: List[ReviewRecord],
        invoices: Optional[List[InvoiceRecord]] = None
    ) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        invoice_map = {}
        if invoices:
            for inv in invoices:
                invoice_map[inv.invoice_number] = inv
        
        rows = []
        
        for review in reviews:
            inv = invoice_map.get(review.invoice_number)
            
            row = {
                '发票号': review.invoice_number,
                '风险分数': f"{review.risk_score:.4f}",
                '风险等级': review.risk_level,
                '复核状态': review.status,
                '商户名称': inv.vendor_name if inv else '',
                '金额': inv.total_amount if inv else 0,
                '开票日期': inv.invoice_date if inv else '',
                '触发规则数': len(review.rule_matches),
                '复核备注': review.reviewer_notes or '',
                '复核人': review.reviewer_id or '',
                '创建时间': review.created_at.strftime('%Y-%m-%d %H:%M:%S') if review.created_at else '',
            }
            
            if review.rule_matches:
                rule_names = [r.get('rule_name', '') for r in review.rule_matches]
                row['触发规则'] = '; '.join(rule_names)
            else:
                row['触发规则'] = ''
            
            rows.append(row)
        
        if rows:
            fieldnames = list(rows[0].keys())
        else:
            fieldnames = ['发票号', '风险分数', '风险等级', '复核状态']
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path


class JSONExporter:
    def export(
        self,
        output_path: Path,
        reviews: List[ReviewRecord],
        invoices: Optional[List[InvoiceRecord]] = None,
        claims: Optional[List[ClaimRecord]] = None,
        statistics: Optional[Dict[str, Any]] = None,
        include_raw_data: bool = False
    ) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        audit_package = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '0.1.0',
                'package_type': 'audit_trail'
            },
            'statistics': statistics or {},
            'reviews': [],
            'invoices': [],
            'claims': [],
        }
        
        for review in reviews:
            review_dict = {
                'id': review.id,
                'invoice_number': review.invoice_number,
                'risk_score': review.risk_score,
                'risk_level': review.risk_level,
                'status': review.status,
                'reviewer_notes': review.reviewer_notes,
                'reviewer_id': review.reviewer_id,
                'features': review.features,
                'rule_matches': review.rule_matches,
                'top_features': review.top_features,
                'created_at': review.created_at.isoformat() if review.created_at else None,
                'reviewed_at': review.reviewed_at.isoformat() if review.reviewed_at else None,
            }
            audit_package['reviews'].append(review_dict)
        
        if invoices:
            for inv in invoices:
                inv_dict = {
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.invoice_date,
                    'vendor_name': inv.vendor_name,
                    'vendor_tax_id': inv.vendor_tax_id,
                    'total_amount': inv.total_amount,
                    'tax_amount': inv.tax_amount,
                    'buyer_name': inv.buyer_name,
                    'buyer_tax_id': inv.buyer_tax_id,
                    'ocr_confidence': inv.ocr_confidence,
                }
                if include_raw_data:
                    inv_dict['raw_json'] = inv.raw_json
                audit_package['invoices'].append(inv_dict)
        
        if claims:
            for claim in claims:
                claim_dict = {
                    'id': claim.id,
                    'claim_id': claim.claim_id,
                    'policy_number': claim.policy_number,
                    'claimant_name': claim.claimant_name,
                    'claim_date': claim.claim_date,
                    'claim_amount': claim.claim_amount,
                    'invoice_number': claim.invoice_number,
                    'diagnosis': claim.diagnosis,
                    'hospital_name': claim.hospital_name,
                }
                if include_raw_data:
                    claim_dict['raw_data'] = claim.raw_data
                audit_package['claims'].append(claim_dict)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path


class Exporter:
    def __init__(self):
        self.markdown_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        self.json_exporter = JSONExporter()
    
    def export_all(
        self,
        output_dir: Path,
        base_name: str,
        reviews: List[ReviewRecord],
        invoices: Optional[List[InvoiceRecord]] = None,
        claims: Optional[List[ClaimRecord]] = None,
        statistics: Optional[Dict[str, Any]] = None,
        include_raw_data: bool = False
    ) -> Dict[str, Path]:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        results = {}
        
        md_path = output_dir / f"{base_name}_report.md"
        results['markdown'] = self.markdown_exporter.export(
            md_path, reviews, invoices, claims, statistics
        )
        
        csv_path = output_dir / f"{base_name}_risk_list.csv"
        results['csv'] = self.csv_exporter.export(
            csv_path, reviews, invoices
        )
        
        json_path = output_dir / f"{base_name}_audit.json"
        results['json'] = self.json_exporter.export(
            json_path, reviews, invoices, claims, statistics, include_raw_data
        )
        
        return results
