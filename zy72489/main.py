from processor import BlockProcessor


def main():
    print("=" * 80)
    print("  街区空置铺面盘活 - 演示系统")
    print("  社区书记周姐给新人讲流程专用")
    print("=" * 80)
    print()

    processor = BlockProcessor()

    print("【一、正常材料 - 完整流程演示】")
    print("（包含：无障碍坡道导入、夜间采样点补录、点位清单更新、人工修正、重跑）")
    print()
    session_normal = processor.run_full_process("正常材料")
    processor.print_session_report(session_normal)

    print("\n【二、错口径材料 - 演示施工临时改道未同步地图】")
    print("（重点看：施工改道别急着归正常，留给居民代表复核）")
    print()
    session_wrong = processor.run_full_process("错口径材料")
    processor.print_session_report(session_wrong)

    print("\n【三、补录材料 - 演示从夜间采样点补来的旧口径】")
    print("（重点看：夜间采样点补录、口径变更记录）")
    print()
    session_supplement = processor.run_full_process("补录材料")
    processor.print_session_report(session_supplement)

    print("\n" + "=" * 80)
    print("  一致性校验 - 点位清单 vs 历史记录")
    print("=" * 80)

    all_good = True
    all_good &= processor.verify_point_history_consistency(session_normal)
    all_good &= processor.verify_point_history_consistency(session_wrong)
    all_good &= processor.verify_point_history_consistency(session_supplement)

    print("\n" + "=" * 80)
    if all_good:
        print("  ✓ 全部校验通过！点位清单和历史记录完全对应。")
    else:
        print("  ✗ 存在校验不通过的情况，请检查！")
    print("=" * 80)

    print("\n" + "=" * 80)
    print("  周姐提示：")
    print("  1. P001 幸福社区服务中心 - 顺利记录，直接正常")
    print("  2. P002 阳光便利店 - 施工临时改道未同步地图，先标记「需居民代表复核」")
    print("  3. P003 老街口早餐铺 - 从夜间采样点补录旧口径，更新为新口径")
    print("  记住：施工改道别急着归正常，居民代表开会前只有十分钟，")
    print("       直接说明问题就行，别再翻无障碍坡道记录！")
    print("=" * 80)


if __name__ == "__main__":
    main()
