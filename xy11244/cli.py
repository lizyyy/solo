import argparse
import sys
import json
from datetime import datetime
from typing import Optional

from service import BookDonationService
from models import DonationStatus, ExceptionType


def print_result(result: dict) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_import(args) -> None:
    service = BookDonationService()

    if args.file:
        donations = service.parse_csv_file(args.file)
        print(f"从文件读取了 {len(donations)} 条记录")
    else:
        print("请提供 --file 参数")
        sys.exit(1)

    result = service.import_donations(
        donations=donations,
        volunteer=args.volunteer,
        batch_id=args.batch_id
    )

    print("导入结果:")
    print_result(result)


def cmd_deduplicate(args) -> None:
    service = BookDonationService()

    result = service.deduplicate_batch(
        batch_id=args.batch_id,
        operator=args.operator,
        auto_mark=args.auto_mark
    )

    print("去重结果:")
    print_result(result)


def cmd_shelf_list(args) -> None:
    service = BookDonationService()

    result = service.generate_shelf_list(
        batch_id=args.batch_id,
        operator=args.operator,
        list_id=args.list_id,
        shelf_code=args.shelf_code or "",
        filter_duplicates=not args.include_duplicates,
        filter_unusable=not args.include_unusable
    )

    print("上架清单生成结果:")
    print_result(result)

    if args.export:
        export_result = service.export_shelf_list(
            list_id=result['list_id'],
            output_path=args.export
        )
        print(f"\n已导出到: {export_result['file_path']}")


def cmd_query(args) -> None:
    service = BookDonationService()

    result = service.query_with_filters(
        volunteer=args.volunteer,
        start_date=args.start_date,
        end_date=args.end_date,
        status=args.status,
        exception_type=args.exception_type,
        batch_id=args.batch_id,
        is_duplicate=args.is_duplicate,
        page=args.page,
        page_size=args.page_size
    )

    print(f"查询结果 (共 {result['total']} 条):")
    print_result(result)

    if args.export:
        export_result = service.export_to_csv(
            output_path=args.export,
            volunteer=args.volunteer,
            start_date=args.start_date,
            end_date=args.end_date,
            status=args.status,
            exception_type=args.exception_type,
            batch_id=args.batch_id,
            is_duplicate=args.is_duplicate
        )
        print(f"\n已导出到: {export_result['file_path']}")


def cmd_history(args) -> None:
    service = BookDonationService()

    result = service.get_operation_history(
        operation_type=args.operation_type,
        batch_id=args.batch_id,
        operator=args.operator,
        start_date=args.start_date,
        end_date=args.end_date,
        page=args.page,
        page_size=args.page_size
    )

    print(f"操作历史 (共 {result['total']} 条):")
    print_result(result)


def cmd_add_isbn_info(args) -> None:
    from storage import BookStorage
    storage = BookStorage()

    result = storage.add_isbn_info(
        isbn=args.isbn,
        title=args.title,
        author=args.author or "",
        publisher=args.publisher or "",
        publish_date=args.publish_date or "",
        suggested_grades=args.suggested_grades or "",
        category=args.category or ""
    )

    if result:
        print(f"成功添加/更新ISBN信息: {args.isbn}")
    else:
        print(f"添加ISBN信息失败")


def main():
    parser = argparse.ArgumentParser(
        description="公益书库捐书管理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入捐书记录")
    import_parser.add_argument("--file", required=True, help="CSV文件路径")
    import_parser.add_argument("--volunteer", required=True, help="负责人")
    import_parser.add_argument("--batch-id", help="批次ID (可选，自动生成)")

    dedup_parser = subparsers.add_parser("deduplicate", help="去重处理")
    dedup_parser.add_argument("--batch-id", required=True, help="批次ID")
    dedup_parser.add_argument("--operator", required=True, help="操作人")
    dedup_parser.add_argument("--auto-mark", action="store_true", help="自动标记重复")

    shelf_parser = subparsers.add_parser("shelf-list", help="生成上架清单")
    shelf_parser.add_argument("--batch-id", required=True, help="批次ID")
    shelf_parser.add_argument("--operator", required=True, help="操作人")
    shelf_parser.add_argument("--list-id", help="清单ID (可选，自动生成)")
    shelf_parser.add_argument("--shelf-code", help="货架编码")
    shelf_parser.add_argument("--include-duplicates", action="store_true", help="包含重复书籍")
    shelf_parser.add_argument("--include-unusable", action="store_true", help="包含不可上架书籍")
    shelf_parser.add_argument("--export", help="导出到CSV文件路径")

    query_parser = subparsers.add_parser("query", help="查询捐书记录")
    query_parser.add_argument("--volunteer", help="按负责人筛选")
    query_parser.add_argument("--start-date", help="开始日期 (ISO格式)")
    query_parser.add_argument("--end-date", help="结束日期 (ISO格式)")
    query_parser.add_argument("--status", help="按状态筛选", choices=[s.value for s in DonationStatus])
    query_parser.add_argument("--exception-type", help="按异常类型筛选", choices=[e.value for e in ExceptionType])
    query_parser.add_argument("--batch-id", help="按批次筛选")
    query_parser.add_argument("--is-duplicate", type=bool, help="是否只查询重复记录")
    query_parser.add_argument("--page", type=int, default=1, help="页码")
    query_parser.add_argument("--page-size", type=int, default=100, help="每页数量")
    query_parser.add_argument("--export", help="导出到CSV文件路径")

    history_parser = subparsers.add_parser("history", help="查询操作历史")
    history_parser.add_argument("--operation-type", help="按操作类型筛选")
    history_parser.add_argument("--batch-id", help="按批次筛选")
    history_parser.add_argument("--operator", help="按操作人筛选")
    history_parser.add_argument("--start-date", help="开始日期 (ISO格式)")
    history_parser.add_argument("--end-date", help="结束日期 (ISO格式)")
    history_parser.add_argument("--page", type=int, default=1, help="页码")
    history_parser.add_argument("--page-size", type=int, default=100, help="每页数量")

    isbn_parser = subparsers.add_parser("add-isbn", help="添加ISBN标准信息")
    isbn_parser.add_argument("--isbn", required=True, help="ISBN")
    isbn_parser.add_argument("--title", required=True, help="书名")
    isbn_parser.add_argument("--author", help="作者")
    isbn_parser.add_argument("--publisher", help="出版社")
    isbn_parser.add_argument("--publish-date", help="出版日期")
    isbn_parser.add_argument("--suggested-grades", help="适用年级")
    isbn_parser.add_argument("--category", help="分类")

    args = parser.parse_args()

    if args.command == "import":
        cmd_import(args)
    elif args.command == "deduplicate":
        cmd_deduplicate(args)
    elif args.command == "shelf-list":
        cmd_shelf_list(args)
    elif args.command == "query":
        cmd_query(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "add-isbn":
        cmd_add_isbn_info(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
