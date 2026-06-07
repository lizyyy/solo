#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型监控延迟归因分析器
推荐策略老唐 & 数据科学家 交接专用
"""

import yaml
import json
import copy
from datetime import datetime
from typing import Dict, List, Tuple, Optional


class AttributionAnalyzer:
    def __init__(self):
        self.threshold_config: Optional[Dict] = None
        self.threshold_version: Optional[str] = None
        self.monitor_report: Optional[Dict] = None
        self.eval_slices: Optional[Dict] = None
        self.records: List[Dict] = []
        self.history: List[Dict] = []
        self.manual_corrections: List[Dict] = []

    def step1_import_threshold_yaml(self, yaml_path: str) -> Dict:
        """
        第一步：导入参数YAML
        """
        print("=" * 60)
        print("【第一步】导入参数 YAML")
        print("=" * 60)
        
        with open(yaml_path, 'r', encoding='utf-8') as f:
            self.threshold_config = yaml.safe_load(f)
        
        self.threshold_version = self.threshold_config['model']['version']
        print(f"✓ 已导入阈值配置: {self.threshold_config['model']['name']}")
        print(f"  版本: {self.threshold_version}")
        print(f"  整体CTR warning阈值: {self.threshold_config['metrics']['overall']['ctr']['warning']}")
        print(f"  新用户CTR warning阈值: {self.threshold_config['metrics']['segments']['new_user']['ctr']['warning']}")
        print()
        
        self._log_history("STEP1_IMPORT_YAML", {
            "yaml_path": yaml_path,
            "version": self.threshold_version
        })
        
        return {
            "status": "success",
            "version": self.threshold_version,
            "threshold_config": self.threshold_config
        }

    def step2_load_monitor_report(self, report_path: str) -> Dict:
        """
        加载监控报告（内部方法）
        """
        with open(report_path, 'r', encoding='utf-8') as f:
            self.monitor_report = json.load(f)
        
        self.records = []
        for rec in self.monitor_report['records']:
            record = copy.deepcopy(rec)
            record['attribution_status'] = 'pending'
            record['issues'] = []
            record['final_status'] = None
            record['corrected_by'] = None
            record['correction_note'] = None
            self.records.append(record)
        
        return self.monitor_report

    def step2_check_eval_slices(self, eval_path: str) -> Dict:
        """
        第二步：推荐策略老唐补看评测切片
        检测阈值不一致问题
        """
        print("=" * 60)
        print("【第二步】补看评测切片 & 阈值核对")
        print("=" * 60)
        
        with open(eval_path, 'r', encoding='utf-8') as f:
            self.eval_slices = json.load(f)
        
        print(f"✓ 已加载评测切片: {len(self.eval_slices['slices'])} 条")
        print(f"  评测日期: {self.eval_slices['eval_date']}")
        print()
        
        print("开始核对阈值一致性...")
        print("-" * 60)
        
        issues_found = 0
        for record in self.records:
            expected_threshold = self._get_expected_threshold(
                record['segment'], record['metric']
            )
            
            if expected_threshold is not None:
                if abs(record['threshold_used'] - expected_threshold) > 0.0001:
                    record['issues'].append({
                        "type": "THRESHOLD_MISMATCH",
                        "severity": "high",
                        "expected": expected_threshold,
                        "actual": record['threshold_used'],
                        "description": f"报告使用阈值{record['threshold_used']}，但YAML当前版本为{expected_threshold}"
                    })
                    record['attribution_status'] = 'needs_review'
                    issues_found += 1
                    print(f"⚠️  {record['record_id']} [{record['segment']}/{record['metric']}]: 阈值不一致")
                    print(f"   报告用: {record['threshold_used']}, 应该用: {expected_threshold}")
                else:
                    if not record['issues']:
                        record['attribution_status'] = 'consistent'
        
        print()
        print(f"阈值核对完成: 发现 {issues_found} 条阈值不一致记录")
        print()
        
        self._log_history("STEP2_CHECK_EVAL_SLICES", {
            "eval_path": eval_path,
            "issues_found": issues_found,
            "records_analyzed": len(self.records)
        })
        
        return {
            "status": "success",
            "issues_found": issues_found,
            "records": self.records
        }

    def step3_manual_correction(self, record_id: str, action: str, note: str = "") -> Dict:
        """
        第三步：人工修正
        action: 'confirm_mismatch' - 确认阈值不一致，留待数据科学家复核
                'use_eval_data' - 使用评测切片数据补录旧口径
                'mark_normal' - 标记为正常（慎用）
        """
        print("=" * 60)
        print(f"【第三步】人工修正: {record_id}")
        print("=" * 60)
        
        record = self._find_record(record_id)
        if not record:
            return {"status": "error", "message": f"未找到记录 {record_id}"}
        
        old_status = record['attribution_status']
        
        if action == 'confirm_mismatch':
            record['attribution_status'] = 'pending_datascience_review'
            record['final_status'] = 'PENDING_REVIEW'
            record['corrected_by'] = 'laotang'
            record['correction_note'] = note or "阈值改过但报告仍写旧值，待数据科学家复核"
            print(f"✓ 记录 {record_id} 标记为【待数据科学家复核】")
            print(f"  说明: {record['correction_note']}")
            
        elif action == 'use_eval_data':
            eval_slice = self._find_eval_slice(record['segment'], record['metric'])
            if eval_slice:
                record['value'] = eval_slice['value']
                record['source'] = 'eval_slice_backfill'
                record['attribution_status'] = 'backfilled'
                record['final_status'] = self._calc_status(record['value'], record['threshold_used'])
                record['corrected_by'] = 'laotang'
                record['correction_note'] = note or "从评测切片补录旧口径数据"
                print(f"✓ 记录 {record_id} 已从评测切片补录")
                print(f"  补录值: {eval_slice['value']}, 状态: {record['final_status']}")
            else:
                return {"status": "error", "message": f"未找到对应的评测切片"}
            
        elif action == 'mark_normal':
            record['attribution_status'] = 'normal'
            record['final_status'] = 'normal'
            record['corrected_by'] = 'laotang'
            record['correction_note'] = note or "人工确认正常"
            print(f"✓ 记录 {record_id} 标记为正常")
        
        print()
        
        self.manual_corrections.append({
            "record_id": record_id,
            "action": action,
            "old_status": old_status,
            "new_status": record['attribution_status'],
            "timestamp": datetime.now().isoformat(),
            "note": note
        })
        
        self._log_history("STEP3_MANUAL_CORRECTION", {
            "record_id": record_id,
            "action": action,
            "old_status": old_status,
            "new_status": record['attribution_status']
        })
        
        return {
            "status": "success",
            "record_id": record_id,
            "action": action,
            "record": record
        }

    def step4_rerun_and_update(self) -> Dict:
        """
        第四步：重跑 & 分层指标更新
        """
        print("=" * 60)
        print("【第四步】重跑归因 & 分层指标更新")
        print("=" * 60)
        
        segmented_metrics: Dict[str, Dict] = {}
        status_summary: Dict[str, int] = {}
        
        for record in self.records:
            if record['final_status'] is None:
                record['final_status'] = self._calc_status(
                    record['value'], 
                    self._get_expected_threshold(record['segment'], record['metric']) or record['threshold_used']
                )
            
            seg = record['segment']
            metric = record['metric']
            if seg not in segmented_metrics:
                segmented_metrics[seg] = {}
            segmented_metrics[seg][metric] = {
                "value": record['value'],
                "threshold": self._get_expected_threshold(seg, metric) or record['threshold_used'],
                "status": record['final_status'],
                "attribution": record['attribution_status']
            }
            
            status = record['attribution_status']
            status_summary[status] = status_summary.get(status, 0) + 1
        
        print("分层指标汇总:")
        print("-" * 60)
        for seg, metrics in segmented_metrics.items():
            print(f"  [{seg}]")
            for metric_name, metric_data in metrics.items():
                print(f"    {metric_name}: {metric_data['value']:.4f} "
                      f"(阈值: {metric_data['threshold']:.4f}) "
                      f"→ {metric_data['status']} [{metric_data['attribution']}]")
        
        print()
        print("归因状态汇总:")
        print("-" * 60)
        for status, count in status_summary.items():
            print(f"  {status}: {count} 条")
        
        print()
        
        self._log_history("STEP4_RERUN_UPDATE", {
            "segmented_metrics": segmented_metrics,
            "status_summary": status_summary
        })
        
        return {
            "status": "success",
            "segmented_metrics": segmented_metrics,
            "status_summary": status_summary,
            "records": self.records
        }

    def generate_comparison_report(self) -> Dict:
        """
        生成三种场景对比报告
        """
        print()
        print("=" * 60)
        print("【三种场景处理结果对比】")
        print("=" * 60)
        
        scenarios = {
            "顺利记录": [],
            "阈值改过但报告仍写旧值（待复核）": [],
            "从评测切片补录旧口径": []
        }
        
        for record in self.records:
            if record['attribution_status'] == 'consistent' and not record['issues']:
                scenarios["顺利记录"].append(record)
            elif record['attribution_status'] == 'pending_datascience_review':
                scenarios["阈值改过但报告仍写旧值（待复核）"].append(record)
            elif record['attribution_status'] == 'backfilled':
                scenarios["从评测切片补录旧口径"].append(record)
        
        for scenario_name, records in scenarios.items():
            print(f"\n【{scenario_name}】({len(records)} 条)")
            print("-" * 40)
            for rec in records:
                print(f"  {rec['record_id']} [{rec['segment']}/{rec['metric']}]")
                print(f"    值: {rec['value']:.4f}, 报告阈值: {rec['threshold_used']:.4f}")
                if rec.get('correction_note'):
                    print(f"    修正说明: {rec['correction_note']}")
                print(f"    最终状态: {rec['final_status']}")
                print(f"    归因状态: {rec['attribution_status']}")
        
        print()
        print("=" * 60)
        print("【历史操作记录】")
        print("=" * 60)
        for i, entry in enumerate(self.history):
            print(f"  {i+1}. [{entry['timestamp']}] {entry['action']}")
            if 'details' in entry:
                for k, v in entry['details'].items():
                    if not isinstance(v, (dict, list)):
                        print(f"       {k}: {v}")
        
        return scenarios

    def _get_expected_threshold(self, segment: str, metric: str) -> Optional[float]:
        if not self.threshold_config:
            return None
        
        metrics = self.threshold_config['metrics']
        if segment == 'overall':
            if metric in metrics['overall']:
                return metrics['overall'][metric]['warning']
        else:
            if segment in metrics['segments']:
                if metric in metrics['segments'][segment]:
                    return metrics['segments'][segment][metric]['warning']
        return None

    def _find_record(self, record_id: str) -> Optional[Dict]:
        for rec in self.records:
            if rec['record_id'] == record_id:
                return rec
        return None

    def _find_eval_slice(self, segment: str, metric: str) -> Optional[Dict]:
        if not self.eval_slices:
            return None
        for sl in self.eval_slices['slices']:
            if sl['segment'] == segment and sl['metric'] == metric:
                return sl
        return None

    def _calc_status(self, value: float, threshold: float) -> str:
        if value >= threshold:
            return 'normal'
        elif value >= threshold * 0.8:
            return 'warning'
        else:
            return 'critical'

    def _log_history(self, action: str, details: Dict):
        self.history.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })

    def export_results(self, output_path: str):
        results = {
            "export_time": datetime.now().isoformat(),
            "threshold_version": self.threshold_version,
            "records": self.records,
            "history": self.history,
            "manual_corrections": self.manual_corrections
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n✓ 结果已导出到: {output_path}")
