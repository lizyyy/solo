#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deep_sea_cleaner import DeepSeaCleaner


def main():
    parser = argparse.ArgumentParser(description="深海采样数据清洗工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    list_parser = subparsers.add_parser("list", help="列出可用样例包")

    run_parser = subparsers.add_parser("run", help="运行清洗任务")
    run_parser.add_argument("--sample", "-s", required=True, help="样例文件名 (如 pack01_demo.csv)")
    run_parser.add_argument("--batch", "-b", help="批次ID，不指定则自动生成")

    summary_parser = subparsers.add_parser("summary", help="查看清洗汇总")
    summary_parser.add_argument("--batch", "-b", help="批次ID，不指定则查看最近一次")

    anomalies_parser = subparsers.add_parser("anomalies", help="查看异常明细")
    anomalies_parser.add_argument("--batch", "-b", help="批次ID")
    anomalies_parser.add_argument("--type", "-t", help="异常类型过滤")

    duplicates_parser = subparsers.add_parser("duplicates", help="查看重复采样瓶明细")
    duplicates_parser.add_argument("--batch", "-b", help="批次ID")

    review_parser = subparsers.add_parser("review", help="添加人工改判记录")
    review_parser.add_argument("--record", "-r", required=True, help="记录ID")
    review_parser.add_argument("--reviewer", "-w", required=True, help="评审人")
    review_parser.add_argument("--reason", "-n", required=True, choices=["formula", "unit", "threshold", "format"],
                               help="失败原因：formula/unit/threshold/format")
    review_parser.add_argument("--field", "-f", choices=["temperature", "salinity", "depth", "latitude", "longitude"],
                               help="改判字段名")
    review_parser.add_argument("--original", "-o", help="原始值")
    review_parser.add_argument("--override", "-v", help="改判值")
    review_parser.add_argument("--justification", "-j", default="", help="改判理由")
    review_parser.add_argument("--source", "-c", default="", help="来源说明（如船上记录本第几页）")

    chain_parser = subparsers.add_parser("chain", help="查看改判追溯链")
    chain_parser.add_argument("--record", "-r", required=True, help="记录ID")

    args = parser.parse_args()

    cleaner = DeepSeaCleaner()

    if args.command == "list":
        samples = cleaner.list_samples()
        if not samples:
            print("没有找到样例文件")
        else:
            print("可用样例包:")
            for s in samples:
                print(f"  - {s}")

    elif args.command == "run":
        print(f"开始清洗样例: {args.sample}")
        result = cleaner.run_clean(args.sample, batch_id=args.batch)
        print(f"\n批次ID: {result['batch_id']}")
        print(f"运行时间: {result['run_time']}")
        print(f"\n=== 清洗汇总 ===")
        s = result["summary"]
        print(f"总记录数: {s['total_records']}")
        print(f"有效记录: {s['valid_records']}")
        print(f"异常记录: {s['anomaly_records']}")
        print(f"合格率: {s['valid_rate']}%")
        print(f"\n异常类型分布:")
        for k, v in s["anomaly_by_type"].items():
            print(f"  {k}: {v}")
        print(f"\n失败原因分布:")
        for k, v in s["fail_reason_counts"].items():
            print(f"  {k}: {v}")
        print(f"\n重复采样瓶: {s['duplicate_bottle_count']} 组")
        for dup in s["duplicate_bottles"]:
            print(f"  {dup['station_bottle']}: {dup['count']} 条 (记录ID: {', '.join(dup['record_ids'])})")
        print(f"\n结果已保存到: output/{result['batch_id']}.json")

    elif args.command == "summary":
        summary = cleaner.get_summary(batch_id=args.batch)
        if not summary:
            print("没有找到结果，请先运行清洗任务")
        else:
            print(json.dumps(summary, ensure_ascii=False, indent=2))

    elif args.command == "anomalies":
        anomalies = cleaner.get_anomalies(batch_id=args.batch, anomaly_type=args.type)
        if not anomalies:
            print("没有异常记录")
        else:
            print(f"共 {len(anomalies)} 条异常:")
            for a in anomalies:
                print(f"  [{a['anomaly_type']}] {a['record_id']} ({a['station']}/{a['bottle_id']}): {a['message']}")
                if a.get("detail"):
                    print(f"      详情: {json.dumps(a['detail'], ensure_ascii=False)}")

    elif args.command == "duplicates":
        duplicates = cleaner.get_duplicates(batch_id=args.batch)
        if not duplicates:
            print("没有重复采样瓶")
        else:
            print(f"共 {len(duplicates)} 组重复采样瓶:")
            for d in duplicates:
                print(f"  {d['station_bottle']}: {d['count']} 条")
                print(f"    记录ID: {', '.join(d['record_ids'])}")
                print(f"    采样时间: {', '.join(str(t) for t in d['sample_times'])}")

    elif args.command == "review":
        review = cleaner.add_manual_review(
            record_id=args.record,
            reviewer=args.reviewer,
            fail_reason=args.reason,
            field_name=args.field,
            original_value=args.original,
            overridden_value=args.override,
            justification=args.justification,
            source_note=args.source,
        )
        print(f"人工改判记录已添加:")
        print(f"  评审ID: {review.review_id}")
        print(f"  记录ID: {review.record_id}")
        print(f"  评审人: {review.reviewer}")
        print(f"  失败原因: {review.fail_reason.value}")
        print(f"  改判字段: {review.field_name}")
        print(f"  原始值: {review.original_value}")
        print(f"  改判值: {review.overridden_value}")
        print(f"  理由: {review.justification}")
        print(f"  来源: {review.source_note}")
        print(f"\n提示: 重新运行清洗后可看到改判效果")

    elif args.command == "chain":
        chain = cleaner.get_review_chain(args.record)
        if not chain:
            print(f"记录 {args.record} 没有改判记录")
        else:
            print(f"记录 {args.record} 的改判追溯链:")
            for i, r in enumerate(chain, 1):
                print(f"\n  [{i}] {r['review_id']} - {r['review_time']}")
                print(f"      评审人: {r['reviewer']}")
                print(f"      状态: {r['status']}")
                print(f"      失败原因: {r['fail_reason']}")
                print(f"      改判字段: {r['field_name']}")
                print(f"      原始值: {r['original_value']}")
                print(f"      改判值: {r['overridden_value']}")
                print(f"      理由: {r['justification']}")
                print(f"      来源: {r['source_note']}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
