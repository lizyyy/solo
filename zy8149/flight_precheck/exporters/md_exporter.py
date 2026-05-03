"""Markdown exporter for flight brief report."""

from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict

from flight_precheck.calculators.rules import RiskEvent, RiskLevel, RiskCategory
from flight_precheck.calculators.geometry import FlightSegment, calculate_total_distance, calculate_total_flight_time
from flight_precheck.parsers.csv_parser import Waypoint
from flight_precheck.parsers.yaml_parser import AircraftCapabilities


class MarkdownExporter:
    """Exporter for flight brief in Markdown format."""
    
    def __init__(self):
        self.level_colors = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢",
            RiskLevel.INFO: "🔵",
        }
    
    def export(self, 
               risk_events: List[RiskEvent],
               waypoints: List[Waypoint],
               segments: List[FlightSegment],
               aircraft: AircraftCapabilities,
               output_path: str,
               flight_name: str = "Power Inspection Flight") -> None:
        """Export flight brief to Markdown file.
        
        Args:
            risk_events: List of RiskEvent objects
            waypoints: List of waypoints
            segments: List of flight segments
            aircraft: Aircraft capabilities
            output_path: Path to output markdown file
            flight_name: Name of the flight
        """
        content = self._generate_content(
            risk_events, waypoints, segments, aircraft, flight_name
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_content(self,
                          risk_events: List[RiskEvent],
                          waypoints: List[Waypoint],
                          segments: List[FlightSegment],
                          aircraft: AircraftCapabilities,
                          flight_name: str) -> str:
        """Generate the Markdown content."""
        total_distance = calculate_total_distance(segments)
        total_time = calculate_total_flight_time(segments)
        
        summary = self._summarize_risks(risk_events)
        
        lines = []
        
        lines.append(f"# {flight_name} - Flight Brief")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Aircraft:** {aircraft.model}")
        lines.append("")
        
        lines.append("## Executive Summary")
        lines.append("")
        
        critical_count = summary['levels'].get(RiskLevel.CRITICAL, 0)
        high_count = summary['levels'].get(RiskLevel.HIGH, 0)
        
        if critical_count > 0:
            lines.append(f"⚠️ **WARNING:** {critical_count} CRITICAL risk(s) detected. Flight NOT recommended.")
            lines.append("")
        elif high_count > 0:
            lines.append(f"⚠️ **CAUTION:** {high_count} HIGH risk(s) detected. Review before proceeding.")
            lines.append("")
        else:
            lines.append("✅ **STATUS:** No critical or high risks detected.")
            lines.append("")
        
        lines.append(f"- **Total Distance:** {total_distance:.0f}m ({total_distance/1000:.2f}km)")
        lines.append(f"- **Estimated Time:** {total_time:.1f}min")
        lines.append(f"- **Waypoints:** {len(waypoints)}")
        lines.append(f"- **Segments:** {len(segments)}")
        lines.append("")
        
        lines.append("## Risk Summary")
        lines.append("")
        lines.append("| Level | Count |")
        lines.append("|-------|-------|")
        
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO]:
            count = summary['levels'].get(level, 0)
            icon = self.level_colors[level]
            lines.append(f"| {icon} {level.value.upper()} | {count} |")
        
        lines.append("")
        
        lines.append("| Category | Critical | High | Medium | Low | Info | Total |")
        lines.append("|----------|----------|------|--------|-----|------|-------|")
        
        for category, counts in sorted(summary['categories'].items(), key=lambda x: x[0].value):
            row = [
                category.value,
                str(counts.get(RiskLevel.CRITICAL, 0)),
                str(counts.get(RiskLevel.HIGH, 0)),
                str(counts.get(RiskLevel.MEDIUM, 0)),
                str(counts.get(RiskLevel.LOW, 0)),
                str(counts.get(RiskLevel.INFO, 0)),
                str(sum(counts.values()))
            ]
            lines.append("| " + " | ".join(row) + " |")
        
        lines.append("")
        
        lines.append("## Detailed Risk Events")
        lines.append("")
        
        non_info_events = [e for e in risk_events if e.level != RiskLevel.INFO]
        info_events = [e for e in risk_events if e.level == RiskLevel.INFO]
        
        if non_info_events:
            for event in sorted(non_info_events, key=lambda e: self._level_priority(e.level)):
                icon = self.level_colors[event.level]
                lines.append(f"### {icon} {event.risk_id} - {event.level.value.upper()}")
                lines.append("")
                lines.append(f"**Category:** {event.category.value}")
                lines.append(f"**Description:** {event.description}")
                
                if event.waypoint_id:
                    lines.append(f"**Waypoint:** {event.waypoint_id}")
                if event.segment_index is not None:
                    lines.append(f"**Segment:** {event.segment_index}")
                if event.location_lat is not None and event.location_lon is not None:
                    lines.append(f"**Location:** {event.location_lat:.6f}°N, {event.location_lon:.6f}°E")
                
                if event.details:
                    lines.append("")
                    lines.append("**Details:**")
                    lines.append("```")
                    for key, value in event.details.items():
                        lines.append(f"  {key}: {value}")
                    lines.append("```")
                
                lines.append("")
        else:
            lines.append("*No warning or critical events detected.*")
            lines.append("")
        
        if info_events:
            lines.append("### Informational Events")
            lines.append("")
            for event in info_events:
                lines.append(f"- **{event.risk_id}:** {event.description}")
            lines.append("")
        
        lines.append("## Flight Plan")
        lines.append("")
        lines.append("### Waypoints")
        lines.append("")
        lines.append("| ID | Latitude | Longitude | Altitude | Type |")
        lines.append("|----|----------|-----------|----------|------|")
        
        for wp in waypoints:
            wp_type = []
            if wp.is_home:
                wp_type.append("Home")
            if wp.is_return_point:
                wp_type.append("Return")
            if not wp_type:
                wp_type.append("Waypoint")
            
            lines.append(
                f"| {wp.id} | {wp.latitude:.6f} | {wp.longitude:.6f} | "
                f"{wp.altitude}m | {', '.join(wp_type)} |"
            )
        
        lines.append("")
        
        lines.append("### Flight Segments")
        lines.append("")
        lines.append("| Segment | From | To | Distance | Bearing | Est. Time |")
        lines.append("|---------|------|-----|----------|---------|-----------|")
        
        for idx, seg in enumerate(segments):
            lines.append(
                f"| {idx} | WP{seg.start_index} | WP{seg.end_index} | "
                f"{seg.distance_m:.0f}m | {seg.bearing_deg:.1f}° | {seg.estimated_time_min:.1f}min |"
            )
        
        lines.append("")
        
        lines.append("## Aircraft Capabilities")
        lines.append("")
        lines.append(f"**Model:** {aircraft.model}")
        lines.append("")
        lines.append("### Performance")
        lines.append("")
        lines.append(f"- **Cruise Speed:** {aircraft.cruise_speed} m/s")
        lines.append(f"- **Max Speed:** {aircraft.max_speed} m/s")
        lines.append(f"- **Max Altitude:** {aircraft.max_altitude} m")
        lines.append(f"- **Max Flight Time:** {aircraft.max_flight_time} min")
        lines.append(f"- **Range:** {aircraft.range} m ({aircraft.range/1000:.2f}km)")
        lines.append("")
        
        lines.append("### Weather Limits")
        lines.append("")
        lines.append(f"- **Max Wind Speed:** {aircraft.max_wind_speed} m/s")
        lines.append(f"- **Max Crosswind:** {aircraft.max_crosswind} m/s")
        lines.append(f"- **Max Gust:** {aircraft.max_gust} m/s")
        lines.append(f"- **Temperature Range:** {aircraft.min_temperature}°C to {aircraft.max_temperature}°C")
        lines.append(f"- **Min Visibility:** {aircraft.min_visibility} m")
        lines.append("")
        
        return "\n".join(lines)
    
    def _summarize_risks(self, risk_events: List[RiskEvent]) -> Dict[str, Any]:
        """Summarize risks by level and category."""
        levels = defaultdict(int)
        categories = defaultdict(lambda: defaultdict(int))
        
        for event in risk_events:
            levels[event.level] += 1
            categories[event.category][event.level] += 1
        
        return {
            'levels': dict(levels),
            'categories': dict(categories)
        }
    
    def _level_priority(self, level: RiskLevel) -> int:
        """Get priority for sorting risk levels (critical first)."""
        priority = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.INFO: 4,
        }
        return priority.get(level, 99)
