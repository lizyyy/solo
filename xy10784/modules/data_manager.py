import json
import os
import uuid
from datetime import datetime
import pandas as pd
from typing import List, Dict, Optional


class DataManager:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.errors_file = os.path.join(data_dir, 'errors.json')
        self.user_profiles_file = os.path.join(data_dir, 'user_profiles.json')
        self.candidates_file = os.path.join(data_dir, 'candidates.json')
        self.explanations_file = os.path.join(data_dir, 'explanations.json')
        self._init_data_files()

    def _init_data_files(self):
        if not os.path.exists(self.errors_file):
            self._write_json(self.errors_file, [])
        if not os.path.exists(self.user_profiles_file):
            self._write_json(self.user_profiles_file, [])
        if not os.path.exists(self.candidates_file):
            self._write_json(self.candidates_file, [])
        if not os.path.exists(self.explanations_file):
            self._write_json(self.explanations_file, [])

    def _read_json(self, filepath: str) -> List:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write_json(self, filepath: str, data: List):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_errors(self, page: int = 1, page_size: int = 20, status: Optional[str] = None) -> Dict:
        errors = self._read_json(self.errors_file)
        if status:
            errors = [e for e in errors if e.get('status') == status]
        errors.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        total = len(errors)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            'data': errors[start:end],
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }

    def get_error_by_id(self, error_id: str) -> Optional[Dict]:
        errors = self._read_json(self.errors_file)
        for error in errors:
            if error.get('id') == error_id:
                return error
        return None

    def rollback_error(self, error_id: str) -> Dict:
        errors = self._read_json(self.errors_file)
        for error in errors:
            if error.get('id') == error_id:
                error['status'] = 'rolled_back'
                error['rolled_back_at'] = datetime.now().isoformat()
                self._write_json(self.errors_file, errors)
                return {'success': True, 'message': '已回滚'}
        return {'success': False, 'message': '未找到错误记录'}

    def fix_error(self, error_id: str, fix_data: Dict) -> Dict:
        errors = self._read_json(self.errors_file)
        for error in errors:
            if error.get('id') == error_id:
                error['status'] = 'fixed'
                error['fixed_at'] = datetime.now().isoformat()
                error['fix_data'] = fix_data
                self._write_json(self.errors_file, errors)
                return {'success': True, 'message': '已修正'}
        return {'success': False, 'message': '未找到错误记录'}

    def batch_import(self, file) -> Dict:
        try:
            df = pd.read_excel(file) if file.filename.endswith('.xlsx') else pd.read_csv(file)
            imported = 0
            for _, row in df.iterrows():
                error = {
                    'id': str(uuid.uuid4()),
                    'user_id': str(row.get('用户ID', row.get('user_id', ''))),
                    'error_type': str(row.get('错误类型', row.get('error_type', 'unknown'))),
                    'score_before': float(row.get('原始分数', row.get('score_before', 0))),
                    'score_after': float(row.get('处理后分数', row.get('score_after', 0))),
                    'block_reason': str(row.get('屏蔽原因', row.get('block_reason', ''))),
                    'status': 'pending',
                    'created_at': datetime.now().isoformat()
                }
                errors = self._read_json(self.errors_file)
                errors.append(error)
                self._write_json(self.errors_file, errors)
                imported += 1
            return {'success': True, 'imported': imported}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def batch_compensate(self, error_ids: List[str]) -> Dict:
        errors = self._read_json(self.errors_file)
        compensated = 0
        for error in errors:
            if error.get('id') in error_ids:
                error['status'] = 'compensated'
                error['compensated_at'] = datetime.now().isoformat()
                compensated += 1
        self._write_json(self.errors_file, errors)
        return {'success': True, 'compensated': compensated}

    def get_user_profiles(self, user_id: Optional[str] = None) -> List:
        profiles = self._read_json(self.user_profiles_file)
        if user_id:
            return [p for p in profiles if p.get('user_id') == user_id]
        return profiles

    def get_candidates(self, error_id: Optional[str] = None) -> List:
        candidates = self._read_json(self.candidates_file)
        if error_id:
            return [c for c in candidates if c.get('error_id') == error_id]
        return candidates

    def get_recommendation_explanations(self, error_id: Optional[str] = None) -> List:
        explanations = self._read_json(self.explanations_file)
        if error_id:
            return [e for e in explanations if e.get('error_id') == error_id]
        return explanations

    def get_statistics(self) -> Dict:
        errors = self._read_json(self.errors_file)
        status_counts = {}
        for error in errors:
            status = error.get('status', 'pending')
            status_counts[status] = status_counts.get(status, 0) + 1
        return {
            'total_errors': len(errors),
            'status_counts': status_counts,
            'total_users': len(set(e.get('user_id') for e in errors))
        }

    def get_export_data(self) -> Dict[str, pd.DataFrame]:
        errors = self._read_json(self.errors_file)
        profiles = self._read_json(self.user_profiles_file)
        candidates = self._read_json(self.candidates_file)
        explanations = self._read_json(self.explanations_file)

        errors_df = pd.DataFrame([{
            '错误ID': e.get('id'),
            '用户ID': e.get('user_id'),
            '错误类型': e.get('error_type'),
            '原始排序分数': e.get('score_before'),
            '处理后分数': e.get('score_after'),
            '分数差异': e.get('score_before', 0) - e.get('score_after', 0),
            '屏蔽原因': e.get('block_reason'),
            '状态': self._get_status_label(e.get('status')),
            '创建时间': e.get('created_at'),
            '处理时间': e.get('fixed_at') or e.get('rolled_back_at') or e.get('compensated_at')
        } for e in errors])

        profiles_df = pd.DataFrame([{
            '用户ID': p.get('user_id'),
            '年龄': p.get('age'),
            '性别': p.get('gender'),
            '兴趣标签': ', '.join(p.get('interests', [])),
            '历史行为': p.get('behavior_summary'),
            '画像原始输入': json.dumps(p.get('raw_input'), ensure_ascii=False),
            '画像处理结果': json.dumps(p.get('processed_result'), ensure_ascii=False)
        } for p in profiles])

        candidates_df = pd.DataFrame([{
            '物料ID': c.get('item_id'),
            '物料名称': c.get('item_name'),
            '物料类型': c.get('item_type'),
            '原始分数': c.get('raw_score'),
            '是否被拦截': '是' if c.get('blocked') else '否',
            '拦截原因': c.get('block_reason'),
            '关联错误ID': c.get('error_id')
        } for c in candidates])

        explanations_df = pd.DataFrame([{
            '推荐解释ID': e.get('id'),
            '用户ID': e.get('user_id'),
            '推荐原因': e.get('reason'),
            '置信度': e.get('confidence'),
            '特征贡献': json.dumps(e.get('feature_contributions'), ensure_ascii=False),
            '关联错误ID': e.get('error_id')
        } for e in explanations])

        return {
            '错误明细': errors_df,
            '用户画像': profiles_df,
            '候选物料': candidates_df,
            '推荐解释': explanations_df
        }

    def _get_status_label(self, status: str) -> str:
        labels = {
            'pending': '待处理',
            'fixed': '已修正',
            'rolled_back': '已回滚',
            'compensated': '已补偿'
        }
        return labels.get(status, status)

    def add_error(self, error: Dict) -> str:
        error['id'] = str(uuid.uuid4())
        error['created_at'] = datetime.now().isoformat()
        if 'status' not in error:
            error['status'] = 'pending'
        errors = self._read_json(self.errors_file)
        errors.append(error)
        self._write_json(self.errors_file, errors)
        return error['id']

    def add_user_profile(self, profile: Dict):
        profiles = self._read_json(self.user_profiles_file)
        profiles.append(profile)
        self._write_json(self.user_profiles_file, profiles)

    def add_candidate(self, candidate: Dict):
        candidates = self._read_json(self.candidates_file)
        candidates.append(candidate)
        self._write_json(self.candidates_file, candidates)

    def add_explanation(self, explanation: Dict):
        explanations = self._read_json(self.explanations_file)
        explanations.append(explanation)
        self._write_json(self.explanations_file, explanations)
