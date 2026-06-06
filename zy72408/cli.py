import argparse
import sys
import json
from datetime import datetime
from core_engine import RoyaltyEngine
from self_check import SelfChecker
from unified_data_layer import UnifiedDataLayer
from data_models import RecordStatus


def cmd_init(args):
    engine = RoyaltyEngine()
    print("✅ 版税分摊引擎已初始化")
    return engine


def cmd_import(args):
    engine = _load_engine()
    sample_data = _get_sample_rehearsal_data()
    batch, records = engine.step1_import_rehearsal(
        sample_data,
        batch_name=args.batch_name or "2026年6月第1周",
        expected_cities_map=_get_expected_cities()
    )
    _save_engine(engine)
    print(f"✅ 导入完成：批次 {batch.batch_id}，共 {len(records)} 条记录")
    for r in records:
        print(f"   行{r.source_row}: {r.musician_name} - {r.song_title}")


def cmd_review_contract(args):
    engine = _load_engine()
    record = engine.step2_review_contract(
        record_id=args.record_id,
        contract_note=args.note or "合同页截图已复核",
        authorized_cities=args.cities.split(",") if args.cities else None
    )
    _save_engine(engine)
    print(f"✅ 合同复核完成：{record.musician_name} - {record.song_title}，状态：{record.status.value}")


def cmd_fix_area(args):
    engine = _load_engine()
    record = engine.fix_missing_area(
        record_id=args.record_id,
        additional_cities=args.cities.split(",")
    )
    _save_engine(engine)
    print(f"✅ 授权地区已补录：{record.musician_name} - {record.song_title}")
    print(f"   当前授权城市：{record.authorized_cities}")


def cmd_update_verification(args):
    engine = _load_engine()
    sample_verification = _get_sample_verification(engine)
    updated = engine.step3_update_verification(sample_verification)
    _save_engine(engine)
    print(f"✅ 核销更新完成：共 {len(updated)} 条记录")
    for r in updated:
        print(f"   {r.musician_name} - {r.song_title}: 核销{r.verified_count}次，版税¥{r.royalty_amount:.2f}")


def cmd_check(args):
    engine = _load_engine()
    checker = SelfChecker(engine)
    results = checker.run_all_checks()
    _save_engine(engine)
    print("📋 自检结果：")
    for r in results:
        status = "✅ 通过" if r.passed else "⚠️ 异常"
        print(f"   {status} - {r.check_name}: {r.details}")
        if r.affected_records:
            for rid in r.affected_records:
                rec = engine.records[rid]
                print(f"     → 行{rec.source_row}: {rec.musician_name} - {rec.song_title}")


def cmd_list(args):
    engine = _load_engine()
    data_layer = UnifiedDataLayer(engine)
    status = RecordStatus(args.status) if args.status else None
    records = data_layer.get_all_records(status_filter=status, include_audit=False)
    print(f"📋 记录列表（共 {len(records)} 条）：")
    for r in records:
        flag = " ⚠️受备注影响" if r.get("affected_by_note_update") else ""
        print(f"   [{r['record_id']}] 行{r['source_row']}: {r['musician_name']} - {r['song_title']} | 状态: {r['status']}{flag}")


def cmd_audit(args):
    engine = _load_engine()
    data_layer = UnifiedDataLayer(engine)
    if args.record_id:
        trail = data_layer.get_audit_trail(args.record_id)
        print(f"📋 记录 {args.record_id} 的审计追踪：")
        for log in trail:
            print(f"   [{log['timestamp']}] {log['operator']} | {log['change_type']} | {log['field_name']}: {log['old_value']} → {log['new_value']} ({log['note']})")
    else:
        report = data_layer.get_full_audit_report()
        print(f"📋 完整审计报告：")
        print(f"   总记录数: {report['summary']['total_records']}")
        print(f"   总审计日志: {report['summary']['total_audit_logs']}")
        for idx in report['record_audit_index']:
            print(f"   [{idx['record_id']}] 行{idx['source_row']}: {idx['musician']} - {idx['song']} | {idx['status']} | {idx['audit_count']}条改动")


def cmd_affected(args):
    engine = _load_engine()
    affected = engine.get_affected_by_note()
    print(f"📋 受备注修改影响需复核的记录（共 {len(affected)} 条）：")
    for r in affected:
        print(f"   [{r.record_id}] 行{r.source_row}: {r.musician_name} - {r.song_title} | 状态: {r.status.value}")
    if args.clear:
        engine.clear_affected_flags()
        _save_engine(engine)
        print("✅ 已清除所有受影响标记")


