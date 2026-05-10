#!/usr/bin/env python3
import pandas as pd
import os


def create_sample_props():
    data = [
        {'道具ID': 'P001', '道具名称': '复古钢琴', '分类': '乐器', '价值': 50000, '押金比例': 1.0, '状态': 'available', '存放位置': 'A区-1号棚', '描述': '1960年生产的三角钢琴'},
        {'道具ID': 'P002', '道具名称': '欧式沙发', '分类': '家具', '价值': 8000, '押金比例': 1.0, '状态': 'available', '存放位置': 'B区-仓库3', '描述': '三人座真皮沙发'},
        {'道具ID': 'P003', '道具名称': '古代铠甲', '分类': '服装', '价值': 15000, '押金比例': 1.5, '状态': 'available', '存放位置': 'C区-服装库', '描述': '明代武士铠甲复刻'},
        {'道具ID': 'P004', '道具名称': '古董座钟', '分类': '摆件', '价值': 25000, '押金比例': 1.2, '状态': 'available', '存放位置': 'A区-贵重物品柜', '描述': '18世纪法国座钟'},
        {'道具ID': 'P005', '道具名称': '摄影灯架', '分类': '设备', '价值': 2000, '押金比例': 0.5, '状态': 'available', '存放位置': 'D区-设备间', '描述': '重型灯架5件套'},
        {'道具ID': 'P006', '道具名称': '民国桌椅', '分类': '家具', '价值': 12000, '押金比例': 1.0, '状态': 'available', '存放位置': 'B区-仓库2', '描述': '民国时期实木桌椅一套'},
        {'道具ID': 'P007', '道具名称': '激光剑道具', '分类': '道具', '价值': 3500, '押金比例': 1.0, '状态': 'available', '存放位置': 'E区-科幻区', '描述': '可发光激光剑模型'},
        {'道具ID': 'P008', '道具名称': '中世纪剑', '分类': '武器', '价值': 8000, '押金比例': 1.0, '状态': 'available', '存放位置': 'E区-武器库', '描述': '不开刃长剑'}
    ]
    return pd.DataFrame(data)


def create_sample_borrows():
    data = [
        {'借用单ID': 'B001', '道具ID': 'P001', '剧组名称': '《时光协奏曲》', '借用日期': '2026-05-01', '计划归还日期': '2026-05-10', '已交押金': 50000},
        {'借用单ID': 'B002', '道具ID': 'P002', '剧组名称': '《民国往事》', '借用日期': '2026-05-03', '计划归还日期': '2026-05-15', '已交押金': 8000},
        {'借用单ID': 'B003', '道具ID': 'P003', '剧组名称': '《大明风云》', '借用日期': '2026-05-05', '计划归还日期': '2026-05-20', '已交押金': 22500},
        {'借用单ID': 'B004', '道具ID': 'P004', '剧组名称': '《时光协奏曲》', '借用日期': '2026-05-02', '计划归还日期': '2026-05-08', '已交押金': 30000},
        {'借用单ID': 'B005', '道具ID': 'P005', '剧组名称': '《城市边缘》', '借用日期': '2026-05-01', '计划归还日期': '2026-05-05', '已交押金': 1000}
    ]
    return pd.DataFrame(data)


def create_sample_returns():
    data = [
        {'借用单ID': 'B004', '实际归还日期': '2026-05-08', '损坏程度': '无'},
        {'借用单ID': 'B005', '实际归还日期': '2026-05-07', '损坏程度': '轻微', '损坏费': None, '延期费': None}
    ]
    return pd.DataFrame(data)


def create_dirty_data_props():
    data = [
        {'道具ID': '', '道具名称': '无名道具', '分类': '测试', '价值': 1000, '押金比例': 1.0},
        {'道具ID': 'P009', '道具名称': '', '分类': '测试', '价值': 1000, '押金比例': 1.0},
        {'道具ID': 'P010', '道具名称': '错误价值道具', '分类': '测试', '价值': -500, '押金比例': 1.0},
        {'道具ID': 'P011', '道具名称': '错误比例道具', '分类': '测试', '价值': 1000, '押金比例': 3.0},
        {'道具ID': 'P001', '道具名称': '重复ID', '分类': '测试', '价值': 1000, '押金比例': 1.0}
    ]
    return pd.DataFrame(data)


def main():
    samples_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    os.makedirs(samples_dir, exist_ok=True)
    
    props_df = create_sample_props()
    props_df.to_excel(os.path.join(samples_dir, 'props.xlsx'), index=False)
    print(f"已创建: {os.path.join(samples_dir, 'props.xlsx')}")
    
    borrows_df = create_sample_borrows()
    borrows_df.to_excel(os.path.join(samples_dir, 'borrows.xlsx'), index=False)
    print(f"已创建: {os.path.join(samples_dir, 'borrows.xlsx')}")
    
    returns_df = create_sample_returns()
    returns_df.to_excel(os.path.join(samples_dir, 'returns.xlsx'), index=False)
    print(f"已创建: {os.path.join(samples_dir, 'returns.xlsx')}")
    
    dirty_props_df = create_dirty_data_props()
    dirty_props_df.to_excel(os.path.join(samples_dir, 'dirty_props.xlsx'), index=False)
    print(f"已创建: {os.path.join(samples_dir, 'dirty_props.xlsx')} (包含脏数据用于测试)")
    
    print("\n示例数据创建完成！")


if __name__ == '__main__':
    main()
