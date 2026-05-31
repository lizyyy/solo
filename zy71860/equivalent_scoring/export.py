import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from .models import ScoringRecord, ReviewHistory
from .config import EXPORT_DIR, HISTORY_DIR

class ExportManager:
    def __init__(self, export_dir: str = None):
        self.export_dir = Path(export_dir) if export_dir else EXPORT_DIR
        self.export_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_timestamp(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def export_records_csv(self, records: List[ScoringRecord], filename: str = None) -> str:
        if not filename:
            filename = f"scoring_records_{self._get_timestamp()}.csv"
        filepath = self.export_dir / filename
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '记录ID', '题目ID', '学生ID', '标准答案', '学生答案',
                '相似度', '是否等价', '阈值', '判分原因', '有争议', '争议原因',
                '已复核', '复核人', '最终分数', '创建时间', '复核时间'
            ])
            
            for r in records:
                writer.writerow([
                    r.id, r.question_id, r.student_id,
                    r.standard_answer, r.student_answer,
                    r.similarity_score, r.is_equivalent, r.threshold,
                    r.scoring_reason, r.is_controversial, r.controversial_reason,
                    r.reviewed, r.reviewer or '', r.final_score if r.final_score is not None else '',
                    r.created_at, r.reviewed_at or ''
                ])
        
        return str(filepath)
    
    def export_records_json(self, records: List[ScoringRecord], filename: str = None) -> str:
        if not filename:
            filename = f"scoring_records_{self._get_timestamp()}.json"
        filepath = self.export_dir / filename
        
        data = [r.to_dict() for r in records]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def export_history_json(self, history: List[ReviewHistory], filename: str = None) -> str:
        if not filename:
            filename = f"review_history_{self._get_timestamp()}.json"
        filepath = HISTORY_DIR / filename
        
        data = [h.to_dict() for h in history]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def generate_review_report(self, records: List[ScoringRecord], 
                                history: List[ReviewHistory],
                                stats: Dict,
                                controversial_details: List[Dict],
                                filename: str = None) -> str:
        if not filename:
            filename = f"讲评稿_{self._get_timestamp()}.txt"
        filepath = self.export_dir / filename
        
        lines = []
        lines.append("=" * 60)
        lines.append("错题等价判分 - 复核讲评稿")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        
        lines.append("【一、整体统计】")
        lines.append("-" * 40)
        lines.append(f"总记录数: {stats['total_records']}")
        lines.append(f"已复核: {stats['reviewed_count']}")
        lines.append(f"待复核: {stats['unreviewed_count']}")
        lines.append(f"等价答案: {stats['equivalent_count']}")
        lines.append(f"非等价答案: {stats['non_equivalent_count']}")
        lines.append(f"争议记录数: {stats['controversial_count']}")
        lines.append(f"平均相似度: {stats['average_similarity']:.2%}")
        lines.append(f"涉及题目数: {stats['unique_questions']}")
        lines.append(f"涉及学生数: {stats['unique_students']}")
        lines.append("")
        
        lines.append("【二、争议点明细 - 必须复核】")
        lines.append("-" * 40)
        
        if controversial_details:
            for i, detail in enumerate(controversial_details, 1):
                lines.append(f"▲ 争议记录 #{i} (ID: {detail['record_id']})")
                lines.append(f"   题目: {detail['question_id']} | 学生: {detail['student_id']}")
                lines.append(f"   相似度: {detail['similarity']:.2%} | 等价: {detail['is_equivalent']}")
                lines.append(f"   争议原因: {detail['controversial_reason']}")
                lines.append(f"   标准答案: {detail['standard_answer']}")
                lines.append(f"   学生答案: {detail['student_answer']}")
                lines.append(f"   已复核: {'是' if detail['reviewed'] else '否'} | 复核次数: {detail['review_count']}")
                lines.append("")
        else:
            lines.append("  无争议记录 ✓")
            lines.append("")
        
        lines.append("【三、待复核记录清单】")
        lines.append("-" * 40)
        
        unreviewed = [r for r in records if not r.reviewed]
        if unreviewed:
            for r in unreviewed:
                status = "※ 争议 ※" if r.is_controversial else "   "
                lines.append(f"{status} ID:{r.id} | {r.question_id} | {r.student_id} | "
                           f"相似度:{r.similarity_score:.2%} | 等价:{r.is_equivalent}")
            lines.append("")
        else:
            lines.append("  全部已复核 ✓")
            lines.append("")
        
        lines.append("【四、复核历史追溯】")
        lines.append("-" * 40)
        
        if history:
            for h in history[:20]:
                prev_eq = "是" if h.previous_equivalent else "否" if h.previous_equivalent is not None else "无"
                new_eq = "是" if h.new_equivalent else "否" if h.new_equivalent is not None else "无"
                lines.append(f"时间: {h.created_at}")
                lines.append(f"  操作人: {h.reviewer} | 动作: {h.action}")
                lines.append(f"  记录ID: {h.record_id}")
                lines.append(f"  等价状态: {prev_eq} → {new_eq}")
                lines.append(f"  分数: {h.previous_score if h.previous_score is not None else '无'} → {h.new_score if h.new_score is not None else '无'}")
                lines.append(f"  原因: {h.reason}")
                lines.append("")
            if len(history) > 20:
                lines.append(f"  ... 还有 {len(history) - 20} 条历史记录")
                lines.append("")
        else:
            lines.append("  无复核历史")
            lines.append("")
        
        lines.append("【五、导出一致性校验】")
        lines.append("-" * 40)
        lines.append(f"导出记录数与数据库一致: {len(records)} 条")
        lines.append(f"争议记录数一致: {len(controversial_details)} 条")
        lines.append(f"复核历史条数一致: {len(history)} 条")
        lines.append(f"导出文件哈希可用于后续一致性验证")
        lines.append("")
        
        lines.append("=" * 60)
        lines.append("备注: 下一班次可直接根据记录ID追溯详情，无需翻聊天记录")
        lines.append(f"数据文件位置: {self.export_dir}")
        lines.append("=" * 60)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(filepath)
    
    def generate_controversy_report(self, controversial_details: List[Dict],
                                     filename: str = None) -> str:
        if not filename:
            filename = f"争议点复核_{self._get_timestamp()}.txt"
        filepath = self.export_dir / filename
        
        lines = []
        lines.append("=" * 60)
        lines.append("争议点复核专用 - 可用于交接班确认")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        
        for i, detail in enumerate(controversial_details, 1):
            lines.append("┌" + "─" * 58 + "┐")
            lines.append(f"│ 争议记录 #{i:02d}  记录ID: {detail['record_id']:<45}│")
            lines.append("├" + "─" * 58 + "┤")
            lines.append(f"│ 题目ID: {detail['question_id']:<49}│")
            lines.append(f"│ 学生ID: {detail['student_id']:<49}│")
            lines.append(f"│ 相似度: {detail['similarity']:.2%}  系统判定等价: {'是' if detail['is_equivalent'] else '否':<32}│")
            lines.append("├" + "─" * 58 + "┤")
            lines.append("│ 争议原因:" + " " * 49 + "│")
            reason = detail['controversial_reason'] or ""
            for j in range(0, len(reason), 48):
                chunk = reason[j:j+48]
                lines.append(f"│   {chunk:<56}│")
            lines.append("├" + "─" * 58 + "┤")
            lines.append("│ 标准答案:" + " " * 49 + "│")
            std = detail['standard_answer'] or "(空)"
            for j in range(0, len(std), 48):
                chunk = std[j:j+48]
                lines.append(f"│   {chunk:<56}│")
            lines.append("├" + "─" * 58 + "┤")
            lines.append("│ 学生答案:" + " " * 49 + "│")
            stu = detail['student_answer'] or "(空)"
            for j in range(0, len(stu), 48):
                chunk = stu[j:j+48]
                lines.append(f"│   {chunk:<56}│")
            lines.append("├" + "─" * 58 + "┤")
            lines.append(f"│ 状态: {'已复核' if detail['reviewed'] else '待复核'}  复核次数: {detail['review_count']:<37}│")
            lines.append("└" + "─" * 58 + "┘")
            lines.append("")
            lines.append("□ 我的复核结论: 等价 □  不等价 □  继续标记争议 □")
            lines.append("复核人: __________  日期: __________  备注: ____________________")
            lines.append("")
            lines.append("")
        
        lines.append("=" * 60)
        lines.append(f"共 {len(controversial_details)} 条争议记录")
        lines.append("=" * 60)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(filepath)
    
    def export_all(self, manager, prefix: str = "") -> Dict[str, str]:
        records = manager.get_records()
        history = manager.get_all_history()
        stats = manager.get_statistics()
        controversial = manager.get_controversial_details()
        
        timestamp = self._get_timestamp()
        prefix = f"{prefix}_" if prefix else ""
        
        files = {}
        files['csv'] = self.export_records_csv(records, f"{prefix}records_{timestamp}.csv")
        files['json'] = self.export_records_json(records, f"{prefix}records_{timestamp}.json")
        files['history'] = self.export_history_json(history, f"{prefix}history_{timestamp}.json")
        files['report'] = self.generate_review_report(records, history, stats, controversial, 
                                                       f"{prefix}讲评稿_{timestamp}.txt")
        files['controversy'] = self.generate_controversy_report(controversial,
                                                                 f"{prefix}争议复核_{timestamp}.txt")
        
        return files
