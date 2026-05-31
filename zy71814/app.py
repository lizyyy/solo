"""
预付卡沉淀核对系统 - 主界面
Streamlit可视化应用
"""
import streamlit as st
import pandas as pd
from datetime import datetime, date
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.engine import ReconciliationEngine
from src.file_manager import FileManager
from src.report import ReconciliationReport
from src.models import RecordStatus

st.set_page_config(
    page_title="预付卡沉淀核对系统",
    page_icon="💳",
    layout="wide"
)

st.title("💳 预付卡沉淀核对系统")
st.markdown("---")

if 'engine' not in st.session_state:
    st.session_state.engine = ReconciliationEngine()

if 'file_manager' not in st.session_state:
    st.session_state.file_manager = FileManager()

if 'report' not in st.session_state:
    st.session_state.report = ReconciliationReport()

if 'current_txns_df' not in st.session_state:
    st.session_state.current_txns_df = None

if 'reconciliation_results' not in st.session_state:
    st.session_state.reconciliation_results = None

if 'selected_period' not in st.session_state:
    st.session_state.selected_period = None

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📥 数据导入",
    "🔍 数据核对",
    "✏️ 人工修正",
    "📜 历史记录",
    "📊 对账说明",
    "📤 导出"
])

with tab1:
    st.header("数据导入")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("交易明细导入")
        txn_file = st.file_uploader(
            "上传交易明细Excel",
            type=['xlsx', 'xls'],
            key="txn_uploader",
            help="需包含: 交易流水号、交易日期、卡号、卡类型、交易金额、手续费、结算金额、商户号、商户名称、终端号、订单号"
        )

        txn_period = st.text_input("交易期间 (如: 2024年1月)", "")

        if txn_file and st.button("导入交易明细", type="primary"):
            with st.spinner("正在导入交易明细..."):
                try:
                    file_info = st.session_state.file_manager.save_uploaded_file(
                        txn_file, 'transaction', txn_period
                    )
                    transactions = st.session_state.engine.load_transactions_from_excel(
                        file_info['file_path']
                    )
                    st.session_state.current_txns_df = st.session_state.engine.get_transactions_dataframe()
                    st.success(f"成功导入 {len(transactions)} 条交易记录！")
                    st.info(f"文件已保存: {file_info['original_name']}")
                except Exception as e:
                    st.error(f"导入失败: {str(e)}")

    with col2:
        st.subheader("结算记录导入")
        settle_file = st.file_uploader(
            "上传结算记录Excel",
            type=['xlsx', 'xls'],
            key="settle_uploader",
            help="需包含: 结算流水号、结算日期、批次号、交易总金额、手续费总额、实际结算金额等"
        )

        settle_period = st.text_input("结算期间", "")

        if settle_file and st.button("导入结算记录", type="primary"):
            with st.spinner("正在导入结算记录..."):
                try:
                    file_info = st.session_state.file_manager.save_uploaded_file(
                        settle_file, 'settlement', settle_period
                    )
                    settlements = st.session_state.engine.load_settlements_from_excel(
                        file_info['file_path']
                    )
                    st.success(f"成功导入 {len(settlements)} 条结算记录！")
                    st.info(f"文件已保存: {file_info['original_name']}")
                except Exception as e:
                    st.error(f"导入失败: {str(e)}")

    st.markdown("---")
    st.subheader("已导入文件列表")
    files = st.session_state.file_manager.get_file_list()
    if files:
        file_df = pd.DataFrame(files)
        st.dataframe(file_df[['original_name', 'file_type', 'period', 'upload_time']], use_container_width=True)
    else:
        st.info("暂无已导入文件")

with tab2:
    st.header("数据核对")

    if st.session_state.current_txns_df is not None:
        st.subheader("交易明细概览")
        st.dataframe(st.session_state.current_txns_df, use_container_width=True, height=300)

        st.markdown("---")
        col1, col2, col3, col4 = st.columns(4)

        duplicate_count = len(st.session_state.engine.get_duplicate_transactions())
        fee_crossed_count = sum(1 for t in st.session_state.engine.transactions.values() if t.fee_period_crossed)

        with col1:
            st.metric("总交易笔数", len(st.session_state.engine.transactions))
        with col2:
            st.metric("重复入账风险", duplicate_count, delta="需关注" if duplicate_count > 0 else "正常")
        with col3:
            st.metric("手续费跨期", fee_crossed_count, delta="需关注" if fee_crossed_count > 0 else "正常")
        with col4:
            total_amount = sum(t.transaction_amount for t in st.session_state.engine.transactions.values())
            st.metric("交易总金额", f"¥{total_amount:,.2f}")

        if st.button("执行核对", type="primary"):
            with st.spinner("正在执行核对..."):
                results, settlements = st.session_state.engine.reconcile()
                st.session_state.reconciliation_results = results

                st.success("核对完成！")

                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("核对一致", results['matched_count'])
                with col2:
                    st.metric("核对不一致", results['unmatched_count'])
                with col3:
                    st.metric("部分匹配", results['total_settlements'] - results['matched_count'] - results['unmatched_count'])

        if duplicate_count > 0:
            st.markdown("---")
            st.subheader("⚠️ 重复入账风险记录")
            st.info("以下记录可能存在重复入账，请点击交易流水号查看来源附件")

            dup_txns = st.session_state.engine.get_duplicate_transactions()
            dup_data = []
            for txn in dup_txns:
                dup_data.append({
                    '交易流水号': txn.transaction_id,
                    '交易日期': txn.transaction_date.strftime('%Y-%m-%d'),
                    '交易金额': txn.transaction_amount,
                    '商户名称': txn.merchant_name,
                    '订单号': txn.order_no,
                    '重复流水号': ', '.join(txn.duplicate_with),
                    '来源文件': txn.source_file
                })
            st.dataframe(pd.DataFrame(dup_data), use_container_width=True)
    else:
        st.info("请先在【数据导入】页面导入交易明细")

