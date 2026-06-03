import json
from processor import RecordProcessor
from models import RecordStatus


def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def demo_poisson_prediction():
    processor = RecordProcessor()
    
    print_section("【泊松到店人数预测】系统演示")
    
    print_section("第一步：参数调试表第一次导入（正常材料）")
    normal_data = [
        {"date": "2026-06-01", "store_id": "S001", "predicted_foot_traffic": 156.3, "poisson_lambda": 150.0},
        {"date": "2026-06-02", "store_id": "S001", "predicted_foot_traffic": 172.5, "poisson_lambda": 165.0},
        {"date": "2026-06-03", "store_id": "S001", "predicted_foot_traffic": 148.7, "poisson_lambda": 145.0},
        {"date": "2026-06-04", "store_id": "S001", "predicted_foot_traffic": 189.2, "poisson_lambda": 180.0},
    ]
    processor.import_parameter_sheet(normal_data, "数据组小明")
    print("导入正常记录 4 条:")
    for r in processor.records:
        print(f"  编号{r.record_id}: {r.date} 预测{r.predicted_foot_traffic}人 [状态:{r.status.value}]")
    
    print_section("第二步：模拟人工删除一行，制造编号断档")
    deleted = processor.simulate_manual_deletion(2, "运营阿岚")
    print(f"人工删除编号 2 的记录: {'成功' if deleted else '失败'}")
    processor.mark_gap_records("系统检测")
    
    print("断档检测后的记录状态:")
    for r in sorted(processor.records, key=lambda x: x.record_id):
        status_mark = "⚠️ " if r.status == RecordStatus.GAP_DETECTED else "  "
        print(f"  {status_mark}编号{r.record_id}: {r.date} 预测{r.predicted_foot_traffic}人 [状态:{r.status.value}]")
        if r.notes:
            print(f"         备注: {r.notes}")
    
    gaps = processor.detect_id_gaps()
    print(f"\n检测到编号断档: {gaps}")
    print("（此状态保留给教研组复核，不自动归为正常）")
    
    print_section("第三步：运营规划阿岚补看手算反例（错口径材料）")
    hand_calc_data = [
        {"date": "2026-06-03", "store_id": "S001", "manual_value": 165.0, "formula_used": "旧口径：上周同期*1.1"},
    ]
    for calc in hand_calc_data:
        processor.add_hand_calculation(calc, "运营阿岚")
    
    print("手算反例已录入:")
    for hc in processor.hand_calculations:
        print(f"  {hc.calc_id}: {hc.date} 手算值{hc.manual_value}人 (公式: {hc.formula_used})")
    
    conflicts = processor.check_conflicts()
    print(f"\n冲突检测发现 {len(conflicts)} 处矛盾:")
    for cf in conflicts:
        print(f"  {cf.conflict_id}: 记录{cf.record_id}")
        print(f"     参数值: {cf.parameter_value}, 手算值: {cf.hand_calc_value}")
        print(f"     {cf.description}")
        print(f"     请运营规划阿岚选择: [确认confirm / 驳回reject]")
    
    print_section("冲突处理：列出证据，等待人工决策")
    print("注意：系统不自动拍板，需要运营阿岚确认或驳回")
    processor.resolve_conflict("CF-001", "confirm", "运营阿岚")
    print("阿岚选择确认: 采用参数值，保留手算反例作为参考")
    
    print_section("第四步：补录旧口径记录（补录材料）")
    old_caliber_data = {
        "date": "2026-05-28",
        "store_id": "S001",
        "predicted_foot_traffic": 132.0,
        "poisson_lambda": 128.0,
        "version": "v0.9-old",
        "previous_version": "v0.8"
    }
    processor.import_old_caliber_record(old_caliber_data, "运营阿岚")
    print("旧口径补录记录已导入，标记为特殊状态:")
    old_record = processor.records[-1]
    print(f"  编号{old_record.record_id}: {old_record.date} 预测{old_record.predicted_foot_traffic}人")
    print(f"     状态: {old_record.status.value}, 版本: {old_record.version}")
    print(f"     备注: {old_record.notes}")
    
    print_section("第五步：参数版本页更新")
    processor.create_parameter_version(
        lambda_value=160.0,
        effective_date="2026-06-01",
        created_by="数据组小明",
        reason="根据5月实际到店数据校准，调整lambda参数"
    )
    processor.create_parameter_version(
        lambda_value=168.5,
        effective_date="2026-06-05",
        created_by="运营阿岚",
        reason="结合手算反例CF-001确认结果，微调lambda参数"
    )
    
    version_page = processor.get_parameter_version_page()
    print("参数版本页:")
    print(f"  当前活跃版本: {version_page['active_version'].version}")
    print(f"  Lambda值: {version_page['active_version'].lambda_value}")
    print(f"  生效日期: {version_page['active_version'].effective_date}")
    print(f"  版本创建人: {version_page['active_version'].created_by}")
    print(f"  取舍理由: {version_page['active_version'].reason}")
    print(f"\n  历史版本（共{version_page['total_versions']}个）:")
    for pv in version_page['history']:
        active_mark = "★" if pv.is_active else " "
        print(f"    {active_mark} {pv.version}: lambda={pv.lambda_value}, {pv.created_by}, {pv.reason[:30]}...")
    
    print_section("第六步：历史记录页 - 三种处理结果对比")
    history = processor.get_processing_history()
    print(f"{'编号':<6}{'日期':<12}{'预测人数':<10}{'状态':<15}{'来源':<15}{'版本':<12}{'备注'}")
    print("-" * 90)
    for h in history:
        notes = h['notes'] or ""
        print(f"{h['record_id']:<6}{h['date']:<12}{h['predicted']:<10.1f}{h['status']:<15}{h['source']:<15}{h['version']:<12}{notes[:40]}")
    
    print_section("三种处理结果总结")
    print("1. ✅ 顺利记录 (编号1,4):")
    print("   - 状态: normal")
    print("   - 说明: 参数调试表正常导入，无异常")
    print("\n2. ⚠️ 编号断档记录 (编号3):")
    print("   - 状态: gap_detected")
    print("   - 说明: 人工删除编号2后，编号3被标记为断档")
    print("   - 处理: 保留异常状态，留给教研组复核")
    print("\n3. 📋 旧口径补录记录 (编号5):")
    print("   - 状态: old_caliber")
    print("   - 说明: 从手算反例补录的历史数据")
    print("   - 版本: v0.9-old，与当前v2.0区分")
    
    print_section("处理日志")
    print(f"{'日志ID':<10}{'记录编号':<10}{'操作':<20}{'操作人':<12}{'时间'}")
    print("-" * 70)
    for log in sorted(processor.logs, key=lambda x: x.timestamp):
        print(f"{log.log_id:<10}{log.record_id:<10}{log.action:<20}{log.operator:<12}{log.timestamp.strftime('%H:%M:%S')}")
        if log.details:
            print(f"           详情: {json.dumps(log.details, ensure_ascii=False)}")
    
    print_section("演示完成")
    print("""
    关键点回顾:
    1. 参数调试表导入 → 自动检测编号断档
    2. 手算反例录入 → 自动检测矛盾 → 列出证据 → 人工确认/驳回
    3. 旧口径补录 → 保留版本号和来源标记
    4. 参数版本页 → 记录lambda值、创建人、取舍理由
    5. 断档记录 → 不自动归正常，留给教研组复核
    """)


if __name__ == "__main__":
    demo_poisson_prediction()
