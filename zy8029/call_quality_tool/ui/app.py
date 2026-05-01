import streamlit as st
import pandas as pd
import os
from typing import List, Dict, Any

from data_loader.call_data_loader import CallDataLoader
from data_loader.rule_loader import RuleLoader
from data_loader.sensitive_word_loader import SensitiveWordLoader
from rule_engine.quality_engine import QualityEngine
from metrics_agg.aggregator import MetricsAggregator
from exporter.markdown_exporter import MarkdownExporter
from exporter.csv_exporter import CSVExporter

DEFAULT_TRANSCRIPT_PATH = 'sample_data/sample_transcripts.json'
DEFAULT_RULES_PATH = 'sample_data/quality_rules.yaml'
DEFAULT_SENSITIVE_WORDS_PATH = 'sample_data/sensitive_words.txt'

def load_data(transcript_path: str, rules_path: str, words_path: str):
    transcripts = CallDataLoader.load_transcripts(transcript_path)
    rules = RuleLoader.load_rules(rules_path)
    sensitive_words = SensitiveWordLoader.load_words(words_path)
    return transcripts, rules, sensitive_words

def analyze_data(transcripts: List[Dict[str, Any]], rules: Dict[str, Any], sensitive_words: List[str]):
    engine = QualityEngine(rules, sensitive_words)
    results = engine.analyze_calls(transcripts)
    agent_stats = MetricsAggregator.aggregate_by_agent(results)
    violation_counts = MetricsAggregator.aggregate_by_violation_type(results)
    all_violations = MetricsAggregator.get_all_violations(results)
    return results, agent_stats, violation_counts, all_violations

def main():
    st.set_page_config(page_title='客服录音质检工具', layout='wide')
    st.title('客服录音质检工具')
    
    with st.sidebar:
        st.header('文件配置')
        transcript_path = st.text_input('通话转写JSON路径', DEFAULT_TRANSCRIPT_PATH)
        rules_path = st.text_input('质检规则YAML路径', DEFAULT_RULES_PATH)
        words_path = st.text_input('敏感词表TXT路径', DEFAULT_SENSITIVE_WORDS_PATH)
        
        if st.button('加载并分析'):
            if not os.path.exists(transcript_path):
                st.error(f'转写文件不存在: {transcript_path}')
                return
            if not os.path.exists(rules_path):
                st.error(f'规则文件不存在: {rules_path}')
                return
            if not os.path.exists(words_path):
                st.error(f'敏感词文件不存在: {words_path}')
                return
            
            try:
                transcripts, rules, sensitive_words = load_data(transcript_path, rules_path, words_path)
                results, agent_stats, violation_counts, all_violations = analyze_data(transcripts, rules, sensitive_words)
                
                st.session_state['results'] = results
                st.session_state['agent_stats'] = agent_stats
                st.session_state['violation_counts'] = violation_counts
                st.session_state['all_violations'] = all_violations
                st.success('分析完成')
            except Exception as e:
                st.error(f'分析失败: {str(e)}')
    
    if 'results' not in st.session_state:
        st.info('请在左侧配置文件路径并点击"加载并分析"')
        return
    
    results = st.session_state['results']
    agent_stats = st.session_state['agent_stats']
    violation_counts = st.session_state['violation_counts']
    all_violations = st.session_state['all_violations']
    
    st.header('概览统计')
    col1, col2, col3, col4 = st.columns(4)
    col1.metric('通话总数', len(results))
    col2.metric('坐席总数', len(agent_stats))
    col3.metric('违规总数', sum(r['violation_count'] for r in results))
    col4.metric('平均违规数/通话', f"{sum(r['violation_count'] for r in results) / len(results):.2f}")
    
    st.header('违规类型分布')
    violation_df = pd.DataFrame(list(violation_counts.items()), columns=['类型', '数量'])
    violation_df['类型'] = violation_df['类型'].map({
        'opening_missing': '开场白缺失',
        'promise_conflict': '承诺时效矛盾',
        'sensitive_word': '敏感词命中',
        'long_silence': '长时间静默'
    })
    st.bar_chart(violation_df, x='类型', y='数量')
    
    st.header('坐席表现')
    agent_filter = st.multiselect('筛选坐席', options=[a['agent_name'] for a in agent_stats], default=None)
    
    agent_df = pd.DataFrame(agent_stats)
    agent_df = agent_df[['agent_name', 'call_count', 'total_violations', 'avg_violations_per_call', 'avg_call_duration']]
    agent_df.columns = ['坐席姓名', '通话数', '违规数', '平均违规数/通话', '平均通话时长(秒)']
    
    if agent_filter:
        agent_df = agent_df[agent_df['坐席姓名'].isin(agent_filter)]
    
    st.dataframe(agent_df)
    
    st.header('违规详情')
    violation_type_filter = st.selectbox('违规类型筛选', options=['全部', '开场白缺失', '承诺时效矛盾', '敏感词命中', '长时间静默'])
    
    violation_type_map = {
        '全部': None,
        '开场白缺失': 'opening_missing',
        '承诺时效矛盾': 'promise_conflict',
        '敏感词命中': 'sensitive_word',
        '长时间静默': 'long_silence'
    }
    
    filtered_violations = all_violations
    if violation_type_filter != '全部':
        filtered_violations = [v for v in all_violations if v['type'] == violation_type_map[violation_type_filter]]
    
    violation_df = pd.DataFrame(filtered_violations)
    violation_df['type'] = violation_df['type'].map({
        'opening_missing': '开场白缺失',
        'promise_conflict': '承诺时效矛盾',
        'sensitive_word': '敏感词命中',
        'long_silence': '长时间静默'
    })
    violation_df = violation_df[['call_id', 'agent_name', 'type', 'description', 'timestamp']]
    violation_df.columns = ['通话ID', '坐席姓名', '违规类型', '描述', '时间戳(秒)']
    
    st.dataframe(violation_df)
    
    st.header('导出报告')
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button('导出Markdown报告'):
            output_path = 'quality_report.md'
            MarkdownExporter.export(results, agent_stats, output_path)
            st.success(f'Markdown报告已导出: {output_path}')
    
    with col2:
        if st.button('导出CSV报告'):
            output_path = 'quality_report.csv'
            CSVExporter.export(results, output_path)
            st.success(f'CSV报告已导出: {output_path}')

if __name__ == '__main__':
    main()