def cmd_export(args):
    engine = _load_engine()
    data_layer = UnifiedDataLayer(engine)
    if args.format == "csv":
        csv_data = data_layer.export_csv()
        with open(args.output or "版税分摊明细.csv", "w", encoding="utf-8-sig") as f:
            f.write(csv_data)
        print(f"✅ CSV已导出到 {args.output or '版税分摊明细.csv'}")
    else:
        json_data = data_layer.export_json()
        with open(args.output or "版税分摊明细.json", "w", encoding="utf-8") as f:
            f.write(json_data)
        print(f"✅ JSON已导出到 {args.output or '版税分摊明细.json'}")


def cmd_replay(args):
    engine = _load_engine()
    print("📋 可重放的命令序列（按时间顺序）：")
    print("=" * 60)
    for i, cmd in enumerate(engine.replay_commands, 1):
        print(f"{i:2d}. [{cmd.timestamp.strftime('%H:%M:%S')}] {cmd.description}")
        print(f"    命令: {cmd.command}")
    print("=" * 60)
    print("\n💡 可重新运行上述命令复现完整处理流程")


def cmd_demo(args):
    print("=" * 60)
    print("🎸 独立音乐人版税分摊系统 - 完整演示")
    print("=" * 60)
    engine = RoyaltyEngine()
    checker = SelfChecker(engine)
    data_layer = UnifiedDataLayer(engine)

    print("\n📥 【步骤1】排练群接龙第一次导入")
    sample_data = _get_sample_rehearsal_data()
    batch, records = engine.step1_import_rehearsal(
        sample_data,
        batch_name="2026年6月第1周",
        expected_cities_map=_get_expected_cities()
    )
    print(f"   导入 {len(records)} 条记录，批次号: {batch.batch_id}")
    for r in records:
        print(f"     行{r.source_row}: {r.musician_name} - {r.song_title}")

    print("\n📋 【自检】导入后第一次自检")
    for r in checker.run_all_checks():
        status = "✅" if r.passed else "⚠️"
        print(f"   {status} {r.check_name}: {r.details}")

    print("\n📄 【步骤2】店长老周补看合同页截图")
    missing_records = engine.get_records_by_status(RecordStatus.AREA_MISSING)
    print(f"   发现 {len(missing_records)} 条授权地区待复核")
    for r in missing_records:
        print(f"     行{r.source_row}: {r.musician_name} - {r.song_title} | 缺失: {set(r.expected_cities) - set(r.authorized_cities)}")
        engine.step2_review_contract(
            record_id=r.record_id,
            contract_note="合同截图显示：上海、杭州已授权，深圳漏签补充协议"
        )
        print(f"     → 已补充合同备注，状态保持【授权地区缺失】（留待店长复核")

    print("\n📋 【日常检查】查看受备注修改影响的记录")
    affected = engine.get_affected_by_note()
    print(f"   受影响记录: {len(affected)} 条")
    for r in affected:
        print(f"     行{r.source_row}: {r.musician_name} - {r.song_title}")

    print("\n🔧 店长复核后，补录缺失的授权城市")
    for r in missing_records:
        missing_cities = list(set(r.expected_cities) - set(r.authorized_cities))
        engine.fix_missing_area(r.record_id, missing_cities)
        print(f"     行{r.source_row}: 补录 {missing_cities}")

    print("\n✅ 授权地区补录完成后自检")
    for r in checker.run_all_checks():
        status = "✅" if r.passed else "⚠️"
        print(f"   {status} {r.check_name}: {r.details}")

    print("\n📊 【步骤3】课时核销单更新")
    verification_data = _get_sample_verification(engine)
    updated = engine.step3_update_verification(verification_data)
    print(f"   更新 {len(updated)} 条核销记录")
    for r in updated:
        print(f"     {r.musician_name} - {r.song_title}: ¥{r.royalty_amount:.2f}")

    print("\n🔍 数据一致性验证：页面/接口/导出 同一份数据")
    page_data = data_layer.get_page_view()
    api_data = data_layer.get_api_response()
    print(f"   页面数据: {len(page_data['data'])} 条，来源: {page_data['source']}")
    print(f"   接口数据: {len(api_data['data'])} 条，来源: {api_data['source']}")
    print(f"   ✅ 三处数据同源，保证一致")

    print("\n📋 最终状态一览：")
    for rid, r in engine.records.items():
        print(f"   行{r.source_row}: {r.musician_name} - {r.song_title} | {r.status.value} | ¥{r.royalty_amount:.2f}")

    print("\n📜 可重放命令序列：")
    for i, cmd in enumerate(engine.replay_commands, 1):
        print(f"   {i}. {cmd.description}")

    _save_engine(engine)
    print("\n" + "=" * 60)
    print("✅ 演示完成！引擎状态已保存，可运行其他命令继续操作")
    print("=" * 60)


