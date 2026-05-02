from typing import Dict, List, Optional
from ..parser.station_graph import StationGraph
from ..parser.fare_rules import FareRules
from ..state_machine.trip_reconstructor import Trip


def calculate_fare(
    trip: Trip,
    station_graph: StationGraph,
    fare_rules: FareRules,
) -> int:
    if not trip.legs:
        return 0
    
    total_distance = 0
    for leg in trip.legs:
        if leg.tap_in and leg.tap_out:
            distance = _calculate_station_distance(
                leg.tap_in.station_id,
                leg.tap_out.station_id,
                station_graph,
            )
            total_distance += distance
    
    for rule in fare_rules.fare_rules:
        if rule.min_distance <= total_distance <= rule.max_distance:
            return rule.price
    
    return fare_rules.fare_rules[-1].price if fare_rules.fare_rules else 0


def _calculate_station_distance(
    from_station: str,
    to_station: str,
    station_graph: StationGraph,
) -> int:
    if from_station == to_station:
        return 0
    
    if from_station == 'UNKNOWN' or to_station == 'UNKNOWN':
        return 5000
    
    key = (from_station, to_station)
    if key in station_graph.edges:
        return station_graph.edges[key]
    
    visited = set()
    queue = [(from_station, 0)]
    
    while queue:
        current, dist = queue.pop(0)
        if current == to_station:
            return dist
        if current in visited:
            continue
        visited.add(current)
        
        for (s1, s2), d in station_graph.edges.items():
            if s1 == current and s2 not in visited:
                queue.append((s2, dist + d))
            elif s2 == current and s1 not in visited:
                queue.append((s1, dist + d))
    
    return 5000
