import os
import pandas as pd
from datetime import datetime, timedelta

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test_data")
os.makedirs(TEST_DATA_DIR, exist_ok=True)


def generate_contract_data():
    data = {
        "合同编好": ["HT2024001", "HT2024002", "HT2024002", "HT2024003", "HT2024004"],
        "版本": ["1", "1", "1", "2", "1"],
        "组户名称": ["星巴克咖啡", "优衣库", "优衣库", "海底捞", "小米之家"],
        "铺位编号": ["A101", "B201", "B201", "C301", "D401"],
        "建筑面积(㎡)": ["150", "300", "300", "500", "200"],
        "月租金(元)": ["45000", "90000", "90000", "¥150,000", "60000"],
        "起始日期": ["2024-01-01", "2024/03/15", "2024/03/15", "2023年10月1日", "2024-06-01"],
        "结束日期": ["2026-12-31", "2027/03/14", "2027/03/14", "2028年9月30日", "2029-05-31"],
        "合同状态": ["生效中", "生效中", "生效中", "生效中", "草稿"],
        "": ["", "", "", "", ""],
        "备注": ["正常", "", "", "", "新签"],
    }
    df = pd.DataFrame(data)
    df.to_excel(os.path.join(TEST_DATA_DIR, "租赁合同.xlsx"), index=False)
    print("✓ 生成租赁合同.xlsx (包含错别字'组户'、'合同编好'、重复行、空列、多种日期格式)")


def generate_rent_plan_data():
    data = {
        "合同号": ["HT2024001", "HT2024001", "HT2024002", "HT2024003", "HT2024004"],
        "费用期间起": ["2024-01-01", "2024-04-01", "2024-03-15", "2023-10-01", "2024-06-01"],
        "费用期间止": ["2024-03-31", "2024-06-30", "2024-06-14", "2023-12-31", "2024-08-31"],
        "月租金标准": ["45000", "45000", "90000", "150000", "60000"],
        "备注": ["", "涨幅0%", "", "", ""],
    }
    df = pd.DataFrame(data)
    df.to_excel(os.path.join(TEST_DATA_DIR, "租金计划.xlsx"), index=False)
    print("✓ 生成租金计划.xlsx")


def generate_reduction_application_data():
    data = {
        "申请编号": ["SQ2024001", "SQ2024002", "SQ2024003", "SQ2024004"],
        "合同编号": ["HT2024001", "HT2024002", "HT2024003", "HT2024001"],
        "阻户名称": ["星巴克咖啡", "优衣库", "海底捞", "星巴克咖啡"],
        "闭店开始日期": ["2024-05-01", "2024-04-01", "2024-06-01", "2024-05-15"],
        "闭店结束日期": ["2024-06-30", "2024-04-30", "2025-01-31", "2024-06-15"],
        "申请减勉天数": ["61", "30", "245", "32"],
        "减兔比例(%)": ["100", "80", "100", "100"],
        "申请原因": ["市场调整", "装修升级", "长期闭店", "设备维护"],
    }
    df = pd.DataFrame(data)
    df.to_excel(os.path.join(TEST_DATA_DIR, "减免申请.xlsx"), index=False)
    print("✓ 生成减免申请.xlsx (包含错别字'阻户'、'减勉'、'减兔'、超限天数245天、重复申请)")


def generate_store_closure_data():
    data = {
        "证明编号": ["ZM2024001", "ZM2024002", "ZM2024003"],
        "合同编号": ["HT2024001", "HT2024002", "HT2024003"],
        "闭店开始": ["2024-05-01", "2024-04-01", "2024-06-01"],
        "闭店结束": ["2024-06-30", "2024-04-30", "2025-01-31"],
        "核实闭店天数": ["61", "30", "245"],
        "证明开具日期": ["2024-05-05", "2024-04-05", "2024-06-05"],
    }
    df = pd.DataFrame(data)
    df.to_excel(os.path.join(TEST_DATA_DIR, "闭店证明.xlsx"), index=False)
    print("✓ 生成闭店证明.xlsx")


def generate_supplementary_agreement_data():
    data = {
        "协议编号": ["BC2024001", "BC2024002"],
        "合同编号": ["HT2024001", "HT2024002"],
        "原合同编号": ["HT2024001", "HT2024002"],
        "补充协议内容": ["减免61天租金，100%", "减免30天租金，80%"],
        "签署日期": ["2024-07-01", "2024-05-15"],
        "减免金额(元)": ["91500", "72000"],
    }
    df = pd.DataFrame(data)
    df.to_excel(os.path.join(TEST_DATA_DIR, "补充协议.xlsx"), index=False)
    print("✓ 生成补充协议.xlsx")


def generate_all():
    print("\n" + "=" * 60)
    print("生成测试数据（包含各种不规范格式）")
    print("=" * 60 + "\n")
    
    generate_contract_data()
    generate_rent_plan_data()
    generate_reduction_application_data()
    generate_store_closure_data()
    generate_supplementary_agreement_data()
    
    print("\n" + "=" * 60)
    print(f"测试数据已生成到: {TEST_DATA_DIR}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    generate_all()
