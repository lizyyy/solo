from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Set, Optional
import json
from collections import defaultdict

from app.models import (
    Package, SourceFile, ImportPath, BoundaryRule, Violation,
    ViolationStatusHistory, ViolationStatus, RuleType, ViolationType,
    DependencyGraphCache
)
from app.schemas import (
    PackageCreate, SourceFileCreate, ImportPathCreate, BoundaryRuleCreate,
    ViolationCreate, ViolationStatusUpdate, DependencyGraph, DependencyNode,
    DependencyEdge, CircularDependency, ViolationReport, ViolationReportItem
)


class PackageService:
    @staticmethod
    def create_package(db: Session, pkg: PackageCreate) -> Package:
        db_pkg = Package(**pkg.model_dump())
        db.add(db_pkg)
        db.commit()
        db.refresh(db_pkg)
        return db_pkg

    @staticmethod
    def get_package(db: Session, package_id: int) -> Optional[Package]:
        return db.query(Package).filter(Package.id == package_id).first()

    @staticmethod
    def get_package_by_name(db: Session, name: str) -> Optional[Package]:
        return db.query(Package).filter(Package.name == name).first()

    @staticmethod
    def list_packages(db: Session, skip: int = 0, limit: int = 100) -> List[Package]:
        return db.query(Package).offset(skip).limit(limit).all()


class SourceFileService:
    @staticmethod
    def create_source_file(db: Session, file: SourceFileCreate) -> SourceFile:
        db_file = SourceFile(**file.model_dump())
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        return db_file

    @staticmethod
    def get_source_file(db: Session, file_id: int) -> Optional[SourceFile]:
        return db.query(SourceFile).filter(SourceFile.id == file_id).first()

    @staticmethod
    def get_source_file_by_path(db: Session, file_path: str) -> Optional[SourceFile]:
        return db.query(SourceFile).filter(SourceFile.file_path == file_path).first()

    @staticmethod
    def list_source_files(db: Session, package_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[SourceFile]:
        query = db.query(SourceFile)
        if package_id:
            query = query.filter(SourceFile.package_id == package_id)
        return query.offset(skip).limit(limit).all()


class ImportPathService:
    @staticmethod
    def create_import_path(db: Session, import_path: ImportPathCreate) -> ImportPath:
        db_import = ImportPath(**import_path.model_dump())
        db.add(db_import)
        db.commit()
        db.refresh(db_import)
        return db_import

    @staticmethod
    def list_import_paths(db: Session, skip: int = 0, limit: int = 100) -> List[ImportPath]:
        return db.query(ImportPath).offset(skip).limit(limit).all()


class BoundaryRuleService:
    @staticmethod
    def create_rule(db: Session, rule: BoundaryRuleCreate) -> BoundaryRule:
        db_rule = BoundaryRule(**rule.model_dump())
        db.add(db_rule)
        db.commit()
        db.refresh(db_rule)
        return db_rule

    @staticmethod
    def get_rule(db: Session, rule_id: int) -> Optional[BoundaryRule]:
        return db.query(BoundaryRule).filter(BoundaryRule.id == rule_id).first()

    @staticmethod
    def list_rules(db: Session, is_active: Optional[bool] = None, skip: int = 0, limit: int = 100) -> List[BoundaryRule]:
        query = db.query(BoundaryRule)
        if is_active is not None:
            query = query.filter(BoundaryRule.is_active == is_active)
        return query.offset(skip).limit(limit).all()


class DependencyGraphService:
    @staticmethod
    def build_dependency_graph(db: Session) -> DependencyGraph:
        packages = db.query(Package).all()
        package_map = {p.id: p.name for p in packages}

        nodes = []
        for pkg in packages:
            file_count = db.query(SourceFile).filter(SourceFile.package_id == pkg.id).count()
            nodes.append(DependencyNode(
                package_id=pkg.id,
                package_name=pkg.name,
                file_count=file_count
            ))

        edges_map = defaultdict(int)
        imports = db.query(ImportPath).all()

        for imp in imports:
            from_file = db.query(SourceFile).filter(SourceFile.id == imp.from_file_id).first()
            to_file = db.query(SourceFile).filter(SourceFile.id == imp.to_file_id).first()

            if from_file and to_file:
                from_pkg = package_map.get(from_file.package_id)
                to_pkg = package_map.get(to_file.package_id)
                if from_pkg and to_pkg and from_pkg != to_pkg:
                    edges_map[(from_pkg, to_pkg)] += 1

        edges = [
            DependencyEdge(from_package=k[0], to_package=k[1], import_count=v)
            for k, v in edges_map.items()
        ]

        graph = DependencyGraph(nodes=nodes, edges=edges)

        cache = DependencyGraphCache(graph_data=json.dumps(graph.model_dump()))
        db.add(cache)
        db.commit()

        return graph

    @staticmethod
    def detect_circular_dependencies(db: Session) -> List[CircularDependency]:
        packages = db.query(Package).all()
        package_map = {p.id: p.name for p in packages}
        package_names = {p.name: p.id for p in packages}

        adj = defaultdict(list)
        imports = db.query(ImportPath).all()

        for imp in imports:
            from_file = db.query(SourceFile).filter(SourceFile.id == imp.from_file_id).first()
            to_file = db.query(SourceFile).filter(SourceFile.id == imp.to_file_id).first()

            if from_file and to_file:
                from_pkg = package_map.get(from_file.package_id)
                to_pkg = package_map.get(to_file.package_id)
                if from_pkg and to_pkg and from_pkg != to_pkg:
                    if to_pkg not in adj[from_pkg]:
                        adj[from_pkg].append(to_pkg)

        cycles = []

        def dfs(node: str, path: List[str], visited: Set[str], recursion_stack: Set[str]):
            visited.add(node)
            recursion_stack.add(node)
            path.append(node)

            for neighbor in adj.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor, path.copy(), visited, recursion_stack)
                elif neighbor in recursion_stack:
                    idx = path.index(neighbor)
                    cycle = path[idx:]
                    cycle.append(neighbor)
                    if len(cycle) > 2:
                        cycles.append(CircularDependency(
                            packages=list(set(cycle)),
                            path=cycle
                        ))

            recursion_stack.remove(node)

        visited = set()
        for pkg_name in package_names.keys():
            if pkg_name not in visited:
                dfs(pkg_name, [], visited, set())

        unique_cycles = []
        seen = set()
        for cycle in cycles:
            key = tuple(sorted(cycle.packages))
            if key not in seen:
                seen.add(key)
                unique_cycles.append(cycle)

        return unique_cycles


