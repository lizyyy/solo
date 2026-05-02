import csv
from typing import Dict, List
from ..state_machine.trip_reconstructor import Trip


def export_adjustments(
    all_trips: Dict[str, List[Trip]],
    output_path: str,
) -> None:
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'card_id',
            'trip_id',
            'anomaly_type',
            'adjustment_amount',
            'notes',
        ])
        
        trip_counter = 1
        for card_id, trips in all_trips.items():
            for trip in trips:
                if trip.anomalies:
                    for anomaly in trip.anomalies:
                        writer.writerow([
                            card_id,
                            f"TRIP-{trip_counter}",
                            anomaly,
                            trip.calculated_fare,
                            f"行程有{len(trip.legs)}段",
                        ])
                trip_counter += 1
