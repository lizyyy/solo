from decimal import Decimal
from datetime import date, datetime
from typing import List, Dict, Optional, Tuple
from models import (
    ExposureRecord, DiffItem, HistoryEntry,
    Source, MatchStatus, ReviewStatus
)


class ExposureEngine:
    def __init__(self):
        self.records: Dict[str, List[ExposureRecord]] = {}
        self.diff_list: List[DiffItem] = []
        self.history: List[HistoryEntry] = []
        self._step_counter = 0

    def _log(self, business_no: str, action: str, operator: str,
             before: str = "", after: str = ""):
        self.history.append(HistoryEntry(
            business_no=business_no,
            action=action,
            operator=operator,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            before_value=before,
            after_value=after,
        ))

    def import_tail_adjust(self, records: List[ExposureRecord], operator: str = "林姐"):
        self._step_counter += 1
        step = self._step_counter
        print(f"\n{'='*60}")
        print(f"第{step}步：尾差调整条首次导入（{operator}操作）")
        print(f"{'='*60}")

        for r in records:
            r.source = Source.TAIL_ADJUST
            if r.business_no not in self.records:
                self.records[r.business_no] = []
            self.records[r.business_no].append(r)

            if r.fee_line is not None and r.principal_line is not None:
                r.match_status = MatchStatus.SPLIT_PENDING
                r.review_status = ReviewStatus.PENDING
                self._log(
                    r.business_no,
                    "尾差调整条导入-拆行",
                    operator,
                    "无",
                    f"手续费={r.fee_line}, 本金={r.principal_line}, 状态=拆行待复核"
                )
                print(f"  ▸ {r.business_no}（{r.bond_name}）：手续费/本金拆行，留待结算主管复核")
            else:
                r.match_status = MatchStatus.MATCHED
                self._log(
                    r.business_no,
                    "尾差调整条导入-正常",
                    operator,
                    "无",
                    f"面值={r.face_value}, 状态=匹配通过"
                )
                print(f"  ▸ {r.business_no}（{r.bond_name}）：面值{r.face_value}，匹配通过")

    def check_custody_confirm(self, custody_records: List[ExposureRecord], operator: str = "林姐"):
        self._step_counter += 1
        step = self._step_counter
        print(f"\n{'='*60}")
        print(f"第{step}步：基金会计补看托管确认页（{operator}操作）")
        print(f"{'='*60}")

        for cr in custody_records:
            cr.source = Source.CUSTODY_CONFIRM
            if cr.business_no not in self.records:
                cr.match_status = MatchStatus.OLD_CALIBER
                cr.old_caliber_flag = True
                self.records[cr.business_no] = [cr]
                self._log(
                    cr.business_no,
                    "托管确认页补录-旧口径",
                    operator,
                    "无",
                    f"面值={cr.face_value}, 来源=托管确认页, 标记=旧口径"
                )
                print(f"  ▸ {cr.business_no}（{cr.bond_name}）：托管确认页有，尾差调整条没有 → 旧口径补录")
            else:
                existing = self.records[cr.business_no]
                for ex in existing:
                    if ex.match_status == MatchStatus.SPLIT_PENDING:
                        total_split = (ex.fee_line or Decimal("0")) + (ex.principal_line or Decimal("0"))
                        if abs(total_split - cr.face_value) < Decimal("0.01"):
                            print(f"  ▸ {cr.business_no}（{cr.bond_name}）：托管确认页面值{cr.face_value}，"
                                  f"与拆行合计{total_split}吻合，但拆行仍待结算主管复核")
                            self._log(
                                cr.business_no,
                                "托管确认页核验-拆行吻合",
                                operator,
                                f"拆行合计={total_split}",
                                f"托管面值={cr.face_value}，吻合但仍待复核"
                            )
                        else:
                            print(f"  ▸ {cr.business_no}（{cr.bond_name}）：托管确认页面值{cr.face_value}，"
                                  f"与拆行合计{total_split}不吻合，记入差异清单")
                            self.diff_list.append(DiffItem(
                                business_no=cr.business_no,
                                diff_type="拆行合计与托管不符",
                                detail=f"拆行合计{total_split} vs 托管{cr.face_value}",
                                source_a="尾差调整条",
                                source_b="托管确认页",
                                amount_diff=abs(total_split - cr.face_value),
                            ))
                            self._log(
                                cr.business_no,
                                "托管确认页核验-差异",
                                operator,
                                f"拆行合计={total_split}",
                                f"托管面值={cr.face_value}，差异={abs(total_split - cr.face_value)}"
                            )
                    elif ex.match_status == MatchStatus.MATCHED:
                        if abs(ex.face_value - cr.face_value) < Decimal("0.01"):
                            print(f"  ▸ {cr.business_no}（{cr.bond_name}）：托管确认页面值{cr.face_value}，与尾差调整条一致")
                            self._log(
                                cr.business_no,
                                "托管确认页核验-一致",
                                operator,
                                f"尾差面值={ex.face_value}",
                                f"托管面值={cr.face_value}，一致"
                            )
                        else:
                            print(f"  ▸ {cr.business_no}（{cr.bond_name}）：托管确认页面值{cr.face_value}，"
                                  f"与尾差调整条{ex.face_value}不一致，记入差异清单")
                            self.diff_list.append(DiffItem(
                                business_no=cr.business_no,
                                diff_type="面值不一致",
                                detail=f"尾差调整条{ex.face_value} vs 托管确认页{cr.face_value}",
                                source_a="尾差调整条",
                                source_b="托管确认页",
                                amount_diff=abs(ex.face_value - cr.face_value),
                            ))
                            self._log(
                                cr.business_no,
                                "托管确认页核验-差异",
                                operator,
                                f"尾差面值={ex.face_value}",
                                f"托管面值={cr.face_value}，差异={abs(ex.face_value - cr.face_value)}"
                            )

    def update_diff_list(self, operator: str = "林姐"):
        self._step_counter += 1
        step = self._step_counter
        print(f"\n{'='*60}")
        print(f"第{step}步：差异清单更新（{operator}操作）")
        print(f"{'='*60}")

        if not self.diff_list:
            print("  ✓ 差异清单为空，无待查差异")
        else:
            for d in self.diff_list:
                print(f"  ▸ 业务号{d.business_no}：{d.diff_type}")
                print(f"    详情：{d.detail}")
                print(f"    来源A={d.source_a}，来源B={d.source_b}，金额差异={d.amount_diff}")

        print(f"\n  当前各业务号处理状态汇总：")
        for biz_no, recs in self.records.items():
            for r in recs:
                review_str = f"（复核状态：{r.review_status.value}）" if r.review_status else ""
                caliber_str = " [旧口径]" if r.old_caliber_flag else ""
                print(f"    {biz_no}（{r.bond_name}）：{r.match_status.value}{review_str}{caliber_str}")

    def manual_fix(self, business_no: str, correct_value: Decimal, operator: str = "林姐"):
        print(f"\n{'='*60}")
        print(f"人工修正（{operator}操作）：业务号{business_no}")
        print(f"{'='*60}")

        if business_no not in self.records:
            print(f"  ✗ 未找到业务号{business_no}")
            return

        recs = self.records[business_no]
        for r in recs:
            old_status = r.match_status
            old_value = r.face_value
            r.face_value = correct_value
            r.source = Source.MANUAL_FIX
            r.match_status = MatchStatus.MATCHED
            r.review_status = None
            self._log(
                business_no,
                "人工修正",
                operator,
                f"面值={old_value}, 状态={old_status.value}",
                f"面值={correct_value}, 状态=匹配通过"
            )
            print(f"  ▸ {business_no}（{r.bond_name}）：面值从{old_value}修正为{correct_value}，状态改为匹配通过")

    def rerun(self, operator: str = "结算主管"):
        print(f"\n{'='*60}")
        print(f"重跑（{operator}操作）")
        print(f"{'='*60}")

        self.diff_list.clear()

        for biz_no, recs in self.records.items():
            for r in recs:
                old_status = r.match_status
                if r.match_status == MatchStatus.SPLIT_PENDING:
                    if r.review_status == ReviewStatus.PASSED:
                        r.match_status = MatchStatus.MATCHED
                        self._log(
                            biz_no,
                            "重跑-拆行复核通过",
                            operator,
                            f"状态={old_status.value}",
                            f"状态=匹配通过"
                        )
                        print(f"  ▸ {biz_no}（{r.bond_name}）：拆行已复核通过，状态更新为匹配通过")
                    else:
                        self.diff_list.append(DiffItem(
                            business_no=biz_no,
                            diff_type="拆行待复核",
                            detail=f"手续费={r.fee_line}, 本金={r.principal_line}，结算主管尚未复核",
                            source_a="尾差调整条",
                            source_b="待结算主管确认",
                            amount_diff=r.fee_line,
                        ))
                        self._log(
                            biz_no,
                            "重跑-拆行仍待复核",
                            operator,
                            f"状态={old_status.value}",
                            f"状态仍为拆行待复核"
                        )
                        print(f"  ▸ {biz_no}（{r.bond_name}）：拆行仍未复核，继续留在差异清单")
                elif r.match_status == MatchStatus.OLD_CALIBER:
                    self.diff_list.append(DiffItem(
                        business_no=biz_no,
                        diff_type="旧口径补录待确认",
                        detail=f"面值={r.face_value}，来源为托管确认页，需确认是否沿用旧口径",
                        source_a="托管确认页",
                        source_b="待确认",
                        amount_diff=r.face_value,
                    ))
                    self._log(
                        biz_no,
                        "重跑-旧口径待确认",
                        operator,
                        f"状态={old_status.value}",
                        f"旧口径补录仍待确认"
                    )
                    print(f"  ▸ {biz_no}（{r.bond_name}）：旧口径补录，需确认是否沿用")

        if not self.diff_list:
            print("  ✓ 重跑后差异清单为空，全部匹配通过")
        else:
            print(f"\n  重跑后差异清单（{len(self.diff_list)}条）：")
            for d in self.diff_list:
                print(f"    {d.business_no}：{d.diff_type} — {d.detail}")

    def review_split(self, business_no: str, passed: bool, operator: str = "结算主管"):
        print(f"\n{'='*60}")
        print(f"结算主管复核（{operator}操作）：业务号{business_no}，{'通过' if passed else '退回'}")
        print(f"{'='*60}")

        if business_no not in self.records:
            print(f"  ✗ 未找到业务号{business_no}")
            return

        for r in self.records[business_no]:
            if r.match_status == MatchStatus.SPLIT_PENDING:
                r.review_status = ReviewStatus.PASSED if passed else ReviewStatus.REJECTED
                self._log(
                    business_no,
                    f"结算主管复核-{'通过' if passed else '退回'}",
                    operator,
                    f"复核状态={ReviewStatus.PENDING.value}",
                    f"复核状态={r.review_status.value}"
                )
                print(f"  ▸ {business_no}（{r.bond_name}）：复核{'通过' if passed else '退回'}")
            else:
                print(f"  ▸ {business_no}（{r.bond_name}）：非拆行待复核状态，跳过")

    def print_history(self):
        print(f"\n{'='*60}")
        print(f"历史记录")
        print(f"{'='*60}")
        if not self.history:
            print("  （无）")
        for h in self.history:
            print(f"  [{h.timestamp}] {h.business_no} | {h.action} | 操作人={h.operator}")
            if h.before_value:
                print(f"    变更前：{h.before_value}")
            if h.after_value:
                print(f"    变更后：{h.after_value}")

    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"信用债舆情敞口标记 — 处理结果汇总")
        print(f"{'='*60}")
        print(f"{'业务号':<14} {'债券名称':<12} {'处理结果':<14} {'复核状态':<10} {'来源':<10} {'备注'}")
        print(f"{'-'*14} {'-'*12} {'-'*14} {'-'*10} {'-'*10} {'-'*20}")
        for biz_no, recs in self.records.items():
            for r in recs:
                review_str = r.review_status.value if r.review_status else "—"
                remark = ""
                if r.old_caliber_flag:
                    remark = "旧口径补录"
                elif r.fee_line is not None and r.principal_line is not None:
                    remark = f"手续费{r.fee_line}+本金{r.principal_line}"
                print(f"{biz_no:<14} {r.bond_name:<12} {r.match_status.value:<14} {review_str:<10} "
                      f"{r.source.value:<10} {remark}")
