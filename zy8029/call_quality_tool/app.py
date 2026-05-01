import streamlit as st
import pandas as pd
from pathlib import Path
from data_loader import CallDataLoader
from rule_engine import RuleEngine
from metrics import MetricsAggregator
from export import ReportExporter


st.set_page_config(
    page_title="客服录音质检工具",
    page_icon="📞",
    layout="wide"
)


def init_session_state():
    if 'issues' not in st.session_state:
        st.session_state.issues = []
    if 'calls' not in st.session_state:
        st.session_state.calls = []
    if 'rules' not in st.session_state:
        st.session_state.rules = []
    if 'sensitive_words' not in st.session_state:
        st.session_state.sensitive_words = []
    if 'agent_metrics' not in st.session_state:
        st.session_state.agent_metrics = {}
    if 'call_metrics' not in st.session_state:
        st.session_state.call_metrics = {}
    if 'summary' not in st.session_state:
        st.session_state.summary = {}


def load_data(calls_file, rules_file, words_file):
    loader = CallDataLoader()

    if calls_file:
        calls = loader.load_calls(calls_file.name)
        calls = [loader.sort_utterances_by_time(call) for call in calls]
        st.session_state.calls = calls

    if rules_file:
        rules = loader.load_rules(rules_file.name)
        st.session_state.rules = rules

    if words_file:
        words = loader.load_sensitive_words(words_file.name)
        st.session_state.sensitive_words = words

    if st.session_state.calls and st.session_state.rules:
        engine = RuleEngine(st.session_state.rules, st.session_state.sensitive_words)
        issues = engine.analyze_calls(st.session_state.calls)
        st.session_state.issues = issues

        aggregator = MetricsAggregator(issues, st.session_state.calls)
        st.session_state.agent_metrics = aggregator.aggregate_by_agent()
        st.session_state.call_metrics = aggregator.aggregate_by_call()
        st.session_state.summary = aggregator.get_summary()
        st.session_state.type_metrics = aggregator.aggregate_by_issue_type()
        st.session_state.stage_analysis = aggregator.get_stage_analysis()

    return len(st.session_state.calls), len(st.session_state.issues)


def display_summary_cards():
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("总通话数", st.session_state.summary.get('total_calls', 0))

    with col2:
        st.metric("总问题数", st.session_state.summary.get('total_issues', 0))

    with col3:
        st.metric("涉及问题通话", st.session_state.summary.get('calls_with_issues', 0))

    with col4:
        rate = st.session_state.summary.get('issue_rate', 0) * 100
        st.metric("问题率", f"{rate:.1f}%")


def display_issue_type_chart():
    type_dist = st.session_state.summary.get('issue_type_distribution', {})
    if type_dist:
        df = pd.DataFrame({
            '问题类型': list(type_dist.keys()),
            '数量': list(type_dist.values())
        })
        st.bar_chart(df.set_index('问题类型'))


def display_severity_chart():
    severity_dist = st.session_state.summary.get('severity_distribution', {})
    if severity_dist:
        df = pd.DataFrame({
            '严重程度': list(severity_dist.keys()),
            '数量': list(severity_dist.values())
        })
        st.bar_chart(df.set_index('严重程度'))


def display_agent_table():
    if st.session_state.agent_metrics:
        data = []
        for agent_id, metrics in st.session_state.agent_metrics.items():
            data.append({
                '坐席ID': agent_id,
                '问题总数': metrics['total_issues'],
                '通话数': metrics['call_count'],
                '问题率': f"{metrics['total_issues']/metrics['call_count']:.2f}" if metrics['call_count'] > 0 else 'N/A'
            })
        df = pd.DataFrame(data)
        st.dataframe(df, use_container_width=True)


def display_issues_table(filters=None):
    if not st.session_state.issues:
        st.info("暂无问题数据")
        return

    data = []
    for issue in st.session_state.issues:
        if filters:
            if filters.get('agent_id') and issue.agent_id != filters['agent_id']:
                continue
            if filters.get('issue_type') and issue.issue_type != filters['issue_type']:
                continue
            if filters.get('severity') and issue.severity != filters['severity']:
                continue

        data.append({
            '通话ID': issue.call_id,
            '坐席ID': issue.agent_id,
            '问题类型': issue.issue_type,
            '规则名称': issue.rule_name,
            '严重程度': issue.severity,
            '描述': issue.description,
            '话语序号': issue.utterance_index
        })

    df = pd.DataFrame(data)
    st.dataframe(df, use_container_width=True, hide_index=True)


