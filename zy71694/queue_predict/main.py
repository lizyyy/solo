from __future__ import annotations

import argparse
import json
import sys
import os
from typing import Dict, Any, Optional, List

from .models import (
    PipelineContext,
    Registration,
    RecordStatus,
    AnomalyType,
)
from .param_store import ParamStore
from .queue_simulator import QueueSimulator
from .wait_predictor import WaitPredictor
from .anomaly_detector import AnomalyDetector
from .timeline_exporter import TimelineExporter
from .report_generator import ReportGenerator
from .resume_handler import ResumeHandler
from .sample_data import create_sample_data


class QueuePredictPipeline:
    def __init__(
        self,
        output_dir: str = ".output",
        param_store_dir: Optional[str] = None,
        resume_dir: Optional[str] = None,
    ):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        ps_dir = param_store_dir or os.path.join(output_dir, ".param_store")
        rs_dir = resume_dir or os.path.join(output_dir, ".resume_state")
        report_dir = os.path.join(output_dir, ".reports")

        self.param_store = ParamStore(ps_dir)
        self.resume_handler = ResumeHandler(rs_dir)
        self.report_generator = ReportGenerator(report_dir)
        self.timeline_exporter = TimelineExporter()

    def run(
        self,
        ctx: PipelineContext,
        filter_conditions: Optional[Dict[str, Any]] = None,
        calc_params: Optional[Dict[str, Any]] = None,
    ) -> PipelineContext:
        filter_conditions = filter_conditions or {}
        calc_params = calc_params or {}

        snapshot = self.param_store.save(filter_conditions, calc_params)
        ctx.param_snapshot_id = snapshot.snapshot_id
        ctx.filter_conditions = filter_conditions

        resolved_params = snapshot.calc_params

        self._validate_stage(ctx)
        self._anomaly_check_stage(ctx, resolved_params)
        self._simulate_stage(ctx, resolved_params)
        self._predict_stage(ctx, resolved_params)

        anomaly_explanations = self._explain_stage(ctx, resolved_params)

        self._export_timeline(ctx)
        self._generate_report(ctx, anomaly_explanations)

        return ctx

    def _validate_stage(self, ctx: PipelineContext) -> None:
        for reg in ctx.registrations:
            if reg.status == RecordStatus.RETURNED_FOR_SUPPLEMENT:
                continue

            try:
                if reg.status == RecordStatus.RECEIVED:
                    reg.transition_to(RecordStatus.VALIDATING)

                if not reg.doctor_id:
                    reg.return_for_supplement("缺少医生ID")
                    continue
                if not reg.patient_id:
                    reg.return_for_supplement("缺少患者ID")
                    continue

                reg.transition_to(RecordStatus.ANOMALY_CHECKING)
            except ValueError:
                pass

    def _anomaly_check_stage(self, ctx: PipelineContext, calc_params: Dict[str, Any]) -> None:
        detector = AnomalyDetector(calc_params)
        for reg in ctx.registrations:
            if reg.status in (RecordStatus.VALIDATING, RecordStatus.ANOMALY_CHECKING):
                if reg.status == RecordStatus.VALIDATING:
                    try:
                        reg.transition_to(RecordStatus.ANOMALY_CHECKING)
                    except ValueError:
                        pass

        ctx = detector.detect(ctx)

        for reg in ctx.registrations:
            if reg.status == RecordStatus.ANOMALY_FLAGGED:
                if AnomalyType.MISSING_SCHEDULE in reg.anomaly_types:
                    reg.return_for_supplement(
                        f"医生 {reg.doctor_id} 无排班记录，请补充排班信息"
                    )
                    self.resume_handler.save_state(reg)
                else:
                    try:
                        reg.transition_to(RecordStatus.SIMULATING)
                    except ValueError:
                        reg.status = RecordStatus.SIMULATING
                        reg.last_successful_stage = RecordStatus.SIMULATING

            elif reg.status == RecordStatus.ANOMALY_CHECKING:
                try:
                    reg.transition_to(RecordStatus.SIMULATING)
                except ValueError:
                    reg.status = RecordStatus.SIMULATING
                    reg.last_successful_stage = RecordStatus.SIMULATING

    def _simulate_stage(self, ctx: PipelineContext, calc_params: Dict[str, Any]) -> None:
        simulator = QueueSimulator(calc_params)
        ctx = simulator.simulate(ctx)

        for reg in ctx.registrations:
            if reg.status == RecordStatus.SIMULATING:
                try:
                    reg.transition_to(RecordStatus.PREDICTED)
                except ValueError:
                    reg.status = RecordStatus.PREDICTED
                    reg.last_successful_stage = RecordStatus.PREDICTED

    def _predict_stage(self, ctx: PipelineContext, calc_params: Dict[str, Any]) -> None:
        predictor = WaitPredictor(calc_params)
        ctx = predictor.predict(ctx)

        for reg in ctx.registrations:
            if reg.status == RecordStatus.PREDICTED:
                try:
                    reg.transition_to(RecordStatus.COMPLETED)
                except ValueError:
                    reg.status = RecordStatus.COMPLETED
                    reg.last_successful_stage = RecordStatus.COMPLETED

    def _explain_stage(self, ctx: PipelineContext, calc_params: Dict[str, Any]) -> Dict[str, List[str]]:
        detector = AnomalyDetector(calc_params)
        return detector.explain(ctx)

    def _export_timeline(self, ctx: PipelineContext) -> None:
        json_path = os.path.join(self.output_dir, "timeline.json")
        csv_path = os.path.join(self.output_dir, "timeline.csv")
        self.timeline_exporter.export_json(ctx, json_path)
        self.timeline_exporter.export_csv(ctx, csv_path)

        try:
            chart_path = os.path.join(self.output_dir, "timeline_chart.png")
            self.timeline_exporter.export_matplotlib(ctx, chart_path)
            wait_chart_path = os.path.join(self.output_dir, "waiting_chart.png")
            self.timeline_exporter.export_waiting_chart(ctx, wait_chart_path)
        except ImportError:
            pass

    def _generate_report(self, ctx: PipelineContext, anomaly_explanations: Dict[str, List[str]]) -> None:
        self.report_generator.generate(ctx, anomaly_explanations)

    def resume_record(self, reg_id: str, materials: Dict[str, Any], ctx: PipelineContext) -> Optional[PipelineContext]:
        reg = self.resume_handler.resume_with_supplement(reg_id, materials)
        if reg is None:
            return None

        existing = [r for r in ctx.registrations if r.reg_id == reg_id]
        if existing:
            idx = ctx.registrations.index(existing[0])
            ctx.registrations[idx] = reg
        else:
            ctx.registrations.append(reg)

        return ctx


