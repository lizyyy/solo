#!/usr/bin/env python3
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from models import (
    PointRecord, ScoreRecord, load_streets, load_bus_data,
    build_street_tree, detect_street_membership, calculate_score,
    save_points
)


def init_demo_data():
    streets = load_streets()
    street_tree, street_info = build_street_tree(streets)
    bus_data_list = load_bus_data()
    bus_by_id = {b['id']: b for b in bus_data_list}
    bus_by_point = {b['point_id']: b for b in bus_data_list}

    now = datetime.now().isoformat()

    point_1 = PointRecord(
        id="point_001",
        name="解放路小学路口",
        lng=116.418,
        lat=39.912,
        cross_road="解放路与幸福路交叉口",
        photo_path="photos/point_001.jpg",
        status="completed",
        created_at=now,
        updated_at=now
    )
    result_1 = detect_street_membership(point_1.lng, point_1.lat, street_tree, street_info)
    point_1.streets = result_1['streets']
    point_1.is_boundary = result_1['is_boundary']
    point_1.boundary_streets = result_1['boundary_streets']
    point_1.bus_data_id = "bus_002"
    point_1.bus_swipes_added = True
    point_1.current_score = calculate_score(point_1, bus_by_id.get("bus_002"))
    point_1.current_score.method = "initial"
    point_1.score_history = [ScoreRecord(**point_1.current_score.__dict__)]

    point_2 = PointRecord(
        id="point_002",
        name="朝阳解放交界路口",
        lng=116.410,
        lat=39.9125,
        cross_road="朝阳路与解放路交界口",
        photo_path="photos/point_002.jpg",
        status="pending_review",
        created_at=now,
        updated_at=now
    )
    result_2 = detect_street_membership(point_2.lng, point_2.lat, street_tree, street_info)
    point_2.streets = result_2['streets']
    point_2.is_boundary = result_2['is_boundary']
    point_2.boundary_streets = result_2['boundary_streets']
    point_2.bus_data_id = "bus_003"
    point_2.bus_swipes_added = True
    point_2.current_score = calculate_score(point_2, bus_by_id.get("bus_003"))
    point_2.score_history = [ScoreRecord(**point_2.current_score.__dict__)]

    point_3 = PointRecord(
        id="point_003",
        name="朝阳路三小路口",
        lng=116.402,
        lat=39.910,
        cross_road="朝阳路与育才路交叉口",
        photo_path="photos/point_003.jpg",
        status="bus_added",
        created_at=now,
        updated_at=now
    )
    result_3 = detect_street_membership(point_3.lng, point_3.lat, street_tree, street_info)
    point_3.streets = result_3['streets']
    point_3.is_boundary = result_3['is_boundary']
    point_3.boundary_streets = result_3['boundary_streets']

    initial_score = calculate_score(point_3, None)
    initial_score.method = "initial"
    initial_score.note = "初始评分，无公交数据"
    point_3.score_history.append(ScoreRecord(**initial_score.__dict__))

    point_3.bus_data_id = "bus_001"
    point_3.bus_swipes_added = True
    point_3.current_score = calculate_score(point_3, bus_by_id.get("bus_001"))
    point_3.score_history.append(ScoreRecord(**point_3.current_score.__dict__))

    points = [point_1, point_2, point_3]

    save_points(points)

    print("✅ 演示数据初始化完成")
    print(f"  - 共 {len(points)} 条点位记录")
    for p in points:
        status_icon = "🟢" if not p.is_boundary else "🟡"
        bus_icon = "🚌" if p.bus_swipes_added else "❌"
        print(f"  {status_icon} {p.id}: {p.name}")
        print(f"     街道: {', '.join(p.streets) if p.streets else '无'}")
        print(f"     边界: {'是 - ' + ', '.join(p.boundary_streets) if p.is_boundary else '否'}")
        print(f"     公交: {bus_icon} 评分: {p.current_score.total} ({p.current_score.level})")
        print(f"     方法: {p.current_score.method}")

    return points


if __name__ == "__main__":
    init_demo_data()
