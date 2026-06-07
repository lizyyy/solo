"""核心业务流程 - 复核记录系统"""
import copy
from typing import List, Optional
from .models import (
    RecallCandidate, ParamsConfig, AuditRecord, AnomalySample,
    generate_id, current_timestamp
)
from .store import DataStore
from .anomaly_detector import AnomalyDetector
from .report_generator import ReportGenerator


class MabBudgetReviewer:
    """多臂老虎机预算分流 - 复核主流程"""

    def __init__(self, data_dir: str = "./data", output_dir: str = "./output"):
        self.store = DataStore(data_dir)
        self.detector = AnomalyDetector()
        self.reporter = ReportGenerator(output_dir, self.store)

    def step1_import_candidates(self, csv_path: str, operator: str = "推荐策略老唐") -> List[RecallCandidate]:
        """第一步：导入召回候选表"""
        candidates = self.store.import_candidates_from_csv(csv_path)
        self.store.save_candidates(candidates, "latest")

        self._add_audit(
            operator=operator,
            action="导入召回候选表",
            target_type="candidates",
            target_id="latest",
            change_summary=f"导入 {len(candidates)} 条召回候选记录",
            reason="实验平台负责人催结果，需要快速翻表",
            impacted=[f"候选表共 {len(candidates)} 条记录已入库"]
        )

        return candidates

    def step2_load_params(self, yaml_path: Optional[str] = None, operator: str = "推荐策略老唐") -> Optional[ParamsConfig]:
        """第二步：加载/补录参数YAML"""
        params = None
        if yaml_path:
            import yaml
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            params = ParamsConfig(**data)
            self.store.save_params(params)
            action = "补录参数YAML"
            summary = f"从 {yaml_path} 加载参数配置 v{params.version}"
        else:
            params = self.store.load_params()
            action = "查看参数YAML"
            summary = f"查看当前参数配置 v{params.version}" if params else "无参数配置"

        if params:
            self.detector.update_params(params)
            self._add_audit(
                operator=operator,
                action=action,
                target_type="params",
                target_id=params.version,
                change_summary=summary,
                reason="检测异常需要使用参数配置做参照",
                impacted=["异常检测规则已同步更新", "后续检测将使用新参数"]
            )
        return params

    def step3_run_detection(self, operator: str = "推荐策略老唐", auto_mark: bool = False) -> List[AnomalySample]:
        """第三步：运行异常检测，生成异常样本页"""
        candidates = self.store.load_candidates()
        if not candidates:
            return []

        anomalies = self.detector.detect_all(candidates)
        self.store.save_candidates(candidates, "latest")

        for a in anomalies:
            self.store.save_anomaly(a)
            self.reporter.generate_anomaly_page(a)

        impacted = []
        time_cross = [a for a in anomalies if a.anomaly_type == "time_window_cross"]
        if time_cross:
            impacted.append(f"检测到 {len(time_cross)} 条「时间窗穿越」异常，效果可能虚高，需复核")
            impacted.append("⚠️ 这些样本不急着归正常，留给实验平台负责人复核")
        impacted.append(f"其余 {len(anomalies) - len(time_cross)} 条其他类型异常")

        self._add_audit(
            operator=operator,
            action="运行异常检测",
            target_type="detection",
            target_id=current_timestamp(),
            change_summary=f"检出 {len(anomalies)} 条异常样本",
            reason="标出时间窗穿越导致的效果虚高，避免结论出错",
            impacted=impacted
        )

        audit_records = self.store.load_audit_records()
        params = self.store.load_params()
        self.reporter.generate_summary_report(anomalies, candidates, params, audit_records)

        return anomalies

    def manual_correct_anomaly(self, sample_id: str, operator: str,
                               correction_notes: str,
                               mark_verified: bool = False,
                               next_step_owner: Optional[str] = None,
                               next_step_action: Optional[str] = None) -> Optional[AnomalySample]:
        """人工修正异常样本"""
        anomaly = self.store.load_anomaly(sample_id)
        if not anomaly:
            return None

        before = copy.deepcopy(anomaly)

        anomaly.correction_history.append({
            "timestamp": current_timestamp(),
            "operator": operator,
            "notes": correction_notes
        })

        if mark_verified:
            anomaly.is_verified = True
            anomaly.verified_by = operator
            anomaly.verified_at = current_timestamp()

        if next_step_owner:
            anomaly.next_step_owner = next_step_owner
        if next_step_action:
            anomaly.next_step_action = next_step_action

        anomaly.correction_notes = correction_notes

        self.store.save_anomaly(anomaly)
        self.reporter.generate_anomaly_page(anomaly)

        changes = []
        if mark_verified and not before.is_verified:
            changes.append("标记为已复核")
        if next_step_owner and before.next_step_owner != next_step_owner:
            changes.append(f"下一步负责人从 {before.next_step_owner} 改为 {next_step_owner}")
        changes.append(f"补充修正备注：{correction_notes}")

        self._add_audit(
            operator=operator,
            action="人工修正异常样本",
            target_type="anomaly",
            target_id=sample_id,
            change_summary="; ".join(changes),
            reason=correction_notes,
            impacted=[f"异常样本页 {sample_id} 已更新", "汇总报告同步刷新"]
        )

        self._refresh_summary()
        return anomaly

    def rerun_detection(self, operator: str = "推荐策略老唐") -> List[AnomalySample]:
        """重跑检测（基于当前参数）"""
        self._add_audit(
            operator=operator,
            action="重跑检测",
            target_type="detection",
            target_id="rerun_" + current_timestamp(),
            change_summary="使用最新参数重新执行异常检测",
            reason="参数或候选表更新后，需要重新评估",
            impacted=["所有异常样本将重新生成", "报告页同步刷新"]
        )
        return self.step3_run_detection(operator)

    def _add_audit(self, operator: str, action: str, target_type: str,
                   target_id: str, change_summary: str, reason: str,
                   impacted: List[str]):
        record = AuditRecord(
            record_id=generate_id("audit_"),
            timestamp=current_timestamp(),
            operator=operator,
            action=action,
            target_type=target_type,
            target_id=target_id,
            change_summary=change_summary,
            reason=reason,
            impacted_results=impacted
        )
        self.store.add_audit_record(record)

    def _refresh_summary(self):
        anomalies = self.store.load_anomalies()
        candidates = self.store.load_candidates()
        params = self.store.load_params()
        audit = self.store.load_audit_records()
        self.reporter.generate_summary_report(anomalies, candidates, params, audit)

    def get_dashboard_data(self):
        """获取小看板数据"""
        return {
            "candidates": self.store.load_candidates(),
            "anomalies": self.store.load_anomalies(),
            "params": self.store.load_params(),
            "audit": self.store.load_audit_records()
        }
