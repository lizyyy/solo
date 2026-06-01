import math
from datetime import datetime
from collections import defaultdict

from .models import RateRecord, ArbitragePath, SearchResult


def _build_graph(records: list) -> tuple:
    nodes = set()
    edges = []
    record_map = {}

    for r in records:
        if r.compute_status != "ok" or r.rate is None or r.rate <= 0:
            continue
        nodes.add(r.from_currency)
        nodes.add(r.to_currency)
        w = -math.log(r.rate)
        edges.append((r.from_currency, r.to_currency, w, r))
        record_map[(r.from_currency, r.to_currency)] = r

    return list(nodes), edges, record_map


def _bellman_ford(nodes: list, edges: list, source: str) -> tuple:
    INF = float("inf")
    dist = {n: INF for n in nodes}
    pred = {n: None for n in nodes}
    dist[source] = 0.0

    for _ in range(len(nodes) - 1):
        updated = False
        for u, v, w, _ in edges:
            if dist[u] + w < dist[v] - 1e-12:
                dist[v] = dist[u] + w
                pred[v] = u
                updated = True
        if not updated:
            break

    negative_nodes = set()
    for u, v, w, _ in edges:
        if dist[u] + w < dist[v] - 1e-12:
            negative_nodes.add(v)

    return dist, pred, negative_nodes


def _trace_cycle(pred: dict, start: str, nodes: set) -> list:
    visited = set()
    cycle = []
    cur = start
    while cur not in visited:
        if cur is None:
            return []
        visited.add(cur)
        cur = pred.get(cur)
        if cur is None:
            return []

    cycle_start = cur
    cycle = [cycle_start]
    cur = pred[cycle_start]
    safety = 0
    while cur != cycle_start and safety < len(nodes) + 2:
        if cur is None:
            return []
        cycle.append(cur)
        cur = pred[cur]
        safety += 1
    if cur != cycle_start:
        return []
    cycle.reverse()
    return cycle


def _deduplicate_cycles(cycles: list) -> list:
    seen = []
    unique = []
    for c in cycles:
        key = tuple(sorted(c))
        if key not in seen:
            seen.append(key)
            unique.append(c)
    return unique


def _build_reasoning(cycle: list, record_map: dict, profit_pct: float) -> str:
    steps = []
    for i in range(len(cycle)):
        src = cycle[i]
        dst = cycle[(i + 1) % len(cycle)]
        rec = record_map.get((src, dst))
        if rec:
            step = (
                f"{src}→{dst} @ {rec.rate:.6f}"
                f" (来源: {rec.original_source or '未知'}"
                f"{'，备注: ' + rec.original_notes if rec.original_notes else ''})"
            )
        else:
            step = f"{src}→{dst} (未找到直接汇率)"
        steps.append(step)

    chain = " → ".join(cycle) + f" → {cycle[0]}"
    reason = (
        f"套利路径: {chain}\n"
        f"各段汇率: {'; '.join(steps)}\n"
        f"理论收益率: {profit_pct:.4f}%\n"
        f"建议: 收益率{'较高' if profit_pct > 1 else '偏低'}，"
        f"{'值得重点关注' if profit_pct > 1 else '需考虑交易成本后判断是否可行'}。"
        f"注意: 此为纯数学套利，未扣除手续费、滑点和资金转移时间成本。"
    )
    return reason


def find_arbitrage_paths(records: list, min_profit_pct: float = 0.01) -> SearchResult:
    now = datetime.now().isoformat()
    nodes, edges, record_map = _build_graph(records)

    valid_records = [r for r in records if r.compute_status == "ok"]
    uncomputable_records = [r for r in records if r.compute_status != "ok"]

    if not nodes or not edges:
        return SearchResult(
            paths=[], anomalies=[], valid_records=valid_records,
            uncomputable_records=uncomputable_records,
            search_timestamp=now, total_rows_loaded=len(records),
            total_rows_valid=len(valid_records),
            total_rows_uncomputable=len(uncomputable_records),
        )

    all_cycles = []
    for source in nodes:
        dist, pred, neg_nodes = _bellman_ford(nodes, edges, source)
        for n in neg_nodes:
            cycle = _trace_cycle(pred, n, set(nodes))
            if cycle and len(cycle) >= 2:
                all_cycles.append(cycle)

    unique_cycles = _deduplicate_cycles(all_cycles)

    paths = []
    for cycle in unique_cycles:
        profit_rate = 1.0
        contributing = []
        missing_edge = False
        for i in range(len(cycle)):
            src = cycle[i]
            dst = cycle[(i + 1) % len(cycle)]
            rec = record_map.get((src, dst))
            if rec is None:
                missing_edge = True
                break
            profit_rate *= rec.rate
            contributing.append(rec)

        if missing_edge:
            continue

        profit_pct = (profit_rate - 1.0) * 100
        if profit_pct < min_profit_pct:
            continue

        sources = [r.original_source for r in contributing]
        notes = [r.original_notes for r in contributing]
        reasoning = _build_reasoning(cycle, record_map, profit_pct)

        paths.append(ArbitragePath(
            cycle=cycle,
            profit_rate=profit_rate,
            profit_pct=profit_pct,
            reasoning=reasoning,
            contributing_records=contributing,
            detected_at=now,
            original_sources=sources,
            original_notes=notes,
        ))

    paths.sort(key=lambda p: p.profit_pct, reverse=True)

    return SearchResult(
        paths=paths,
        anomalies=[],
        valid_records=valid_records,
        uncomputable_records=uncomputable_records,
        search_timestamp=now,
        total_rows_loaded=len(records),
        total_rows_valid=len(valid_records),
        total_rows_uncomputable=len(uncomputable_records),
    )
