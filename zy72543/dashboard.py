"""Streamlit 小看板 - 编辑部校稿风格"""
import streamlit as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from citation_review.storage import JsonStorage
from citation_review.engine import CitationReviewEngine
from citation_review.importer import TicketImporter
from citation_review.models import ReviewStatus, NextOwner

st.set_page_config(page_title="学术摘要引用复核", layout="wide")

DATA_DIR = "./data"


def get_storage():
    return JsonStorage(DATA_DIR)


def get_engine():
    storage = get_storage()
    return CitationReviewEngine(storage), storage


st.title("📝 学术摘要引用复核")
st.caption("编辑部校稿风格：摘要、引用页、人工备注并排看")

tab1, tab2, tab3 = st.tabs(["📊 复核总览", "🔍 工单校稿室", "📄 报告导出"])

with tab1:
    st.header("复核总览")
    engine, storage = get_engine()
    tickets = storage.list_tickets()
    reviews = storage.list_reviews()
    groups = storage.list_groups()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("总工单数", len(tickets))
    with col2:
        dup_count = sum(1 for r in reviews if r.status in (ReviewStatus.DUPLICATE_DETECTED, ReviewStatus.CONFIRMED_DUPLICATE))
        st.metric("疑似重复", dup_count, delta=f"{len(groups)} 组")
    with col3:
        need_info = sum(1 for r in reviews if r.status == ReviewStatus.NEED_MORE_INFO)
        st.metric("待补充信息", need_info)
    with col4:
        normal = sum(1 for r in reviews if r.status == ReviewStatus.NORMAL)
        st.metric("已确认正常", normal)

    if groups:
        st.subheader("🔴 重复工单分组")
        for g in groups:
            with st.expander(f"分组 {g.group_id} | 用户 {g.user_id} | 相似度 {g.similarity_score:.2%}"):
                st.write(g.merged_summary)
                st.write(f"涉及工单：{', '.join(g.ticket_ids)}")

    if st.button("🔄 重新执行复核"):
        records = engine.run_review()
        st.success(f"复核完成，处理 {len(records)} 条记录")
        st.rerun()

