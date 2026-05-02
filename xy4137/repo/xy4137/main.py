#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from config import EXAMPLES_DIR, RISK_LEVELS
from data_parser import DataParser
from feature_extractor import FeatureExtractor
from text_classifier import TextClassifier, get_default_training_data
from risk_fusion import RiskFusionEngine, RiskSource
from storage import StorageManager
from exporter import Exporter


class QualityInspector:
    RISK_ORDER = ["低风险", "中风险", "高风险", "极高风险"]
    
    def __init__(self):
        self.parser = DataParser()
        self.extractor = FeatureExtractor()
        self.classifier = TextClassifier()
        self.fusion_engine = RiskFusionEngine()
        self.storage = StorageManager()
        self.exporter = Exporter()
        
        self._initialized = False
        self._model_trained = False
    
    def initialize(self, train_model: bool = True) -> Dict:
        init_info = {
            "status": "success",
            "message": "初始化完成",
            "model_status": "未训练"
        }
        
        if self.classifier.load_model():
            self._model_trained = True
            init_info["model_status"] = "已加载预训练模型"
        elif train_model:
            texts, labels = get_default_training_data()
            train_info = self.classifier.train(texts, labels)
            self.classifier.save_model()
            self._model_trained = True
            init_info["model_status"] = f"已训练模型 ({train_info['total_samples']}样本)"
        
        self.storage.create_session()
        self._initialized = True
        
        return init_info
    
    def import_files(
        self,
        transcript_files: Optional[List[str]] = None,
        risk_tags_file: Optional[str] = None,
        callback_file: Optional[str] = None
    ) -> Dict:
        result = {
            "transcripts_imported": 0,
            "risk_tags_imported": 0,
            "callbacks_imported": 0,
            "errors": []
        }
        
        if transcript_files:
            for file_path in transcript_files:
                try:
                    path = Path(file_path)
                    if not path.exists():
                        result["errors"].append(f"文件不存在: {file_path}")
                        continue
                    
                    record = self.parser.parse_transcript(path)
                    self.storage.add_call_to_session(record.call_id)
                    result["transcripts_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"解析转写文件失败 {file_path}: {str(e)}")
        
        if risk_tags_file:
            try:
                path = Path(risk_tags_file)
                if not path.exists():
                    result["errors"].append(f"风险标签文件不存在: {risk_tags_file}")
                else:
                    records = self.parser.parse_risk_tags(path)
                    for record in records:
                        self.storage.add_call_to_session(record.call_id)
                    result["risk_tags_imported"] = len(records)
            except Exception as e:
                result["errors"].append(f"解析风险标签文件失败: {str(e)}")
        
        if callback_file:
            try:
                path = Path(callback_file)
                if not path.exists():
                    result["errors"].append(f"回访安排表不存在: {callback_file}")
                else:
                    records = self.parser.parse_callback_schedule(path)
                    for record in records:
                        self.storage.add_call_to_session(record.call_id)
                    result["callbacks_imported"] = len(records)
            except Exception as e:
                result["errors"].append(f"解析回访安排表失败: {str(e)}")
        
        return result
    
    def run_analysis(self) -> Dict:
        if not self._initialized:
            raise RuntimeError("请先调用 initialize() 进行初始化")
        
        call_ids = self.parser.get_call_ids()
        
        if not call_ids:
            return {
                "status": "warning",
                "message": "没有可分析的通话记录",
                "analyzed_count": 0
            }
        
        for call_id in call_ids:
            call_data = self.parser.get_call_data(call_id)
            
            transcript = call_data["transcript"]
            original_tag = call_data["risk_tag"]
            callback = call_data["callback"]
            
            text = transcript.content if transcript else ""
            
            features = None
            if text:
                features = self.extractor.extract(text, call_id)
            
            model_result = None
            if self._model_trained and text:
                try:
                    model_result = self.classifier.predict(text, call_id)
                except Exception:
                    pass
            
            fusion_result = self.fusion_engine.fuse(
                call_id=call_id,
                transcript=transcript,
                original_tag=original_tag,
                callback=callback,
                features=features,
                model_result=model_result
            )
            
            self.storage.mark_call_processed(call_id)
        
        time_conflicts = self.fusion_engine.detect_time_conflicts(self.parser.callbacks)
        self.storage.set_time_conflicts(time_conflicts)
        
        high_risk = self.fusion_engine.get_high_risk_cases()
        missed_high_risk = self.fusion_engine.get_missed_high_risk_cases()
        template_issues = self.fusion_engine.get_template_issue_cases()
        pending_callbacks = self.fusion_engine.get_pending_callback_list()
        
        return {
            "status": "success",
            "analyzed_count": len(call_ids),
            "high_risk_count": len(high_risk),
            "missed_high_risk_count": len(missed_high_risk),
            "template_issue_count": len(template_issues),
            "time_conflict_count": len(time_conflicts),
            "pending_callback_count": len(pending_callbacks)
        }
    
    def get_results_summary(self) -> Dict:
        results = self.fusion_engine.get_all_results()
        
        if not results:
            return {
                "total_calls": 0,
                "risk_distribution": {},
                "issues": {
                    "missed_high_risk": [],
                    "template_issues": [],
                    "time_conflicts": []
                }
            }
        
        risk_distribution = {}
        for result in results.values():
            risk = result.final_risk
            risk_distribution[risk] = risk_distribution.get(risk, 0) + 1
        
        missed_high_risk = [
            {
                "call_id": r.call_id,
                "original_risk": r.original_tag.risk_level if r.original_tag else "无标签",
                "detected_risk": r.final_risk,
                "confidence": r.confidence
            }
            for r in self.fusion_engine.get_missed_high_risk_cases()
        ]
        
        template_issues = [
            {
                "call_id": r.call_id,
                "template_score": r.template_issue_score,
                "phrases": [e.keyword for e in r.keyword_evidences if e.category == "模板话术"]
            }
            for r in self.fusion_engine.get_template_issue_cases()
        ]
        
        time_conflicts = [
            {
                "call_id_1": c.call_id_1,
                "call_id_2": c.call_id_2,
                "time_1": c.time_1.isoformat() if c.time_1 else None,
                "time_2": c.time_2.isoformat() if c.time_2 else None,
                "volunteer": c.volunteer
            }
            for c in self.fusion_engine.time_conflicts
        ]
        
        return {
            "total_calls": len(results),
            "risk_distribution": risk_distribution,
            "issues": {
                "missed_high_risk": missed_high_risk,
                "template_issues": template_issues,
                "time_conflicts": time_conflicts
            }
        }
    
    def get_call_detail(self, call_id: str) -> Optional[Dict]:
        result = self.fusion_engine.results.get(call_id)
        if not result:
            return None
        
        call_data = self.parser.get_call_data(call_id)
        
        return {
            "call_id": call_id,
            "transcript": call_data["transcript"],
            "original_tag": call_data["risk_tag"],
            "callback": call_data["callback"],
            "analysis_result": {
                "final_risk": result.final_risk,
                "final_risk_level": result.final_risk_level,
                "risk_source": result.risk_source.value if result.risk_source else None,
                "confidence": result.confidence,
                "is_missed_high_risk": result.is_missed_high_risk,
                "has_template_issue": result.has_template_issue,
                "template_issue_score": result.template_issue_score,
                "keyword_evidences": [
                    {
                        "keyword": e.keyword,
                        "count": e.count,
                        "category": e.category
                    }
                    for e in result.keyword_evidences
                ],
                "model_probabilities": result.model_result.probabilities if result.model_result else None,
                "manual_override": result.manual_override,
                "override_reason": result.override_reason
            }
        }
    
    def manual_review(
        self,
        call_id: str,
        new_risk: str,
        reason: str,
        reviewer: str = "督导"
    ) -> Dict:
        result = self.fusion_engine.results.get(call_id)
        if not result:
            return {
                "status": "error",
                "message": f"未找到通话记录: {call_id}"
            }
        
        if new_risk not in self.RISK_ORDER:
            return {
                "status": "error",
                "message": f"无效的风险等级: {new_risk}，有效值: {self.RISK_ORDER}"
            }
        
        original_risk = result.final_risk
        
        self.fusion_engine.manual_override(call_id, new_risk, reason)
        
        self.storage.add_review(
            call_id=call_id,
            original_risk=original_risk,
            new_risk=new_risk,
            reviewer=reviewer,
            reason=reason
        )
        
        return {
            "status": "success",
            "call_id": call_id,
            "original_risk": original_risk,
            "new_risk": new_risk,
            "reason": reason,
            "reviewer": reviewer
        }
    
    def export_results(self) -> Dict[str, str]:
        results = self.fusion_engine.get_all_results()
        time_conflicts = self.fusion_engine.time_conflicts
        pending_callbacks = self.fusion_engine.get_pending_callback_list()
        session = self.storage.get_current_session()
        
        exported_files = self.exporter.export_all(
            results=results,
            time_conflicts=time_conflicts,
            pending_callbacks=pending_callbacks,
            session=session
        )
        
        return exported_files
    
    def save_session(self) -> str:
        return self.storage.save_session()
    
    def load_session(self, session_id: str) -> Dict:
        session = self.storage.load_session(session_id)
        if not session:
            return {
                "status": "error",
                "message": f"未找到会话: {session_id}"
            }
        
        return {
            "status": "success",
            "session_id": session.session_id,
            "created_at": session.created_at,
            "call_count": len(session.call_ids),
            "reviewed_count": len(session.reviewed_calls)
        }
    
    def list_sessions(self) -> List[Dict]:
        return self.storage.list_sessions()


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    倾听记录质检员                               ║
║          Listener Record Quality Inspector                    ║
╠══════════════════════════════════════════════════════════════╣
║  功能: 风险等级评估 | 关键词证据提取 | 模板话术检测           ║
║        回访时间冲突检测 | 人工改判 | 多格式导出                ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def print_help():
    help_text = """
可用命令:
  init                    - 初始化系统（训练模型）
  import <文件>           - 导入文件（支持多个文件）
    --transcripts <文件>  - 指定通话转写TXT文件
    --risk-tags <文件>    - 指定风险标签CSV文件
    --callback <文件>     - 指定回访安排表CSV文件
  analyze                 - 运行质检分析
  summary                 - 显示分析摘要
  detail <call_id>        - 查看通话详情
  review <call_id>        - 人工改判风险等级
  export                  - 导出所有报告
  save                    - 保存当前会话
  load <session_id>       - 加载历史会话
  list-sessions           - 列出所有会话
  example                 - 使用示例数据进行演示
  help                    - 显示帮助信息
  exit                    - 退出程序
"""
    print(help_text)


def interactive_mode():
    print_banner()
    
    inspector = QualityInspector()
    
    print("正在初始化系统...")
    init_info = inspector.initialize()
    print(f"✓ {init_info['message']}")
    print(f"✓ 模型状态: {init_info['model_status']}")
    print()
    
    while True:
        try:
            user_input = input("\n[质检系统] 请输入命令 (输入 help 查看帮助): ").strip()
            if not user_input:
                continue
            
            parts = user_input.split()
            command = parts[0].lower()
            args = parts[1:]
            
            if command == "exit" or command == "quit":
                print("感谢使用，再见！")
                break
            
            elif command == "help":
                print_help()
            
            elif command == "init":
                print("正在重新初始化...")
                init_info = inspector.initialize(train_model=True)
                print(f"✓ 初始化完成")
                print(f"✓ 模型状态: {init_info['model_status']}")
            
            elif command == "import":
                transcript_files = []
                risk_tags_file = None
                callback_file = None
                
                i = 0
                while i < len(args):
                    if args[i] == "--transcripts" and i + 1 < len(args):
                        i += 1
                        while i < len(args) and not args[i].startswith("--"):
                            transcript_files.append(args[i])
                            i += 1
                        continue
                    elif args[i] == "--risk-tags" and i + 1 < len(args):
                        i += 1
                        risk_tags_file = args[i]
                    elif args[i] == "--callback" and i + 1 < len(args):
                        i += 1
                        callback_file = args[i]
                    else:
                        if args[i].endswith('.txt'):
                            transcript_files.append(args[i])
                        elif args[i].endswith('.csv'):
                            if 'risk' in args[i].lower() or 'tag' in args[i].lower():
                                risk_tags_file = args[i]
                            elif 'callback' in args[i].lower() or '回访' in args[i]:
                                callback_file = args[i]
                    i += 1
                
                if not transcript_files and not risk_tags_file and not callback_file:
                    print("请指定要导入的文件")
                    continue
                
                result = inspector.import_files(
                    transcript_files=transcript_files if transcript_files else None,
                    risk_tags_file=risk_tags_file,
                    callback_file=callback_file
                )
                
                print(f"导入结果:")
                print(f"  通话转写: {result['transcripts_imported']} 个")
                print(f"  风险标签: {result['risk_tags_imported']} 个")
                print(f"  回访安排: {result['callbacks_imported']} 个")
                
                if result["errors"]:
                    print("\n错误:")
                    for error in result["errors"]:
                        print(f"  - {error}")
            
            elif command == "analyze":
                print("正在运行质检分析...")
                result = inspector.run_analysis()
                
                if result["status"] == "warning":
                    print(f"⚠ {result['message']}")
                else:
                    print(f"✓ 分析完成")
                    print(f"  分析通话数: {result['analyzed_count']}")
                    print(f"  高风险案例: {result['high_risk_count']}")
                    print(f"  漏标高风险: {result['missed_high_risk_count']}")
                    print(f"  模板话术问题: {result['template_issue_count']}")
                    print(f"  时间冲突: {result['time_conflict_count']}")
                    print(f"  待回访: {result['pending_callback_count']}")
            
            elif command == "summary":
                summary = inspector.get_results_summary()
                
                if summary["total_calls"] == 0:
                    print("暂无分析结果，请先运行 analyze 命令")
                    continue
                
                print(f"\n【质检摘要】")
                print(f"总通话数: {summary['total_calls']}")
                print(f"\n风险分布:")
                for risk, count in summary["risk_distribution"].items():
                    print(f"  {risk}: {count}")
                
                issues = summary["issues"]
                
                if issues["missed_high_risk"]:
                    print(f"\n⚠ 漏标高风险案例 ({len(issues['missed_high_risk'])}):")
                    for item in issues["missed_high_risk"]:
                        print(f"  - {item['call_id']}: 原始标签={item['original_risk']} → 检测到={item['detected_risk']} (置信度={item['confidence']*100:.1f}%)")
                
                if issues["template_issues"]:
                    print(f"\n⚠ 模板话术问题 ({len(issues['template_issues'])}):")
                    for item in issues["template_issues"]:
                        phrases = ", ".join(item["phrases"][:3])
                        print(f"  - {item['call_id']}: 模板占比={item['template_score']*100:.1f}%, 检测到: {phrases}")
                
                if issues["time_conflicts"]:
                    print(f"\n⚠ 回访时间冲突 ({len(issues['time_conflicts'])}):")
                    for item in issues["time_conflicts"]:
                        volunteer = item['volunteer'] or "未分配志愿者"
                        print(f"  - {item['call_id_1']} 与 {item['call_id_2']} 冲突 ({volunteer})")
            
            elif command == "detail":
                if not args:
                    print("请指定通话ID")
                    continue
                
                call_id = args[0]
                detail = inspector.get_call_detail(call_id)
                
                if not detail:
                    print(f"未找到通话记录: {call_id}")
                    continue
                
                analysis = detail["analysis_result"]
                
                print(f"\n【通话详情】{call_id}")
                print(f"\n分析结果:")
                print(f"  风险等级: {analysis['final_risk']}")
                print(f"  判定来源: {analysis['risk_source']}")
                print(f"  置信度: {analysis['confidence']*100:.1f}%")
                print(f"  漏标高风险: {'是' if analysis['is_missed_high_risk'] else '否'}")
                print(f"  模板话术问题: {'是' if analysis['has_template_issue'] else '否'}")
                
                if analysis["keyword_evidences"]:
                    print(f"\n关键词证据:")
                    for ev in analysis["keyword_evidences"]:
                        print(f"  - [{ev['category']}] {ev['keyword']} x{ev['count']}")
                
                if analysis["model_probabilities"]:
                    print(f"\n模型预测概率:")
                    for risk, prob in sorted(analysis["model_probabilities"].items(), 
                                            key=lambda x: x[1], reverse=True):
                        print(f"  {risk}: {prob*100:.1f}%")
                
                if detail["original_tag"]:
                    print(f"\n原始标签:")
                    print(f"  风险等级: {detail['original_tag'].risk_level}")
                    if detail['original_tag'].tags:
                        print(f"  标签: {', '.join(detail['original_tag'].tags)}")
                
                if detail["callback"]:
                    print(f"\n回访安排:")
                    cb = detail["callback"]
                    if cb.callback_time:
                        print(f"  时间: {cb.callback_time.strftime('%Y-%m-%d %H:%M')}")
                    if cb.assigned_volunteer:
                        print(f"  志愿者: {cb.assigned_volunteer}")
                    print(f"  优先级: {cb.priority}")
                    print(f"  状态: {cb.status}")
                
                if analysis["manual_override"]:
                    print(f"\n人工改判:")
                    print(f"  改判原因: {analysis['override_reason']}")
            
            elif command == "review":
                if not args:
                    print("请指定通话ID")
                    continue
                
                call_id = args[0]
                
                detail = inspector.get_call_detail(call_id)
                if not detail:
                    print(f"未找到通话记录: {call_id}")
                    continue
                
                print(f"\n当前风险等级: {detail['analysis_result']['final_risk']}")
                print(f"可用风险等级: {', '.join(inspector.RISK_ORDER)}")
                
                new_risk = input("请输入新的风险等级: ").strip()
                if new_risk not in inspector.RISK_ORDER:
                    print(f"无效的风险等级")
                    continue
                
                reason = input("请输入改判原因: ").strip()
                if not reason:
                    print("改判原因不能为空")
                    continue
                
                reviewer = input("请输入改判人姓名 (默认: 督导): ").strip() or "督导"
                
                result = inspector.manual_review(call_id, new_risk, reason, reviewer)
                
                if result["status"] == "success":
                    print(f"✓ 改判成功: {result['original_risk']} → {result['new_risk']}")
                else:
                    print(f"✗ 改判失败: {result['message']}")
            
            elif command == "export":
                print("正在导出报告...")
                files = inspector.export_results()
                
                print(f"✓ 导出完成:")
                for name, path in files.items():
                    print(f"  {name}: {path}")
            
            elif command == "save":
                path = inspector.save_session()
                print(f"✓ 会话已保存: {path}")
            
            elif command == "load":
                if not args:
                    print("请指定会话ID")
                    continue
                
                session_id = args[0]
                result = inspector.load_session(session_id)
                
                if result["status"] == "success":
                    print(f"✓ 会话加载成功: {result['session_id']}")
                    print(f"  创建时间: {result['created_at']}")
                    print(f"  通话数: {result['call_count']}")
                    print(f"  已复核: {result['reviewed_count']}")
                else:
                    print(f"✗ 加载失败: {result['message']}")
            
            elif command == "list-sessions":
                sessions = inspector.list_sessions()
                
                if not sessions:
                    print("暂无历史会话")
                    continue
                
                print(f"\n历史会话 ({len(sessions)}):")
                for s in sessions:
                    print(f"\n  会话ID: {s['session_id']}")
                    print(f"  创建时间: {s['created_at']}")
                    print(f"  通话数: {s['call_count']}, 已处理: {s['processed_count']}, 已复核: {s['reviewed_count']}")
            
            elif command == "example":
                print("正在加载示例数据...")
                
                example_dir = EXAMPLES_DIR
                
                transcript_files = list(example_dir.glob("call_*.txt"))
                risk_tags_file = example_dir / "risk_tags_20240501.csv"
                callback_file = example_dir / "callback_schedule_20240501.csv"
                
                if not transcript_files:
                    print("未找到示例转写文件")
                    continue
                
                result = inspector.import_files(
                    transcript_files=[str(f) for f in transcript_files],
                    risk_tags_file=str(risk_tags_file) if risk_tags_file.exists() else None,
                    callback_file=str(callback_file) if callback_file.exists() else None
                )
                
                print(f"✓ 导入完成:")
                print(f"  通话转写: {result['transcripts_imported']} 个")
                print(f"  风险标签: {result['risk_tags_imported']} 个")
                print(f"  回访安排: {result['callbacks_imported']} 个")
                
                print("\n正在运行分析...")
                analysis_result = inspector.run_analysis()
                
                print(f"\n✓ 分析完成！")
                print(f"\n【发现的问题】")
                print(f"  高风险案例: {analysis_result['high_risk_count']}")
                print(f"  漏标高风险: {analysis_result['missed_high_risk_count']}")
                print(f"  模板话术问题: {analysis_result['template_issue_count']}")
                print(f"  时间冲突: {analysis_result['time_conflict_count']}")
                
                print("\n提示: 可使用 'summary' 查看完整摘要，'export' 导出报告")
            
            else:
                print(f"未知命令: {command}，输入 'help' 查看帮助")
        
        except KeyboardInterrupt:
            print("\n\n程序被中断，正在退出...")
            break
        
        except Exception as e:
            print(f"发生错误: {str(e)}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    interactive_mode()
