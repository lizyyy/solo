import json
import csv
from io import StringIO
from typing import Dict, Any
from models import AllocationReport


class ReportExporter:
    @staticmethod
    def to_json(report: AllocationReport) -> str:
        return json.dumps(report.model_dump(), indent=2, ensure_ascii=False, default=str)

    @staticmethod
    def to_csv(report: AllocationReport) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["=== 矿池收益分配报告 ==="])
        writer.writerow(["报告ID", report.report_id])
        writer.writerow(["生成时间", report.created_at])
        writer.writerow(["统计周期", f"{report.period_start} 至 {report.period_end}"])
        writer.writerow([])
        
        writer.writerow(["=== 汇总信息 ==="])
        writer.writerow(["矿工总数", report.total_miners])
        writer.writerow(["有效矿工数", report.valid_miners])
        writer.writerow(["总算力 (MH/s)", f"{report.total_hashrate:.4f}"])
        writer.writerow(["总区块奖励", f"{report.total_reward:.6f}"])
        writer.writerow(["总手续费", f"{report.total_fees:.6f}"])
        writer.writerow(["矿池手续费比例", f"{report.pool_fee_ratio*100:.1f}%"])
        writer.writerow(["矿池手续费金额", f"{report.pool_fee_amount:.6f}"])
        writer.writerow(["可分配总金额", f"{report.allocatable_amount:.6f}"])
        writer.writerow([])
        
        writer.writerow(["=== 矿工分配明细 ==="])
        writer.writerow([
            "矿工ID", "钱包地址", "钱包有效", "总算力(MH/s)", "有效算力(MH/s)",
            "在线时长(小时)", "在线率", "权重占比", "基础奖励", "手续费分配", "总分配", "问题数"
        ])
        
        for alloc in report.allocations:
            writer.writerow([
                alloc.miner_id,
                alloc.wallet_address,
                "是" if alloc.wallet_valid else "否",
                f"{alloc.total_hashrate:.4f}",
                f"{alloc.effective_hashrate:.4f}",
                f"{alloc.online_duration:.2f}",
                f"{alloc.online_ratio*100:.1f}%",
                f"{alloc.weight_ratio*100:.4f}%",
                f"{alloc.base_reward:.6f}",
                f"{alloc.fee_allocation:.6f}",
                f"{alloc.total_allocation:.6f}",
                len(alloc.issues)
            ])
        
        writer.writerow([])
        writer.writerow(["=== 全局问题 ==="])
        if report.global_issues:
            writer.writerow(["问题类型", "严重程度", "描述", "关联矿工"])
            for issue in report.global_issues:
                writer.writerow([
                    issue.issue_type,
                    issue.severity,
                    issue.message,
                    issue.miner_id or ""
                ])
        else:
            writer.writerow(["无问题"])
        
        return output.getvalue()

    @staticmethod
    def to_summary_dict(report: AllocationReport) -> Dict[str, Any]:
        return {
            "report_id": report.report_id,
            "created_at": report.created_at,
            "total_miners": report.total_miners,
            "valid_miners": report.valid_miners,
            "total_hashrate": report.total_hashrate,
            "total_reward": report.total_reward,
            "total_fees": report.total_fees,
            "pool_fee_amount": report.pool_fee_amount,
            "allocatable_amount": report.allocatable_amount,
            "issue_count": len(report.global_issues),
            "miners_with_issues": sum(1 for a in report.allocations if a.issues)
        }