def main():
    init_session_state()

    st.title("📞 客服录音质检工具")
    st.markdown("---")

    with st.sidebar:
        st.header("数据上传")

        calls_file = st.file_uploader(
            "通话转写JSON",
            type=['json'],
            help="上传通话转写JSON文件"
        )

        rules_file = st.file_uploader(
            "质检规则YAML",
            type=['yaml', 'yml'],
            help="上传质检规则YAML文件"
        )

        words_file = st.file_uploader(
            "敏感词表TXT",
            type=['txt'],
            help="上传敏感词表TXT文件"
        )

        if st.button("加载并分析", type="primary"):
            if calls_file and rules_file and words_file:
                with st.spinner("分析中..."):
                    call_count, issue_count = load_data(calls_file, rules_file, words_file)
                    st.success(f"已加载 {call_count} 条通话，发现 {issue_count} 个问题！")
            else:
                st.error("请上传所有三个文件")

        st.markdown("---")

        if st.session_state.issues:
            st.header("导出报告")

            export_dir = Path("exports")
            export_dir.mkdir(exist_ok=True)

            if st.button("导出 Markdown 报告"):
                exporter = ReportExporter(
                    st.session_state.issues,
                    st.session_state.summary,
                    st.session_state.agent_metrics,
                    st.session_state.call_metrics,
                    st.session_state.type_metrics,
                    st.session_state.stage_analysis
                )
                exporter.export_markdown(str(export_dir / "report.md"))
                st.success("已导出: exports/report.md")

            if st.button("导出 CSV 明细"):
                exporter = ReportExporter(
                    st.session_state.issues,
                    st.session_state.summary,
                    st.session_state.agent_metrics,
                    st.session_state.call_metrics,
                    st.session_state.type_metrics,
                    st.session_state.stage_analysis
                )
                exporter.export_csv(str(export_dir / "issues.csv"))
                st.success("已导出: exports/issues.csv")

    tab1, tab2, tab3, tab4 = st.tabs(["概览", "坐席统计", "问题明细", "筛选"])

    with tab1:
        st.header("质检概览")

        if st.session_state.issues:
            display_summary_cards()

            col1, col2 = st.columns(2)
            with col1:
                st.subheader("问题类型分布")
                display_issue_type_chart()

            with col2:
                st.subheader("严重程度分布")
                display_severity_chart()
        else:
            st.info("请上传数据文件开始分析")

    with tab2:
        st.header("坐席统计")

        if st.session_state.agent_metrics:
            display_agent_table()

            st.subheader("坐席问题明细")
            for agent_id, metrics in st.session_state.agent_metrics.items():
                with st.expander(f"坐席 {agent_id} - {metrics['total_issues']} 个问题"):
                    for detail in metrics.get('issue_details', []):
                        st.write(f"- [{detail['severity']}] {detail['rule_name']}: {detail['description']}")
        else:
            st.info("暂无坐席数据")

    with tab3:
        st.header("问题明细")

        if st.session_state.issues:
            st.dataframe(
                pd.DataFrame([{
                    '通话ID': i.call_id,
                    '坐席ID': i.agent_id,
                    '问题类型': i.issue_type,
                    '规则名称': i.rule_name,
                    '严重程度': i.severity,
                    '描述': i.description,
                    '话语序号': i.utterance_index
                } for i in st.session_state.issues]),
                use_container_width=True,
                hide_index=True
            )
        else:
            st.info("暂无问题数据")

    with tab4:
        st.header("问题筛选")

        if st.session_state.issues:
            col1, col2, col3 = st.columns(3)

            agents = list(set(i.agent_id for i in st.session_state.issues))
            issue_types = list(set(i.issue_type for i in st.session_state.issues))
            severities = list(set(i.severity for i in st.session_state.issues))

            with col1:
                selected_agent = st.selectbox("坐席", ["全部"] + agents)

            with col2:
                selected_type = st.selectbox("问题类型", ["全部"] + issue_types)

            with col3:
                selected_severity = st.selectbox("严重程度", ["全部"] + severities)

            filters = {
                'agent_id': None if selected_agent == "全部" else selected_agent,
                'issue_type': None if selected_type == "全部" else selected_type,
                'severity': None if selected_severity == "全部" else selected_severity
            }

            display_issues_table(filters)
        else:
            st.info("暂无问题数据")


if __name__ == "__main__":
    main()
