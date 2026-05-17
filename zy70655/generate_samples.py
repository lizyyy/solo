#!/usr/bin/env python3
import pandas as pd
from datetime import datetime, timedelta
import os


def generate_normal_sample():
    """生成正常输入样例"""
    base_date = datetime(2025, 5, 15)
    data = {
        "日期": [
            (base_date + timedelta(days=i % 3)).strftime("%Y-%m-%d")
            for i in range(20)
        ],
        "设备编号": [f"EQ-{1001 + i % 8}" for i in range(20)],
        "检查项": [
            "高压电路检测", "消防设施检查", "机械保养", "润滑油更换",
            "安全门检查", "电气接地检测", "传送带润滑", "防护罩检查",
            "有毒气体检测", "消防器材有效期", "电机保养", "液压油更换",
            "高空作业平台检查", "动火作业许可", "设备清洁", "滤芯更换",
            "警示标识检查", "紧急停止测试", "轴承润滑", "电气绝缘测试"
        ],
        "班组": [
            "甲班", "甲班", "甲班", "乙班", "乙班",
            "乙班", "丙班", "丙班", "丙班", "甲班",
            "甲班", "乙班", "乙班", "丙班", "丙班",
            "甲班", "乙班", "丙班", "甲班", "乙班"
        ],
        "缺项类型": [
            "安全项", "安全项", "保养项", "保养项",
            "安全项", "安全项", "保养项", "安全项",
            "安全项", "安全项", "保养项", "保养项",
            "安全项", "安全项", "保养项", "保养项",
            "安全项", "安全项", "保养项", "安全项"
        ],
        "是否完成": [
            "是", "否", "是", "否", "是",
            "是", "否", "是", "否", "是",
            "否", "是", "否", "是", "否",
            "是", "否", "是", "否", "否"
        ],
        "巡检人": [
            "张三", "李四", "王五", "赵六", "钱七",
            "孙八", "周九", "吴十", "郑一", "王二",
            "冯三", "陈四", "褚五", "卫六", "蒋七",
            "沈八", "韩九", "杨十", "朱一", "秦二"
        ],
        "整改负责人": [
            "", "李四", "", "赵六", "",
            "", "周九", "", "郑一", "",
            "冯三", "", "褚五", "", "蒋七",
            "", "沈八", "", "朱一", "秦二"
        ],
        "备注": [
            "", "需立即整改", "", "下周完成", "",
            "", "备件待到", "", "发现泄漏", "",
            "计划明天", "", "高优先级", "", "下周一",
            "", "已通知", "", "常规", "重要"
        ]
    }

    df = pd.DataFrame(data)
    output_path = "samples/normal_sample.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 正常样例已生成: {output_path}")


def generate_dirty_data_sample():
    """生成脏数据样例"""
    base_date = datetime(2025, 5, 15)
    data = {
        "日期": [
            (base_date + timedelta(days=0)).strftime("%Y-%m-%d"),
            "2025/05/16",  # 格式不一致
            "",  # 空值
            "invalid_date",  # 无效日期
            (base_date + timedelta(days=3)).strftime("%Y-%m-%d"),
        ],
        "设备编号": [
            "EQ-1001",
            "",  # 空值
            "EQ-1003",
            "  EQ-1004  ",  # 有空格
            None,  # None值
        ],
        "检查项": [
            "高压电路检测",
            "消防设施检查",
            "",  # 空值
            "防护罩检查",
            "有毒气体检测",
        ],
        "班组": [
            "甲班",
            "甲班",
            "",  # 空值
            "乙班",
            None,  # None值
        ],
        "缺项类型": [
            "安全项",
            "安全",  # 简写
            "未知类型",  # 未知类型
            "",  # 空值
            None,  # None值
        ],
        "是否完成": [
            "是",
            "否",
            "YES",  # 英文
            "1",  # 数字
            "",  # 空值
        ],
        "巡检人": ["张三", "", None, "李四", "王五"],
        "整改负责人": ["", "李四", "", "", "王五"],
        "备注": ["", "需立即整改", "", "", ""]
    }

    df = pd.DataFrame(data)
    output_path = "samples/dirty_data_sample.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 脏数据样例已生成: {output_path}")


def generate_boundary_conflict_sample():
    """生成边界冲突样例"""
    base_date = datetime(2025, 5, 15)
    data = {
        "日期": [
            (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range(10)
        ],
        "设备编号": [f"EQ-{1001 + i}" for i in range(10)],
        "检查项": [
            "高压电路检测",  # 高风险
            "消防设施检查",  # 高风险
            "高空作业平台检查",  # 高风险
            "动火作业许可",  # 高风险
            "有毒气体检测",  # 高风险
            "机械防护检查",  # 中风险
            "防护罩检查",  # 中风险
            "警示标识检查",  # 中风险
            "润滑油更换",  # 低风险
            "设备清洁",  # 低风险
        ],
        "班组": ["甲班"] * 5 + ["乙班"] * 5,
        "缺项类型": ["安全项"] * 10,
        "是否完成": ["否"] * 10,  # 全部未完成
        "巡检人": ["张三"] * 10,
        "整改负责人": ["李四"] * 10,
        "备注": ["全部未完成，边界冲突测试"] * 10
    }

    df = pd.DataFrame(data)
    output_path = "samples/boundary_conflict_sample.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 边界冲突样例已生成: {output_path}")


