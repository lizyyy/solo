# -*- coding: utf-8 -*-
import pandas as pd
import numpy as np
import re
from datetime import datetime
from typing import Dict, List, Any, Optional

STOP_WORDS = set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
    '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀',
    '哦', '嗯', '哈', '哎', '唉', '喂', '嗨', '哈喽', '你好', '您好', '谢谢',
    '感谢', '麻烦', '请', '请问', '帮忙', '一下', '可以', '能', '可能', '应该',
    '需要', '想要', '想', '希望', '打算', '准备', '已经', '正在', '将要', '会',
    '或者', '还是', '以及', '而且', '但是', '然而', '不过', '所以', '因此',
    '因为', '由于', '如果', '假如', '只要', '除非', '虽然', '尽管', '即使',
    '关于', '对于', '为了', '按照', '根据', '通过', '把', '被', '让', '给',
    '与', '跟', '和', '同', '及', '等', '等等', '之类', '什么的', '等等',
    '亲', '哦', '嗯', '哈', '呢', '啊', '吧', '呀', '嘛', '呗', '哈', '嘻',
    '啦', '喽', '哟', '耶', '哇', '呢', '么', '嘛', '哈', '啊', '哦', '嗯'
])

class DataProcessor:
    REQUIRED_FIELDS = ['session_id', 'user_message', 'agent_message']
    OPTIONAL_FIELDS = ['time', 'timestamp', 'date', 'tags', 'satisfaction', 'satisfaction_score']
    
    def __init__(self):
        import jieba
        self.jieba = jieba
        self._init_jieba()
    
    def _init_jieba(self):
        custom_words = [
            '退款', '退货', '换货', '售后', '投诉', '差评', '催发货', '改地址',
            '优惠券', '满减', '促销', '打折', '包邮', '运费险', '七天无理由',
            '发货时间', '物流信息', '快递单号', '签收', '拒收', '退换货',
            '客服', '人工客服', '在线客服', '机器人', '自动回复', '转接人工',
            '订单号', '订单编号', '订单状态', '待发货', '已发货', '已签收',
            '支付宝', '微信支付', '银行卡', '支付方式', '退款金额', '实付金额',
            '会员', '积分', '优惠券码', '兑换码', '激活码', '验证码',
            '地址', '收货地址', '手机号码', '手机号', '联系电话', '身份证',
            '发票', '保修', '质保', '正品', '假货', '质量问题', '色差', '尺码'
        ]
        for word in custom_words:
            self.jieba.add_word(word)
    
    def load_and_validate(self, filepath: str) -> Dict[str, Any]:
        try:
            if filepath.endswith('.xlsx') or filepath.endswith('.xls'):
                df = pd.read_excel(filepath)
            else:
                df = pd.read_csv(filepath, encoding='utf-8-sig')
            
            df.columns = [self._normalize_column_name(col) for col in df.columns]
            
            validation = self._validate_dataframe(df)
            if not validation['valid']:
                return validation
            
            return {'valid': True, 'dataframe': df, 'warnings': validation.get('warnings', [])}
            
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(filepath, encoding='gbk')
                df.columns = [self._normalize_column_name(col) for col in df.columns]
                validation = self._validate_dataframe(df)
                return validation
            except Exception as e:
                return {'valid': False, 'error': f'文件编码错误，无法读取: {str(e)}'}
        except Exception as e:
            return {'valid': False, 'error': f'读取文件失败: {str(e)}'}
    
    def _normalize_column_name(self, col: str) -> str:
        col = col.strip().lower()
        col = re.sub(r'[\s_\-]+', '_', col)
        
        mappings = {
            '会话id': 'session_id', '会话编号': 'session_id', '订单号': 'session_id',
            '用户消息': 'user_message', '用户问题': 'user_message', '用户输入': 'user_message',
            '客服回复': 'agent_message', '客服消息': 'agent_message', '助理回复': 'agent_message',
            '时间': 'time', '日期': 'time', 'timestamp': 'time', '发送时间': 'time',
            '标签': 'tags', '分类': 'tags', '类别': 'tags',
            '满意度': 'satisfaction', '评分': 'satisfaction', '评价': 'satisfaction',
            '满意度分数': 'satisfaction', 'satisfaction_score': 'satisfaction'
        }
        
        return mappings.get(col, col)
    
    def _validate_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        result = {'valid': True, 'warnings': [], 'details': {}}
        missing_fields = []
        
        has_session_id = False
        has_user_message = False
        has_agent_message = False
        
        for col in df.columns:
            if col in ['session_id', '会话id', '会话编号', '订单号']:
                has_session_id = True
            if col in ['user_message', '用户消息', '用户问题', '用户输入']:
                has_user_message = True
            if col in ['agent_message', '客服回复', '客服消息', '助理回复']:
                has_agent_message = True
        
        if not has_session_id:
            missing_fields.append('session_id (会话ID/订单号)')
        if not has_user_message:
            missing_fields.append('user_message (用户消息)')
        if not has_agent_message:
            missing_fields.append('agent_message (客服回复)')
        
        if missing_fields:
            result['valid'] = False
            result['error'] = f'缺少必要字段: {", ".join(missing_fields)}'
            result['details'] = {
                'available_columns': list(df.columns),
                'required_columns': ['session_id (会话ID)', 'user_message (用户消息)', 'agent_message (客服回复)'],
                'optional_columns': ['time (时间)', 'tags (标签)', 'satisfaction (满意度)']
            }
            return result
        
        if len(df) == 0:
            result['valid'] = False
            result['error'] = 'CSV文件为空，没有数据行'
            return result
        
        result['details'] = {
            'total_rows': len(df),
            'columns': list(df.columns),
            'sample_rows': min(5, len(df))
        }
        
        return result
    
    def process_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        sessions = {}
        
        for _, row in df.iterrows():
            session_id = str(row.get('session_id', row.get('会话id', row.get('会话编号', '')))).strip()
            
            if not session_id or session_id == 'nan':
                continue
            
            if session_id not in sessions:
                sessions[session_id] = {
                    'session_id': session_id,
                    'messages': [],
                    'tags': [],
                    'satisfaction': None,
                    'first_time': None,
                    'last_time': None
                }
            
            user_msg = str(row.get('user_message', row.get('用户消息', row.get('用户问题', '')))).strip()
            agent_msg = str(row.get('agent_message', row.get('客服回复', row.get('客服消息', '')))).strip()
            
            time_val = row.get('time', row.get('日期', row.get('timestamp', None)))
            parsed_time = self._parse_time(time_val)
            
            tags = self._parse_tags(row.get('tags', row.get('标签', '')))
            satisfaction = self._parse_satisfaction(row.get('satisfaction', row.get('满意度', row.get('评分', None))))
            
            if sessions[session_id]['first_time'] is None or (parsed_time and parsed_time < sessions[session_id]['first_time']):
                sessions[session_id]['first_time'] = parsed_time
            if sessions[session_id]['last_time'] is None or (parsed_time and parsed_time > sessions[session_id]['last_time']):
                sessions[session_id]['last_time'] = parsed_time
            
            if tags:
                existing_tags = sessions[session_id]['tags']
                sessions[session_id]['tags'] = list(set(existing_tags + tags))
            
            if satisfaction is not None:
                sessions[session_id]['satisfaction'] = satisfaction
            
            if user_msg and user_msg != 'nan':
                sessions[session_id]['messages'].append({
                    'role': 'user',
                    'content': user_msg,
                    'time': parsed_time.isoformat() if parsed_time else None
                })
            
            if agent_msg and agent_msg != 'nan':
                sessions[session_id]['messages'].append({
                    'role': 'agent',
                    'content': agent_msg,
                    'time': parsed_time.isoformat() if parsed_time else None
                })
        
        session_list = []
        all_times = []
        
        for session in sessions.values():
            if session['messages']:
                session['messages'].sort(key=lambda x: x['time'] or '')
                session_list.append(session)
                if session['first_time']:
                    all_times.append(session['first_time'])
        
        date_range = None
        if all_times:
            min_time = min(all_times)
            max_time = max(all_times)
            date_range = {
                'min': min_time.isoformat(),
                'max': max_time.isoformat()
            }
        
        return {
            'sessions': session_list,
            'total_sessions': len(session_list),
            'date_range': date_range,
            'processed_at': datetime.now().isoformat()
        }
    
    def _parse_time(self, time_val) -> Optional[datetime]:
        if time_val is None or pd.isna(time_val) or str(time_val).strip() == '':
            return None
        
        try:
            if isinstance(time_val, datetime):
                return time_val
            if isinstance(time_val, pd.Timestamp):
                return time_val.to_pydatetime()
            
            time_str = str(time_val).strip()
            
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%Y/%m/%d %H:%M:%S',
                '%Y/%m/%d %H:%M',
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%m-%d %H:%M',
                '%m/%d %H:%M'
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(time_str, fmt)
                except ValueError:
                    continue
            
            from dateutil import parser
            return parser.parse(time_str, fuzzy=True)
        except Exception:
            return None
    
    def _parse_tags(self, tags_val) -> List[str]:
        if tags_val is None or pd.isna(tags_val):
            return []
        
        tags_str = str(tags_val).strip()
        if not tags_str:
            return []
        
        separators = [',', '，', ';', '；', '|', '、']
        for sep in separators:
            if sep in tags_str:
                return [t.strip() for t in tags_str.split(sep) if t.strip()]
        
        return [tags_str]
    
    def _parse_satisfaction(self, val) -> Optional[float]:
        if val is None or pd.isna(val):
            return None
        
        try:
            if isinstance(val, (int, float)):
                return float(val)
            
            val_str = str(val).strip().lower()
            
            text_mappings = {
                '非常满意': 5.0, '很满意': 5.0, '满意': 4.0, '一般': 3.0,
                '不太满意': 2.0, '不满意': 1.0, '非常不满意': 1.0,
                '好评': 5.0, '中评': 3.0, '差评': 1.0,
                '5星': 5.0, '4星': 4.0, '3星': 3.0, '2星': 2.0, '1星': 1.0,
                '★★★★★': 5.0, '★★★★☆': 4.0, '★★★☆☆': 3.0,
                '★★☆☆☆': 2.0, '★☆☆☆☆': 1.0
            }
            
            for key, score in text_mappings.items():
                if key in val_str:
                    return score
            
            num_match = re.search(r'(\d+\.?\d*)', val_str)
            if num_match:
                return float(num_match.group(1))
            
            return None
        except Exception:
            return None
    
    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        words = self.jieba.lcut(text)
        
        word_freq = {}
        for word in words:
            word = word.strip()
            if len(word) < 2:
                continue
            if word in STOP_WORDS:
                continue
            if re.match(r'^[a-zA-Z0-9]+$', word) and len(word) < 3:
                continue
            if re.match(r'^\d+$', word):
                continue
            
            word_freq[word] = word_freq.get(word, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in sorted_words[:top_k]]
    
    def clean_text(self, text: str) -> str:
        if not text:
            return ''
        
        text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