class BoundaryCheckerService:
    @staticmethod
    def check_boundaries(db: Session) -> List[Violation]:
        violations = []
        active_rules = db.query(BoundaryRule).filter(BoundaryRule.is_active == True).all()

        forbid_rules = [r for r in active_rules if r.rule_type == RuleType.FORBID_IMPORT]

        imports = db.query(ImportPath).all()
        package_map = {p.id: p.name for p in db.query(Package).all()}

        for imp in imports:
            from_file = db.query(SourceFile).filter(SourceFile.id == imp.from_file_id).first()
            to_file = db.query(SourceFile).filter(SourceFile.id == imp.to_file_id).first()

            if not from_file or not to_file:
                continue

            from_pkg_id = from_file.package_id
            to_pkg_id = to_file.package_id

            if from_pkg_id == to_pkg_id:
                continue

            for rule in forbid_rules:
                if (rule.from_package_id == from_pkg_id and rule.to_package_id == to_pkg_id):
                    existing = db.query(Violation).filter(
                        Violation.import_path_id == imp.id,
                        Violation.rule_id == rule.id,
                        Violation.status.in_([ViolationStatus.OPEN, ViolationStatus.IN_PROGRESS])
                    ).first()

                    if not existing:
                        violation = Violation(
                            violation_type=ViolationType.CROSS_BOUNDARY,
                            source_file_id=from_file.id,
                            import_path_id=imp.id,
                            rule_id=rule.id,
                            description=f"包 {package_map.get(from_pkg_id)} 违规导入 {package_map.get(to_pkg_id)}",
                            status=ViolationStatus.OPEN,
                            fix_suggestion=f"移除跨包导入，或调整边界规则允许 {package_map.get(from_pkg_id)} -> {package_map.get(to_pkg_id)}"
                        )
                        db.add(violation)
                        violations.append(violation)

        db.commit()
        return violations

    @staticmethod
    def check_layer_violations(db: Session) -> List[Violation]:
        violations = []
        packages = db.query(Package).filter(Package.layer.isnot(None)).all()

        layer_order = {"foundation": 0, "infrastructure": 1, "domain": 2, "application": 3, "interface": 4}

        package_layers = {p.id: p.layer for p in packages}

        imports = db.query(ImportPath).all()
        package_map = {p.id: p.name for p in packages}

        for imp in imports:
            from_file = db.query(SourceFile).filter(SourceFile.id == imp.from_file_id).first()
            to_file = db.query(SourceFile).filter(SourceFile.id == imp.to_file_id).first()

            if not from_file or not to_file:
                continue

            from_pkg_id = from_file.package_id
            to_pkg_id = to_file.package_id

            from_layer = package_layers.get(from_pkg_id)
            to_layer = package_layers.get(to_pkg_id)

            if from_layer and to_layer:
                from_order = layer_order.get(from_layer, 999)
                to_order = layer_order.get(to_layer, 999)

                if from_order < to_order:
                    existing = db.query(Violation).filter(
                        Violation.import_path_id == imp.id,
                        Violation.violation_type == ViolationType.LAYER_VIOLATION,
                        Violation.status.in_([ViolationStatus.OPEN, ViolationStatus.IN_PROGRESS])
                    ).first()

                    if not existing:
                        violation = Violation(
                            violation_type=ViolationType.LAYER_VIOLATION,
                            source_file_id=from_file.id,
                            import_path_id=imp.id,
                            description=f"层级违规: {package_map.get(from_pkg_id)}({from_layer}) 不能依赖 {package_map.get(to_pkg_id)}({to_layer})",
                            status=ViolationStatus.OPEN,
                            fix_suggestion="反转依赖方向，或提取公共接口，或使用依赖倒置"
                        )
                        db.add(violation)
                        violations.append(violation)

        db.commit()
        return violations