with tab3:
    st.header("人工修正")

    if st.session_state.current_txns_df is not None:
        txn_ids = list(st.session_state.engine.transactions.keys())
        selected_txn = st.selectbox("选择要修正的交易流水号", txn_ids)

        if selected_txn:
            txn = st.session_state.engine.transactions[selected_txn]

            col1, col2 = st.columns(2)
            with col1:
                st.write("**当前记录信息**")
                st.write(f"- 交易日期: {txn.transaction_date.strftime('%Y-%m-%d')}")
                st.write(f"- 交易金额: ¥{txn.transaction_amount:,.2f}")
                st.write(f"- 手续费: ¥{txn.fee_amount:,.2f}")
                st.write(f"- 商户名称: {txn.merchant_name}")
                st.write(f"- 当前状态: {txn.status.value}")
                st.write(f"- 来源文件: {txn.source_file}")

            with col2:
                new_status = st.selectbox(
                    "修改状态",
                    [s.value for s in RecordStatus],
                    index=[s.value for s in RecordStatus].index(txn.status.value)
                )
                new_remark = st.text_area("修正备注", value=txn.manual_remark, height=100)

                if st.button("保存修改", type="primary"):
                    status_enum = [s for s in RecordStatus if s.value == new_status][0]
                    success = st.session_state.engine.update_transaction_status(
                        selected_txn, status_enum, new_remark
                    )
                    if success:
                        st.session_state.current_txns_df = st.session_state.engine.get_transactions_dataframe()
                        st.success("修改已保存！")
                        st.rerun()

        st.markdown("---")
        st.subheader("人工修正记录")
        modified_df = st.session_state.current_txns_df[
            st.session_state.current_txns_df['状态'] == RecordStatus.MANUAL_MODIFIED.value
        ]
        if not modified_df.empty:
            st.dataframe(modified_df, use_container_width=True)
        else:
            st.info("暂无人工修正记录")
    else:
        st.info("请先导入交易明细")

with tab4:
    st.header("历史记录")

    history = st.session_state.file_manager.get_reconciliation_history()

    if history:
        st.subheader("历史核对记录")
        history_df = pd.DataFrame(history)
        st.dataframe(history_df[['history_id', 'period', 'created_at']], use_container_width=True)

        selected_history = st.selectbox(
            "选择要查看的历史记录",
            [h['history_id'] for h in history],
            format_func=lambda x: f"{x} - {next((h['period'] for h in history if h['history_id'] == x), '未知期间')}"
        )

        if selected_history and st.button("加载历史记录"):
            with st.spinner("正在加载..."):
                record = st.session_state.file_manager.load_reconciliation(selected_history)
                if record:
                    st.success("历史记录加载成功！")
                    st.json(record['data'], expanded=False)
    else:
        st.info("暂无历史核对记录")

    st.markdown("---")
    st.subheader("保存当前核对结果")
    period_name = st.text_input("期间名称", value=st.session_state.selected_period or "")
    if st.button("保存到历史记录"):
        if st.session_state.reconciliation_results:
            history_id = st.session_state.file_manager.save_reconciliation_history({
                'period': period_name,
                'results': st.session_state.reconciliation_results,
                'transaction_count': len(st.session_state.engine.transactions)
            })
            st.success(f"已保存，历史记录ID: {history_id}")
        else:
            st.warning("请先执行核对")

