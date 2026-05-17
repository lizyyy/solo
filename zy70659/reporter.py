import csv
import json
from typing import List
from datetime import datetime
from deduplicator import DeduplicationResult, DuplicateGroup
from utils import Lead


class ReportGenerator:
    def __init__(self, result: DeduplicationResult):
        self.result = result
    
    def generate_machine_readable_csv(self, output_path: str):
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '群组ID', '类型', '原始ID', '手机号', '邮箱', '公司名', 
                '姓名', '来源渠道', '匹配原因', '匹配分数', '推荐保留', 
                '冲突字段', '建议合并来源'
            ])
            
            for group in self.result.duplicate_groups:
                primary = group.primary_lead
                conflict_str = json.dumps(
                    [f"{cf['field']}:{'|'.join(cf['values'])}" 
                     for cf in group.merge_suggestion['conflict_fields']],
                    ensure_ascii=False
                ) if group.merge_suggestion['conflict_fields'] else ''
                sources_str = ','.join(group.merge_suggestion['sources'])
                
                writer.writerow([
                    group.group_id, '保留', primary.id, primary.phone, 
                    primary.email, primary.company, primary.name,
                    primary.source, group.match_reason, 
                    f"{group.match_score:.2f}", '是',
                    conflict_str, sources_str
                ])
                
                for dup in group.duplicate_leads:
                    writer.writerow([
                        group.group_id, '重复', dup.id, dup.phone,
                        dup.email, dup.company, dup.name,
                        dup.source, group.match_reason,
                        f"{group.match_score:.2f}", '否',
                        conflict_str, sources_str
                    ])
            
            unique_ids = set(ld.id for grp in self.result.duplicate_groups 
                            for ld in [grp.primary_lead] + grp.duplicate_leads)
            for lead in self.result.unique_leads:
                if lead.id not in unique_ids:
                    writer.writerow([
                        'SINGLE', '唯一', lead.id, lead.phone,
                        lead.email, lead.company, lead.name,
                        lead.source, '', '', '是', '', ''
                    ])
    
    def generate_human_readable_markdown(self, output_path: str):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        content = f"""# 渠道线索去重报告

生成时间：{now}

## 一、去重概览

| 指标 | 数量 | 说明 |
|------|------|------|
| 输入线索总数 | {self.result.total_input} | 所有待处理线索 |
| 去重后唯一线索 | {self.result.total_unique} | 保留的有效线索 |
| 发现重复线索 | {self.result.total_duplicates} | 需要处理的重复 |
| 重复率 | {(self.result.total_duplicates/self.result.total_input*100):.1f}% | 重复线索占比 |
| 去重群组数 | {len(self.result.duplicate_groups)} | 包含重复的线索组 |

## 二、来源优先级规则

本次去重使用的来源优先级（数字越小优先级越高）：

| 来源渠道 | 优先级 |
|----------|--------|
| 展会 | 1（最高） |
| 电话 | 2 |
| 表单 | 3 |

## 三、去重匹配规则

1. **手机号匹配**：手机号模糊匹配（去除非数字字符后）
2. **邮箱匹配**：邮箱模糊匹配（忽略大小写）
3. **公司名+邮箱前缀匹配**：当手机号缺位时，通过公司名相似度 + 邮箱前缀相似度综合判断

## 四、重复群组详情

"""
        
        for idx, group in enumerate(self.result.duplicate_groups, 1):
            content += f"### {idx}. 群组 {group.group_id}\n\n"
            content += f"- **匹配原因**：{group.match_reason}\n"
            content += f"- **匹配分数**：{group.match_score:.2f}\n"
            content += f"- **推荐保留来源**：{group.merge_suggestion['recommended_source']}\n\n"
            
            content += "#### 线索列表\n\n"
            content += "| 状态 | ID | 姓名 | 手机号 | 邮箱 | 公司名 | 来源 |\n"
            content += "|------|----|------|--------|------|--------|------|\n"
            
            primary = group.primary_lead
            content += f"| ✅ 保留 | {primary.id} | {primary.name or '-'} | {primary.phone or '-'} | {primary.email or '-'} | {primary.company or '-'} | {primary.source or '-'} |\n"
            
            for dup in group.duplicate_leads:
                content += f"| ❌ 重复 | {dup.id} | {dup.name or '-'} | {dup.phone or '-'} | {dup.email or '-'} | {dup.company or '-'} | {dup.source or '-'} |\n"
            
            if group.merge_suggestion['conflict_fields']:
                content += "\n#### 字段冲突提示\n\n"
                for conflict in group.merge_suggestion['conflict_fields']:
                    field_name = {'phone': '手机号', 'email': '邮箱', 'company': '公司名', 'name': '姓名'}.get(conflict['field'], conflict['field'])
                    content += f"- **{field_name}**：建议保留「{conflict['primary_value'] or '-'}」，其他值：{'、'.join([v or '-' for v in conflict['values'] if v != conflict['primary_value']])}\n"
            
            content += "\n---\n\n"
        
        if self.result.duplicate_groups:
            content += "## 五、使用建议\n\n"
            content += "1. 请重点关注有字段冲突的群组，人工核对后确定最终保留值\n"
            content += "2. 来源优先级：展会线索质量通常最高，优先保留\n"
            content += "3. 公司名+邮箱前缀匹配的结果建议人工复核\n"
            content += "4. 所有被标记为重复的线索并非无效，可作为同公司多联系人处理\n\n"
        else:
            content += "## 五、结果说明\n\n"
            content += "🎉 本次未检测到重复线索，所有线索均为唯一！\n\n"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def generate_unique_leads_csv(self, output_path: str):
        from utils import write_leads_to_csv
        write_leads_to_csv(self.result.unique_leads, output_path)