def generate_empty_result_sample():
    """生成空结果样例"""
    data = {
        "日期": [],
        "设备编号": [],
        "检查项": [],
        "班组": [],
        "缺项类型": [],
        "是否完成": [],
        "巡检人": [],
        "整改负责人": [],
        "备注": []
    }

    df = pd.DataFrame(data)
    output_path = "samples/empty_sample.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 空结果样例已生成: {output_path}")


def generate_acceptance_normal():
    """验收用正常样例"""
    base_date = datetime(2025, 5, 15)
    data = {
        "日期": [(base_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(8)],
        "设备编号": ["EQ-2001", "EQ-2002", "EQ-2003", "EQ-2004",
                     "EQ-2005", "EQ-2006", "EQ-2007", "EQ-2008"],
        "检查项": [
            "高压配电箱检测",  # 高风险
            "电机润滑油更换",  # 低风险
            "消防栓压力检查",  # 高风险
            "传送带轴承润滑",  # 低风险
            "有毒气体报警器校准",  # 高风险
            "安全防护罩检查",  # 中风险
            "液压油滤芯更换",  # 低风险
            "紧急停止按钮测试"  # 中风险
        ],
        "班组": ["一班", "一班", "一班", "二班", "二班", "二班", "三班", "三班"],
        "缺项类型": ["安全项", "保养项", "安全项", "保养项",
                     "安全项", "安全项", "保养项", "安全项"],
        "是否完成": ["是", "否", "否", "是", "否", "否", "是", "否"],
        "巡检人": ["王工", "李工", "张工", "刘工", "陈工", "杨工", "赵工", "周工"],
        "整改负责人": ["", "李工", "张工", "", "陈工", "杨工", "", "周工"],
        "备注": [
            "正常完成",
            "油品下周到货",
            "需立即安排",
            "已完成",
            "供应商已联系",
            "安全优先级",
            "按时完成",
            "测试发现异常"
        ]
    }

    df = pd.DataFrame(data)
    output_path = "samples/acceptance_normal.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 验收正常样例已生成: {output_path}")


def generate_acceptance_abnormal():
    """验收用异常样例"""
    data = {
        "日期": [
            "2025-05-15",
            "2025-05-16",
            "",  # 空日期
            "2025-05-18",
            "2025-05-19",
            "invalid",  # 无效日期
            "2025-05-21",
        ],
        "设备编号": [
            "EQ-3001",
            "",  # 空
            "EQ-3003",
            "EQ-3004",
            None,  # None
            "EQ-3006",
            "EQ-3007",
        ],
        "检查项": [
            "高压电路检测",
            "",  # 空
            "消防设施检查",
            "机械保养",
            "润滑油更换",
            "安全门检查",
            "电气接地检测",
        ],
        "班组": [
            "A班",
            "A班",
            "",  # 空
            "B班",
            "B班",
            "C班",
            None,  # None
        ],
        "缺项类型": [
            "安全项",
            "保养项",
            "保养项",
            "安全项",
            "未知类型",  # 未知
            "安全项",
            "保养项",
        ],
        "是否完成": [
            "是",
            "否",
            "否",
            "是",
            "",  # 空
            "否",
            "是",
        ],
        "巡检人": ["张工", "李工", "王工", "", "赵工", "刘工", "陈工"],
        "整改负责人": ["", "李工", "王工", "", "", "刘工", ""],
        "备注": ["", "数据验证测试", "", "", "", "验收样例", ""]
    }

    df = pd.DataFrame(data)
    output_path = "samples/acceptance_abnormal.xlsx"
    df.to_excel(output_path, index=False)
    print(f"✓ 验收异常样例已生成: {output_path}")


def main():
    os.makedirs("samples", exist_ok=True)

    print("正在生成样例数据...")
    generate_normal_sample()
    generate_dirty_data_sample()
    generate_boundary_conflict_sample()
    generate_empty_result_sample()
    generate_acceptance_normal()
    generate_acceptance_abnormal()

    print("\n✓ 所有样例数据已生成完毕！")
    print("\n可用样例:")
    print("  1. normal_sample.xlsx       - 正常输入")
    print("  2. dirty_data_sample.xlsx   - 脏数据（格式错误、空值等）")
    print("  3. boundary_conflict_sample.xlsx - 边界冲突（全部缺项、风险集中）")
    print("  4. empty_sample.xlsx        - 空结果")
    print("  5. acceptance_normal.xlsx   - 验收用正常样例")
    print("  6. acceptance_abnormal.xlsx - 验收用异常样例")


if __name__ == "__main__":
    main()
