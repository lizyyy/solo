"""CSV exporter for risk events."""

import csv
from typing import List

from flight_precheck.calculators.rules import RiskEvent


class CSVExporter:
    """Exporter for risk events to CSV format."""
    
    def export(self, risk_events: List[RiskEvent], output_path: str) -> None:
        """Export risk events to a CSV file.
        
        Args:
            risk_events: List of RiskEvent objects to export
            output_path: Path to the output CSV file
        """
        if not risk_events:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['risk_id', 'category', 'level', 'description', 
                               'location_lat', 'location_lon', 'waypoint_id', 
                               'segment_index', 'details'])
            return
        
        fieldnames = list(risk_events[0].to_csv_row().keys())
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for event in risk_events:
                writer.writerow(event.to_csv_row())
    
    def export_summary(self, risk_events: List[RiskEvent], output_path: str) -> None:
        """Export a summary of risk events by category and level.
        
        Args:
            risk_events: List of RiskEvent objects
            output_path: Path to the output CSV file
        """
        from collections import defaultdict
        
        summary = defaultdict(lambda: defaultdict(int))
        
        for event in risk_events:
            summary[event.category.value][event.level.value] += 1
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['category', 'critical', 'high', 'medium', 'low', 'info', 'total'])
            
            for category, levels in sorted(summary.items()):
                row = [
                    category,
                    levels.get('critical', 0),
                    levels.get('high', 0),
                    levels.get('medium', 0),
                    levels.get('low', 0),
                    levels.get('info', 0),
                    sum(levels.values())
                ]
                writer.writerow(row)