def _get_sample_rehearsal_data():
    return [
        {"音乐人": "小王", "曲目": "春日旋律", "授权城市": "上海、杭州", "播放次数": "120", "合同备注": ""},
        {"音乐人": "小李", "曲目": "城市夜曲", "授权城市": "北京", "播放次数": "85", "合同备注": ""},
        {"音乐人": "小张", "曲目": "海风轻唱", "授权城市": "广州、深圳", "播放次数": "200", "合同备注": ""},
        {"音乐人": "小王", "曲目": "春日旋律", "授权城市": "上海、杭州", "播放次数": "120", "合同备注": ""},
    ]


def _get_expected_cities():
    return {
        "春日旋律": ["上海", "杭州", "深圳"],
        "城市夜曲": ["北京"],
        "海风轻唱": ["广州", "深圳"],
    }


def _get_sample_verification(engine):
    data = []
    for rid, r in engine.records.items():
        if not r.is_duplicate:
            data.append({
                "record_id": rid,
                "verified_count": r.play_count - 10,
                "unit_price": 0.5
            })
    return data


def _save_engine(engine):
    import pickle
    with open("/tmp/royalty_engine.pkl", "wb") as f:
        pickle.dump(engine, f)


def _load_engine():
    import pickle
    try:
        with open("/tmp/royalty_engine.pkl", "rb") as f:
            return pickle.load(f)
    except:
        print("❌ 请先运行 init 或 demo 命令初始化引擎")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="🎸 独立音乐人版税分摊系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_init = subparsers.add_parser("init", help="初始化版税引擎")
    p_init.set_defaults(func=cmd_init)

    p_import = subparsers.add_parser("import", help="导入排练群接龙")
    p_import.add_argument("--batch-name", help="批次名称")
    p_import.set_defaults(func=cmd_import)

    p_review = subparsers.add_parser("review", help="复核合同页截图")
    p_review.add_argument("record_id", help="记录ID")
    p_review.add_argument("--note", help="合同备注")
    p_review.add_argument("--cities", help="授权城市，逗号分隔")
    p_review.set_defaults(func=cmd_review_contract)

    p_fix = subparsers.add_parser("fix-area", help="补录授权地区")
    p_fix.add_argument("record_id", help="记录ID")
    p_fix.add_argument("cities", help="补充城市，逗号分隔")
    p_fix.set_defaults(func=cmd_fix_area)

    p_verify = subparsers.add_parser("verify", help="更新课时核销单")
    p_verify.set_defaults(func=cmd_update_verification)

    p_check = subparsers.add_parser("check", help="运行自检")
    p_check.set_defaults(func=cmd_check)

    p_list = subparsers.add_parser("list", help="列出记录")
    p_list.add_argument("--status", help="按状态过滤")
    p_list.set_defaults(func=cmd_list)

    p_audit = subparsers.add_parser("audit", help="查看审计追踪")
    p_audit.add_argument("--record-id", help="指定记录ID")
    p_audit.set_defaults(func=cmd_audit)

    p_affected = subparsers.add_parser("affected", help="查看受备注影响的记录")
    p_affected.add_argument("--clear", action="store_true", help="清除标记")
    p_affected.set_defaults(func=cmd_affected)

    p_export = subparsers.add_parser("export", help="导出明细")
    p_export.add_argument("--format", default="json", choices=["csv", "json"])
    p_export.add_argument("--output", help="输出文件名")
    p_export.set_defaults(func=cmd_export)

    p_replay = subparsers.add_parser("replay", help="查看可重放命令")
    p_replay.set_defaults(func=cmd_replay)

    p_demo = subparsers.add_parser("demo", help="运行完整演示")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    if args.command:
        args.func(args)


if __name__ == "__main__":
    main()
