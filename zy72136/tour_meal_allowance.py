import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
import re


class TourMealAllowanceChecker:
    def __init__(self, excel_path: str):
        self.excel_path = excel_path
        self.df = None
        self.issues = {
            "duplicate_tracks": [],
            "expired_license": [],
            "missing_license": [],
            "old_master_tapes": [],
            "timecode_mismatch": [],
            "empty_values": [],
            "manual_rename": [],
            "old_format": [],
            "need_confirmation": []
        }
        self.smooth_records = []
        self.processing_suggestions = []
        
    def load_data(self) -> bool:
        try:
            self.df = pd.read_excel(self.excel_path, engine='openpyxl')
            self.df = self.df.fillna("")
            return True
        except Exception as e:
            print(f"加载Excel失败: {e}")
            return False
    
    def check_duplicates(self):
        id_counts = self.df['曲目编号'].value_counts()
        duplicate_ids = id_counts[id_counts > 1].index.tolist()
        
        for track_id in duplicate_ids:
            records = self.df[self.df['曲目编号'] == track_id]
            self.issues["duplicate_tracks"].append({
                "曲目编号": track_id,
                "重复次数": len(records),
                "涉及曲目": records['曲目名称'].tolist(),
                "版本": records['版本'].tolist(),
                "建议": "请核对保留最新版本，删除重复记录或重新分配曲目编号"
            })
    
    def check_license(self):
        today = datetime.now()
        
        for idx, row in self.df.iterrows():
            track_id = row['曲目编号']
            track_name = row['曲目名称']
            license_status = str(row['授权状态']).strip()
            expiry_date = str(row['授权到期日']).strip()
            
            if license_status == "过期":
                self.issues["expired_license"].append({
                    "曲目编号": track_id,
                    "曲目名称": track_name,
                    "授权到期日": expiry_date if expiry_date else "未填写",
                    "建议": "请立即联系版权方更新授权，避免演出风险"
                })
            elif license_status == "待确认":
                self.issues["missing_license"].append({
                    "曲目编号": track_id,
                    "曲目名称": track_name,
                    "建议": "请林老师或行政确认授权状态后再安排演出"
                })
            elif expiry_date:
                try:
                    expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
                    days_left = (expiry - today).days
                    if days_left < 30:
                        self.issues["expired_license"].append({
                            "曲目编号": track_id,
                            "曲目名称": track_name,
                            "授权到期日": expiry_date,
                            "剩余天数": days_left,
                            "建议": f"授权即将到期（剩余{days_left}天），请提前安排续约"
                        })
                except:
                    pass
    
    def check_old_masters(self):
        old_patterns = ['母带', '典藏版', '2022', '2023', '旧版']
        
        for idx, row in self.df.iterrows():
            version = str(row['版本']).strip()
            remarks = str(row['备注']).strip()
            full_text = version + " " + remarks
            
            if any(pattern in full_text for pattern in old_patterns) and "2024巡演版" not in version:
                self.issues["old_master_tapes"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "版本": version,
                    "建议": "请确认是否需要使用2024巡演新版，旧版母带音质可能不适合现场演出"
                })
    
    def check_timecode(self):
        def time_to_seconds(t: str) -> Optional[int]:
            if not t or not isinstance(t, str):
                return None
            parts = t.split(':')
            if len(parts) == 3:
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + int(s)
            elif len(parts) == 2:
                m, s = parts
                return int(m) * 60 + int(s)
            return None
        
        def duration_to_seconds(d: str) -> Optional[int]:
            if not d or not isinstance(d, str):
                return None
            parts = d.split(':')
            if len(parts) == 2:
                m, s = parts
                return int(m) * 60 + int(s)
            return None
        
        for idx, row in self.df.iterrows():
            start_time = str(row['开始时间']).strip()
            end_time = str(row['结束时间']).strip()
            duration = str(row['时长']).strip()
            remarks = str(row['备注']).strip()
            
            start_sec = time_to_seconds(start_time)
            end_sec = time_to_seconds(end_time)
            dur_sec = duration_to_seconds(duration)
            
            mismatch = False
            reason = ""
            
            if "时码错位" in remarks:
                mismatch = True
                reason = "备注中标记有时码错位，请核对"
            
            if mismatch:
                self.issues["timecode_mismatch"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "开始时间": start_time,
                    "结束时间": end_time,
                    "标注时长": duration,
                    "问题": reason,
                    "建议": "请音频组核对时码，确保节目单时间准确"
                })
    
    def check_empty_values(self):
        critical_fields = ['参演人数', '餐补标准', '授权到期日']
        
        for idx, row in self.df.iterrows():
            empty_fields = []
            for field in critical_fields:
                val = str(row[field]).strip()
                if val == "" or val == "nan":
                    empty_fields.append(field)
            
            if empty_fields:
                self.issues["empty_values"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "缺失字段": empty_fields,
                    "建议": "请补充完整信息后再计算餐补"
                })
    
    def check_manual_rename(self):
        for idx, row in self.df.iterrows():
            remarks = str(row['备注']).strip()
            if "改名" in remarks or "原名" in remarks:
                self.issues["manual_rename"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "备注": remarks,
                    "建议": "已记录人工改名，请在最终节目单中使用新名称"
                })
    
    def check_old_format(self):
        for idx, row in self.df.iterrows():
            version = str(row['版本']).strip()
            remarks = str(row['备注']).strip()
            
            if "旧口径" in version or "旧口径" in remarks:
                old_name = row.get('曲目名称（旧）', '')
                self.issues["old_format"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "旧名称": str(old_name) if old_name else "未知",
                    "版本": version,
                    "建议": "从旧口径导入的数据，请确认曲目名称和版本是否正确"
                })
    
    def check_need_confirmation(self):
        for idx, row in self.df.iterrows():
            remarks = str(row['备注']).strip()
            if "人工确认" in remarks or "林老师" in remarks and "确认" in remarks:
                self.issues["need_confirmation"].append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "备注": remarks,
                    "建议": "请林老师亲自确认后再继续处理"
                })
    
    def find_smooth_records(self):
        for idx, row in self.df.iterrows():
            remarks = str(row['备注']).strip()
            if "顺利" in remarks or "正常" in remarks:
                self.smooth_records.append({
                    "曲目编号": row['曲目编号'],
                    "曲目名称": row['曲目名称'],
                    "状态": "正常",
                    "说明": remarks
                })
    
    def generate_suggestions(self):
        suggestions = []
        
        total_issues = sum(len(v) for v in self.issues.values())
        if total_issues == 0:
            suggestions.append("✅ 所有曲目检查通过，可以直接安排演出和餐补发放")
            return suggestions
        
        if self.issues["duplicate_tracks"]:
            suggestions.append(f"⚠️ 发现 {len(self.issues['duplicate_tracks'])} 组重复曲目编号，请先核对去重")
        
        if self.issues["expired_license"]:
            suggestions.append(f"🔴 发现 {len(self.issues['expired_license'])} 个授权过期或即将到期，请立即处理")
        
        if self.issues["missing_license"]:
            suggestions.append(f"🟡 发现 {len(self.issues['missing_license'])} 个授权待确认，请联系林老师")
        
        if self.issues["old_master_tapes"]:
            suggestions.append(f"🔵 发现 {len(self.issues['old_master_tapes'])} 个旧版母带曲目，请确认是否使用新版")
        
        if self.issues["timecode_mismatch"]:
            suggestions.append(f"⚡ 发现 {len(self.issues['timecode_mismatch'])} 个时码错位问题，请音频组核对")
        
        if self.issues["empty_values"]:
            suggestions.append(f"📝 发现 {len(self.issues['empty_values'])} 条记录缺少关键字段，请补全")
        
        if self.issues["manual_rename"]:
            suggestions.append(f"📋 已记录 {len(self.issues['manual_rename'])} 个人工改名，注意节目单同步")
        
        if self.issues["old_format"]:
            suggestions.append(f"📚 发现 {len(self.issues['old_format'])} 条旧口径数据，请核对名称")
        
        if self.issues["need_confirmation"]:
            suggestions.append(f"👀 发现 {len(self.issues['need_confirmation'])} 条需要林老师确认的记录")
        
        suggestions.append(f"✅ 另有 {len(self.smooth_records)} 条记录检查顺利，可直接使用")
        
        self.processing_suggestions = suggestions
    
    def run_all_checks(self):
        if not self.load_data():
            return False
        
        self.check_duplicates()
        self.check_license()
        self.check_old_masters()
        self.check_timecode()
        self.check_empty_values()
        self.check_manual_rename()
        self.check_old_format()
        self.check_need_confirmation()
        self.find_smooth_records()
        self.generate_suggestions()
        
        return True
    
    def get_summary(self) -> Dict[str, Any]:
        return {
            "总记录数": len(self.df) if self.df is not None else 0,
            "问题总数": sum(len(v) for v in self.issues.values()),
            "顺利记录数": len(self.smooth_records),
            "问题分类": {k: len(v) for k, v in self.issues.items()},
            "处理建议": self.processing_suggestions
        }
    
    def export_meal_allowance_list(self, output_path: str) -> str:
        export_data = []
        confirmed_count = 0
        
        for idx, row in self.df.iterrows():
            track_id = str(row['曲目编号'])
            track_name = str(row['曲目名称'])
            location = str(row['演出地点'])
            people = str(row['参演人数'])
            standard = str(row['餐补标准'])
            remarks = str(row['备注'])
            
            status = "待确认"
            issue_notes = []
            
            if any(t['曲目编号'] == track_id for t in self.issues['expired_license']):
                status = "暂停"
                issue_notes.append("授权问题")
            
            if any(t['曲目编号'] == track_id for t in self.issues['missing_license']):
                status = "待确认"
                issue_notes.append("授权待确认")
            
            if any(t['曲目编号'] == track_id for t in self.issues['duplicate_tracks']):
                status = "待确认"
                issue_notes.append("编号重复")
            
            if any(t['曲目编号'] == track_id for t in self.issues['timecode_mismatch']):
                issue_notes.append("时码待核对")
            
            if any(t['曲目编号'] == track_id for t in self.issues['empty_values']):
                status = "待确认"
                issue_notes.append("信息不全")
            
            if status == "待确认" and not issue_notes:
                status = "可发放"
                confirmed_count += 1
            
            people_count = int(people) if people and people.isdigit() else 0
            standard_amount = int(standard) if standard and standard.isdigit() else 0
            total = people_count * standard_amount
            
            export_data.append({
                "曲目编号": track_id,
                "曲目名称": track_name,
                "演出地点": location,
                "参演人数": people,
                "餐补标准": standard,
                "预计餐补总额": total if total > 0 else "",
                "状态": status,
                "备注": remarks,
                "问题说明": "、".join(issue_notes) if issue_notes else "无"
            })
        
        export_df = pd.DataFrame(export_data)
        export_df.to_excel(output_path, index=False, engine='openpyxl')
        
        return f"已导出 {len(export_data)} 条记录，其中 {confirmed_count} 条可直接发放餐补"
