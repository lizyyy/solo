#!/usr/bin/env python3
"""生成示例测试数据"""
import os
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal
import pandas as pd


def generate_sample_data(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)

    products = [
        {"产品代码": "FP001", "产品名称": "稳健增值1号", "产品类型": "固定收益",
         "管理人": "ABC基金", "托管人": "X银行", "成立日期": "2023-01-01",
         "合同编号": "HT2023001", "合同版本": "V1.0", "风险等级": "R2"},
        {"产品代码": "FP002", "产品名称": "进取成长2号", "产品类型": "权益类",
         "管理人": "XYZ基金", "托管人": "Y银行", "成立日期": "2023-06-01",
         "合同编号": "HT2023006", "合同版本": "V1.0", "风险等级": "R4"},
        {"产品代码": "FP003", "产品名称": "平衡配置3号", "产品类型": "混合型",
         "管理人": "ABC基金", "托管人": "X银行", "成立日期": "2023-03-15",
         "合同编号": "HT2023015", "合同版本": "V1.0", "风险等级": "R3"},
    ]
    pd.DataFrame(products).to_excel(output_dir / "products.xlsx", index=False)
    print(f"已生成: {output_dir / 'products.xlsx'}")

    fee_rules = [
        {"产品代码": "FP001", "产品名称": "稳健增值1号", "费用类型": "管理费",
         "费率": 0.005, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP001", "产品名称": "稳健增值1号", "费用类型": "托管费",
         "费率": 0.0015, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP001", "产品名称": "稳健增值1号", "费用类型": "销售服务费",
         "费率": 0.003, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP002", "产品名称": "进取成长2号", "费用类型": "管理费",
         "费率": 0.015, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP002", "产品名称": "进取成长2号", "费用类型": "托管费",
         "费率": 0.002, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP002", "产品名称": "进取成长2号", "费用类型": "销售服务费",
         "费率": 0.005, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP003", "产品名称": "平衡配置3号", "费用类型": "管理费",
         "费率": 0.008, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP003", "产品名称": "平衡配置3号", "费用类型": "托管费",
         "费率": 0.0018, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
        {"产品代码": "FP003", "产品名称": "平衡配置3号", "费用类型": "销售服务费",
         "费率": 0.004, "生效日期": "2024-01-01", "份额口径": "日均",
         "计提方式": "按日", "税率": 0.06},
    ]
    pd.DataFrame(fee_rules).to_excel(output_dir / "fee_rules.xlsx", index=False)
    print(f"已生成: {output_dir / 'fee_rules.xlsx'}")

    channels = [
        {"渠道代码": "CH001", "渠道名称": "X银行总行", "渠道类型": "银行",
         "结算方式": "转账", "结算周期": "月结", "联系人": "张三", "联系方式": "13800138001"},
        {"渠道代码": "CH002", "渠道名称": "Y证券营业部", "渠道类型": "券商",
         "结算方式": "转账", "结算周期": "月结", "联系人": "李四", "联系方式": "13800138002"},
        {"渠道代码": "CH003", "渠道名称": "Z基金直销", "渠道类型": "直销",
         "结算方式": "转账", "结算周期": "月结", "联系人": "王五", "联系方式": "13800138003"},
    ]
    pd.DataFrame(channels).to_excel(output_dir / "channels.xlsx", index=False)
    print(f"已生成: {output_dir / 'channels.xlsx'}")

    year, month = 2024, 3
    nav_data = []
    start_date = date(year, month, 1)
    end_date = date(year, month, 31)
    current = start_date

    base_navs = {"FP001": Decimal("1.05"), "FP002": Decimal("1.12"), "FP003": Decimal("1.08")}
    base_shares = {"FP001": Decimal("50000000"), "FP002": Decimal("30000000"), "FP003": Decimal("40000000")}

    while current <= end_date:
        if current.weekday() < 5:
            for code in ["FP001", "FP002", "FP003"]:
                nav_change = Decimal(str((hash(str(current) + code) % 100 - 50) / 10000))
                unit_nav = base_navs[code] + nav_change
                total_share = base_shares[code] + Decimal(str((hash(str(current) + code + "s") % 1000000 - 500000)))
                total_asset = unit_nav * total_share

                nav_data.append({
                    "产品代码": code,
                    "净值日期": current.strftime("%Y-%m-%d"),
                    "单位净值": float(unit_nav),
                    "累计净值": float(unit_nav + Decimal("0.05")),
                    "总份额": float(total_share),
                    "总资产": float(total_asset),
                })
        current += timedelta(days=1)

    pd.DataFrame(nav_data).to_excel(output_dir / "nav_flows.xlsx", index=False)
    print(f"已生成: {output_dir / 'nav_flows.xlsx'} ({len(nav_data)} 条)")

    share_data = []
    share_date = date(year, month, 31)

    product_shares = {
        "FP001": {
            "CH001": {"C001": Decimal("15000000"), "C002": Decimal("10000000"), "C003": Decimal("5000000")},
            "CH002": {"C004": Decimal("8000000"), "C005": Decimal("7000000")},
            "CH003": {"C006": Decimal("5000000")},
        },
        "FP002": {
            "CH001": {"C007": Decimal("10000000"), "C008": Decimal("5000000")},
            "CH002": {"C009": Decimal("8000000"), "C010": Decimal("4000000")},
            "CH003": {"C011": Decimal("3000000")},
        },
        "FP003": {
            "CH001": {"C012": Decimal("12000000"), "C013": Decimal("8000000")},
            "CH002": {"C014": Decimal("10000000"), "C015": Decimal("5000000")},
            "CH003": {"C016": Decimal("5000000")},
        },
    }

    customer_names = {
        "C001": "张三", "C002": "李四", "C003": "王五", "C004": "赵六",
        "C005": "钱七", "C006": "孙八", "C007": "周九", "C008": "吴十",
        "C009": "郑十一", "C010": "王十二", "C011": "冯十三", "C012": "陈十四",
        "C013": "褚十五", "C014": "卫十六", "C015": "蒋十七", "C016": "沈十八",
    }

    for product_code, channels in product_shares.items():
        for channel_code, customers in channels.items():
            for customer_id, share in customers.items():
                share_data.append({
                    "产品代码": product_code,
                    "渠道代码": channel_code,
                    "客户编号": customer_id,
                    "客户名称": customer_names[customer_id],
                    "份额日期": share_date.strftime("%Y-%m-%d"),
                    "持有份额": float(share),
                    "成本": float(share * Decimal("1.00")),
                    "收益": float(share * Decimal("0.05")),
                })

    pd.DataFrame(share_data).to_excel(output_dir / "customer_shares.xlsx", index=False)
    print(f"已生成: {output_dir / 'customer_shares.xlsx'} ({len(share_data)} 条)")

    rebates = [
        {"渠道代码": "CH001", "产品代码": "FP001", "开始日期": "2024-03-01", "结束日期": "2024-03-31",
         "返费比例": 0.003, "返费金额": 450.00, "结算状态": "待结算"},
        {"渠道代码": "CH002", "产品代码": "FP001", "开始日期": "2024-03-01", "结束日期": "2024-03-31",
         "返费比例": 0.0025, "返费金额": 225.00, "结算状态": "待结算"},
        {"渠道代码": "CH001", "产品代码": "FP002", "开始日期": "2024-03-01", "结束日期": "2024-03-31",
         "返费比例": 0.004, "返费金额": 600.00, "结算状态": "待结算"},
        {"渠道代码": "CH002", "产品代码": "FP002", "开始日期": "2024-03-01", "结束日期": "2024-03-31",
         "返费比例": 0.0035, "返费金额": 420.00, "结算状态": "待结算"},
    ]
    pd.DataFrame(rebates).to_excel(output_dir / "channel_rebates.xlsx", index=False)
    print(f"已生成: {output_dir / 'channel_rebates.xlsx'}")

    print(f"\n示例数据已全部生成到: {output_dir}")


if __name__ == "__main__":
    base_dir = Path(__file__).parent
    generate_sample_data(base_dir)
