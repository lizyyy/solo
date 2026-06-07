from data_models import PointRecord, PointStatus, DataSource, HistoryLog, ProcessingSession
from demo_data import (
    create_ramp_import_data,
    create_night_sampling_data,
    create_construction_detour_info,
    create_history_logs_for_normal,
    create_history_logs_for_detour,
    create_history_logs_for_supplement,
    create_manual_correction_log,
    create_rerun_log,
    get_timestamp
)


class BlockProcessor:
    def __init__(self):
        self.ramp_data = create_ramp_import_data()
        self.night_sampling_data = create_night_sampling_data()
        self.construction_info = create_construction_detour_info()
        self.sessions = {}

    def create_session(self, session_id: str, name: str, material_type: str) -> ProcessingSession:
        session = ProcessingSession(
            session_id=session_id,
            name=name,
            material_type=material_type,
            start_time=get_timestamp()
        )
        self.sessions[session_id] = session
        return session

    def step1_import_ramp_data(self, session: ProcessingSession) -> ProcessingSession:
        session.step = 1
        session.remarks += f"【步骤1】无障碍坡道记录导入完成，共导入{len(self.ramp_data)}条记录。\n"

        for item in self.ramp_data:
            point = PointRecord(
                point_id=item["point_id"],
                name=item["name"],
                address=item["address"],
                status=PointStatus.PENDING,
                source=DataSource.RAMP_IMPORT,
                created_at=get_timestamp(),
                updated_at=get_timestamp(),
                notes=item["notes"]
            )
            session.point_records.append(point)

            log = HistoryLog(
                log_id=f"LOG_{session.session_id}_{item['point_id']}_1",
                point_id=item["point_id"],
                action="无障碍坡道导入",
                operator="系统",
                timestamp=get_timestamp(),
                details=f"首次导入：{item['name']}，坡道状况：{item['ramp_condition']}",
                before_status=None,
                after_status="待复核"
            )
            session.history_logs.append(log)

        return session

    def step2_check_night_sampling(self, session: ProcessingSession) -> ProcessingSession:
        session.step = 2
        session.remarks += "【步骤2】周姐补看夜间采样点数据。\n"

        for night_item in self.night_sampling_data:
            for point in session.point_records:
                if point.point_id == night_item["original_point_id"]:
                    point.old_caliber = night_item["old_caliber"]
                    point.new_caliber = night_item["new_caliber"]
                    point.updated_at = get_timestamp()
                    point.source = DataSource.NIGHT_SAMPLING

                    log = HistoryLog(
                        log_id=f"LOG_{session.session_id}_{point.point_id}_2",
                        point_id=point.point_id,
                        action="夜间采样点补录",
                        operator="周姐",
                        timestamp=get_timestamp(),
                        details=f"从夜间采样点补录：旧口径「{night_item['old_caliber']}」→ 新口径「{night_item['new_caliber']}」",
                        before_status=point.status.value,
                        after_status=PointStatus.SUPPLEMENTED.value
                    )
                    point.status = PointStatus.SUPPLEMENTED
                    session.history_logs.append(log)
                    session.remarks += f"  - 补录{point.name}：{night_item['old_caliber']} → {night_item['new_caliber']}\n"

        return session

    def step3_update_point_list(self, session: ProcessingSession) -> ProcessingSession:
        session.step = 3
        session.remarks += "【步骤3】点位清单更新。\n"

        for point in session.point_records:
            if point.point_id == "P001":
                point.status = PointStatus.NORMAL
                point.updated_at = get_timestamp()
                log = HistoryLog(
                    log_id=f"LOG_{session.session_id}_{point.point_id}_3",
                    point_id=point.point_id,
                    action="点位核验通过",
                    operator="周姐",
                    timestamp=get_timestamp(),
                    details="无障碍坡道核验通过，状态更新为正常",
                    before_status=PointStatus.PENDING.value,
                    after_status=PointStatus.NORMAL.value
                )
                session.history_logs.append(log)

            elif point.point_id == "P002":
                point.status = PointStatus.NEEDS_REVIEW
                point.map_synced = False
                point.construction_note = self.construction_info["P002"]["detour_route"]
                point.updated_at = get_timestamp()
                log = HistoryLog(
                    log_id=f"LOG_{session.session_id}_{point.point_id}_3",
                    point_id=point.point_id,
                    action="发现施工改道",
                    operator="周姐",
                    timestamp=get_timestamp(),
                    details=f"施工临时改道未同步到地图，留待居民代表复核。改道路线：{self.construction_info['P002']['detour_route']}",
                    before_status=PointStatus.PENDING.value,
                    after_status=PointStatus.NEEDS_REVIEW.value
                )
                session.history_logs.append(log)
                session.remarks += f"  - 注意：{point.name} 施工改道未同步地图，已标记「需居民代表复核」\n"

            elif point.point_id == "P003" and point.status == PointStatus.SUPPLEMENTED:
                point.status = PointStatus.NORMAL
                point.updated_at = get_timestamp()
                log = HistoryLog(
                    log_id=f"LOG_{session.session_id}_{point.point_id}_3",
                    point_id=point.point_id,
                    action="点位清单更新",
                    operator="系统",
                    timestamp=get_timestamp(),
                    details="补录信息已生效，点位清单更新完成",
                    before_status=PointStatus.SUPPLEMENTED.value,
                    after_status=PointStatus.NORMAL.value
                )
                session.history_logs.append(log)

        return session

    def apply_manual_correction(self, session: ProcessingSession, point_id: str) -> ProcessingSession:
        for point in session.point_records:
            if point.point_id == point_id and point.status == PointStatus.NEEDS_REVIEW:
                point.status = PointStatus.CONSTRUCTION_DETOUR
                point.source = DataSource.MANUAL_CORRECTION
                point.updated_at = get_timestamp()

                log = HistoryLog(
                    log_id=f"LOG_{session.session_id}_{point_id}_manual",
                    point_id=point_id,
                    action="人工修正",
                    operator="居民代表",
                    timestamp=get_timestamp(),
                    details="居民代表复核确认，状态更新为「施工临时改道」，暂缓地图同步",
                    before_status=PointStatus.NEEDS_REVIEW.value,
                    after_status=PointStatus.CONSTRUCTION_DETOUR.value
                )
                session.history_logs.append(log)
                session.remarks += f"【人工修正】{point.name} 经居民代表复核，确认为施工临时改道\n"

        return session

    def apply_rerun(self, session: ProcessingSession, point_id: str) -> ProcessingSession:
        for point in session.point_records:
            if point.point_id == point_id:
                original_status = point.status.value
                point.source = DataSource.RERUN
                point.updated_at = get_timestamp()

                log = HistoryLog(
                    log_id=f"LOG_{session.session_id}_{point_id}_rerun",
                    point_id=point_id,
                    action="重跑",
                    operator="周姐",
                    timestamp=get_timestamp(),
                    details="重跑点位核验流程，确认数据准确无误",
                    before_status=original_status,
                    after_status=original_status
                )
                session.history_logs.append(log)
                session.remarks += f"【重跑】{point.name} 已重跑核验，数据确认无误\n"

        return session

    def run_full_process(self, material_type: str = "正常材料") -> ProcessingSession:
        session_id = f"SESS_{material_type}_{get_timestamp().replace(' ', '_').replace(':', '-')}"
        session = self.create_session(session_id, f"街区空置铺面盘活-{material_type}", material_type)

        session = self.step1_import_ramp_data(session)
        session = self.step2_check_night_sampling(session)
        session = self.step3_update_point_list(session)

        if material_type == "正常材料":
            session = self.apply_manual_correction(session, "P002")
            session = self.apply_rerun(session, "P003")

        session.end_time = get_timestamp()
        return session

    def print_session_report(self, session: ProcessingSession):
        print("=" * 70)
        print(f"【处理报告】{session.name}")
        print("=" * 70)
        print(f"会话ID: {session.session_id}")
        print(f"材料类型: {session.material_type}")
        print(f"开始时间: {session.start_time}")
        print(f"结束时间: {session.end_time}")
        print(f"当前步骤: 第{session.step}步")
        print("-" * 70)
        print("\n【点位清单】")
        print(f"{'点位ID':<8} {'名称':<20} {'地址':<15} {'状态':<15} {'数据来源':<15} {'地图同步':<8}")
        print("-" * 85)
        for point in session.point_records:
            map_sync = "是" if point.map_synced else "否"
            print(f"{point.point_id:<8} {point.name:<20} {point.address:<15} {point.status.value:<15} {point.source.value:<15} {map_sync:<8}")
            if point.old_caliber:
                print(f"         └─ 口径变更: {point.old_caliber} → {point.new_caliber}")
            if point.construction_note:
                print(f"         └─ 施工备注: {point.construction_note}")

        print("\n" + "-" * 70)
        print("\n【历史记录】")
        print(f"{'日志ID':<25} {'点位ID':<8} {'操作':<15} {'操作人':<8} {'时间':<20}")
        print("-" * 80)
        for log in session.history_logs:
            print(f"{log.log_id:<25} {log.point_id:<8} {log.action:<15} {log.operator:<8} {log.timestamp:<20}")
            if log.before_status or log.after_status:
                print(f"                         └─ 状态变更: {log.before_status or '无'} → {log.after_status or '无'}")
            print(f"                         └─ 详情: {log.details}")

        print("\n" + "-" * 70)
        print("\n【处理备注】")
        print(session.remarks)
        print("=" * 70 + "\n")

    def verify_point_history_consistency(self, session: ProcessingSession) -> bool:
        print(f"\n【一致性校验】{session.name}")
        print("-" * 50)
        all_consistent = True

        for point in session.point_records:
            point_logs = [log for log in session.history_logs if log.point_id == point.point_id]
            print(f"\n点位 {point.point_id} ({point.name}):")
            print(f"  当前状态: {point.status.value}")
            print(f"  历史记录数: {len(point_logs)}")

            if point_logs:
                last_log = sorted(point_logs, key=lambda x: x.timestamp)[-1]
                if last_log.after_status == point.status.value:
                    print(f"  ✓ 状态一致: 最后一条日志状态为「{last_log.after_status}」，与当前状态匹配")
                else:
                    print(f"  ✗ 状态不一致: 最后一条日志状态为「{last_log.after_status}」，但当前状态为「{point.status.value}」")
                    all_consistent = False
            else:
                print(f"  ✗ 无历史记录")
                all_consistent = False

        print("\n" + "-" * 50)
        if all_consistent:
            print("✓ 所有点位清单与历史记录一致！")
        else:
            print("✗ 存在不一致的记录，请检查！")
        print("-" * 50)

        return all_consistent
