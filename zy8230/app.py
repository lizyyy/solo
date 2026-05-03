import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import DataLoader
from src.analyzer import ScoreAnalyzer, AnalysisResult
from src.exporter import Exporter


st.set_page_config(
    page_title="实验课主观题阅卷一致性复核工具",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)


@st.cache_resource
def load_data(data_dir: str):
    loader = DataLoader(base_path=data_dir)
    try:
        student_scores, teacher_ratings, exam_config = loader.load_all()
        return loader, student_scores, teacher_ratings, exam_config
    except Exception as e:
        st.error(f"数据加载失败: {e}")
        return None, None, None, None


def run_analysis(student_scores: pd.DataFrame, teacher_ratings: pd.DataFrame, exam_config: dict):
    settings = exam_config.get('review_settings', {})
    conflict_threshold = settings.get('conflict_threshold', 3.0)
    conflict_threshold_percent = settings.get('conflict_threshold_percent', 0.3)
    
    analyzer = ScoreAnalyzer(
        student_scores=student_scores,
        teacher_ratings=teacher_ratings,
        exam_config=exam_config,
        conflict_threshold=conflict_threshold,
        conflict_threshold_percent=conflict_threshold_percent
    )
    
    result = analyzer.analyze()
    return analyzer, result


def main():
    st.title("📊 实验课主观题阅卷一致性复核工具")
    st.markdown("---")
    
    with st.sidebar:
        st.header("📁 数据设置")
        
        data_dir = st.text_input("数据目录路径", value="sample")
        
        scores_file = st.text_input("学生成绩 CSV", value="student_scores.csv")
        ratings_file = st.text_input("教师评分 JSONL", value="teacher_ratings.jsonl")
        config_file = st.text_input("考试配置 YAML", value="exam_config.yaml")
        
        st.markdown("---")
        st.header("⚙️ 分析设置")
        
        conflict_threshold = st.slider(
            "冲突阈值(分差)",
            min_value=1.0,
            max_value=10.0,
            value=3.0,
            step=0.5
        )
        
        conflict_threshold_pct = st.slider(
            "冲突阈值(分差率%)",
            min_value=10.0,
            max_value=50.0,
            value=30.0,
            step=5.0
        )
        
        load_button = st.button("🔄 加载并分析数据", use_container_width=True)
        
        st.markdown("---")
        st.header("📤 导出报告")
        
        export_issues = st.button("导出 issues.csv", use_container_width=True)
        export_report = st.button("导出 review_report.md", use_container_width=True)
    
    if load_button:
        if not Path(data_dir).exists():
            st.error(f"数据目录不存在: {data_dir}")
            return
        
        with st.spinner("正在加载数据..."):
            loader, student_scores, teacher_ratings, exam_config = load_data(data_dir)
            
            if loader is None:
                return
            
            if exam_config:
                settings = exam_config.get('review_settings', {})
                settings['conflict_threshold'] = conflict_threshold
                settings['conflict_threshold_percent'] = conflict_threshold_pct / 100.0
            
            st.session_state['loader'] = loader
            st.session_state['student_scores'] = student_scores
            st.session_state['teacher_ratings'] = teacher_ratings
            st.session_state['exam_config'] = exam_config
            
            with st.spinner("正在进行数据分析..."):
                analyzer, result = run_analysis(student_scores, teacher_ratings, exam_config)
                st.session_state['analyzer'] = analyzer
                st.session_state['result'] = result
                
                st.success("✅ 数据分析完成！")
    
    if 'result' not in st.session_state:
        st.info("👈 请在左侧侧边栏设置数据路径并点击「加载并分析数据」")
        st.markdown("""
        ### 功能说明
        本工具用于帮助教务老师复核实验课主观题阅卷的一致性，主要功能包括：
        
        1. **分题差异分析** - 对比学生得分与教师评分的差异
        2. **教师严格度分析** - 识别偏严/偏松的评卷老师
        3. **二评冲突分析** - 检测两位教师评分差异过大的记录
        4. **疑似漏评检测** - 找出只收到一位教师评分的答题
        
        ### 数据格式要求
        - **学生成绩 CSV**: 包含 student_id, course, question_num, score, max_score 列
        - **教师评分 JSONL**: 每行一个评分记录，包含 student_id, course, question_num, teacher, score 字段
        - **考试配置 YAML**: 定义各题目的满分和扣分规则
        """)
        return
    
    loader = st.session_state['loader']
    analyzer = st.session_state['analyzer']
    result = st.session_state['result']
    student_scores = st.session_state['student_scores']
    teacher_ratings = st.session_state['teacher_ratings']
    
    courses = loader.get_courses()
    teachers = loader.get_teachers()
    
    st.markdown("## 🔍 数据筛选")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        selected_courses = st.multiselect(
            "选择课程",
            options=courses,
            default=courses
        )
    
    with col2:
        available_questions = []
        if selected_courses:
            for course in selected_courses:
                qs = loader.get_question_numbers(course)
                available_questions.extend([(course, q) for q in qs])
        
        question_options = [f"{course}-第{q}题" for course, q in available_questions]
        selected_questions_display = st.multiselect(
            "选择题目",
            options=question_options,
            default=question_options
        )
        
        selected_question_nums = []
        for q_display in selected_questions_display:
            course_part, q_part = q_display.split("-第")
            q_num = int(q_part.replace("题", ""))
            selected_question_nums.append(q_num)
        selected_question_nums = list(set(selected_question_nums))
    
    with col3:
        selected_teachers = st.multiselect(
            "选择教师",
            options=teachers,
            default=teachers
        )
    
    filtered_scores, filtered_ratings = analyzer.filter_data(
        courses=selected_courses if selected_courses else None,
        question_nums=selected_question_nums if selected_question_nums else None,
        teachers=selected_teachers if selected_teachers else None
    )
    
    if len(filtered_ratings) > 0 and len(filtered_scores) > 0:
        settings = st.session_state['exam_config'].get('review_settings', {})
        filtered_analyzer = ScoreAnalyzer(
            student_scores=filtered_scores,
            teacher_ratings=filtered_ratings,
            exam_config=st.session_state['exam_config'],
            conflict_threshold=settings.get('conflict_threshold', 3.0),
            conflict_threshold_percent=settings.get('conflict_threshold_percent', 0.3)
        )
        filtered_result = filtered_analyzer.analyze()
    else:
        filtered_result = result
        filtered_analyzer = analyzer
    
    st.markdown("---")
    st.markdown("## 📈 分析结果")
    
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📊 数据概览",
        "📋 分题差异分析",
        "👨‍🏫 教师严格度分析",
        "⚔️ 二评冲突分析",
        "🔍 疑似漏评列表"
    ])
    
    with tab1:
        st.subheader("数据统计概览")
        
        summary = filtered_result.summary
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("课程数量", summary.get('total_courses', 0))
            st.metric("题目总数", summary.get('total_questions', 0))
        
        with col2:
            st.metric("学生总数", summary.get('total_students', 0))
            st.metric("教师总数", summary.get('total_teachers', 0))
        
        with col3:
            st.metric("教师评分记录", summary.get('total_teacher_ratings', 0))
            st.metric("二评冲突数", summary.get('total_conflicts', 0))
        
        with col4:
            st.metric("偏严教师数", summary.get('strict_teachers', 0))
            st.metric("疑似漏评数", summary.get('total_missing_reviews', 0))
        
        st.markdown("### 关键指标图表")
        
        chart_col1, chart_col2 = st.columns(2)
        
        with chart_col1:
            strictness_data = []
            for t in filtered_result.teacher_strictness:
                strictness_data.append({
                    '教师': t.teacher,
                    '严格度分数': t.strictness_score,
                    '标签': t.strictness_label
                })
            
            if strictness_data:
                strictness_df = pd.DataFrame(strictness_data)
                fig_strictness = px.bar(
                    strictness_df,
                    x='教师',
                    y='严格度分数',
                    color='标签',
                    title='教师评分严格度分布',
                    color_discrete_map={
                        '偏严': '#FF6B6B',
                        '正常': '#4ECDC4',
                        '偏松': '#45B7D1'
                    }
                )
                fig_strictness.add_hline(y=0, line_dash="dash", line_color="gray")
                st.plotly_chart(fig_strictness, use_container_width=True)
        
        with chart_col2:
            if filtered_result.question_diffs:
                diff_data = []
                for q in filtered_result.question_diffs:
                    course_q = f"{q.course}-{q.question_num}题"
                    diff_data.append({
                        '题目': course_q,
                        '学生平均分': q.avg_score if pd.notna(q.avg_score) else 0,
                        '教师平均分': q.avg_teacher_score if pd.notna(q.avg_teacher_score) else 0,
                        '满分': q.max_score
                    })
                
                if diff_data:
                    diff_df = pd.DataFrame(diff_data)
                    
                    fig_compare = go.Figure()
                    fig_compare.add_trace(go.Bar(
                        name='学生平均分',
                        x=diff_df['题目'],
                        y=diff_df['学生平均分'],
                        marker_color='#FF9F43'
                    ))
                    fig_compare.add_trace(go.Bar(
                        name='教师平均分',
                        x=diff_df['题目'],
                        y=diff_df['教师平均分'],
                        marker_color='#10AC84'
                    ))
                    
                    fig_compare.update_layout(
                        title='各题学生得分与教师评分对比',
                        barmode='group',
                        xaxis_title='题目',
                        yaxis_title='平均分'
                    )
                    st.plotly_chart(fig_compare, use_container_width=True)
        
        data_issues = loader.get_issues()
        if data_issues:
            st.markdown("---")
            st.subheader("⚠️ 数据问题预警")
            
            for issue in data_issues:
                with st.expander(f"🔴 {issue.issue_type}: {issue.description}", expanded=True):
                    st.write(f"**影响记录数**: {len(issue.affected_records)}")
                    for rec in issue.affected_records:
                        st.json(rec)
    
    with tab2:
        st.subheader("分题差异分析")
        st.markdown("对比学生最终得分与教师评分之间的差异，识别可能存在评分偏差的题目。")
        
        question_diffs_df = filtered_analyzer.get_question_diffs_df(filtered_result.question_diffs)
        
        if not question_diffs_df.empty:
            st.dataframe(
                question_diffs_df,
                use_container_width=True,
                hide_index=True
            )
            
            if len(filtered_result.question_diffs) > 0:
                st.markdown("### 分题分差可视化")
                
                diff_fig_data = []
                for q in filtered_result.question_diffs:
                    if pd.notna(q.score_diff):
                        diff_fig_data.append({
                            '课程': q.course,
                            '题号': q.question_num,
                            '分差': q.score_diff,
                            '分差率': q.score_diff_percent
                        })
                
                if diff_fig_data:
                    diff_fig_df = pd.DataFrame(diff_fig_data)
                    diff_fig_df['题目标识'] = diff_fig_df.apply(
                        lambda x: f"{x['课程']}-{x['题号']}题", axis=1
                    )
                    
                    fig = px.scatter(
                        diff_fig_df,
                        x='分差',
                        y='分差率',
                        size='分差率',
                        color='课程',
                        hover_data=['题目标识', '分差', '分差率'],
                        title='分题分差分布散点图'
                    )
                    fig.add_vline(x=0, line_dash="dash", line_color="gray")
                    st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无分题差异数据")
    
    with tab3:
        st.subheader("教师严格度分析")
        st.markdown("分析每位教师的评分风格，识别偏严或偏松的评卷教师。")
        
        strictness_df = filtered_analyzer.get_teacher_strictness_df(filtered_result.teacher_strictness)
        
        if not strictness_df.empty:
            st.dataframe(
                strictness_df,
                use_container_width=True,
                hide_index=True
            )
            
            st.markdown("### 严格度分布")
            
            label_counts = strictness_df['严格度标签'].value_counts().reset_index()
            label_counts.columns = ['严格度标签', '数量']
            
            fig_pie = px.pie(
                label_counts,
                values='数量',
                names='严格度标签',
                title='教师严格度分布占比',
                color='严格度标签',
                color_discrete_map={
                    '偏严': '#FF6B6B',
                    '正常': '#4ECDC4',
                    '偏松': '#45B7D1'
                }
            )
            st.plotly_chart(fig_pie, use_container_width=True)
        else:
            st.info("暂无教师严格度数据")
    
    with tab4:
        st.subheader("二评冲突分析")
        st.markdown("检测两位教师评分差异超过阈值的记录，这些记录可能需要第三位教师仲裁。")
        
        conflicts_df = filtered_analyzer.get_review_conflicts_df(filtered_result.review_conflicts)
        
        if not conflicts_df.empty:
            true_conflicts = conflicts_df[conflicts_df['是否冲突'] == '是']
            total_pairs = len(conflicts_df)
            conflict_count = len(true_conflicts)
            
            st.metric("检测到的冲突数", f"{conflict_count} / {total_pairs}")
            
            if not true_conflicts.empty:
                st.dataframe(
                    true_conflicts,
                    use_container_width=True,
                    hide_index=True
                )
                
                st.markdown("### 冲突分布")
                
                conflict_by_course = true_conflicts.groupby('课程').size().reset_index(name='冲突数')
                
                fig = px.bar(
                    conflict_by_course,
                    x='课程',
                    y='冲突数',
                    title='各课程二评冲突数分布',
                    color='冲突数',
                    color_continuous_scale='Reds'
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.success("✅ 未检测到二评冲突记录！")
        else:
            st.info("暂无二评对比数据")
    
    with tab5:
        st.subheader("疑似漏评列表")
        st.markdown("检测只收到一位教师评分的学生答题，这些记录可能存在漏评。")
        
        missing_df = filtered_analyzer.get_missing_reviews_df(filtered_result.missing_reviews)
        
        if not missing_df.empty:
            st.metric("疑似漏评记录数", len(missing_df))
            
            st.dataframe(
                missing_df,
                use_container_width=True,
                hide_index=True
            )
            
            st.markdown("### 漏评分布")
            
            missing_by_course = missing_df.groupby('课程').size().reset_index(name='漏评数')
            
            fig = px.pie(
                missing_by_course,
                values='漏评数',
                names='课程',
                title='各课程疑似漏评占比',
                hole=0.4
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.success("✅ 未检测到疑似漏评记录！所有答题都已完成双评。")
    
    if export_issues:
        if 'exporter' not in st.session_state:
            st.session_state['exporter'] = Exporter(loader, analyzer, result)
        
        exporter = st.session_state['exporter']
        
        with st.spinner("正在导出 issues.csv..."):
            output_path = "issues.csv"
            try:
                exported_path = exporter.export_issues_csv(output_path)
                st.success(f"✅ 已成功导出: {exported_path}")
                
                with open(exported_path, 'r', encoding='utf-8-sig') as f:
                    st.download_button(
                        "📥 下载 issues.csv",
                        f.read(),
                        file_name="issues.csv",
                        mime="text/csv"
                    )
            except Exception as e:
                st.error(f"导出失败: {e}")
    
    if export_report:
        if 'exporter' not in st.session_state:
            st.session_state['exporter'] = Exporter(loader, analyzer, result)
        
        exporter = st.session_state['exporter']
        
        with st.spinner("正在导出 review_report.md..."):
            output_path = "review_report.md"
            try:
                exported_path = exporter.export_review_report_md(output_path)
                st.success(f"✅ 已成功导出: {exported_path}")
                
                with open(exported_path, 'r', encoding='utf-8') as f:
                    st.download_button(
                        "📥 下载 review_report.md",
                        f.read(),
                        file_name="review_report.md",
                        mime="text/markdown"
                    )
            except Exception as e:
                st.error(f"导出失败: {e}")


if __name__ == "__main__":
    main()
