import random
from typing import List, Dict


class RecommendationEngine:
    def __init__(self, data_manager):
        self.dm = data_manager
        self.block_reasons = [
            '内容重复',
            '用户已屏蔽该作者',
            '不在用户兴趣范围内',
            '时效性过期',
            '敏感内容检测',
            '质量分过低',
            '广告内容过多',
            '用户历史负反馈'
        ]
        self.error_types = [
            '排序分数异常',
            '屏蔽规则误判',
            '用户画像不匹配',
            '特征计算错误',
            '推荐解释不一致'
        ]

    def generate_sample_data(self, count: int = 20):
        for i in range(count):
            user_id = f'user_{1000 + i}'
            
            raw_profile = self._generate_raw_profile()
            processed_profile = self._process_profile(raw_profile)
            self.dm.add_user_profile({
                'user_id': user_id,
                'age': raw_profile.get('age'),
                'gender': raw_profile.get('gender'),
                'interests': processed_profile.get('interests', []),
                'behavior_summary': processed_profile.get('behavior_summary'),
                'raw_input': raw_profile,
                'processed_result': processed_profile
            })

            has_dirty_data = i % 3 == 0
            candidates = self._generate_candidates(user_id, has_dirty_data)
            
            score_before = sum(c.get('raw_score', 0) for c in candidates) / len(candidates)
            blocked_candidates = [c for c in candidates if c.get('blocked')]
            
            if has_dirty_data or blocked_candidates:
                error_id = self.dm.add_error({
                    'user_id': user_id,
                    'error_type': random.choice(self.error_types) if has_dirty_data else '排序分数被拦截',
                    'score_before': score_before,
                    'score_after': score_before * (0.5 if has_dirty_data else 0.7),
                    'block_reason': '; '.join(set(c.get('block_reason', '') for c in blocked_candidates)),
                    'has_dirty_data': has_dirty_data,
                    'dirty_data_details': self._get_dirty_data_details() if has_dirty_data else None,
                    'manual_treatment_applied': False
                })

                for candidate in candidates:
                    candidate['error_id'] = error_id
                    self.dm.add_candidate(candidate)

                self.dm.add_explanation({
                    'id': f'exp_{error_id}',
                    'user_id': user_id,
                    'error_id': error_id,
                    'reason': self._generate_explanation(has_dirty_data),
                    'confidence': random.uniform(0.6, 0.98),
                    'feature_contributions': self._generate_feature_contributions(),
                    'score_impact': {
                        'before': score_before,
                        'after': score_before * (0.5 if has_dirty_data else 0.7),
                        'difference': score_before * (0.3 if has_dirty_data else 0.5)
                    }
                })

    def _generate_raw_profile(self) -> Dict:
        return {
            'age': random.randint(18, 65),
            'gender': random.choice(['男', '女']),
            'raw_interests': ['科技', '体育', '娱乐', '财经', '教育', '健康'][random.randint(2, 4)],
            'browsing_history': [f'item_{random.randint(100, 999)}' for _ in range(10)],
            'click_behavior': {
                'total_clicks': random.randint(50, 500),
                'avg_time_spent': random.randint(10, 120)
            }
        }

    def _process_profile(self, raw: Dict) -> Dict:
        interests = raw.get('raw_interests', [])
        if isinstance(interests, str):
            interests = [interests]
        expanded_interests = []
        for interest in interests:
            expanded_interests.append(interest)
            if interest == '科技':
                expanded_interests.extend(['人工智能', '编程', '数码产品'])
            elif interest == '体育':
                expanded_interests.extend(['篮球', '足球', '健身'])
        return {
            'interests': list(set(expanded_interests)),
            'behavior_summary': f"高活跃用户，月均点击{raw.get('click_behavior', {}).get('total_clicks', 0)}次",
            'quality_score': random.uniform(0.7, 0.95)
        }

    def _generate_candidates(self, user_id: str, has_dirty_data: bool) -> List[Dict]:
        candidates = []
        item_types = ['文章', '视频', '图片', '问答', '直播']
        
        for i in range(random.randint(5, 15)):
            raw_score = random.uniform(0.1, 1.0)
            blocked = random.random() < 0.3 or (has_dirty_data and i == 0)
            
            block_reason = ''
            if blocked:
                block_reason = random.choice(self.block_reasons)
            
            if has_dirty_data and i == 0:
                raw_score = random.uniform(2.0, 5.0)
                block_reason = '脏数据：分数异常过高，已被人工拦截'
            
            candidates.append({
                'item_id': f'item_{10000 + i}',
                'item_name': f'{random.choice(item_types)}标题{i + 1}',
                'item_type': random.choice(item_types),
                'raw_score': raw_score,
                'blocked': blocked,
                'block_reason': block_reason,
                'user_id': user_id
            })
        return candidates

    def _get_dirty_data_details(self) -> Dict:
        return {
            '检测到的问题': [
                '排序分数超出正常范围(0-1)',
                '物料特征值缺失',
                '用户画像字段不完整'
            ],
            '自动处理': '已降低分数至0.5',
            '建议人工处理': True
        }

    def _generate_explanation(self, has_dirty_data: bool) -> str:
        if has_dirty_data:
            return '检测到脏数据介入，排序分数被强制修正。原始推荐依据：用户兴趣匹配度85%，但因物料数据异常导致分数计算错误，已应用屏蔽规则防止劣质内容曝光。'
        return '基于用户历史行为模式推荐。用户近期对科技类内容有较高点击率，结合协同过滤算法推荐相似物料。屏蔽规则已过滤3条低质量候选。'

    def _generate_feature_contributions(self) -> Dict:
        return {
            '用户兴趣匹配': round(random.uniform(0.2, 0.4), 3),
            '历史行为相似': round(random.uniform(0.15, 0.3), 3),
            '物料质量分': round(random.uniform(0.1, 0.25), 3),
            '时效性权重': round(random.uniform(0.05, 0.15), 3),
            '地理位置': round(random.uniform(0.05, 0.1), 3)
        }

    def apply_manual_treatment(self, error_id: str, treatment: str) -> Dict:
        error = self.dm.get_error_by_id(error_id)
        if not error:
            return {'success': False, 'message': '未找到错误记录'}
        
        error['manual_treatment_applied'] = True
        error['manual_treatment'] = treatment
        error['status'] = 'fixed'
        
        return {
            'success': True,
            'message': '人工处理已应用',
            'treatment': treatment
        }
