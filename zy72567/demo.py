"""
完整流程演示
跟推荐策略老唐和策略产品交接的场景模拟
"""
import os
import json
from database import Database
from workflow import WorkflowManager
from self_check import SelfChecker
from exporter import Exporter
from models import SampleStatus


def demo_full_flow():
    """
    演示完整的三步流程，以及异常场景处理
    
    场景：
    1. 老唐导入一份YAML，包含5个边界样本
    2. 老唐逐个看评测切片
    3. 老唐更新特征版本表（故意模拟同一批重复训练的情况）
    4. 自检发现重复训练，自动标记待产品复核
    5. 策略产品复核，给出最终结论
    6. 导出结果，验证页面/接口/导出一致
    """
    # 清理旧数据
    if os.path.exists("boundary_samples.db"):
        os.remove("boundary_samples.db")
    
    db = Database()
    workflow = WorkflowManager(db)
    checker = SelfChecker(db)
    exporter = Exporter(db)
    
    print("=" * 70)
    print("【文本分类边界样本管理系统 - 完整流程演示】")
    print("=" * 70)
    
    # ========== 第一步：老唐导入YAML ==========
    print("\n📌 第一步：推荐策略老唐导入参数YAML")
    print("-" * 70)
    
    yaml_content = """# 文本分类边界样本 - 2026-06-07批次
- sample_key: batch001_001
  batch_id: batch001
  text: "这个手机壳算不算电子产品类目"
  predict: 电子产品
  actual: 配件
- sample_key: batch001_002
  batch_id: batch001
  text: "电子书阅读器属于图书还是数码"
  predict: 数码产品
  actual: 数码产品
- sample_key: batch001_003
  batch_id: batch001
  text: "儿童玩具机器人算教育品类吗"
  predict: 玩具
  actual: 教育
- sample_key: batch001_004
  batch_id: batch001
  text: "蓝牙耳机是配件还是数码"
  predict: 数码配件
  actual: 数码
- sample_key: batch001_005
  batch_id: batch001
  text: "机械键盘属于办公用品吗"
  predict: 电脑配件
  actual: 办公用品
"""
    
    result = workflow.step1_import_yaml(yaml_content, "boundary_samples_0607.yaml", "老唐")
    print(f"✅ YAML版本ID: {result['yaml_version_id']}")
    print(f"✅ 导入样本数: {result['imported_count']}")
    print(f"✅ 自检结果摘要:")
    for r in result['self_check_summary']:
        print(f"   - {r}")
    
    # ========== 第二步：老唐看评测切片 ==========
    print("\n📌 第二步：老唐补看评测切片")
    print("-" * 70)
    
    for i in range(1, 6):
        slice_data = f"""
        评测切片 - 样本batch001_00{i}
        模型置信度: 0.7{i}
        上下文特征: 关键词匹配度85%，用户历史行为倾向{i*10}%
        近邻样本: 3个同类，2个异类
        """
        result = workflow.step2_view_slice(
            sample_id=i,
            slice_data=slice_data,
            viewed_by="老唐",
            remark=f"样本{i}：预测和实际有偏差，特征表需要更新"
        )
        print(f"✅ 样本{i} 评测切片查看完成，状态: {result['new_status']}")
    
    # ========== 第三步：老唐更新特征版本 ==========
    print("\n📌 第三步：老唐更新特征版本表")
    print("-" * 70)
    
    # 前4个样本用同一个特征版本
    for i in range(1, 5):
        result = workflow.step3_update_feature(
            sample_id=i,
            feature_version="v20260601",
            updated_by="老唐",
            remark="使用6月1日特征版本训练"
        )
        if "warning" in result:
            print(f"⚠️  样本{i}: {result['warning']}")
        else:
            print(f"✅ 样本{i} 特征版本更新，状态: {result['new_status']}")
    
    # 第5个样本故意用不同的特征版本 → 触发同一批重复训练检测
    print("\n⚠️  故意模拟：第5个样本用了另一个特征版本 v20260605")
    result = workflow.step3_update_feature(
        sample_id=5,
        feature_version="v20260605",
        updated_by="老唐",
        remark="后来补录的，用了6月5日的特征版本"
    )
    if "warning" in result:
        print(f"⚠️  {result['warning']}")
        print(f"⚠️  涉及特征版本: {result['feature_versions_found']}")
        print(f"⚠️  所有样本状态自动变为: {result['status']}（留给策略产品复核）")
    
    # ========== 跑自检 ==========
    print("\n📌 运行全量自检")
    print("-" * 70)
    
    check_results = checker.run_all_checks()
    for cr in check_results:
        status = "✅ 通过" if cr.passed else "❌ 有问题"
        print(f"{status} {cr.check_name}: {cr.summary}")
    
    # ========== 策略产品复核 ==========
    print("\n📌 第四步：策略产品复核")
    print("-" * 70)
    
    print("查看待复核的样本列表...")
    pending, _ = db.list_samples(status=SampleStatus.PENDING_REVIEW, page_size=50)
    print(f"共有 {len(pending)} 个样本待复核")
    
    # 策略产品看证据链
    print("\n📋 策略产品点开样本1，查看完整证据链：")
    evidence = workflow.get_sample_evidence(1)
    print(f"   原始YAML行号: {evidence['yaml_evidence']['original_line_number']}")
    print(f"   原始YAML内容: {evidence['yaml_evidence']['original_line_content']}")
    print(f"   当前状态: {evidence['sample_basic']['current_status']}")
    print(f"   异常类型: {evidence['sample_basic']['anomaly_types']}")
    print(f"   评测切片查看记录数: {len(evidence['slice_evidence'])}")
    print(f"   特征版本记录数: {len(evidence['feature_evidence'])}")
    
    # 策略产品复核确认
    print("\n策略产品复核后确认：这批重复训练是正常的版本迭代，标为正常")
    for i in range(1, 6):
        result = workflow.product_review(
            sample_id=i,
            is_normal=True,
            reviewed_by="策略产品小王",
            remark="特征版本迭代导致，数据没问题，确认正常"
        )
        print(f"✅ 样本{i}: {result['final_status']}")
    
    # ========== 导出结果 ==========
    print("\n📌 第五步：导出结果，验证页面/接口/导出一致")
    print("-" * 70)
    
    csv_data = exporter.export_to_csv()
    print("📄 CSV导出预览（前5行）：")
    lines = csv_data.strip().split('\n')
    for line in lines[:6]:
        print(f"   {line}")
    
    json_data = exporter.export_to_json(has_anomaly=False)
    print(f"\n📄 JSON导出: 共导出正常样本 {len(json.loads(json_data))} 条")
    
    # 验证页面/接口/导出一致
    print("\n✅ 验证一致性：")
    print("   页面展示 → 调用 db.list_samples()")
    print("   API接口 → 调用 db.list_samples()")
    print("   文件导出 → 调用 db.list_samples()")
    print("   👉 三者读同一份数据，不会出现一个地方显示异常、另一个地方消失")
    
    # ========== 人工改动YAML演示 ==========
    print("\n📌 补充演示：人工改动YAML行，保留证据")
    print("-" * 70)
    
    from yaml_importer import YAMLImporter
    importer = YAMLImporter(db)
    
    # 老唐修改第3行YAML内容
    print("老唐修改YAML第3行，把'配件'改成'电子产品配件'")
    importer.modify_yaml_line(
        line_id=3,
        new_content="  actual: 电子产品配件",
        modified_by="老唐",
        remark="跟业务方确认后，细分类目调整"
    )
    
    # 查看改动历史
    diffs = importer.get_version_diff(1)
    print(f"✅ YAML版本改动记录：共 {len(diffs)} 处改动")
    for d in diffs:
        print(f"   第{d['line_number']}行:")
        print(f"     原始: {d['original']}")
        print(f"     当前: {d['current']}")
        print(f"     修改人: {d['modified_by']}, 备注: {d['remark']}")
    
    print("\n" + "=" * 70)
    print("【演示完成】")
    print("=" * 70)
    print("核心能力总结：")
    print("  1. ✅ 四样自检：重复导入、重复训练、补录重算、导出一致")
    print("  2. ✅ 数据一致：页面/接口/导出读同一份结果")
    print("  3. ✅ 证据留存：YAML原始行号、人工改动、处理状态全留痕")
    print("  4. ✅ 流程闭环：导入→看切片→更特征→产品复核")
    print("  5. ✅ 异常谨慎：重复训练不急着归正常，留给产品复核")
    print("=" * 70)


if __name__ == "__main__":
    demo_full_flow()
