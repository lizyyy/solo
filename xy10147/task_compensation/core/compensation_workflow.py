from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta
from typing import Dict, Optional, List, Any
import logging

from task_compensation.models import (
    Task, CompensationPlan, CompensationStep, 
    ExecutionReport, FailureSample, TaskResult, 
    TaskStatus, SystemConfig
)
from task_compensation.core.task_registry import TaskRegistry
from task_compensation.core.missed_task_detector import (
    MissedTaskDetector, FileSystemExecutionRecordStore
)
from task_compensation.core.compensation_planner import CompensationPlanner
from task_compensation.core.idempotency_checker import (
    IdempotencyChecker, FileSystemIdempotencyStore
)
from task_compensation.core.execution_recorder import ExecutionRecorder
from task_compensation.core.input_validator import InputValidator
from task_compensation.core.result_exporter import ResultExporter
from task_compensation.core.task_executor import TaskExecutor


class CompensationWorkflow:
    def __init__(
        self,
        registry: TaskRegistry,
        config: Optional[SystemConfig] = None,
        logger: Optional[logging.Logger] = None
    ):
        self.registry = registry
        self.config = config or SystemConfig()
        self.logger = logger or self._setup_default_logger()
        
        self._setup_components()
    
    def _setup_default_logger(self) -> logging.Logger:
        logger = logging.getLogger("CompensationWorkflow")
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger
    
    def _setup_components(self):
        self.record_store = FileSystemExecutionRecordStore(
            self.config.records_dir
        )
        self.idempotency_store = FileSystemIdempotencyStore(
            os.path.join(self.config.data_dir, "idempotency")
        )
        
        self.detector = MissedTaskDetector(
            registry=self.registry,
            record_store=self.record_store
        )
        self.idempotency_checker = IdempotencyChecker(self.idempotency_store)
        self.planner = CompensationPlanner(
            registry=self.registry,
            idempotency_checker=self.idempotency_checker,
            enable_idempotency_check=self.config.enable_idempotency_check
        )
        self.execution_recorder = ExecutionRecorder(self.config.records_dir)
        self.validator = InputValidator(self.config)
        self.exporter = ResultExporter(self.config.reports_dir)
        self.executor = TaskExecutor(
            execution_recorder=self.execution_recorder,
            idempotency_checker=self.idempotency_checker,
            enable_idempotency=self.config.enable_idempotency_check
        )
    
    def run(
        self,
        target_date: Optional[date] = None,
        specific_task_ids: Optional[List[str]] = None,
        dry_run: bool = False,
        include_inactive: bool = False,
        export_formats: List[str] = ["json"]
    ) -> ExecutionReport:
        self.logger.info("=" * 60)
        self.logger.info("开始执行定时任务漏跑补偿流程")
        self.logger.info("=" * 60)
        
        if target_date is None:
            target_date = date.today() - timedelta(days=1)
            self.logger.info(f"未指定目标日期，默认使用昨天: {target_date}")
        
        self.logger.info(f"目标日期: {target_date}")
        self.logger.info(f"特定任务: {specific_task_ids if specific_task_ids else '全部'}")
        self.logger.info(f"试运行模式: {dry_run}")
        
        date_validation = self.validator.validate_date(target_date, allow_future=False)
        if not date_validation.is_valid:
            error_msg = "日期校验失败: " + "; ".join(str(e) for e in date_validation.errors)
            self.logger.error(error_msg)
            raise ValueError(error_msg)
        
        if self.config.enable_dependency_validation:
            dep_errors = self.registry.validate_dependencies()
            if dep_errors:
                self.logger.warning(f"发现依赖问题: {dep_errors}")
        
        detection = self._detect_missed_tasks(target_date, include_inactive, specific_task_ids)
        
        if not self._has_tasks_to_compensate(detection):
            self.logger.info("没有需要补偿的任务，流程结束")
            return self._create_empty_report(target_date, detection)
        
        plan = self._create_compensation_plan(target_date, detection)
        
        if dry_run:
            self.logger.info("试运行模式，仅生成计划，不执行")
            self._export_plan(plan)
            return self._create_plan_report(plan)
        
        report = self._execute_compensation_plan(plan)
        
        self._export_report(report, export_formats)
        
        self._log_summary(report)
        
        return report
    
    def _detect_missed_tasks(
        self,
        target_date: date,
        include_inactive: bool,
        specific_task_ids: Optional[List[str]]
    ) -> Dict[str, List[str]]:
        self.logger.info("步骤 1/5: 检测漏跑任务...")
        
        detection = self.detector.detect(
            target_date=target_date,
            include_inactive=include_inactive,
            specific_task_ids=specific_task_ids
        )
        
        self.logger.info(f"  检测结果:")
        self.logger.info(f"    - 漏跑任务: {len(detection['missed_tasks'])} 个")
        self.logger.info(f"    - 失败任务: {len(detection['failed_tasks'])} 个")
        self.logger.info(f"    - 运行中: {len(detection['pending_tasks'])} 个")
        self.logger.info(f"    - 成功任务: {len(detection['success_tasks'])} 个")
        self.logger.info(f"    - 跳过任务: {len(detection['skipped_tasks'])} 个")
        
        return detection
    
    def _has_tasks_to_compensate(self, detection: Dict[str, List[str]]) -> bool:
        return len(detection['missed_tasks']) > 0 or len(detection['failed_tasks']) > 0
    
    def _create_compensation_plan(
        self,
        target_date: date,
        detection: Dict[str, List[str]]
    ) -> CompensationPlan:
        self.logger.info("步骤 2/5: 生成补偿计划...")
        
        all_missed = detection['missed_tasks'] + detection['failed_tasks']
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=all_missed,
            include_dependencies=True,
            auto_skip_successful=True
        )
        
        self.logger.info(f"  计划详情:")
        self.logger.info(f"    - 计划ID: {plan.plan_id}")
        self.logger.info(f"    - 总步骤数: {plan.total_steps}")
        
        execute_steps = [s for s in plan.steps if s.action == 'execute']
        skip_steps = [s for s in plan.steps if s.action == 'skip']
        
        self.logger.info(f"    - 需要执行: {len(execute_steps)} 个")
        self.logger.info(f"    - 跳过: {len(skip_steps)} 个")
        
        if plan.warnings:
            self.logger.warning(f"    - 警告: {len(plan.warnings)} 个")
            for warning in plan.warnings:
                self.logger.warning(f"      * {warning}")
        
        plan_validation = self.validator.validate_plan(plan, self.registry)
        if not plan_validation.is_valid:
            raise ValueError("计划校验失败: " + "; ".join(str(e) for e in plan_validation.errors))
        
        self._log_plan_steps(plan)
        
        return plan
    
    def _log_plan_steps(self, plan: CompensationPlan):
        self.logger.info(f"  执行顺序:")
        for step in plan.steps:
            status = "执行" if step.action == "execute" else "跳过"
            reason = f" ({step.reason})" if step.reason else ""
            self.logger.info(f"    [{step.step_id}] {step.task_id} - {status}{reason}")
    
    def _execute_compensation_plan(self, plan: CompensationPlan) -> ExecutionReport:
        self.logger.info("步骤 3/5: 执行补偿任务...")
        
        report = ExecutionReport(
            report_id=str(uuid.uuid4()),
            plan_id=plan.plan_id,
            generated_at=datetime.now(),
            target_date=plan.target_date,
            total_tasks=len(plan.steps)
        )
        
        start_time = datetime.now()
        
        for step in plan.steps:
            self.logger.info(f"  [{step.step_id}/{plan.total_steps}] 执行任务: {step.task_id}")
            
            task = self.registry.get_task(step.task_id)
            if not task:
                self.logger.warning(f"    任务 {step.task_id} 不存在，跳过")
                report.skipped_count += 1
                continue
            
            if step.action == 'skip':
                self.logger.info(f"    跳过: {step.reason}")
                report.skipped_count += 1
                continue
            
            result = self._execute_step(task, step, report)
            report.task_results.append(result)
        
        end_time = datetime.now()
        report.total_duration = (end_time - start_time).total_seconds()
        
        self._generate_recommendations(report)
        
        return report
    
    def _execute_step(
        self,
        task: Task,
        step: CompensationStep,
        report: ExecutionReport
    ) -> TaskResult:
        try:
            result = self.executor.execute_task(
                task=task,
                execution_date=step.execution_date,
                metadata={"compensation": True, "plan_id": report.plan_id}
            )
            
            if result.status == TaskStatus.SUCCESS:
                self.logger.info(f"    ✓ 成功 ({result.duration:.2f}秒)")
                report.success_count += 1
            elif result.status == TaskStatus.SKIPPED:
                self.logger.info(f"    ⏭  跳过: {result.output.get('message', '已执行')}")
                report.skipped_count += 1
            elif result.status == TaskStatus.TIMEOUT:
                self.logger.error(f"    ✗ 超时")
                report.failed_count += 1
                self._record_failure_sample(task, step, result, report)
            else:
                self.logger.error(f"    ✗ 失败: {result.error_message}")
                report.failed_count += 1
                self._record_failure_sample(task, step, result, report)
            
            return result
            
        except Exception as e:
            self.logger.error(f"    ✗ 执行异常: {str(e)}")
            report.failed_count += 1
            
            result = TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                start_time=datetime.now(),
                end_time=datetime.now(),
                duration=0,
                error_message=str(e)
            )
            
            self._record_failure_sample(task, step, result, report)
            return result
    
    def _record_failure_sample(
        self,
        task: Task,
        step: CompensationStep,
        result: TaskResult,
        report: ExecutionReport
    ):
        sample = self.executor.create_failure_sample(
            task=task,
            execution_date=step.execution_date,
            result=result
        )
        report.failure_samples.append(sample)
    
    def _generate_recommendations(self, report: ExecutionReport):
        report.recommendations = []
        
        if report.success_count == 0 and report.total_tasks > 0:
            report.recommendations.append(
                "所有任务都失败了，建议检查任务配置和执行环境"
            )
        
        if report.failed_count > 0:
            report.recommendations.append(
                f"有 {report.failed_count} 个任务失败，请查看失败样本分析原因"
            )
        
        failed_with_retries = [
            r for r in report.task_results 
            if r.retry_count > 0 and r.status == TaskStatus.FAILED
        ]
        if failed_with_retries:
            report.recommendations.append(
                f"有 {len(failed_with_retries)} 个任务重试后仍失败，建议提高重试次数或检查任务逻辑"
            )
    
    def _create_empty_report(
        self,
        target_date: date,
        detection: Dict[str, List[str]]
    ) -> ExecutionReport:
        report = ExecutionReport(
            report_id=str(uuid.uuid4()),
            plan_id="no_plan_needed",
            generated_at=datetime.now(),
            target_date=target_date,
            total_tasks=0
        )
        report.recommendations = ["所有任务执行正常，无需补偿"]
        return report
    
    def _create_plan_report(self, plan: CompensationPlan) -> ExecutionReport:
        report = ExecutionReport(
            report_id=str(uuid.uuid4()),
            plan_id=plan.plan_id,
            generated_at=datetime.now(),
            target_date=plan.target_date,
            total_tasks=len(plan.steps)
        )
        report.recommendations = [
            "试运行模式，计划已生成但未执行",
            f"计划包含 {plan.total_steps} 个步骤，其中 {len([s for s in plan.steps if s.action == 'execute'])} 个需要执行"
        ]
        return report
    
    def _export_plan(self, plan: CompensationPlan):
        self.logger.info("步骤 4/5: 导出补偿计划...")
        plan_path = self.exporter.export_plan(plan)
        self.logger.info(f"  计划已导出: {plan_path}")
    
    def _export_report(self, report: ExecutionReport, formats: List[str]):
        self.logger.info("步骤 4/5: 导出执行报告...")
        
        for format in formats:
            try:
                report_path = self.exporter.export_report(report, format=format)
                self.logger.info(f"  报告已导出 ({format}): {report_path}")
            except Exception as e:
                self.logger.error(f"  导出 {format} 格式失败: {str(e)}")
    
    def _log_summary(self, report: ExecutionReport):
        self.logger.info("=" * 60)
        self.logger.info("补偿执行完成")
        self.logger.info("=" * 60)
        self.logger.info(f"总任务数: {report.total_tasks}")
        self.logger.info(f"成功: {report.success_count}")
        self.logger.info(f"失败: {report.failed_count}")
        self.logger.info(f"跳过: {report.skipped_count}")
        self.logger.info(f"成功率: {report.get_success_rate():.2f}%")
        self.logger.info(f"总耗时: {report.total_duration:.2f} 秒")
        self.logger.info("=" * 60)


import os
