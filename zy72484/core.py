import uuid
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from models import (
    DataStore, Community, Shop, AccessibilityRampRecord, NightSamplingPoint,
    FumeIssueRecord, StreetSummary, CommunityAlias, ReviewStatus, NextRole
)


class FumeInspectionSystem:
    def __init__(self):
        self.store = DataStore()

    def _generate_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def add_community(self, name: str, address: str = None, district: str = None, aliases: List[str] = None) -> str:
        cid = self._generate_id()
        community = Community(
            id=cid,
            name=name,
            aliases=aliases or [],
            address=address,
            district=district
        )
        self.store.communities[cid] = community
        return cid

    def add_shop(self, name: str, community_id: str, address: str, shop_type: str,
                 has_fume_hood: bool = False) -> str:
        sid = self._generate_id()
        shop = Shop(
            id=sid,
            name=name,
            community_id=community_id,
            address=address,
            shop_type=shop_type,
            has_fume_hood=has_fume_hood
        )
        self.store.shops[sid] = shop
        return sid

    def import_ramp_record(self, shop_id: str, community_name: str, has_ramp: bool,
                           inspection_date: str, inspector: str = None,
                           ramp_width: float = None, ramp_slope: float = None,
                           has_handrail: bool = False, notes: str = None) -> str:
        rid = self._generate_id()
        record = AccessibilityRampRecord(
            id=rid,
            shop_id=shop_id,
            community_name=community_name,
            has_ramp=has_ramp,
            inspection_date=inspection_date,
            ramp_width=ramp_width,
            ramp_slope=ramp_slope,
            has_handrail=has_handrail,
            inspector=inspector,
            notes=notes,
            status=ReviewStatus.PENDING
        )
        self.store.ramp_records[rid] = record
        self._auto_create_issue(shop_id, community_name, ramp_record_id=rid)
        self._detect_alias_issue(community_name, just_added_ramp_id=rid)
        return rid

    def import_sampling_point(self, shop_id: str, community_name: str,
                              sampling_date: str, sampling_time: str,
                              fume_concentration: float, standard_limit: float = 2.0,
                              sampler: str = None, notes: str = None) -> str:
        sid = self._generate_id()
        is_qualified = fume_concentration <= standard_limit
        record = NightSamplingPoint(
            id=sid,
            shop_id=shop_id,
            community_name=community_name,
            sampling_date=sampling_date,
            sampling_time=sampling_time,
            fume_concentration=fume_concentration,
            standard_limit=standard_limit,
            is_qualified=is_qualified,
            sampler=sampler,
            notes=notes,
            status=ReviewStatus.PENDING
        )
        self.store.sampling_points[sid] = record
        self._auto_create_issue(shop_id, community_name, sampling_point_id=sid)
        self._detect_alias_issue(community_name, just_added_sampling_id=sid)
        return sid

    def _find_community_by_name(self, name: str) -> Optional[Community]:
        for c in self.store.communities.values():
            if c.name == name or name in c.aliases:
                return c
        return None

    def _find_community_by_fuzzy(self, name: str) -> Optional[Community]:
        exact = self._find_community_by_name(name)
        if exact:
            return exact
        for c in self.store.communities.values():
            if self._is_potential_alias(name, c.name):
                return c
            for alias in c.aliases:
                if self._is_potential_alias(name, alias):
                    return c
        return None

    def _detect_alias_issue(self, community_name: str, just_added_ramp_id: str = None,
                            just_added_sampling_id: str = None):
        matched_community = self._find_community_by_fuzzy(community_name)
        if not matched_community:
            return

        all_records = [
            (r, "ramp") for r in self.store.ramp_records.values()
        ] + [
            (s, "sampling") for s in self.store.sampling_points.values()
        ]

        seen_pairs = set()
        for a in self.store.community_aliases:
            seen_pairs.add(tuple(sorted([a.old_name, a.new_name])))

        for rec, rec_type in all_records:
            if rec.community_name == community_name:
                continue
            if not self._is_potential_alias(community_name, rec.community_name):
                continue

            pair_key = tuple(sorted([community_name, rec.community_name]))
            if pair_key in seen_pairs:
                existing_alias = None
                for a in self.store.community_aliases:
                    if tuple(sorted([a.old_name, a.new_name])) == pair_key:
                        existing_alias = a
                        break
                if existing_alias:
                    if just_added_ramp_id and just_added_ramp_id not in existing_alias.triggered_by_ramp_ids:
                        existing_alias.triggered_by_ramp_ids.append(just_added_ramp_id)
                    if just_added_sampling_id and just_added_sampling_id not in existing_alias.triggered_by_sampling_ids:
                        existing_alias.triggered_by_sampling_ids.append(just_added_sampling_id)
                    if rec_type == "ramp" and rec.id not in existing_alias.triggered_by_ramp_ids:
                        existing_alias.triggered_by_ramp_ids.append(rec.id)
                    if rec_type == "sampling" and rec.id not in existing_alias.triggered_by_sampling_ids:
                        existing_alias.triggered_by_sampling_ids.append(rec.id)
                continue

            seen_pairs.add(pair_key)

            ramp_ids = []
            sampling_ids = []
            if just_added_ramp_id:
                ramp_ids.append(just_added_ramp_id)
            if just_added_sampling_id:
                sampling_ids.append(just_added_sampling_id)
            if rec_type == "ramp":
                ramp_ids.append(rec.id)
            else:
                sampling_ids.append(rec.id)

            alias = CommunityAlias(
                community_id=matched_community.id,
                old_name=rec.community_name,
                new_name=community_name,
                triggered_by_ramp_ids=ramp_ids,
                triggered_by_sampling_ids=sampling_ids,
                reviewed=False
            )
            self.store.community_aliases.append(alias)
            self._mark_alias_on_issues(matched_community.id, rec.community_name, community_name)

    def _is_potential_alias(self, name1: str, name2: str) -> bool:
        if name1 == name2:
            return False
        n1, n2 = name1.replace("小区", ""), name2.replace("小区", "")
        if n1 in n2 or n2 in n1:
            return True
        if len(n1) >= 2 and len(n2) >= 2:
            if n1[:2] == n2[:2] or n1[-2:] == n2[-2:]:
                return True
        return False

    def _mark_alias_on_issues(self, community_id: str, old_name: str, new_name: str):
        alias_names = {old_name, new_name}
        for issue in self.store.issue_records.values():
            shop = self.store.shops.get(issue.shop_id)
            shop_community_match = False
            if shop:
                comm = self.store.communities.get(shop.community_id)
                if comm:
                    shop_community_names = {comm.name} | set(comm.aliases)
                    if shop_community_names & alias_names:
                        shop_community_match = True
            if issue.community_name in alias_names or shop_community_match:
                issue.has_alias_issue = True
                issue.alias_community_id = community_id
                issue.status = ReviewStatus.PENDING
                issue.updated_at = datetime.now()

    def _auto_create_issue(self, shop_id: str, community_name: str,
                           ramp_record_id: str = None,
                           sampling_point_id: str = None):
        shop = self.store.shops.get(shop_id)
        if not shop:
            return

        existing_issue = None
        for issue in self.store.issue_records.values():
            if issue.shop_id == shop_id:
                existing_issue = issue
                break

        ramp = None
        if ramp_record_id:
            ramp = self.store.ramp_records.get(ramp_record_id)
        else:
            for r in self.store.ramp_records.values():
                if r.shop_id == shop_id:
                    ramp = r
                    ramp_record_id = r.id
                    break

        sampling = None
        if sampling_point_id:
            sampling = self.store.sampling_points.get(sampling_point_id)
        else:
            for s in self.store.sampling_points.values():
                if s.shop_id == shop_id:
                    sampling = s
                    sampling_point_id = s.id
                    break

        reasons = []
        missing = []
        next_role = NextRole.BOTH

        if ramp and not ramp.has_ramp:
            reasons.append("无障碍坡道缺失")
            missing.append("无障碍坡道改造方案")
            next_role = NextRole.MUNICIPAL_INSPECTOR
        elif ramp and ramp.status == ReviewStatus.PENDING:
            reasons.append("坡道记录待复核")
        elif not ramp and not ramp_record_id:
            missing.append("无障碍坡道记录")

        if sampling and not sampling.is_qualified:
            reasons.append(f"油烟浓度超标（{sampling.fume_concentration}mg/m³）")
            missing.append("油烟净化设备升级方案")
            if next_role == NextRole.MUNICIPAL_INSPECTOR:
                next_role = NextRole.BOTH
            else:
                next_role = NextRole.STREET_PLANNER
        elif sampling and sampling.status == ReviewStatus.PENDING:
            reasons.append("采样记录待复核")
        elif not sampling and not sampling_point_id:
            missing.append("夜间油烟采样数据")

        if not reasons:
            if missing:
                reasons.append("资料不完整")
            else:
                return

        if existing_issue:
            existing_issue.ramp_record_id = existing_issue.ramp_record_id or ramp_record_id
            existing_issue.sampling_point_id = existing_issue.sampling_point_id or sampling_point_id
            existing_issue.reason_kept = "；".join(reasons)
            existing_issue.missing_materials = list(dict.fromkeys(missing))
            existing_issue.next_role = next_role
            existing_issue.updated_at = datetime.now()
            if existing_issue.status == ReviewStatus.RESOLVED:
                existing_issue.status = ReviewStatus.NEEDS_MORE_INFO
        else:
            iid = self._generate_id()
            issue = FumeIssueRecord(
                id=iid,
                shop_id=shop_id,
                shop_name=shop.name,
                community_name=community_name,
                reason_kept="；".join(reasons),
                ramp_record_id=ramp_record_id,
                sampling_point_id=sampling_point_id,
                missing_materials=missing,
                next_role=next_role,
                status=ReviewStatus.PENDING
            )
            self.store.issue_records[iid] = issue

    def review_alias(self, alias_index: int, reviewer: str, is_valid: bool, note: str = None):
        if 0 <= alias_index < len(self.store.community_aliases):
            alias = self.store.community_aliases[alias_index]
            alias.reviewed = True
            alias.reviewer = reviewer
            alias.review_note = note
            if is_valid:
                comm = self.store.communities.get(alias.community_id)
                if comm and alias.old_name not in comm.aliases:
                    comm.aliases.append(alias.old_name)
            for issue in self.store.issue_records.values():
                if issue.alias_community_id == alias.community_id:
                    issue.has_alias_issue = False
                    issue.updated_at = datetime.now()

    def update_issue_status(self, issue_id: str, status: ReviewStatus, reviewer: str = None):
        issue = self.store.issue_records.get(issue_id)
        if issue:
            issue.status = status
            issue.updated_at = datetime.now()

    def get_ramp_by_issue(self, issue_id: str) -> Optional[AccessibilityRampRecord]:
        issue = self.store.issue_records.get(issue_id)
        if issue and issue.ramp_record_id:
            return self.store.ramp_records.get(issue.ramp_record_id)
        return None

    def get_sampling_by_issue(self, issue_id: str) -> Optional[NightSamplingPoint]:
        issue = self.store.issue_records.get(issue_id)
        if issue and issue.sampling_point_id:
            return self.store.sampling_points.get(issue.sampling_point_id)
        return None

    def _build_alias_trace(self, alias) -> Dict:
        ramp_records = []
        for rid in alias.triggered_by_ramp_ids:
            r = self.store.ramp_records.get(rid)
            if r:
                ramp_records.append({
                    "id": rid,
                    "店铺": self.store.shops[r.shop_id].name if r.shop_id in self.store.shops else "未知",
                    "小区名": r.community_name,
                    "有无坡道": "有" if r.has_ramp else "无",
                    "检查人": r.inspector or "未记录",
                    "检查日期": r.inspection_date
                })
        sampling_records = []
        for sid in alias.triggered_by_sampling_ids:
            s = self.store.sampling_points.get(sid)
            if s:
                sampling_records.append({
                    "id": sid,
                    "店铺": self.store.shops[s.shop_id].name if s.shop_id in self.store.shops else "未知",
                    "小区名": s.community_name,
                    "油烟浓度": f"{s.fume_concentration} mg/m³",
                    "采样人": s.sampler or "未记录",
                    "采样日期": f"{s.sampling_date} {s.sampling_time}"
                })
        return {
            "old_name": alias.old_name,
            "new_name": alias.new_name,
            "reviewed": "已复核" if alias.reviewed else "待复核",
            "reviewer": alias.reviewer or "",
            "review_note": alias.review_note or "",
            "触发坡道记录": ramp_records,
            "触发采样记录": sampling_records
        }

    def generate_street_summary(self) -> StreetSummary:
        summary = StreetSummary()
        summary.total_shops = len(self.store.shops)
        summary.shops_with_issues = len(self.store.issue_records)
        summary.alias_issues = sum(1 for a in self.store.community_aliases if not a.reviewed)

        alias_traces = []
        for a in self.store.community_aliases:
            alias_traces.append(self._build_alias_trace(a))
        summary.alias_details = alias_traces

        for issue in self.store.issue_records.values():
            if issue.status in [ReviewStatus.PENDING, ReviewStatus.NEEDS_MORE_INFO]:
                summary.pending_review += 1
            if not issue.ramp_record_id:
                summary.missing_ramp_records += 1
            if not issue.sampling_point_id:
                summary.missing_sampling_points += 1

            related_alias_info = ""
            if issue.has_alias_issue:
                for a in self.store.community_aliases:
                    if a.community_id == issue.alias_community_id and not a.reviewed:
                        related_alias_info = f"「{a.old_name}」与「{a.new_name}」疑似同一小区，待市政巡检员复核"
                        break

            issue_dict = {
                "id": issue.id,
                "店铺": issue.shop_name,
                "所属小区": issue.community_name,
                "问题说明": issue.reason_kept,
                "待补材料": issue.missing_materials,
                "下一步对接": issue.next_role.value,
                "当前状态": issue.status.value,
                "是否有同名小区问题": "是" if issue.has_alias_issue else "否",
                "同名小区说明": related_alias_info,
                "坡道记录ID": issue.ramp_record_id or "",
                "采样记录ID": issue.sampling_point_id or "",
                "更新时间": issue.updated_at.strftime("%Y-%m-%d %H:%M")
            }
            summary.issues.append(issue_dict)

        return summary

    def get_chart_data(self) -> Dict:
        communities_data = {}
        for issue in self.store.issue_records.values():
            comm = issue.community_name
            if comm not in communities_data:
                communities_data[comm] = {"total": 0, "超标": 0, "无障碍": 0, "待复核": 0, "同名问题": 0}
            communities_data[comm]["total"] += 1
            if "超标" in issue.reason_kept:
                communities_data[comm]["超标"] += 1
            if "坡道" in issue.reason_kept:
                communities_data[comm]["无障碍"] += 1
            if issue.status == ReviewStatus.PENDING:
                communities_data[comm]["待复核"] += 1
            if issue.has_alias_issue:
                communities_data[comm]["同名问题"] += 1

        return {
            "by_community": communities_data,
            "status_counts": {
                s.value: sum(1 for i in self.store.issue_records.values() if i.status == s)
                for s in ReviewStatus
            },
            "alias_list": [self._build_alias_trace(a) for a in self.store.community_aliases]
        }
