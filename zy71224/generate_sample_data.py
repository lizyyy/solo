#!/usr/bin/env python3
import pandas as pd
from datetime import date, timedelta
import random
import os
from pathlib import Path


def generate_sample_data():
    output_dir = Path("./data/input")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    today = date.today()
    random.seed(42)
    
    policy_data = []
    sign_data = []
    visit_data = []
    fee_data = []
    surrender_data = []
    
    policy_names = [
        "重疾保险A款", "终身寿险B款", "年金保险C款", 
        "医疗保险D款", "意外伤害保险E款", "少儿重疾险F款"
    ]
    applicants = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"]
    
    for i in range(1, 11):
        policy_no = f"POL{2024000 + i:07d}"
        applicant = applicants[i % len(applicants)]
        policy_name = policy_names[i % len(policy_names)]
        premium = random.choice([5000, 8000, 10000, 15000, 20000])
        policy_date = today - timedelta(days=random.randint(5, 30))
        
        policy_data.append({
            "保单号": policy_no,
            "险种名称": policy_name,
            "投保人": applicant,
            "被保险人": applicant,
            "保费": premium,
            "保单生效日": policy_date.strftime("%Y-%m-%d"),
            "保险期间": random.choice([20, 30, 99]),
            "缴费方式": random.choice(["年交", "月交", "季交"])
        })
        
        sign_days_ago = random.randint(1, 20)
        sign_date = today - timedelta(days=sign_days_ago)
        sign_data.append({
            "保单号": policy_no,
            "签收日期": sign_date.strftime("%Y-%m-%d"),
            "签收人": applicant,
            "签收方式": random.choice(["纸质", "电子"]),
            "快递单号": f"SF{random.randint(100000000000, 999999999999)}" if random.random() > 0.5 else ""
        })
        
        visit_date = sign_date + timedelta(days=random.randint(1, 3))
        visit_success = random.random() > 0.2
        visit_data.append({
            "保单号": policy_no,
            "回访时间": visit_date.strftime("%Y-%m-%d %H:%M:%S"),
            "回访人": f"客服{random.choice(['001', '002', '003'])}",
            "回访状态": "已回访" if visit_success else "回访失败",
            "回访结果": "客户确认收到保单，了解保险责任" if visit_success else "电话无人接听",
            "录音文件": f"/recordings/{policy_no}_{visit_date.strftime('%Y%m%d')}.mp3" if visit_success and random.random() > 0.1 else "",
            "备注": ""
        })
        
        fee_date = policy_date + timedelta(days=random.randint(1, 5))
        fee_data.append({
            "保单号": policy_no,
            "扣费日期": fee_date.strftime("%Y-%m-%d"),
            "扣费金额": premium,
            "费用类型": "首期保费",
            "交易流水号": f"TXN{fee_date.strftime('%Y%m%d')}{random.randint(10000, 99999)}",
            "扣费渠道": random.choice(["银行卡", "支付宝", "微信"])
        })
        
        apply_days_after_sign = random.randint(3, 25)
        apply_date = sign_date + timedelta(days=apply_days_after_sign)
        surrender_data.append({
            "保单号": policy_no,
            "申请编号": f"SUR{apply_date.strftime('%Y%m%d')}{i:04d}",
            "申请日期": apply_date.strftime("%Y-%m-%d"),
            "申请人": applicant,
            "退保原因": random.choice(["缴费压力大", "产品不适合", "有更好的产品", "资金周转需要", "其他"]),
            "退保类型": "全额退保",
            "申请渠道": random.choice(["客服热线", "APP", "线下柜面", "代理人"]),
            "备注": ""
        })
    
    sign_data.append({
        "保单号": "POL202400001",
        "签收日期": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
        "签收人": "张三",
        "签收方式": "纸质",
        "快递单号": ""
    })
    
    policy_data.append({
        "保单号": "POL202400011",
        "险种名称": "重疾保险A款",
        "投保人": "郑十一",
        "被保险人": "郑十一",
        "保费": 12000,
        "保单生效日": (today - timedelta(days=10)).strftime("%Y-%m-%d"),
        "保险期间": 30,
        "缴费方式": "年交"
    })
    sign_data.append({
        "保单号": "POL202400011",
        "签收日期": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
        "签收人": "郑十一",
        "签收方式": "电子",
        "快递单号": ""
    })
    fee_data.append({
        "保单号": "POL202400011",
        "扣费日期": (today - timedelta(days=9)).strftime("%Y-%m-%d"),
        "扣费金额": 12000,
        "费用类型": "首期保费",
        "交易流水号": f"TXN{today.strftime('%Y%m%d')}12345",
        "扣费渠道": "银行卡"
    })
    surrender_data.append({
        "保单号": "POL202400011",
        "申请编号": f"SUR{today.strftime('%Y%m%d')}0011",
        "申请日期": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
        "申请人": "郑十一",
        "退保原因": "签收日期争议测试",
        "退保类型": "全额退保",
        "申请渠道": "客服热线",
        "备注": "申请日期早于签收日期"
    })
    
    pd.DataFrame(policy_data).to_excel(output_dir / "policy_2024.xlsx", index=False)
    pd.DataFrame(sign_data).to_excel(output_dir / "sign_2024.xlsx", index=False)
    pd.DataFrame(visit_data).to_excel(output_dir / "visit_2024.xlsx", index=False)
    pd.DataFrame(fee_data).to_excel(output_dir / "fee_2024.xlsx", index=False)
    pd.DataFrame(surrender_data).to_excel(output_dir / "surrender_2024.xlsx", index=False)
    
    print("示例数据已生成至 ./data/input/ 目录")
    print(f"  - 保单: {len(policy_data)} 条")
    print(f"  - 签收: {len(sign_data)} 条")
    print(f"  - 回访: {len(visit_data)} 条")
    print(f"  - 扣费: {len(fee_data)} 条")
    print(f"  - 退保申请: {len(surrender_data)} 条")


if __name__ == "__main__":
    generate_sample_data()