def main():
    parser = argparse.ArgumentParser(description="医院门诊排队叫号等待预测")
    parser.add_argument("--sample", action="store_true", help="使用样例数据运行")
    parser.add_argument("--data", type=str, help="输入数据JSON文件路径")
    parser.add_argument("--output", type=str, default=".output", help="输出目录")
    parser.add_argument("--filter", type=str, help="筛选条件JSON字符串")
    parser.add_argument("--params", type=str, help="计算参数JSON字符串")
    parser.add_argument("--reproduce", type=str, help="从参数快照ID复现")
    parser.add_argument("--resume", type=str, help="续跑指定reg_id的退回记录")
    parser.add_argument("--supplement", type=str, help="补充材料JSON字符串(配合--resume使用)")
    parser.add_argument("--list-returned", action="store_true", help="列出所有退回补材料的记录")
    parser.add_argument("--list-snapshots", action="store_true", help="列出所有参数快照")

    args = parser.parse_args()

    pipeline = QueuePredictPipeline(output_dir=args.output)

    if args.list_snapshots:
        snapshots = pipeline.param_store.list_snapshots()
        if not snapshots:
            print("暂无参数快照")
        for s in snapshots:
            print(f"  {s.snapshot_id} | 创建于 {s.created_at} | 筛选: {json.dumps(s.filter_conditions, ensure_ascii=False)}")
        return

    if args.list_returned:
        returned = pipeline.resume_handler.list_returned_records()
        if not returned:
            print("暂无退回记录")
        for r in returned:
            print(f"  {r['reg_id']} | {r['patient_name']} | 原因: {r['returned_reason']} | 保存于 {r['saved_at']}")
        return

    if args.reproduce:
        info = pipeline.param_store.reproduce(args.reproduce)
        if info is None:
            print(f"未找到快照 {args.reproduce}")
            return
        print(f"复现参数快照: {info['snapshot_id']}")
        print(f"筛选条件: {json.dumps(info['filter_conditions'], ensure_ascii=False, indent=2)}")
        print(f"计算参数: {json.dumps(info['calc_params'], ensure_ascii=False, indent=2)}")
        return

    if args.resume:
        materials = {}
        if args.supplement:
            materials = json.loads(args.supplement)
        ctx = create_sample_data()
        ctx = pipeline.resume_record(args.resume, materials, ctx)
        if ctx is None:
            print(f"未找到记录 {args.resume}")
            return
        pipeline.run(ctx)
        print(f"续跑完成: {args.resume}")
        return

    filter_conditions = {}
    if args.filter:
        filter_conditions = json.loads(args.filter)

    calc_params = {}
    if args.params:
        calc_params = json.loads(args.params)

    if args.sample:
        ctx = create_sample_data()
    elif args.data:
        with open(args.data, "r", encoding="utf-8") as f:
            data = json.load(f)
        ctx = _load_context_from_dict(data)
    else:
        ctx = create_sample_data()

    ctx = pipeline.run(ctx, filter_conditions, calc_params)

    print(f"\n===== 排队叫号等待预测结果 =====")
    print(f"参数快照ID: {ctx.param_snapshot_id}")
    print(f"总挂号数: {len(ctx.registrations)}")
    print(f"正常记录: {sum(1 for r in ctx.registrations if not _has_anomaly(r))}")
    print(f"异常记录: {sum(1 for r in ctx.registrations if _has_anomaly(r))}")
    print(f"退回补材料: {sum(1 for r in ctx.registrations if r.status == RecordStatus.RETURNED_FOR_SUPPLEMENT)}")
    print()

    for reg in ctx.registrations:
        pred = ctx.prediction_results.get(reg.reg_id)
        if pred is None:
            continue
        status_icon = "⚠️" if _has_anomaly(reg) else "✓"
        wait_str = f"{pred.predicted_wait_minutes:.1f}分钟" if pred.predicted_wait_minutes >= 0 else "无法预测"
        ci_str = f"[{pred.confidence_low:.1f}, {pred.confidence_high:.1f}]" if pred.predicted_wait_minutes >= 0 else "-"
        print(f"  {status_icon} {reg.queue_number}号 {reg.patient_name} → {reg.doctor_name} | 等待: {wait_str} | 置信区间: {ci_str} | 状态: {reg.status.value}")
        if pred.anomaly_explanations:
            for exp in pred.anomaly_explanations:
                print(f"      → {exp}")

    print(f"\n报告已生成到: {pipeline.output_dir}/.reports/")
    print(f"时间轴已导出到: {pipeline.output_dir}/timeline.json")
    print(f"用 --reproduce {ctx.param_snapshot_id} 可复现本次计算参数")


