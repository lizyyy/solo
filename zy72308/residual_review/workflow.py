"""三步流程管理：导入→批注→参数更新"""

from typing import Dict, Any

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

    def step1_import(self, csv_file: str, source_name: str = None) -> Dict[str, Any]:
        record, is_duplicate = self.importer.import_from_csv(csv_file, source_name)
        return {
            "import_id": record.import_id,
            "is_duplicate": is_duplicate,
            "status": record.status.value,
            "total_rows": record.total_rows,
            "message": "重复导入已检测" if is_duplicate else "首次导入完成",
        }

    def step2_annotate(
        self, import_id: str, original_line_no: int, annotation: str, author: str = "阿岚"
    ) -> Dict[str, Any]:
        record = self.row_manager.add_annotation(import_id, original_line_no, annotation, author)
        return {
            "import_id": import_id,
            "status": record.status.value,
            "annotations_count": len(record.annotations),
            "message": f"已添加批注: {annotation}",
        }

    def step3_update_params(self, import_id: str) -> Dict[str, Any]:
        record = self.importer.recalculate_residuals(import_id)
        record.status = ImportStatus.PARAMS_UPDATED
        self.storage.save_record(record)
        return {
            "import_id": import_id,
            "status": record.status.value,
            "params_version": record.params_version,
            "regression_params": record.regression_params,
            "message": "参数已更新，残差已重算",
        }

    def simulate_alans_workflow(self, csv_file: str, delete_line_no: int = None) -> Dict[str, Any]:
        print("\n" + "=" * 60)
        print("运营规划阿岚的工作流程模拟")
        print("=" * 60)

        print("\n[步骤1] 导入旧公式截图的CSV数据...")
        result1 = self.step1_import(csv_file, "旧公式截图数据.csv")
        import_id = result1["import_id"]
        print(f"  导入ID: {import_id}")
        print(f"  状态: {result1['status']}")
        print(f"  总行数: {result1['total_rows']}")

        if delete_line_no:
            print(f"\n[人工操作] 阿岚删除第{delete_line_no}行（模拟截图中少了一行）...")
            self.row_manager.delete_row(
                import_id, delete_line_no, f"阿岚人工删除，原始截图中缺少第{delete_line_no}行"
            )
            gaps = self.row_manager.get_gap_summary(import_id)
            print(f"  检测到断档: {len(gaps)} 处")
            for gap in gaps:
                print(f"    - 原始行号{gap['original_line_no']}: {gap['notes']}")

        print("\n[步骤2] 阿岚补看老师批注...")
        result2 = self.step2_annotate(
            import_id, 1, "老师批注：注意第3个点残差较大，需要复核", "阿岚"
        )
        print(f"  批注数量: {result2['annotations_count']}")
        print(f"  状态: {result2['status']}")

        print("\n[步骤3] 参数版本页更新...")
        result3 = self.step3_update_params(import_id)
        print(f"  参数版本: v{result3['params_version']}")
        print(f"  回归参数: {result3['regression_params']}")
        print(f"  状态: {result3['status']}")

        print("\n[导出] 生成复盘记录...")
        export_files = self.exporter.export_all(import_id)
        print("  导出文件:")
        for fmt, path in export_files.items():
            print(f"    - {fmt}: {path}")

        print("\n" + "=" * 60)
        print("工作流程完成！断档记录已保留待教研组复核")
        print("=" * 60 + "\n")

        return {
            "import_id": import_id,
            "export_files": export_files,
            "has_gaps": delete_line_no is not None,
        }
