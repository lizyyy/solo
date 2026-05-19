#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.services import BoundaryCheckerService, DependencyGraphService, ViolationService
from app.schemas import ViolationStatusUpdate

db = SessionLocal()

try:
    print("🔍 测试边界检查...")
    violations = BoundaryCheckerService.check_boundaries(db)
    print(f"✅ 发现 {len(violations)} 个边界违规:")
    for v in violations:
        print(f"   - {v.description}")

    print("\n📊 测试依赖图构建...")
    graph = DependencyGraphService.build_dependency_graph(db)
    print(f"✅ 节点数: {len(graph.nodes)}, 边数: {len(graph.edges)}")
    for node in graph.nodes:
        print(f"   - {node.package_name} ({node.file_count} files)")
    for edge in graph.edges:
        print(f"   - {edge.from_package} -> {edge.to_package} ({edge.import_count} imports)")

    print("\n📝 测试违规状态更新...")
    if violations:
        violation = violations[0]
        update = ViolationStatusUpdate(
            to_status="in_progress",
            handler="张三",
            conclusion="开始修复这个跨包依赖问题",
            original_input="代码评审中发现的反向依赖"
        )
        updated = ViolationService.update_status(db, violation.id, update)
        print(f"✅ 状态更新成功: {updated.status}")
        
        history = ViolationService.get_status_history(db, violation.id)
        print(f"✅ 有 {len(history)} 条状态变更记录")
        for h in history:
            print(f"   - {h.handler}: {h.from_status} -> {h.to_status}")

    print("\n📈 测试违规报告...")
    report = ViolationService.generate_report(db)
    print(f"✅ 报告生成: 总计 {report.total_count} 个违规")
    print(f"   按类型: {report.by_type}")
    print(f"   按状态: {report.by_status}")

    print("\n🎉 所有核心服务测试通过!")

finally:
    db.close()
