#!/usr/bin/env python3
import argparse
import sys
import json
from typing import List
from models import HotelRecord, DamageRecord, RewashRecord
from processor import LinenProcessor
from reporter import ReportGenerator
from storage import HistoryStorage


def parse_args():
    parser = argparse.ArgumentParser(
        description="布草分拣返洗短少分级排查CLI - 洗涤工厂布草管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 单次处理（入库100，出库90，破损5，返洗3 → 短少2）
  python3 cli.py process --hotel "希尔顿酒店" --linen "床单" --inbound 100 --outbound 90 --damage 5 --rewash 3
  python3 cli.py process --hotel "万豪酒店" -l "毛巾" -i 200 -o 180 -d 8 -r 10

  # 批量处理（JSON文件）
  python3 cli.py batch --file records.json

  # 查看历史记录
  python3 cli.py history

  # 导出报告
  python3 cli.py export --format text
  python3 cli.py export --format json
  python3 cli.py export --format csv
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    process_parser = subparsers.add_parser("process", help="处理单条布草记录")
    process_parser.add_argument("--hotel", required=True, help="酒店名称")
    process_parser.add_argument("-l", "--linen", required=True, help="布草类型")
    process_parser.add_argument("-i", "--inbound", type=int, required=True, help="入库数量")
    process_parser.add_argument("-o", "--outbound", type=int, required=True, help="实际出库数量")
    process_parser.add_argument("-d", "--damage", type=int, default=0, help="破损数量")
    process_parser.add_argument("-r", "--rewash", type=int, default=0, help="返洗数量")
    process_parser.add_argument("--damage-reason", default="正常损耗", help="破损原因")
    process_parser.add_argument("--rewash-reason", default="污渍未净", help="返洗原因")

    batch_parser = subparsers.add_parser("batch", help="批量处理记录")
    batch_parser.add_argument("-f", "--file", required=True, help="JSON记录文件路径")

    history_parser = subparsers.add_parser("history", help="查看处理历史")
    history_parser.add_argument("--limit", type=int, help="显示最近N条记录")

    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("--format", choices=["text", "json", "csv"], default="text", help="导出格式")
    export_parser.add_argument("-o", "--output", help="输出文件路径")

    clear_parser = subparsers.add_parser("clear", help="清除历史记录")

    return parser.parse_args()


def load_records_from_file(filepath: str) -> List[tuple]:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = []
    for item in data:
        damage_records = []
        if "damage_records" in item:
            damage_records = [DamageRecord(**d) for d in item["damage_records"]]
        elif "damage" in item:
            damage_records = [DamageRecord(item["linen_type"], item["damage"], item.get("damage_reason", "正常损耗"))]

        rewash_records = []
        if "rewash_records" in item:
            rewash_records = [RewashRecord(**r) for r in item["rewash_records"]]
        elif "rewash" in item:
            rewash_records = [RewashRecord(item["linen_type"], item["rewash"], item.get("rewash_reason", "污渍未净"))]

        record = HotelRecord(
            hotel_name=item["hotel_name"],
            linen_type=item["linen_type"],
            inbound_quantity=item["inbound_quantity"],
            damage_records=damage_records,
            rewash_records=rewash_records,
        )
        outbound_quantity = item.get("outbound", item.get("outbound_quantity", 0))
        records.append((record, outbound_quantity))

    return records


def main():
    args = parse_args()
    processor = LinenProcessor()
    reporter = ReportGenerator()
    storage = HistoryStorage()

    processor.history = storage.load_history()

    if args.command == "process":
        try:
            damage_records = []
            if args.damage > 0:
                damage_records.append(DamageRecord(args.linen, args.damage, args.damage_reason))

            rewash_records = []
            if args.rewash > 0:
                rewash_records.append(RewashRecord(args.linen, args.rewash, args.rewash_reason))

            record = HotelRecord(
                hotel_name=args.hotel,
                linen_type=args.linen,
                inbound_quantity=args.inbound,
                damage_records=damage_records,
                rewash_records=rewash_records,
            )

            result, errors = processor.process(record, args.outbound)
            storage.save_history(processor.history)

            print(reporter.generate_human_readable([result], errors))
            print("\n✅ 处理完成！")
            return 0

        except ValueError as e:
            print(f"❌ 处理失败: {e}", file=sys.stderr)
            return 1

    elif args.command == "batch":
        try:
            records = load_records_from_file(args.file)
            results, errors = processor.batch_process(records)
            storage.save_history(processor.history)

            print(reporter.generate_human_readable(results, errors))
            print(f"\n✅ 批量处理完成！共处理 {len(results)} 条记录。")
            return 0

        except FileNotFoundError:
            print(f"❌ 文件不存在: {args.file}", file=sys.stderr)
            return 1
        except json.JSONDecodeError:
            print(f"❌ JSON格式错误: {args.file}", file=sys.stderr)
            return 1
        except Exception as e:
            print(f"❌ 批量处理失败: {e}", file=sys.stderr)
            return 1

    elif args.command == "history":
        history = processor.get_history()
        if args.limit:
            history = history[-args.limit:]

        print(reporter.generate_human_readable(history))
        return 0

    elif args.command == "export":
        history = processor.get_history()

        if args.format == "text":
            output = reporter.export_text(history, filepath=args.output)
        elif args.format == "json":
            output = reporter.export_json(history, filepath=args.output)
        elif args.format == "csv":
            output = reporter.export_csv(history, filepath=args.output)

        if args.output:
            print(f"✅ 报告已导出到: {args.output}")
        else:
            print(output)
        return 0

    elif args.command == "clear":
        processor.clear_history()
        storage.clear_history()
        print("✅ 历史记录已清除")
        return 0

    else:
        print("请使用 -h 查看帮助信息", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