def _has_anomaly(reg: Registration) -> bool:
    return len(reg.anomaly_types) > 0 and AnomalyType.NONE not in reg.anomaly_types


def _load_context_from_dict(data: Dict[str, Any]) -> PipelineContext:
    from datetime import date as date_cls, time as time_cls

    regs = []
    for r in data.get("registrations", []):
        regs.append(Registration(
            reg_id=r.get("reg_id", ""),
            patient_name=r.get("patient_name", ""),
            patient_id=r.get("patient_id", ""),
            doctor_id=r.get("doctor_id", ""),
            doctor_name=r.get("doctor_name", ""),
            dept=r.get("dept", ""),
            clinic_date=date_cls.fromisoformat(r["clinic_date"]) if r.get("clinic_date") else date_cls.today(),
            slot_time=time_cls.fromisoformat(r["slot_time"]) if r.get("slot_time") else None,
            queue_number=r.get("queue_number", 0),
            is_addon=r.get("is_addon", False),
            reg_time=datetime.fromisoformat(r["reg_time"]) if r.get("reg_time") else None,
        ))

    schedules = []
    for s in data.get("schedules", []):
        schedules.append(DoctorSchedule(
            doctor_id=s.get("doctor_id", ""),
            doctor_name=s.get("doctor_name", ""),
            dept=s.get("dept", ""),
            clinic_date=date_cls.fromisoformat(s["clinic_date"]) if s.get("clinic_date") else date_cls.today(),
            shift=s.get("shift", "morning"),
            start_time=time_cls.fromisoformat(s["start_time"]) if s.get("start_time") else time_cls(8, 0),
            end_time=time_cls.fromisoformat(s["end_time"]) if s.get("end_time") else time_cls(12, 0),
            room_id=s.get("room_id", ""),
            avg_consult_minutes=s.get("avg_consult_minutes", 10.0),
            max_addon_slots=s.get("max_addon_slots", 5),
            is_suspended=s.get("is_suspended", False),
        ))

    skips = []
    for s in data.get("skips", []):
        skips.append(SkipRecord(
            skip_id=s.get("skip_id", ""),
            reg_id=s.get("reg_id", ""),
            doctor_id=s.get("doctor_id", ""),
            clinic_date=date_cls.fromisoformat(s["clinic_date"]) if s.get("clinic_date") else date_cls.today(),
            skip_time=datetime.fromisoformat(s["skip_time"]) if s.get("skip_time") else None,
            is_duplicate=s.get("is_duplicate", False),
            skip_count=s.get("skip_count", 1),
        ))

    addons = []
    for a in data.get("addons", []):
        addons.append(AddOnRequest(
            request_id=a.get("request_id", ""),
            reg_id=a.get("reg_id", ""),
            doctor_id=a.get("doctor_id", ""),
            patient_name=a.get("patient_name", ""),
            clinic_date=date_cls.fromisoformat(a["clinic_date"]) if a.get("clinic_date") else date_cls.today(),
            request_time=datetime.fromisoformat(a["request_time"]) if a.get("request_time") else None,
            approved=a.get("approved", False),
            priority=a.get("priority", 0),
            insert_position=a.get("insert_position"),
            is_queue_jump=a.get("is_queue_jump", False),
        ))

    rooms = []
    for r in data.get("rooms", []):
        rooms.append(ClinicRoom(
            room_id=r.get("room_id", ""),
            room_name=r.get("room_name", ""),
            dept=r.get("dept", ""),
            is_available=r.get("is_available", True),
            current_doctor_id=r.get("current_doctor_id"),
        ))

    return PipelineContext(
        registrations=regs,
        schedules=schedules,
        skips=skips,
        addons=addons,
        rooms=rooms,
    )


if __name__ == "__main__":
    main()
