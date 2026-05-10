import os
import json
from typing import Dict, List


class ClaimReporter:
    def __init__(self, reports_dir: str = 'reports'):
        self.reports_dir = reports_dir
        self._ensure_reports_dir()

    def _ensure_reports_dir(self):
        if not os.path.exists(self.reports_dir):
            os.makedirs(self.reports_dir)

    def format_claim_display(self, claim: dict) -> str:
        lines = []
        
        lines.append("=" * 80)
        lines.append(f"{'摄影器材保险理赔单':^80}")
        lines.append("=" * 80)
        
        lines.append(f"\n【理赔基本信息】")
        lines.append(f"  理赔单号: {claim['claim_id']}")
        lines.append(f"  订单编号: {claim['order_id']}")
        lines.append(f"  客户姓名: {claim['customer_name']}")
        lines.append(f"  客户编号: {claim['customer_id']}")
        lines.append(f"  状态: {claim['status']}")
        lines.append(f"  创建时间: {claim['created_at']}")
        if claim.get('confirmed_at'):
            lines.append(f"  确认时间: {claim['confirmed_at']}")

        lines.append(f"\n【押金信息】")
        lines.append(f"  原始押金: ¥{claim['original_deposit']:,.2f}")
        lines.append(f"  已抵扣押金: ¥{claim['total_deposit_deducted']:,.2f}")
        lines.append(f"  剩余押金: ¥{claim['total_deposit_remaining']:,.2f}")

        lines.append(f"\n【理赔明细】")
        lines.append("-" * 80)
        
        for item in claim['items']:
            lines.append(f"\n器材: {item['equipment_name']} ({item['equipment_id']})")
            lines.append(f"  损坏等级: {self._format_damage_level(item['damage_level'])}")
            lines.append(f"  损坏描述: {item['damage_description']}")
            lines.append(f"  评估损失: ¥{item['assessed_loss']:,.2f}")
            lines.append(f"  维修报价: ¥{item['repair_cost']:,.2f}")
            lines.append(f"  是否投保: {'是' if item['is_insured'] else '否'}")
            
            if item['is_excluded']:
                lines.append(f"  排除原因: {item['exclusion_reason']}")
                lines.append(f"  客户应付: ¥{item['customer_payable']:,.2f} (全额自负)")
            else:
                lines.append(f"  免赔额: ¥{item['deductible_applied']:,.2f}")
                lines.append(f"  保险赔付: ¥{item['insurance_payout']:,.2f}")
                lines.append(f"  客户应付: ¥{item['customer_payable']:,.2f}")
            
            if item['deposit_deducted'] > 0:
                lines.append(f"  押金抵扣: ¥{item['deposit_deducted']:,.2f}")

        lines.append("\n" + "-" * 80)
        lines.append(f"\n【金额汇总】")
        lines.append(f"  总评估损失: ¥{claim['total_assessed_loss']:,.2f}")
        lines.append(f"  总维修成本: ¥{claim['total_repair_cost']:,.2f}")
        lines.append(f"  总免赔额: ¥{claim['total_deductible']:,.2f}")
        lines.append(f"  总保险赔付: ¥{claim['total_insurance_payout']:,.2f}")
        lines.append(f"  客户应付总额: ¥{claim['total_customer_payable']:,.2f}")

        if claim['anomalies']:
            lines.append(f"\n【异常情况】")
            for i, anomaly in enumerate(claim['anomalies'], 1):
                lines.append(f"  {i}. [{anomaly['type']}] {anomaly['message']}")

        lines.append("\n" + "=" * 80)
        
        return "\n".join(lines)

    def _format_damage_level(self, level: str) -> str:
        mapping = {
            'minor': '轻微损坏',
            'moderate': '中等损坏',
            'severe': '严重损坏',
            'total_loss': '全损'
        }
        return mapping.get(level, level)

    def export_report(self, claim: dict, format: str = 'text') -> str:
        if format == 'json':
            return json.dumps(claim, ensure_ascii=False, indent=2)
        else:
            return self.format_claim_display(claim)

    def save_report(self, claim: dict, format: str = 'text') -> str:
        order_id = claim['order_id']
        
        if format == 'json':
            filename = f"{order_id}_claim.json"
            content = self.export_report(claim, 'json')
        else:
            filename = f"{order_id}_claim.txt"
            content = self.export_report(claim, 'text')
        
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath
