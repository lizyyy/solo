import json
from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass
class Station:
    station_id: str
    name: str
    line: str


@dataclass
class StationGraph:
    stations: Dict[str, Station]
    edges: Dict[Tuple[str, str], int]
    station_lines: Dict[str, List[str]]


def parse_station_graph(file_path: str) -> StationGraph:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    stations = {}
    for station_data in data['stations']:
        station = Station(
            station_id=station_data['station_id'],
            name=station_data['name'],
            line=station_data['line'],
        )
        stations[station.station_id] = station
    
    edges = {}
    for edge_data in data['edges']:
        key = (edge_data['from'], edge_data['to'])
        edges[key] = edge_data['distance']
        reverse_key = (edge_data['to'], edge_data['from'])
        edges[reverse_key] = edge_data['distance']
    
    station_lines = {}
    for station_id, station in stations.items():
        if station.line not in station_lines:
            station_lines[station.line] = []
        station_lines[station.line].append(station_id)
    
    return StationGraph(
        stations=stations,
        edges=edges,
        station_lines=station_lines,
    )
