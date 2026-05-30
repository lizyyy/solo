import argparse
import sys
import json
import os
from typing import Dict, List, Optional

from models import STANDARD_FREQUENCIES, FREQUENCY_LABELS
from acoustics_service import AcousticsService


class AcousticsCLI:
    def __init__(self, data_dir: str = "data"):
        self.service = AcousticsService(data_dir)

    def run(self):
        parser = argparse.ArgumentParser(
            description="声学混响时间计算工具 (Acoustics Reverberation Time Calculator)",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例用法:
  # 创建房间
  python cli.py create-room --name "录音棚A" --length 8 --width 6 --height 3 --operator "张工"
  
  # 添加材料
  python cli.py add-material --room-id <房间ID> --name "矿棉板" --area 24 --unit m2 \\
      --absorption 125:0.2,250:0.4,500:0.7,1000:0.9,2000:0.95,4000:0.9
  
  # 计算混响时间
  python cli.py calculate --room-id <房间ID>
  
  # 批量处理
  python cli.py batch-process
  
  # 查看频段分析
  python cli.py analyze --room-id <房间ID>
  
  # 查看历史记录
  python cli.py history --room-id <房间ID>
  
  # 导出CSV
  python cli.py export-csv --output results.csv
  
  # 数据完整性校验
  python cli.py verify
            """
        )
        subparsers = parser.add_subparsers(dest="command", help="可用命令")

        create_room_parser = subparsers.add_parser("create-room", help="创建新房间")
        create_room_parser.add_argument("--name", required=True, help="房间名称")
        create_room_parser.add_argument("--length", type=float, required=True, help="长度 (米)")
        create_room_parser.add_argument("--width", type=float, required=True, help="宽度 (米)")
        create_room_parser.add_argument("--height", type=float, required=True, help="高度 (米)")
        create_room_parser.add_argument("--operator", default="system", help="操作人")
        create_room_parser.add_argument("--notes", default="", help="备注")

        add_material_parser = subparsers.add_parser("add-material", help="添加吸声材料")
        add_material_parser.add_argument("--room-id", required=True, help="房间ID")
        add_material_parser.add_argument("--name", required=True, help="材料名称")
        add_material_parser.add_argument("--area", type=float, required=True, help="材料面积")
        add_material_parser.add_argument("--unit", default="m2", help="面积单位 (m2, cm2, ft2)")
        add_material_parser.add_argument(
            "--absorption", required=True,
            help="吸声系数，格式: 125:0.2,250:0.4,500:0.7,1000:0.9,2000:0.95,4000:0.9"
        )
        add_material_parser.add_argument("--operator", default="system", help="操作人")

        update_material_parser = subparsers.add_parser("update-material", help="更新材料信息")
        update_material_parser.add_argument("--room-id", required=True, help="房间ID")
        update_material_parser.add_argument("--material-id", required=True, help="材料ID")
        update_material_parser.add_argument("--name", help="新的材料名称")
        update_material_parser.add_argument("--area", type=float, help="新的面积")
        update_material_parser.add_argument("--unit", help="新的面积单位")
        update_material_parser.add_argument(
            "--absorption",
            help="吸声系数，格式: 125:0.3,500:0.8"
        )
        update_material_parser.add_argument("--operator", default="system", help="操作人")

        remove_material_parser = subparsers.add_parser("remove-material", help="移除材料")
        remove_material_parser.add_argument("--room-id", required=True, help="房间ID")
        remove_material_parser.add_argument("--material-id", required=True, help="材料ID")
        remove_material_parser.add_argument("--operator", default="system", help="操作人")

        calculate_parser = subparsers.add_parser("calculate", help="计算混响时间")
        calculate_parser.add_argument("--room-id", required=True, help="房间ID")
        calculate_parser.add_argument("--operator", default="system", help="操作人")

        batch_parser = subparsers.add_parser("batch-process", help="批量处理所有房间")
        batch_parser.add_argument("--room-ids", help="指定房间ID，逗号分隔，不指定则处理所有")
        batch_parser.add_argument("--operator", default="system", help="操作人")
        batch_parser.add_argument("--output", help="输出结果到JSON文件")

        list_parser = subparsers.add_parser("list-rooms", help="列出所有房间")
        list_parser.add_argument("--format", choices=["table", "json"], default="table", help="输出格式")

        analyze_parser = subparsers.add_parser("analyze", help="频段对比分析")
        analyze_parser.add_argument("--room-id", required=True, help="房间ID")
        analyze_parser.add_argument("--format", choices=["table", "json"], default="table", help="输出格式")

        history_parser = subparsers.add_parser("history", help="查看修改历史")
        history_parser.add_argument("--room-id", required=True, help="房间ID")
        history_parser.add_argument("--format", choices=["table", "json"], default="table", help="输出格式")

        manual_edit_parser = subparsers.add_parser("manual-edit", help="记录人工修改")
        manual_edit_parser.add_argument("--room-id", required=True, help="房间ID")
        manual_edit_parser.add_argument("--field", required=True, help="修改的字段名")
        manual_edit_parser.add_argument("--old-value", required=True, help="原值")
        manual_edit_parser.add_argument("--new-value", required=True, help="新值")
        manual_edit_parser.add_argument("--operator", required=True, help="操作人")
        manual_edit_parser.add_argument("--reason", required=True, help="修改原因")

        export_csv_parser = subparsers.add_parser("export-csv", help="导出为CSV")
        export_csv_parser.add_argument("--output", required=True, help="输出文件路径")
        export_csv_parser.add_argument("--room-ids", help="指定房间ID，逗号分隔")

        export_json_parser = subparsers.add_parser("export-json", help="导出为JSON")
        export_json_parser.add_argument("--output", required=True, help="输出文件路径")
        export_json_parser.add_argument("--room-ids", help="指定房间ID，逗号分隔")

        import_parser = subparsers.add_parser("import", help="从JSON导入数据")
        import_parser.add_argument("--input", required=True, help="输入文件路径")
        import_parser.add_argument("--overwrite", action="store_true", help="覆盖现有数据")

        verify_parser = subparsers.add_parser("verify", help="校验数据完整性")

        get_room_parser = subparsers.add_parser("get-room", help="查看房间详情")
        get_room_parser.add_argument("--room-id", required=True, help="房间ID")

        get_result_parser = subparsers.add_parser("get-result", help="查看计算结果")
        get_result_parser.add_argument("--room-id", required=True, help="房间ID")

        args = parser.parse_args()

        if args.command is None:
            parser.print_help()
            sys.exit(1)

        self._execute_command(args)

    def _execute_command(self, args):
        handlers = {
            "create-room": self._handle_create_room,
            "add-material": self._handle_add_material,
            "update-material": self._handle_update_material,
            "remove-material": self._handle_remove_material,
            "calculate": self._handle_calculate,
            "batch-process": self._handle_batch_process,
            "list-rooms": self._handle_list_rooms,
            "analyze": self._handle_analyze,
            "history": self._handle_history,
            "manual-edit": self._handle_manual_edit,
            "export-csv": self._handle_export_csv,
            "export-json": self._handle_export_json,
            "import": self._handle_import,
            "verify": self._handle_verify,
            "get-room": self._handle_get_room,
            "get-result": self._handle_get_result,
        }

        handler = handlers.get(args.command)
        if handler:
            try:
                handler(args)
            except Exception as e:
                print(f"\n❌ 错误: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"未知命令: {args.command}", file=sys.stderr)
            sys.exit(1)

    def _parse_absorption(self, absorption_str: str) -> Dict[int, float]:
        result = {}
        pairs = absorption_str.split(",")
        for pair in pairs:
            freq_str, alpha_str = pair.split(":")
            freq = int(freq_str.strip())
            alpha = float(alpha_str.strip())
            if freq not in STANDARD_FREQUENCIES:
                print(f"⚠️  警告: 频率 {freq}Hz 不在标准频段 {STANDARD_FREQUENCIES} 中", file=sys.stderr)
            result[freq] = alpha
        return result

    def _print_issues(self, issues):
        if not issues:
            return

        errors = [i for i in issues if i.severity == "error"]
        warnings = [i for i in issues if i.severity == "warning"]

        if errors:
            print("\n❌ 错误:")
            for e in errors:
                print(f"  [{e.type}] {e.related_object}: {e.message}")

        if warnings:
            print("\n⚠️  警告:")
            for w in warnings:
                print(f"  [{w.type}] {w.related_object}: {w.message}")

    def _handle_create_room(self, args):
        room, issues = self.service.create_room(
            name=args.name,
            length=args.length,
            width=args.width,
            height=args.height,
            operator=args.operator,
            notes=args.notes
        )

        print(f"\n✅ 房间创建成功!")
        print(f"   房间ID: {room.id}")
        print(f"   房间名称: {room.name}")
        print(f"   尺寸: {room.length} x {room.width} x {room.height} m")
        print(f"   体积: {room.volume:.2f} m³")
        print(f"   表面积: {room.surface_area:.2f} m²")
        print(f"   状态: {room.status}")

        self._print_issues(issues)

    def _handle_add_material(self, args):
        absorption = self._parse_absorption(args.absorption)
        room, issues = self.service.add_material(
            room_id=args.room_id,
            material_name=args.name,
            area=args.area,
            unit=args.unit,
            absorption_coefficients=absorption,
            operator=args.operator
        )

        if room is None:
            print(f"❌ 添加材料失败", file=sys.stderr)
            self._print_issues(issues)
            sys.exit(1)

        material = room.materials[-1]
        print(f"\n✅ 材料添加成功!")
        print(f"   材料ID: {material.id}")
        print(f"   材料名称: {material.name}")
        print(f"   面积: {material.area} {material.unit}")
        print(f"   吸声系数: {material.absorption_coefficients}")
        print(f"   房间当前状态: {room.status}")

        self._print_issues(issues)

        if room.status == "ready":
            result = self.service.storage.get_result(room.id)
            if result:
                print(f"\n📊 自动计算结果:")
                print(f"   平均混响时间: {result.average_t60:.3f} s")
                for freq in STANDARD_FREQUENCIES:
                    t60 = result.t60_by_frequency.get(freq, 0)
                    print(f"   {FREQUENCY_LABELS[freq]}: {t60:.3f} s")

    def _handle_update_material(self, args):
        absorption = self._parse_absorption(args.absorption) if args.absorption else None
        room, issues = self.service.update_material(
            room_id=args.room_id,
            material_id=args.material_id,
            material_name=args.name,
            area=args.area,
            unit=args.unit,
            absorption_coefficients=absorption,
            operator=args.operator
        )

        if room is None:
            print(f"❌ 更新材料失败", file=sys.stderr)
            self._print_issues(issues)
            sys.exit(1)

        print(f"\n✅ 材料更新成功!")
        print(f"   房间当前状态: {room.status}")

        self._print_issues(issues)

        if room.status == "ready":
            result = self.service.storage.get_result(room.id)
            if result:
                print(f"\n📊 重新计算结果:")
                print(f"   平均混响时间: {result.average_t60:.3f} s")

    def _handle_remove_material(self, args):
        room, issues = self.service.remove_material(
            room_id=args.room_id,
            material_id=args.material_id,
            operator=args.operator
        )

        if room is None:
            print(f"❌ 移除材料失败", file=sys.stderr)
            self._print_issues(issues)
            sys.exit(1)

        print(f"\n✅ 材料移除成功!")
        print(f"   房间当前状态: {room.status}")

        self._print_issues(issues)

        if room.status == "ready":
            result = self.service.storage.get_result(room.id)
            if result:
                print(f"\n📊 重新计算结果:")
                print(f"   平均混响时间: {result.average_t60:.3f} s")

    def _handle_calculate(self, args):
        result, issues = self.service.calculate_reverberation(
            room_id=args.room_id,
            operator=args.operator
        )

        if result is None:
            print(f"❌ 计算失败", file=sys.stderr)
            self._print_issues(issues)
            sys.exit(1)

        print(f"\n📊 混响时间计算结果")
        print(f"   房间: {result.room_name}")
        print(f"   Sabine公式适用: {'是' if result.sabine_formula_applied else '否'}")
        print(f"   平均T60: {result.average_t60:.3f} s")
        print(f"\n   各频段混响时间:")
        for freq in STANDARD_FREQUENCIES:
            t60 = result.t60_by_frequency.get(freq, 0)
            absorption = result.total_absorption_by_frequency.get(freq, 0)
            print(f"   {FREQUENCY_LABELS[freq]:>6}: {t60:.3f} s (吸声量: {absorption:.2f} sabins)")

        self._print_issues(issues)

    def _handle_batch_process(self, args):
        room_ids = args.room_ids.split(",") if args.room_ids else None
        batch_result = self.service.batch_process(room_ids, args.operator)

        print(f"\n📦 批量处理完成")
        print(f"   总计处理: {batch_result['total_processed']} 个房间")
        print(f"   正常记录: {batch_result['normal_count']} 个")
        print(f"   问题记录: {batch_result['problem_count']} 个")

        if batch_result["normal_records"]:
            print(f"\n✅ 正常记录:")
            for record in batch_result["normal_records"]:
                result = record["result"]
                print(f"   - {record['room_name']} (ID: {record['room_id']})")
                print(f"     平均T60: {result['average_t60']:.3f} s")
                if record["warnings"]:
                    for w in record["warnings"]:
                        print(f"     ⚠️  {w['related_object']}: {w['message']}")

        if batch_result["problem_records"]:
            print(f"\n❌ 问题记录:")
            for record in batch_result["problem_records"]:
                print(f"   - {record['room_name']} (ID: {record['room_id']})")
                if record.get("status") == "no_materials":
                    print(f"     原因: 未添加材料")
                if "errors" in record:
                    for e in record["errors"]:
                        print(f"     ❌ {e['related_object']}: {e['message']}")
                if record.get("warnings"):
                    for w in record["warnings"]:
                        print(f"     ⚠️  {w['related_object']}: {w['message']}")

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(batch_result, f, ensure_ascii=False, indent=2)
            print(f"\n💾 结果已保存到: {args.output}")

    def _handle_list_rooms(self, args):
        rooms = self.service.get_all_rooms_summary()

        if not rooms:
            print("暂无房间数据")
            return

        if args.format == "json":
            print(json.dumps(rooms, ensure_ascii=False, indent=2))
            return

        print(f"\n{'房间ID':<38} {'名称':<15} {'尺寸':<18} {'体积(m³)':<10} {'材料数':<6} {'状态':<18} {'平均T60(s)':<10}")
        print("-" * 120)
        for r in rooms:
            t60_str = f"{r['average_t60']:.3f}" if r['average_t60'] else "N/A"
            status_str = r['status'] + (" ⚠️" if r['has_errors'] else "")
            print(f"{r['room_id']:<38} {r['name']:<15} {r['dimensions']:<18} {r['volume']:<10.2f} {r['material_count']:<6} {status_str:<18} {t60_str:<10}")

    def _handle_analyze(self, args):
        analysis = self.service.get_frequency_analysis(args.room_id)

        if analysis is None:
            print(f"❌ 未找到房间或计算结果", file=sys.stderr)
            sys.exit(1)

        if args.format == "json":
            print(json.dumps(analysis, ensure_ascii=False, indent=2))
            return

        print(f"\n📈 频段对比分析")
        print(f"   房间: {analysis['room_name']}")
        print(f"   尺寸: {analysis['room_dimensions']}")
        print(f"   体积: {analysis['room_volume']:.2f} m³")
        print(f"   表面积: {analysis['surface_area']:.2f} m²")
        print(f"   Sabine公式适用: {'是' if analysis['sabine_applicable'] else '否'}")
        if analysis['sabine_notes']:
            for note in analysis['sabine_notes']:
                print(f"   📝 {note}")
        print(f"   平均T60: {analysis['average_t60']:.3f} s")
        print(f"   计算时间: {analysis['calculation_timestamp']}")
        print(f"   错误: {analysis['error_count']}, 警告: {analysis['warning_count']}")

        print(f"\n{'频段':<8} {'T60(s)':<10} {'吸声量(sabins)':<16} {'与均值偏差(s)':<14} 主要材料贡献")
        print("-" * 90)
        for fd in analysis['frequency_data']:
            t60_str = fd['t60_seconds'] if isinstance(fd['t60_seconds'], str) else f"{fd['t60_seconds']:.3f}"
            top_materials = fd['material_breakdown'][:2]
            contrib_str = ", ".join([f"{m['material_name']}({m['contribution_percent']:.0f}%)" for m in top_materials])
            print(f"{fd['frequency_label']:<8} {t60_str:<10} {fd['total_absorption_sabins']:<16.3f} {fd['deviation_from_average']:<+14.3f} {contrib_str}")

    def _handle_history(self, args):
        history = self.service.get_room_history(args.room_id)

        if not history:
            print("暂无历史记录")
            return

        if args.format == "json":
            print(json.dumps(history, ensure_ascii=False, indent=2))
            return

        print(f"\n📜 修改历史记录 (房间ID: {args.room_id})")
        print("-" * 120)
        print(f"{'时间':<25} {'操作':<14} {'字段':<25} {'操作人':<10} 变更内容")
        print("-" * 120)
        for entry in history:
            field = entry['field'] or "-"
            old = entry['old_value'] or "-"
            new = entry['new_value'] or "-"
            change_str = f"{old[:30]} → {new[:30]}"
            print(f"{entry['timestamp']:<25} {entry['operation']:<14} {field:<25} {entry['operator']:<10} {change_str}")
            if entry['reason']:
                print(f"{'':<25} {'':<14} {'':<25} {'':<10} 原因: {entry['reason']}")

    def _handle_manual_edit(self, args):
        success = self.service.manual_edit(
            room_id=args.room_id,
            field_name=args.field,
            old_value=args.old_value,
            new_value=args.new_value,
            operator=args.operator,
            reason=args.reason
        )

        if success:
            print(f"\n✅ 人工修改已记录到历史")
            print(f"   字段: {args.field}")
            print(f"   原值: {args.old_value}")
            print(f"   新值: {args.new_value}")
            print(f"   原因: {args.reason}")
        else:
            print(f"❌ 记录失败，房间不存在", file=sys.stderr)
            sys.exit(1)

    def _handle_export_csv(self, args):
        room_ids = args.room_ids.split(",") if args.room_ids else None
        result = self.service.export_to_csv(args.output, room_ids)
        print(f"\n💾 CSV导出完成")
        print(f"   文件: {result['filepath']}")
        print(f"   导出记录: {result['exported_count']} 条")

    def _handle_export_json(self, args):
        room_ids = args.room_ids.split(",") if args.room_ids else None
        result = self.service.export_to_json(args.output, room_ids)
        print(f"\n💾 JSON导出完成")
        print(f"   文件: {result['filepath']}")
        print(f"   房间: {result['rooms_count']} 个")
        print(f"   计算结果: {result['results_count']} 条")
        print(f"   历史记录: {result['history_entries']} 条")

    def _handle_import(self, args):
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)

        report = self.service.storage.import_data(data, overwrite=args.overwrite)
        print(f"\n📥 导入完成")
        print(f"   导入房间: {report['rooms_imported']} 个")
        print(f"   导入结果: {report['results_imported']} 条")
        print(f"   导入历史: {report['history_imported']} 条")
        if report['skipped']:
            print(f"   跳过: {len(report['skipped'])} 项")
            for s in report['skipped']:
                print(f"     - {s}")

    def _handle_verify(self, args):
        result = self.service.verify_integrity()
        print(f"\n🔍 数据完整性校验")
        print(f"   校验和有效: {'✅ 是' if result['checksums_valid'] else '❌ 否'}")
        if not result['checksums_valid']:
            for name, valid in result['checksum_details'].items():
                status = "✅" if valid else "❌"
                print(f"   {name}: {status}")
        print(f"   房间总数: {result['total_rooms']}")
        print(f"   结果总数: {result['total_results']}")
        if result['rooms_without_results']:
            print(f"   无计算结果的房间: {len(result['rooms_without_results'])}")
            for rid in result['rooms_without_results']:
                room = self.service.storage.get_room(rid)
                if room:
                    print(f"     - {room.name} ({rid})")
        if result['results_without_rooms']:
            print(f"   无对应房间的结果: {len(result['results_without_rooms'])}")
            for rid in result['results_without_rooms']:
                print(f"     - {rid}")

        if result['checksums_valid']:
            print("\n✅ 数据完整性校验通过，重启后数据一致")
        else:
            print("\n❌ 数据可能已被篡改，请检查", file=sys.stderr)
            sys.exit(1)

    def _handle_get_room(self, args):
        room = self.service.storage.get_room(args.room_id)
        if not room:
            print(f"❌ 房间不存在", file=sys.stderr)
            sys.exit(1)

        print(f"\n🏠 房间详情")
        print(f"   ID: {room.id}")
        print(f"   名称: {room.name}")
        print(f"   尺寸: {room.length} x {room.width} x {room.height} m")
        print(f"   体积: {room.volume:.2f} m³")
        print(f"   表面积: {room.surface_area:.2f} m²")
        print(f"   状态: {room.status}")
        print(f"   创建时间: {room.created_at}")
        print(f"   更新时间: {room.updated_at}")
        if room.notes:
            print(f"   备注: {room.notes}")

        if room.materials:
            print(f"\n   材料列表 ({len(room.materials)} 种):")
            for m in room.materials:
                print(f"   - {m.name} (ID: {m.id})")
                print(f"     面积: {m.area} {m.unit}")
                print(f"     吸声系数: {m.absorption_coefficients}")
        else:
            print(f"\n   暂无材料")

    def _handle_get_result(self, args):
        result = self.service.storage.get_result(args.room_id)
        if not result:
            print(f"❌ 暂无计算结果", file=sys.stderr)
            sys.exit(1)

        room = self.service.storage.get_room(args.room_id)
        room_name = room.name if room else "未知"

        print(f"\n📊 计算结果")
        print(f"   房间: {room_name}")
        print(f"   房间ID: {result.room_id}")
        print(f"   Sabine公式适用: {'是' if result.sabine_formula_applied else '否'}")
        print(f"   平均T60: {result.average_t60:.3f} s")
        print(f"   计算时间: {result.calculation_timestamp}")

        print(f"\n   各频段结果:")
        for freq in STANDARD_FREQUENCIES:
            t60 = result.t60_by_frequency.get(freq, 0)
            absorption = result.total_absorption_by_frequency.get(freq, 0)
            print(f"   {FREQUENCY_LABELS[freq]:>6}: T60={t60:.3f}s, 吸声量={absorption:.2f}sabins")

        if result.issues:
            print(f"\n   问题 ({len(result.issues)}):")
            for issue in result.issues:
                icon = "❌" if issue.severity == "error" else "⚠️"
                print(f"   {icon} [{issue.type}] {issue.related_object}: {issue.message}")


def main():
    cli = AcousticsCLI()
    cli.run()


if __name__ == "__main__":
    main()
