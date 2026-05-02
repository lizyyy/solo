import argparse
import os
import sys

from .engine import MigrationEngine


def main():
    parser = argparse.ArgumentParser(
        description="CRM 数据迁移预检工具 - 验证数据并生成迁移 SQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--source-dir",
        "-s",
        required=True,
        help="包含源 CSV 文件的目录路径",
    )
    
    parser.add_argument(
        "--schema",
        "-m",
        required=True,
        help="目标表结构配置文件路径 (JSON 或 YAML)",
    )
    
    parser.add_argument(
        "--mapping",
        "-p",
        required=True,
        help="字段映射配置文件路径 (JSON 或 YAML)",
    )
    
    parser.add_argument(
        "--out",
        "-o",
        required=True,
        help="输出目录路径",
    )
    
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="即使存在阻断错误也强制生成迁移 SQL（带警告注释）",
    )
    
    args = parser.parse_args()
    
    source_dir = os.path.abspath(args.source_dir)
    schema_path = os.path.abspath(args.schema)
    mapping_path = os.path.abspath(args.mapping)
    out_dir = os.path.abspath(args.out)
    
    if not os.path.isdir(source_dir):
        print(f"错误: 源目录不存在: {source_dir}", file=sys.stderr)
        sys.exit(1)
    
    if not os.path.isfile(schema_path):
        print(f"错误: Schema 文件不存在: {schema_path}", file=sys.stderr)
        sys.exit(1)
    
    if not os.path.isfile(mapping_path):
        print(f"错误: 映射配置文件不存在: {mapping_path}", file=sys.stderr)
        sys.exit(1)
    
    print("=" * 60)
    print("CRM 数据迁移预检工具")
    print("=" * 60)
    print()
    print(f"源数据目录: {source_dir}")
    print(f"Schema 配置: {schema_path}")
    print(f"映射配置: {mapping_path}")
    print(f"输出目录: {out_dir}")
    print(f"强制模式: {'是' if args.force else '否'}")
    print()
    
    try:
        engine = MigrationEngine(
            source_dir=source_dir,
            schema_path=schema_path,
            mapping_path=mapping_path,
            out_dir=out_dir,
            force=args.force,
        )
        
        result = engine.run()
        
        if not result["success"]:
            print(f"错误: {result.get('error', '未知错误')}", file=sys.stderr)
            sys.exit(1)
        
        summary = result["summary"]
        print("-" * 60)
        print("预检完成!")
        print("-" * 60)
        print()
        
        status = summary["status"]
        if status == "success":
            print("✅ 状态: 成功 - 所有检查通过")
        elif status == "warning":
            print("⚠️ 状态: 警告 - 存在需要人工确认的问题")
        else:
            print("❌ 状态: 错误 - 存在阻断迁移的问题")
        
        print()
        print(f"处理的表数: {summary['total_tables']}")
        print(f"总记录数: {summary['total_rows']}")
        print(f"错误数: {summary['total_errors']}")
        print(f"警告数: {summary['total_warnings']}")
        print()
        
        if summary["total_errors"] > 0 and not args.force:
            print("⚠️ 由于存在阻断错误，未生成迁移 SQL。")
            print("   如需强制生成草稿 SQL，请使用 --force 参数。")
            print()
        elif summary["total_errors"] > 0 and args.force:
            print("⚠️ 注意：已使用 --force 生成包含错误的草稿 SQL。")
            print("   建议修复所有错误后再执行迁移。")
            print()
        
        print(f"输出文件:")
        print(f"  - {out_dir}/report.md")
        print(f"  - {out_dir}/report.json")
        
        if summary["total_errors"] == 0 or args.force:
            print(f"  - {out_dir}/migrate.sql")
            print(f"  - {out_dir}/rollback.sql")
        
        print()
        print("=" * 60)
        
        if summary["total_errors"] > 0:
            sys.exit(2)
        
    except Exception as e:
        print(f"执行出错: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
