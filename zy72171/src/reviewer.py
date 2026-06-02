import pandas as pd
from datetime import datetime
from .config import Config

class Reviewer:
    def __init__(self):
        self.review_data = None
        self.review_log = []
        self.review_time = None
    
    def load_data(self, merged_data):
        self.review_data = merged_data.copy()
        self.review_time = datetime.now()
        
        if '_review_notes' not in self.review_data.columns:
            self.review_data['_review_notes'] = ''
        if '_reviewed' not in self.review_data.columns:
            self.review_data['_reviewed'] = False
        if '_review_time' not in self.review_data.columns:
            self.review_data['_review_time'] = pd.NaT
        if '_reviewer' not in self.review_data.columns:
            self.review_data['_reviewer'] = ''
        if '_original_status' not in self.review_data.columns:
            self.review_data['_original_status'] = self.review_data['_status'].copy()
        
        return self.review_data
    
    def add_note(self, record_id, note, reviewer="城市规划师小赵"):
        if self.review_data is None:
            raise ValueError("请先加载数据")
        
        mask = self.review_data['_record_id'] == record_id
        if not mask.any():
            raise ValueError(f"未找到记录: {record_id}")
        
        current_notes = self.review_data.loc[mask, '_review_notes'].iloc[0]
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        if current_notes:
            new_notes = f"{current_notes}\n[{timestamp} - {reviewer}] {note}"
        else:
            new_notes = f"[{timestamp} - {reviewer}] {note}"
        
        self.review_data.loc[mask, '_review_notes'] = new_notes
        self.review_data.loc[mask, '_reviewed'] = True
        self.review_data.loc[mask, '_review_time'] = datetime.now()
        self.review_data.loc[mask, '_reviewer'] = reviewer
        
        original_status = self.review_data.loc[mask, '_original_status'].iloc[0]
        current_status = self.review_data.loc[mask, '_status'].iloc[0]
        
        self.review_log.append({
            'time': timestamp,
            'record_id': record_id,
            'reviewer': reviewer,
            'note': note,
            'original_status': original_status,
            'current_status': current_status
        })
        
        return True
    
    def update_status(self, record_id, new_status, reason="", reviewer="城市规划师小赵"):
        if self.review_data is None:
            raise ValueError("请先加载数据")
        
        valid_statuses = ['processed', 'pending', 'onsite']
        if new_status not in valid_statuses:
            raise ValueError(f"无效状态，可选值: {valid_statuses}")
        
        mask = self.review_data['_record_id'] == record_id
        if not mask.any():
            raise ValueError(f"未找到记录: {record_id}")
        
        original_status = self.review_data.loc[mask, '_status'].iloc[0]
        original_status_text = self.review_data.loc[mask, '_status_text'].iloc[0]
        
        status_text_map = {
            'processed': '已处理',
            'pending': '待核实',
            'onsite': '需要现场复看'
        }
        
        new_status_text = status_text_map.get(new_status, new_status)
        
        self.review_data.loc[mask, '_status'] = new_status
        self.review_data.loc[mask, '_status_text'] = new_status_text
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        status_change_note = f"[{timestamp} - {reviewer}] 状态变更: {original_status_text} → {new_status_text}"
        if reason:
            status_change_note += f"，原因: {reason}"
        
        current_notes = self.review_data.loc[mask, '_review_notes'].iloc[0]
        if current_notes:
            self.review_data.loc[mask, '_review_notes'] = f"{current_notes}\n{status_change_note}"
        else:
            self.review_data.loc[mask, '_review_notes'] = status_change_note
        
        self.review_data.loc[mask, '_reviewed'] = True
        self.review_data.loc[mask, '_review_time'] = datetime.now()
        self.review_data.loc[mask, '_reviewer'] = reviewer
        
        self.review_log.append({
            'time': timestamp,
            'record_id': record_id,
            'reviewer': reviewer,
            'action': 'status_change',
            'original_status': original_status,
            'new_status': new_status,
            'reason': reason
        })
        
        return True
    
    def get_pending_items(self):
        if self.review_data is None:
            return []
        
        pending = self.review_data[self.review_data['_status'] != 'processed']
        return pending.to_dict('records')
    
    def get_review_diffs(self):
        diffs = []
        if self.review_data is None:
            return diffs
        
        changed = self.review_data[self.review_data['_original_status'] != self.review_data['_status']]
        
        for _, row in changed.iterrows():
            diffs.append({
                'record_id': row['_record_id'],
                'stall_id': row.get('stall_id', '未知'),
                'original_status': self._translate_status(row['_original_status']),
                'new_status': self._translate_status(row['_status']),
                'reviewer': row.get('_reviewer', ''),
                'review_time': row.get('_review_time', ''),
                'notes': row.get('_review_notes', '')
            })
        
        return diffs
    
    def get_review_summary(self):
        if self.review_data is None:
            return {}
        
        total = len(self.review_data)
        reviewed = len(self.review_data[self.review_data['_reviewed'] == True])
        status_changed = len(self.review_data[self.review_data['_original_status'] != self.review_data['_status']])
        
        by_status = self.review_data['_status_text'].value_counts().to_dict()
        
        return {
            '总记录数': total,
            '已复核数': reviewed,
            '状态变更数': status_changed,
            '当前状态分布': by_status,
            '复核日志数': len(self.review_log)
        }
    
    def get_reviewed_data(self):
        return self.review_data
    
    def _translate_status(self, status):
        status_map = {
            'processed': '已处理',
            'pending': '待核实',
            'onsite': '需要现场复看'
        }
        return status_map.get(status, status)
