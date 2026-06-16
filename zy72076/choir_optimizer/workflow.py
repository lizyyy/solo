"""核心工作流编排模块 - 串联所有处理环节"""
import json
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from .data_import import DataImporter
from .params import ParameterManager
from .calculator import CalculationEngine
from .anomaly import AnomalyDetector
from .conflict import ConflictDetector
from .supplement import SupplementManager
from .charts import ChartGenerator
from .report import ReportGenerator
from .database import get_db, RAW_RECORDS_TABLE, CALCULATIONS_TABLE, CALC_STEPS_TABLE


class ChoirOptimizationWorkflow:
    """合唱声部排练优化完整工作流"""

    def __init__(self, batch_id: Optional[str] = None):
        self.db = get_db()
        self.batch_id = batch_id or self.db.new_batch_id()
        self.importer = DataImporter(self.batch_id)
        self.param_manager = ParameterManager()
        self.calculator = CalculationEngine(self.batch_id)
        self.anomaly_detector = AnomalyDetector(self.batch_id)
        self.conflict_detector = ConflictDetector(self.batch_id)
        self.supplement_manager = SupplementManager(self.batch_id)
        self.chart_generator = ChartGenerator(self.batch_id)
        self.report_generator = ReportGenerator(self.batch_id)
        self._original_df: Optional[pd.DataFrame] = None
        self._calc_results: Optional[Dict] = None
        self._anomaly_summary: Optional[Dict] = None
        self._conflict_summary: Optional[Dict] = None
        self._supplement_summary: Optional[Dict] = None
        self._review_data: Optional[Dict] = None

    def step1_import_data(self, data_dir: str,
                          custom_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """步骤1：导入多源数据"""
        print(f"[步骤1] 正在导入数据，批次号: {self.batch_id}")
        sources = self.importer.import_directory(data_dir, custom_mapping)
        df = self.importer.get_imported_data()
        self._original_df = df.copy()
        source_list = self.importer.get_sources()
        print(f"  ✓ 共导入 {len(sources)} 个数据源，{len(df)} 条记录")
        for s in source_list:
            print(f"    - [{s['source_type']}] {s['source_name']}: {s['record_count']}条")
        return {
            "batch_id": self.batch_id,
            "sources": source_list,
            "record_count": len(df),
            "columns": list(df.columns)
        }

    def step2_set_params(self, updates: Optional[Dict[str, Any]] = None,
                        reason: str = "人工调优",
                        operator: str = "周姐") -> Dict[str, Any]:
        """步骤2：设置参数（可选）"""
        if updates:
            print(f"[步骤2] 正在设置参数，共 {len(updates)} 项变更")
            results = self.param_manager.set_params_batch(updates, reason, operator)
            for r in results:
                print(f"  ✓ {r['key']}: {r['old_value']} → {r['new_value']} ({r['reason']})")
        param_diff = self.param_manager.compare_with_defaults()
        return {
            "param_version": self.param_manager.get_current_version_tag(),
            "diff_from_default": param_diff,
            "current_params": self.param_manager.get_all_params()
        }

    def step3_calculate(self) -> Dict[str, Any]:
        """步骤3：运行计算"""
        print(f"[步骤3] 正在运行计算...")
        df = self.supplement_manager.get_updated_data(self._original_df)
        calc_results = self.calculator.run_full_calculation(df)
        self._calc_results = calc_results
        personal_df = calc_results["personal_scores"]
        section_df = calc_results["section_metrics"]
        print(f"  ✓ 已计算 {len(personal_df)} 人个人综合分")
        if not section_df.empty:
            print(f"  ✓ 已汇总 {len(section_df)} 个声部指标")
            for _, row in section_df.iterrows():
                print(f"    - {row['声部']}: 平均分{row['声部平均分']:.1f}分, "
                      f"达标率{row['声部达标率']:.0f}%, {row['排练优先级']}")
        return calc_results

    def step4_detect_anomalies(self) -> Dict[str, Any]:
        """步骤4：检测异常"""
        print(f"[步骤4] 正在检测异常...")
        df = self._calc_results["personal_scores"] if self._calc_results else self._original_df
        trend_df = self._calc_results.get("trend_metrics") if self._calc_results else None
        anomaly_result = self.anomaly_detector.run_all_detections(df, trend_df)
        self._anomaly_summary = self.anomaly_detector.get_anomaly_summary()
        total = anomaly_result["total_count"]
        if total == 0:
            print("  ✓ 未检测到异常")
        else:
            print(f"  ⚠️  检测到 {total} 个异常: "
                  f"高{anomaly_result['high_count']}个, "
                  f"中{anomaly_result['medium_count']}个, "
                  f"低{anomaly_result['low_count']}个")
            for a in self._anomaly_summary["details"][:3]:
                sev_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(a["severity"], "⚪")
                print(f"    {sev_icon} {a['description']}")
        return anomaly_result

    def step5_detect_conflicts(self, review_data: Optional[Dict] = None) -> Dict[str, Any]:
        """步骤5：检测冲突，包括复盘图表说法与导入数据的冲突"""
        print(f"[步骤5] 正在检测数据冲突...")
        self._review_data = review_data
        df = self._calc_results["personal_scores"] if self._calc_results else self._original_df
        conflict_result = self.conflict_detector.run_all_detections(df, review_data)
        self._conflict_summary = self.conflict_detector.get_conflict_summary()
        total = conflict_result["total_count"]
        if total == 0:
            print("  ✓ 未检测到数据冲突")
        else:
            print(f"  ⚠️  检测到 {total} 个冲突，{self._conflict_summary['unresolved']} 个待解决")
            for c in self._conflict_summary["details"][:3]:
                print(f"    字段[{c['field_name']}]: {c['source_a']}={c['value_a']} vs {c['source_b']}={c['value_b']}")
        return conflict_result

    def step6_supplement(self, supplements: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """步骤6：补录备注/修正数据"""
        if not supplements:
            self._supplement_summary = self.supplement_manager.get_supplement_summary()
            return {"supplements": [], "count": 0}
        print(f"[步骤6] 正在处理 {len(supplements)} 条补录...")
        results = []
        for s in supplements:
            stype = s.get("type")
            if stype == "add_remark":
                result = self.supplement_manager.add_remark(
                    s["record_id"], s["remark"], s.get("operator", "周姐")
                )
            elif stype == "correct_field":
                result = self.supplement_manager.correct_field(
                    s["record_id"], s["field_name"], s["new_value"],
                    s.get("reason", ""), s.get("operator", "周姐")
                )
            elif stype == "add_record":
                result = self.supplement_manager.add_new_record(
                    s["record_data"], s.get("source_name", "人工补录"),
                    s.get("reason", ""), s.get("operator", "周姐")
                )
            else:
                continue
            results.append(result)
            print(f"  ✓ [{result.get('action', s['type'])}] {result.get('diff_display', result.get('member', ''))}")
        if supplements and self._calc_results:
            print("  🔄 补录完成，需要重新运行计算以更新结果")
        comparison = self.supplement_manager.compare_before_after(self._original_df)
        self._supplement_summary = self.supplement_manager.get_supplement_summary()
        self._supplement_summary["comparison"] = comparison
        return {
            "supplements": results,
            "count": len(results),
            "comparison": comparison
        }

    def step7_generate_charts(self) -> Dict[str, Any]:
        """步骤7：生成图表"""
        print(f"[步骤7] 正在生成图表...")
        chart_result = self.chart_generator.generate_all_charts(
            self._calc_results, self._anomaly_summary
        )
        print(f"  ✓ 已生成 {chart_result['count']} 个图表")
        for chart in chart_result["chart_list"]:
            print(f"    - {chart['chart_title']}: {Path(chart['file_path']).name}")
        return chart_result

    def step8_generate_report(self) -> Dict[str, Any]:
        """步骤8：生成报告"""
        print(f"[步骤8] 正在生成报告...")
        sources = self.importer.get_sources()
        param_diff = self.param_manager.compare_with_defaults()
        if self._supplement_summary is None:
            self._supplement_summary = self.supplement_manager.get_supplement_summary()
        report_result = self.report_generator.generate_full_report(
            self._calc_results,
            self._anomaly_summary,
            self._conflict_summary,
            self._supplement_summary,
            sources,
            param_diff
        )
        print(f"  ✓ 文本报告: {Path(report_result['text_report']).name}")
        print(f"  ✓ HTML报告: {Path(report_result['html_report']).name}")
        print(f"  ✓ 明细文件: {len(report_result['detail_files'])} 个")
        return report_result

    def run_full_workflow(self, data_dir: str,
                          param_updates: Optional[Dict[str, Any]] = None,
                          review_data: Optional[Dict] = None,
                          supplements: Optional[List[Dict]] = None,
                          operator: str = "周姐") -> Dict[str, Any]:
        """运行完整工作流（一次顺利处理场景）"""
        print("=" * 60)
        print("  合唱声部排练优化 - 完整工作流")
        print("=" * 60)
        result = {"batch_id": self.batch_id, "started_at": datetime.now().isoformat()}
        result["import"] = self.step1_import_data(data_dir)
        result["params"] = self.step2_set_params(param_updates, operator=operator)
        result["calculation"] = self.step3_calculate()
        result["anomalies"] = self.step4_detect_anomalies()
        result["conflicts"] = self.step5_detect_conflicts(review_data)
        if supplements:
            result["supplements"] = self.step6_supplement(supplements)
            result["calculation"] = self.step3_calculate()
            result["anomalies"] = self.step4_detect_anomalies()
            result["conflicts"] = self.step5_detect_conflicts(review_data)
        result["charts"] = self.step7_generate_charts()
        result["report"] = self.step8_generate_report()
        result["completed_at"] = datetime.now().isoformat()
        print("=" * 60)
        print(f"  工作流完成！批次号: {self.batch_id}")
        print("=" * 60)
        return result

    def run_rework_workflow(self, existing_batch_id: str,
                            supplements: List[Dict],
                            review_data: Optional[Dict] = None) -> Dict[str, Any]:
        """返工处理场景：基于已有批次补录后重新计算"""
        print("=" * 60)
        print(f"  合唱声部排练优化 - 返工处理 (基于批次 {existing_batch_id})")
        print("=" * 60)
        from .database import RAW_RECORDS_TABLE, DATA_SOURCES_TABLE
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"""
            SELECT r.normalized_data, r.id, r.source_id
            FROM {RAW_RECORDS_TABLE} r
            WHERE r.batch_id = ?
            ORDER BY r.created_at
            """,
            (existing_batch_id,)
        )
        rows = cursor.fetchall()
        records = []
        for row in rows:
            data = json.loads(row['normalized_data'])
            data['_record_id'] = row['id']
            data['_source_id'] = row['source_id']
            records.append(data)
        self._original_df = pd.DataFrame(records)
        cursor.execute(
            f"""
            SELECT id, source_type, source_name, file_path, record_count, field_mapping
            FROM {DATA_SOURCES_TABLE} WHERE batch_id = ?
            """,
            (existing_batch_id,)
        )
        for row in cursor.fetchall():
            self.importer.imported_sources.append({
                "source_id": row['id'],
                "source_type": row['source_type'],
                "source_name": row['source_name'],
                "record_count": row['record_count']
            })
        result = {"batch_id": self.batch_id, "rework_from": existing_batch_id}
        result["params"] = self.step2_set_params()
        result["calculation"] = self.step3_calculate()
        result["anomalies"] = self.step4_detect_anomalies()
        result["conflicts"] = self.step5_detect_conflicts(review_data)
        print(f"[返工] 正在处理 {len(supplements)} 条补录/修正...")
        result["supplements"] = self.step6_supplement(supplements)
        print("[返工] 重新计算...")
        result["calculation"] = self.step3_calculate()
        result["anomalies"] = self.step4_detect_anomalies()
        result["conflicts"] = self.step5_detect_conflicts(review_data)
        result["charts"] = self.step7_generate_charts()
        result["report"] = self.step8_generate_report()
        result["completed_at"] = datetime.now().isoformat()
        print("=" * 60)
        print(f"  返工完成！新批次号: {self.batch_id}")
        print("=" * 60)
        return result

    def query_calc_audit(self, record_id: str) -> List[Dict]:
        """查询指定记录的计算审计，用于复查"""
        return self.calculator.get_calculation_audit(record_id)

    def get_decision_support(self, conflict_id: str) -> Dict[str, Any]:
        """获取冲突决策支持（只摆证据，不替用户拍板）"""
        return self.conflict_detector.get_conflict_for_decision(conflict_id)

    def resolve_conflict(self, conflict_id: str, resolution: str,
                        operator: str = "周姐") -> Dict[str, Any]:
        """记录冲突解决结果"""
        return self.conflict_detector.resolve_conflict(conflict_id, resolution, operator)

    def resolve_anomaly(self, anomaly_id: str, resolution_note: str,
                        operator: str = "周姐"):
        """标记异常为已解决"""
        self.anomaly_detector.resolve_anomaly(anomaly_id, resolution_note, operator)

    def _load_calc_results_from_db(self) -> Dict[str, Any]:
        """从数据库加载计算结果"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT record_id, result_value FROM {CALCULATIONS_TABLE} WHERE batch_id = ? AND calc_type = '个人综合分'",
            (self.batch_id,)
        )
        calc_map = {r["record_id"]: r["result_value"] for r in cursor.fetchall()}
        rec_cursor = self.db.conn.cursor()
        rec_cursor.execute(
            f"SELECT id, normalized_data FROM {RAW_RECORDS_TABLE} WHERE batch_id = ?",
            (self.batch_id,)
        )
        records = []
        for row in rec_cursor.fetchall():
            data = json.loads(row["normalized_data"])
            data["_record_id"] = row["id"]
            records.append(data)
        personal_df = pd.DataFrame(records) if records else pd.DataFrame()
        if not personal_df.empty and "人员" in personal_df.columns:
            personal_df = personal_df[personal_df["人员"].notna() & (personal_df["人员"] != "")].copy()
        if not personal_df.empty and "_record_id" in personal_df.columns:
            personal_df["个人综合分"] = personal_df["_record_id"].map(calc_map)
        from .calculator import CalculationEngine
        engine = CalculationEngine(self.batch_id)
        section_df = engine.calculate_section_metrics(personal_df) if not personal_df.empty else pd.DataFrame()
        return {
            "personal_scores": personal_df,
            "section_metrics": section_df,
            "param_version": self.param_manager.get_current_version_tag(),
            "weights_used": engine.weights,
            "thresholds_used": engine.thresholds
        }

    def _load_anomaly_summary_from_db(self) -> Dict[str, Any]:
        """从数据库加载异常摘要"""
        return self.anomaly_detector.get_anomaly_summary()

    def _load_conflict_summary_from_db(self) -> Dict[str, Any]:
        """从数据库加载冲突摘要"""
        return self.conflict_detector.get_conflict_summary()

    def _load_supplement_summary_from_db(self) -> Dict[str, Any]:
        """从数据库加载补录摘要"""
        return self.supplement_manager.get_supplement_summary()

    def export_all(self, output_dir: Optional[str] = None) -> Dict[str, Any]:
        """导出所有可复查数据"""
        from .config import EXPORTS_DIR
        if output_dir is None:
            output_dir = str(EXPORTS_DIR)
        calc_results = self._calc_results if self._calc_results is not None else self._load_calc_results_from_db()
        anomaly_summary = self._anomaly_summary if self._anomaly_summary is not None else self._load_anomaly_summary_from_db()
        conflict_summary = self._conflict_summary if self._conflict_summary is not None else self._load_conflict_summary_from_db()
        supplement_summary = self._supplement_summary if self._supplement_summary is not None else self._load_supplement_summary_from_db()
        personal_df = calc_results.get("personal_scores", pd.DataFrame())
        section_df = calc_results.get("section_metrics", pd.DataFrame())
        calc_audit_cursor = self.db.conn.cursor()
        calc_audit_cursor.execute(
            f"SELECT c.id, c.record_id, c.calc_type, c.result_value, c.param_version, "
            f"s.step_order, s.step_name, s.formula, s.output_value "
            f"FROM {CALCULATIONS_TABLE} c LEFT JOIN {CALC_STEPS_TABLE} s ON c.id = s.calc_id "
            f"WHERE c.batch_id = ? ORDER BY c.id, s.step_order",
            (self.batch_id,)
        )
        calc_audit = []
        for r in calc_audit_cursor.fetchall():
            calc_audit.append({
                "计算ID": r["id"],
                "记录ID": r["record_id"],
                "计算类型": r["calc_type"],
                "结果值": r["result_value"],
                "参数版本": r["param_version"],
                "步骤序号": r["step_order"],
                "步骤名称": r["step_name"],
                "计算公式": r["formula"],
                "步骤输出": r["output_value"]
            })
        export_data = {
            "batch_id": self.batch_id,
            "exported_at": datetime.now().isoformat(),
            "params": {
                "version": self.param_manager.get_current_version_tag(),
                "values": self.param_manager.get_all_params(),
                "diff_from_default": self.param_manager.compare_with_defaults()
            },
            "sources": self.importer.get_sources(),
            "calculation_results": {
                "personal_scores": personal_df.to_dict(orient="records") if not personal_df.empty else [],
                "section_metrics": section_df.to_dict(orient="records") if not section_df.empty else [],
                "param_version": calc_results.get("param_version", ""),
                "weights_used": calc_results.get("weights_used", {}),
                "thresholds_used": calc_results.get("thresholds_used", {}),
                "total_people": len(personal_df),
                "avg_score": round(float(personal_df["个人综合分"].mean()), 2) if not personal_df.empty and "个人综合分" in personal_df.columns else None,
                "pass_rate": round(float((personal_df["个人综合分"] >= 80).mean() * 100), 2) if not personal_df.empty and "个人综合分" in personal_df.columns else None
            },
            "calc_audit": calc_audit,
            "anomalies": anomaly_summary,
            "conflicts": conflict_summary,
            "supplements": supplement_summary
        }
        export_path = Path(output_dir) / f"{self.batch_id}_完整导出.json"
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)
        self.db.log_audit(
            "export_all",
            {"export_path": str(export_path)},
            batch_id=self.batch_id
        )
        return {
            "export_path": str(export_path),
            "exported_at": datetime.now().isoformat()
        }