with tab5:
    st.header("对账说明")

    if st.session_state.current_txns_df is not None:
        col1, col2 = st.columns(2)
        with col1:
            start_date = st.date_input("核对期间开始", value=date.today().replace(day=1))
        with col2:
            end_date = st.date_input("核对期间结束", value=date.today())

        period_str = f"{start_date.strftime('%Y年%m月%d日')} 至 {end_date.strftime('%Y年%m月%d日')}"
        st.session_state.selected_period = period_str

        if st.button("生成对账说明", type="primary"):
            with st.spinner("正在生成对账说明..."):
                confirmed, pending, modified, duplicates = st.session_state.report.categorize_transactions(
                    st.session_state.current_txns_df
                )

                summary = st.session_state.engine.generate_deposit_summary(
                    datetime.combine(start_date, datetime.min.time()),
                    datetime.combine(end_date, datetime.max.time())
                )

                summary_dict = {
                    'total_transactions': len(st.session_state.engine.transactions),
                    'total_deposit': summary.total_deposit,
                    'total_fee': summary.total_fee,
                    'closing_balance': summary.closing_balance
                }

                statement = st.session_state.report.generate_reconciliation_statement(
                    period_str,
                    summary_dict,
                    confirmed,
                    pending,
                    modified,
                    duplicates
                )

                st.session_state.current_statement = statement

                st.success("对账说明生成完成！")

        if 'current_statement' in st.session_state:
            stmt = st.session_state.current_statement

            st.subheader("📋 报告摘要")
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("已确认笔数", stmt['汇总统计']['已确认笔数'])
            with col2:
                st.metric("待补充笔数", stmt['汇总统计']['待补充笔数'])
            with col3:
                st.metric("期末沉淀", f"¥{stmt['汇总统计']['期末沉淀金额']:,.2f}")

            st.markdown("---")
            st.subheader("📏 处理口径")
            for rule_name, rule_desc in stmt['处理口径'].items():
                st.write(f"**{rule_name}**: {rule_desc}")

            st.markdown("---")
            st.subheader("📊 明细分类")

            detail_tab1, detail_tab2, detail_tab3, detail_tab4 = st.tabs([
                f"已确认 ({stmt['汇总统计']['已确认笔数']})",
                f"待补充 ({stmt['汇总统计']['待补充笔数']})",
                f"人工修改 ({stmt['汇总统计']['人工修改笔数']})",
                f"重复入账风险 ({stmt['汇总统计']['重复入账风险笔数']})"
            ])

            with detail_tab1:
                if stmt['已确认交易明细']:
                    st.dataframe(pd.DataFrame(stmt['已确认交易明细']), use_container_width=True)
                else:
                    st.info("暂无已确认交易")

            with detail_tab2:
                if stmt['待补充交易明细']:
                    st.dataframe(pd.DataFrame(stmt['待补充交易明细']), use_container_width=True)
                else:
                    st.info("暂无待补充交易")

            with detail_tab3:
                if stmt['人工修改交易明细']:
                    st.dataframe(pd.DataFrame(stmt['人工修改交易明细']), use_container_width=True)
                else:
                    st.info("暂无人工修改记录")

            with detail_tab4:
                if stmt['重复入账风险明细']:
                    st.dataframe(pd.DataFrame(stmt['重复入账风险明细']), use_container_width=True)
                    st.warning("请重点复核以上重复入账风险记录，点击来源文件可追溯原始附件")
                else:
                    st.success("无重复入账风险记录")

            st.markdown("---")
            st.subheader("✅ 复核信息")
            reviewer = st.text_input("复核人")
            review_opinion = st.text_area("复核意见")

            if st.button("确认复核"):
                st.session_state.current_statement['复核人'] = reviewer
                st.session_state.current_statement['复核意见'] = review_opinion
                st.session_state.current_statement['复核日期'] = datetime.now().strftime('%Y-%m-%d')
                st.success("复核信息已更新！")
    else:
        st.info("请先导入交易明细")

with tab6:
    st.header("导出")

    export_col1, export_col2 = st.columns(2)

    with export_col1:
        st.subheader("导出交易明细")
        if st.session_state.current_txns_df is not None:
            if st.button("导出当前交易明细", type="primary"):
                export_path = st.session_state.file_manager.export_to_excel(
                    st.session_state.current_txns_df,
                    "预付卡交易明细.xlsx"
                )
                st.success(f"已导出到: {export_path}")
        else:
            st.info("请先导入交易明细")

    with export_col2:
        st.subheader("导出对账说明")
        if 'current_statement' in st.session_state:
            if st.button("导出对账说明Excel", type="primary"):
                import tempfile
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
                export_path = st.session_state.report.export_statement_to_excel(
                    st.session_state.current_statement,
                    temp_file.name
                )
                st.success(f"对账说明已生成！")

                with open(export_path, 'rb') as f:
                    st.download_button(
                        label="下载对账说明",
                        data=f,
                        file_name=f"预付卡沉淀核对说明_{datetime.now().strftime('%Y%m%d')}.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
        else:
            st.info("请先在【对账说明】页面生成对账说明")

    st.markdown("---")
    st.subheader("导出目录")
    st.info(f"所有导出文件保存在: {st.session_state.file_manager.exports_dir}")

st.markdown("---")
st.caption("预付卡沉淀核对系统 v1.0 | 结算附件样例及使用说明见 data/samples 目录")
