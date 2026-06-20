"""
初始化问题样例数据
场景：同一批数据重复训练两次 → 停在"待策略产品复核"状态
用于演示：导出明细查看、状态变化、历史留痕、结果说明
"""
import os
import json
from datetime import datetime

from database import Database
from workflow import WorkflowManager
from self_check import SelfChecker


def init_problem_sample():
    # 清理旧数据库
    db_path = "boundary_samples.db"
    if os.path.exists(db_path):
        os.remove(db_path)
        print("🗑️  清理旧数据库")
    
    db = Database(db_path)
    workflow = WorkflowManager(db)
    checker = SelfChecker(db)
    
    print("=" * 60)
    print("【初始化问题样例：同一批数据重复训练两次】")
    print("=" * 60)
    
    # =============== 第一步：YAML导入 ===============
    print("\n📌 第一步：参数YAML第一次导入")
    print("-" * 60)
    
    yaml_content = """# 文本分类边界样本 - batch_0615 批次
# 导入人：推荐策略老唐
# 导入时间：2026-06-15

- sample_key: batch_0615_001
  batch_id: batch_0615
  text: "这个手机壳算不算电子产品类目还是配件类目"
  predict: 电子产品
  actual: 配件

- sample_key: batch_0615_002
  batch_id: batch_0615
  text: "电子书阅读器属于图书分类还是数码产品分类"
  predict: 数码产品
  actual: 数码产品

- sample_key: batch_0615_003
  batch_id: batch_0615
  text: "儿童玩具机器人算玩具品类还是教育品类"
  predict: 玩具
  actual: 教育

- sample_key: batch_0615_004
  batch_id: batch_0615
  text: "蓝牙耳机是数码配件还是独立数码品类"
  predict: 数码配件
  actual: 数码

- sample_key: batch_0615_005
  batch_id: batch_0615
  text: "机械键盘属于办公用品还是电脑配件"
  predict: 电脑配件
  actual: 办公用品

- sample_key: batch_0615_006
  batch_id: batch_0615
  text: "智能手表是饰品还是电子产品"
  predict: 电子产品
  actual: 智能穿戴

- sample_key: batch_0615_007
  batch_id: batch_0615
  text: "充电宝属于配件还是数码产品"
  predict: 数码配件
  actual: 数码配件
"""
    
    result = workflow.step1_import_yaml(
        yaml_content, 
        "boundary_samples_batch_0615.yaml", 
        "推荐策略老唐"
    )
    
    print(f"✅ YAML版本ID: {result['yaml_version_id']}")
    print(f"✅ 导入样本数: {result['imported_count']}")
    print(f"✅ 文件名: boundary_samples_batch_0615.yaml")
    
    # =============== 第二步：老唐看评测切片 ===============
    print("\n📌 第二步：推荐策略老唐补看评测切片")
    print("-" * 60)
    
    slice_templates = [
        ("这个手机壳算不算电子产品类目还是配件类目", "模型在'电子产品'和'配件'之间摇摆，置信度分别是0.52和0.48", "边界样本，类目定义不清晰，需要跟业务方对齐"),
        ("电子书阅读器属于图书分类还是数码产品分类", "因为关键词'书'触发了图书类目，但实际是数码产品", "典型的关键词歧义样本"),
        ("儿童玩具机器人算玩具品类还是教育品类", "既有玩具属性又有教育属性，用户行为数据偏向玩具", "跨类目样本，边界模糊"),
        ("蓝牙耳机是数码配件还是独立数码品类", "目前归在配件，但独立sku销量很高，可能需要独立类目", "类目体系问题"),
        ("机械键盘属于办公用品还是电脑配件", "办公场景和游戏场景都有，需要看主要用户群", "多场景样本"),
        ("智能手表是饰品还是电子产品", "外观属性和功能属性各占一半，女性用户更偏向饰品", "新类目边界"),
        ("充电宝属于配件还是数码产品", "这个基本没问题，两边特征都挺明显的", "简单样本，作为对照")
    ]
    
    for i in range(1, 8):
        text, slice_data, remark = slice_templates[i-1]
        full_slice = f"""文本：{text}
模型预测置信度：0.6{i}
上下文特征：关键词匹配度 7{i}%，用户历史行为倾向 {60+i*5}%
近邻样本：{i+2} 个同类，{4+i} 个异类
特征贡献：类目关键词 45%，用户行为 35%，商品属性 20%"""
        
        result = workflow.step2_view_slice(
            sample_id=i,
            slice_data=full_slice,
            viewed_by="推荐策略老唐",
            remark=remark
        )
        print(f"✅ 样本 {i} ({text[:12]}...) 已查看，状态: {result['new_status']}")
    
    # =============== 第三步：更新特征版本表（制造问题） ===============
    print("\n📌 第三步：特征版本表更新（模拟同一批重复训练）")
    print("-" * 60)
    
    # 前5个样本用 v20260610 版本特征
    print("\n📝 前5个样本用 v20260610 特征版本训练：")
    for i in range(1, 6):
        result = workflow.step3_update_feature(
            sample_id=i,
            feature_version="v20260610",
            updated_by="推荐策略老唐",
            remark="使用6月10日特征版本训练"
        )
        print(f"   样本 {i}: 特征版本 v20260610 → 状态: {result.get('new_status', '-')}")
    
    # 第6、7个样本用 v20260615 版本特征（模拟补录时用了新版本）
    print("\n⚠️  第6、7个样本补录时，误用了 v20260615 特征版本：")
    print("   （同一批数据 batch_0615 用了两个不同的特征版本训练）")
    for i in range(6, 8):
        result = workflow.step3_update_feature(
            sample_id=i,
            feature_version="v20260615",
            updated_by="推荐策略老唐",
            remark="后来补录的样本，用了最新的6月15日特征版本"
        )
        if "warning" in result:
            print(f"   ⚠️  样本 {i}: 系统检测到同一批数据重复训练！")
            print(f"      发现特征版本: {result['feature_versions_found']}")
            print(f"      自动标记为: {result['status']}（待策略产品复核）")
        else:
            print(f"   样本 {i}: 特征版本 v20260615 → 状态: {result.get('new_status', '-')}")
    
    # =============== 运行自检 ===============
    print("\n📌 运行全量自检")
    print("-" * 60)
    
    check_results = checker.run_all_checks()
    for cr in check_results:
        status_icon = "✅" if cr.passed else "⚠️ "
        print(f"{status_icon} {cr.check_name}: {cr.summary}")
    
    # =============== 统计结果 ===============
    print("\n" + "=" * 60)
    print("【初始化完成 · 当前状态总览】")
    print("=" * 60)
    
    samples, total = db.list_samples(page_size=100)
    print(f"\n📊 样本总数: {total}")
    
    status_counts = {}
    anomaly_count = 0
    for s in samples:
        st = s.status.value
        status_counts[st] = status_counts.get(st, 0) + 1
        if s.is_abnormal:
            anomaly_count += 1
    
    status_labels = {
        "imported": "已导入",
        "slice_viewed": "已看切片",
        "feature_updated": "已更特征",
        "pending_review": "待产品复核",
        "normal": "确认正常",
        "abnormal": "确认异常"
    }
    
    for st, cnt in status_counts.items():
        label = status_labels.get(st, st)
        print(f"   {label}: {cnt} 个")
    
    print(f"\n⚠️  存在异常的样本: {anomaly_count} 个")
    print(f"   → 全部因『同一批数据重复训练两次』标记为待产品复核")
    
    print("\n📋 当前停留状态：导出明细页 · 待策略产品复核")
    print("   可以通过页面查看：")
    print("   - 所有样本的处理状态")
    print("   - 异常标记和类型")
    print("   - 每个样本的完整历史留痕")
    print("   - YAML原始行号和改动记录")
    print("   - 导出CSV/JSON验证数据一致性")
    
    print("\n🚀 启动服务：python3 app.py")
    print("🌐 访问地址：http://localhost:5060")
    print("=" * 60)


if __name__ == "__main__":
    init_problem_sample()