class ViolationService:
    @staticmethod
    def create_violation(db: Session, violation: ViolationCreate) -> Violation:
        db_violation = Violation(**violation.model_dump())
        db.add(db_violation)
        db.commit()
        db.refresh(db_violation)
        return db_violation

    @staticmethod
    def get_violation(db: Session, violation_id: int) -> Optional[Violation]:
        return db.query(Violation).filter(Violation.id == violation_id).first()

    @staticmethod
    def list_violations(
        db: Session,
        status: Optional[ViolationStatus] = None,
        violation_type: Optional[ViolationType] = None,
        assignee: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Violation]:
        query = db.query(Violation)
        if status:
            query = query.filter(Violation.status == status)
        if violation_type:
            query = query.filter(Violation.violation_type == violation_type)
        if assignee:
            query = query.filter(Violation.assignee == assignee)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def update_status(db: Session, violation_id: int, update: ViolationStatusUpdate) -> Optional[Violation]:
        violation = db.query(Violation).filter(Violation.id == violation_id).first()
        if not violation:
            return None

        old_status = violation.status

        history = ViolationStatusHistory(
            violation_id=violation_id,
            from_status=old_status,
            to_status=update.to_status,
            handler=update.handler,
            conclusion=update.conclusion,
            original_input=update.original_input
        )
        db.add(history)

        violation.status = update.to_status
        db.commit()
        db.refresh(violation)
        return violation

    @staticmethod
    def get_status_history(db: Session, violation_id: int) -> List[ViolationStatusHistory]:
        return db.query(ViolationStatusHistory).filter(
            ViolationStatusHistory.violation_id == violation_id
        ).order_by(ViolationStatusHistory.created_at.desc()).all()

    @staticmethod
    def generate_report(db: Session) -> ViolationReport:
        violations = db.query(Violation).all()

        by_type = defaultdict(int)
        by_status = defaultdict(int)
        report_items = []

        package_map = {p.id: p.name for p in db.query(Package).all()}

        for v in violations:
            by_type[v.violation_type.value] += 1
            by_status[v.status.value] += 1

            source_file = db.query(SourceFile).filter(SourceFile.id == v.source_file_id).first()
            import_path = db.query(ImportPath).filter(ImportPath.id == v.import_path_id).first()

            from_package = ""
            to_package = ""
            import_statement = ""

            if import_path:
                import_statement = import_path.import_statement
                from_file = db.query(SourceFile).filter(SourceFile.id == import_path.from_file_id).first()
                to_file = db.query(SourceFile).filter(SourceFile.id == import_path.to_file_id).first()
                if from_file:
                    from_package = package_map.get(from_file.package_id, "")
                if to_file:
                    to_package = package_map.get(to_file.package_id, "")

            report_items.append(ViolationReportItem(
                id=v.id,
                violation_type=v.violation_type,
                source_file=source_file.file_path if source_file else "",
                import_statement=import_statement,
                from_package=from_package,
                to_package=to_package,
                description=v.description or "",
                status=v.status,
                assignee=v.assignee,
                fix_suggestion=v.fix_suggestion
            ))

        return ViolationReport(
            total_count=len(violations),
            by_type=dict(by_type),
            by_status=dict(by_status),
            violations=report_items
        )
