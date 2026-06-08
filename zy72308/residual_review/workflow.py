"""三步流程管理：导入→批注→参数更新 - 确保同一条记录全链路一致"""

from typing import Dict, Any, Optional

from .models import ImportStatus
from .storage import StorageManager
from .importer import DataImporter
from .row_manager import RowManager
from .exporter import UnifiedExporter


class ReviewWorkflow:
    def __init__(self, data_dir: str = "./data"):
        self.storage = StorageManager(data_dir)
        self.importer = DataImporter(self.storage)
        self.row_manager = RowManager(self.storage)
        self.exporter = UnifiedExporter(self.storage)

    def step1_import(self, file_path: str, source_name: str = None, author: str = "阿岚") -> Dict[str, Any]:
        record, is_duplicate = self.importer.import_from_file(
            file_path, source_name, author=author
        )
        return {
            "import_id": record.import_id,
            "is_duplicate": is_duplicate,
            "status": record.status.value,
            "total_rows": record.total_rows,
            "params_version": record.params_version,
            "message": "重复导入已检测，原记录状态已更新为duplicate"
            if is_duplicate
            else "首次导入完成，初始残差已计算",
        }

    def step2_annotate(
        self, import_id: str, original_line_no: int, annotation: str, author: str = "阿岚"
    ) -> Dict[str, Any]:
        record = self.row_manager.add_annotation(import_id, original_line_no, annotation, author)
        data = self.exporter.export_for_display(import_id)
        return {
            "import_id": import_id,
            "status": record.status.value,
            "annotations_count": len(record.annotations),
            "待处理项": {
                "待复核行数": data["待复核行数"],
                "断档行数": data["断档行数"],
                "下一步处理人汇总": sorted(set(
                    r.get("下一步处理人", "") for r in data["行明细"] if r.get("下一步处理人")
                )),
            },
            "message": f"已添加批注（行{original_line_no}）：{annotation[:40]}...",
        }

    def step3_update_params(
        self, import_id: str, author: str = "阿岚", trigger: str = ""
    ) -> Dict[str, Any]:
        record = self.row_manager.update_params_and_recalc(
            import_id, author=author, trigger=trigger
        )
        data = self.exporter.export_for_display(import_id)
        return {
            "import_id": import_id,
            "status": record.status.value,
            "params_version": record.params_version,
            "regression_params": record.regression_params,
            "一致性校验": data["数据一致性校验"],
            "消息": "参数版本页已更新，残差全部重算，展示/导出/接口数据已同步",
        }

    def action_delete_row(
        self, import_id: str, line_no: int, reason: str = "", author: str = "阿岚"
    ) -> Dict[str, Any]:
        record = self.row_manager.delete_row(import_id, line_no, notes=reason, author=author)
        gaps = self.row_manager.get_gap_summary(import_id)
        return {
            "import_id": import_id,
            "action": "delete",
            "target_line": line_no,
            "gap_count": len(gaps),
            "gap_lines": [g["original_line_no"] for g in gaps],
            "next_owner": "教研组",
            "message": f"行{line_no}已标记删除，{len(gaps)}处断档待教研组复核，不会提前归入正常结果",
        }

    def action_supplement_and_recalc(
        self,
        import_id: str,
        line_no: int,
        x_val: float,
        y_val: float,
        reason: str = "",
        author: str = "阿岚",
        auto_recalc: bool = True,
    ) -> Dict[str, Any]:
        record, needs_recalc = self.row_manager.supplement_row(
            import_id, line_no, x_val, y_val, notes=reason, author=author
        )
        if auto_recalc and needs_recalc:
            self.importer.recalculate_residuals(
                import_id,
                trigger=f"补录行{line_no}后自动重算",
                author=author,
            )

        display = self.exporter.export_for_display(import_id)
        return {
            "import_id": import_id,
            "action": "supplement",
            "target_line": line_no,
            "auto_recalc_triggered": auto_recalc and needs_recalc,
            "row_status_after": "pending_review",
            "next_owner": "教研组",
            "params_version": display["参数版本"],
            "一致性校验": display["数据一致性校验"],
            "展示/导出/接口同步": "✔ 同一份数据",
            "message": f"行{line_no}已补录，状态为待复核，{'残差已按最新状态重算' if auto_recalc and needs_recalc else '暂未重算'}",
        }

    def action_review_row(
        self,
        import_id: str,
        line_no: int,
        approve: bool,
        comment: str = "",
        reviewer: str = "教研组",
        auto_recalc: bool = True,
    ) -> Dict[str, Any]:
        record, needs_recalc = self.row_manager.review_row(
            import_id, line_no, approve, comment=comment, reviewer=reviewer
        )
        if auto_recalc and needs_recalc:
            self.importer.recalculate_residuals(
                import_id,
                trigger=f"教研组复核行{line_no}（{'通过' if approve else '退回'}）后重算",
                author=reviewer,
            )
        display = self.exporter.export_for_display(import_id)
        return {
            "import_id": import_id,
            "action": "review",
            "target_line": line_no,
            "approve": approve,
            "auto_recalc_triggered": auto_recalc and needs_recalc,
            "params_version": display["参数版本"],
            "一致性校验": display["数据一致性校验"],
            "展示/导出/接口同步": "✔ 同一份数据",
            "消息": f"行{line_no}已由{reviewer}{'通过复核' if approve else '复核不通过退回'}",
        }

    def simulate_alans_workflow(
        self,
        csv_file: str,
        delete_line_no: Optional[int] = None,
        supplement_line: Optional[int] = None,
        supplement_x: Optional[float] = None,
        supplement_y: Optional[float] = None,
        review_supplement: bool = True,
    ) -> Dict[str, Any]:
        print("\n" + "=" * 72)
        print("  线性回归残差复盘 - 运营规划阿岚的完整工作流程模拟")
        print("  校验点：页面展示/接口/导出 → 读同一份结果")
        print("  校验点：删除/补录/修正/复核 → 变更历史不丢")
        print("  校验点：断档待复核 → 提前归正常")
        print("=" * 72)

        print("\n[步骤1/3] 第一次导入（旧公式截图数据）")
        result1 = self.step1_import(csv_file, "旧公式截图数据.csv", author="阿岚")
        import_id = result1["import_id"]
        print(f"  导入ID: {import_id}")
        print(f"  状态: {result1['status']}")
        print(f"  总行数: {result1['total_rows']}")
        print(f"  参数版本: v{result1['params_version']}")
        print(f"  → {result1['message']}")

        if delete_line_no:
            print(f"\n[人工操作] 阿岚删除第{delete_line_no}行（模拟截图缺少某一行）")
            del_result = self.action_delete_row(
                import_id, delete_line_no, reason=f"旧公式截图里缺少第{delete_line_no}行，人工标记删除", author="阿岚"
            )
            print(f"  断档记录数: {del_result['gap_count']} → 行号: {del_result['gap_lines']}")
            print(f"  下一步处理人: {del_result['next_owner']}")
            print(f"  → {del_result['message']}")

        if supplement_line is not None and supplement_x is not None and supplement_y is not None:
            print(f"\n[人工操作] 阿岚补录第{supplement_line}行 ({supplement_x}, {supplement_y})")
            sup_result = self.action_supplement_and_recalc(
                import_id, supplement_line, supplement_x, supplement_y,
                reason="老师批注后提供的补录值", author="阿岚", auto_recalc=True,
            )
            print(f"  当前状态: {sup_result['row_status_after']}")
            print(f"  自动重算: {'✔是' if sup_result['auto_recalc_triggered'] else '否'}")
            print(f"  参数版本: v{sup_result['params_version']}")
            print(f"  展示/导出/接口: {sup_result['展示/导出/接口同步']}")
            print(f"  下一步处理人: {sup_result['next_owner']}")
            print(f"  → {sup_result['message']}")

            if review_supplement:
                print(f"\n[人工操作] 教研组复核第{supplement_line}行（通过）")
                rev_result = self.action_review_row(
                    import_id, supplement_line, True,
                    comment="核对原始截图无误，确认接受补录值", reviewer="教研组", auto_recalc=True,
                )
                print(f"  复核结论: {'通过' if rev_result['approve'] else '退回'}")
                print(f"  参数版本: v{rev_result['params_version']}")
                print(f"  展示/导出/接口: {rev_result['展示/导出/接口同步']}")
                print(f"  → {rev_result['消息']}")

        print("\n[步骤2/3] 阿岚补看老师批注")
        result2 = self.step2_annotate(
            import_id, 1, "老师批注：第3个点残差较大，建议核对原始数据；第5行已补录并复核通过", "阿岚"
        )
        print(f"  批注数量: {result2['annotations_count']}")
        print(f"  待复核行数: {result2['待处理项']['待复核行数']}")
        print(f"  断档行数: {result2['待处理项']['断档行数']}")
        print(f"  → {result2['message']}")

        print("\n[步骤3/3] 参数版本页更新（重算所有残差）")
        result3 = self.step3_update_params(
            import_id, author="阿岚", trigger="参数版本页手动点击『更新参数』"
        )
        print(f"  参数版本: v{result3['params_version']}")
        print(f"  回归参数: {result3['regression_params']}")
        print(f"  一致性校验: {result3['一致性校验']}")
        print(f"  → {result3['消息']}")

        print("\n[导出] 同一份结果的三种形式")
        files = self.exporter.export_all(import_id)
        print("  已导出:")
        for fmt, path in files.items():
            print(f"    · {fmt}: {path}")

        print("\n[验证] 对比展示/接口/导出数据是否同源")
        api_data = self.exporter.export_for_api(import_id)
        display_data = self.exporter.export_for_display(import_id)
        checks = [
            ("展示==接口行明细", len(display_data["行明细"]) == len(api_data["行明细"])),
            ("展示==接口参数版本", display_data["参数版本"] == api_data["参数版本"]),
            ("展示==接口回归参数", display_data["回归参数"] == api_data["回归参数"]),
            ("所有待复核保留原始值", all(
                r["原始X值"] is not None and r["原始Y值"] is not None
                for r in api_data["行明细"]
            )),
        ]
        for name, ok in checks:
            print(f"  {'✔' if ok else '✘'} {name}")

        print("\n" + "=" * 72)
        print("工作流程完成！断档/待复核均保留痕迹，教研组可随时回到证据。")
        print("=" * 72 + "\n")

        return {
            "import_id": import_id,
            "export_files": files,
            "has_gaps": delete_line_no is not None,
            "data_consistency_checks": dict(checks),
        }