with tab2:
    st.header("🔍 工单校稿室")
    st.caption("像编辑部校稿一样：左=工单原文，中=证据回放，右=脱敏备注")

    _, storage = get_engine()
    tickets = storage.list_tickets()

    if not tickets:
        st.info("暂无工单，请先导入数据")
    else:
        ticket_ids = [t.ticket_id for t in tickets]
        selected = st.selectbox("选择工单", ticket_ids, format_func=lambda x: f"{x} - {storage.get_ticket(x).user_feedback[:30]}...")

        ticket = storage.get_ticket(selected)
        review = storage.get_review_for_ticket(selected)
        note = storage.get_note_for_ticket(selected)

        col_left, col_mid, col_right = st.columns([1, 1, 1])

        with col_left:
            st.subheader("📄 工单原文")
            st.info(f"**工单 ID**: {ticket.ticket_id}")
            st.write(f"**用户 ID**: {ticket.user_id}")
            st.write(f"**提交时间**: {ticket.submit_time}")
            st.write(f"**来源渠道**: {ticket.source_channel}")
            st.divider()
            st.write("**用户反馈内容**:")
            st.markdown(f"> {ticket.user_feedback}")

            if review and review.evidence.duplicate_ticket_ids:
                st.divider()
                st.warning("⚠️ 关联重复工单：")
                for dup_id in review.evidence.duplicate_ticket_ids:
                    dup_t = storage.get_ticket(dup_id)
                    if dup_t:
                        st.markdown(f"- **{dup_id}**: {dup_t.user_feedback[:40]}...")

        with col_mid:
            st.subheader("🔍 证据回放")
            if not review:
                st.warning("暂无复核记录，请先执行复核")
            else:
                status_map = {
                    ReviewStatus.PENDING: ("⚪", "待处理", "gray"),
                    ReviewStatus.DUPLICATE_DETECTED: ("🔴", "疑似重复", "red"),
                    ReviewStatus.CONFIRMED_DUPLICATE: ("🟤", "已确认重复", "orange"),
                    ReviewStatus.NORMAL: ("🟢", "正常", "green"),
                    ReviewStatus.NEED_MORE_INFO: ("🟡", "需补充信息", "yellow"),
                }
                icon, label, color = status_map.get(review.status, ("⚪", "未知", "gray"))
                st.markdown(f"**状态**: {icon} :{color}[**{label}**]")

                st.divider()
                st.write("**为什么被留下？**")
                st.info(review.evidence.why_kept)

                st.divider()
                st.write("**还缺什么材料？**")
                for m in review.evidence.missing_materials:
                    st.markdown(f"- ❌ {m}")

                st.divider()
                owner_map = {
                    NextOwner.ANNOTATION_LEAD: "👔 标注负责人",
                    NextOwner.AI_PRODUCT_MANAGER: "👩‍💼 AI 产品经理阿宁",
                    NextOwner.SYSTEM: "🖥️ 系统自动处理",
                }
                st.write(f"**下一步找谁**: {owner_map.get(review.evidence.next_owner, review.evidence.next_owner.value)}")
                st.write(f"**下一步动作**: {review.evidence.next_action}")

                st.divider()
                st.write("**判定细节**:")
                st.caption(review.evidence.reasoning_detail)

        with col_right:
            st.subheader("📌 脱敏规则备注")
            st.caption("AI 产品经理阿宁补录区")

            if note:
                st.success("✅ 已有备注")
                st.write(f"**补录人**: {note.noted_by}")
                st.write(f"**更新时间**: {note.updated_at}")
                st.divider()
                st.write("**脱敏规则**:")
                st.markdown(f"> {note.desensitization_rule}")
                if note.additional_context:
                    st.divider()
                    st.write("**补充上下文**:")
                    st.markdown(f"> {note.additional_context}")
            else:
                st.warning("⚠️ 暂无脱敏备注")

            st.divider()
            st.write("**补录脱敏备注**")
            with st.form(f"note_form_{selected}"):
                rule = st.text_area("脱敏规则", height=100, placeholder="例如：用户手机号已按规则 A 脱敏，身份证号按规则 B 脱敏")
                context = st.text_area("补充上下文（可选）", height=80, placeholder="例如：该用户是测试账号，反馈内容需特殊处理")
                submitted = st.form_submit_button("💾 保存备注并更新证据回放")

                if submitted and rule.strip():
                    importer = TicketImporter(storage)
                    importer.add_desensitization_note(selected, rule.strip(), context.strip() if context.strip() else None)
                    engine, _ = get_engine()
                    engine.update_evidence_with_note(selected)
                    st.success("备注已保存，证据回放已更新")
                    st.rerun()

with tab3:
    st.header("📄 复核报告")
    engine, _ = get_engine()

    if st.button("📊 生成学术摘要风格报告"):
        report = engine.generate_report()

        st.subheader("【摘要】")
        st.info(report.summary)

        st.subheader("【核心发现】")
        for i, finding in enumerate(report.key_findings, 1):
            st.markdown(f"{i}. {finding}")

        st.divider()
        col_a, col_b, col_c, col_d = st.columns(4)
        col_a.metric("总工单", report.total_tickets)
        col_b.metric("重复组数", report.duplicate_groups_count)
        col_c.metric("重复工单", report.duplicate_tickets_count)
        col_d.metric("需补充信息", report.need_more_info_count)

        st.divider()
        st.subheader("【证据回放索引】")
        for r in report.review_records:
            status_icon = "🔴" if r.status == ReviewStatus.DUPLICATE_DETECTED else "🟡" if r.status == ReviewStatus.NEED_MORE_INFO else "🟢"
            owner_icon = "👔" if r.evidence.next_owner == NextOwner.ANNOTATION_LEAD else "👩‍💼" if r.evidence.next_owner == NextOwner.AI_PRODUCT_MANAGER else "🖥️"
            with st.expander(f"{status_icon} {r.ticket_id} [{r.status.value}] -> {owner_icon} {r.evidence.next_owner.value}"):
                st.write(f"**为什么留下**: {r.evidence.why_kept}")
                st.write(f"**缺什么材料**: {', '.join(r.evidence.missing_materials)}")
                st.write(f"**下一步动作**: {r.evidence.next_action}")

        st.divider()
        st.download_button(
            "⬇️ 下载完整报告 (JSON)",
            data=report.model_dump_json(indent=2, ensure_ascii=False),
            file_name=f"citation_review_report_{report.report_id}.json",
            mime="application/json"
        )
