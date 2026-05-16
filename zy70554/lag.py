import argparse
import csv
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

class KafkaLagAnalyzer:
    def __init__(self, input_file, window_minutes=5, lag_threshold=1000):
        self.input_file = input_file
        self.window_minutes = window_minutes
        self.lag_threshold = lag_threshold
        self.valid_snapshots = []
        self.bad_samples = []

    def parse_timestamp(self, ts_str):
        formats = ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']
        for fmt in formats:
            try:
                return datetime.strptime(ts_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"Cannot parse timestamp: {ts_str}")

    def read_samples(self):
        with open(self.input_file, 'r') as f:
            lines = f.readlines()
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            if line.startswith('timestamp'):
                continue
            try:
                if ',' in line:
                    parts = [p.strip().strip('"') for p in line.split(',')]
                    if len(parts) >= 7:
                        snapshot = {
                            'timestamp': self.parse_timestamp(parts[0]),
                            'consumer_group': parts[1],
                            'topic': parts[2],
                            'partition': int(parts[3]),
                            'lag': int(parts[4]),
                            'current_offset': int(parts[5]),
                            'end_offset': int(parts[6])
                        }
                        self.valid_snapshots.append(snapshot)
                    else:
                        self.bad_samples.append({'line': line_num, 'data': line, 'error': f'Not enough fields: {len(parts)}'})
                else:
                    self.bad_samples.append({'line': line_num, 'data': line, 'error': 'Not CSV format'})
            except Exception as e:
                self.bad_samples.append({'line': line_num, 'data': line, 'error': str(e)})

    def analyze(self):
        self.read_samples()
        snapshots = self.valid_snapshots
        all_lags = [s['lag'] for s in snapshots]
        
        partition_data = defaultdict(list)
        for s in snapshots:
            key = (s['consumer_group'], s['topic'], s['partition'])
            partition_data[key].append(s)
        
        partition_stats = []
        for key, data in partition_data.items():
            data.sort(key=lambda x: x['timestamp'])
            lags = [s['lag'] for s in data]
            n = len(lags)
            if n >= 2:
                x = list(range(n))
                x_mean = sum(x) / n
                y_mean = sum(lags) / n
                numerator = sum((x[i] - x_mean) * (lags[i] - y_mean) for i in range(n))
                denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
                slope = numerator / denominator if denominator != 0 else 0
            else:
                slope = 0
            if slope > 0.1:
                trend = 'increasing'
            elif slope < -0.1:
                trend = 'decreasing'
            else:
                trend = 'stable'
            partition_stats.append({
                'consumer_group': key[0],
                'topic': key[1],
                'partition': key[2],
                'min_lag': min(lags),
                'max_lag': max(lags),
                'avg_lag': round(sum(lags) / len(lags), 2),
                'latest_lag': lags[-1],
                'trend': trend
            })
        
        result = {
            'metadata': {
                'total_samples': len(snapshots) + len(self.bad_samples),
                'valid_samples': len(snapshots),
                'bad_samples': len(self.bad_samples)
            },
            'summary': {
                'total_lag': sum(all_lags) if all_lags else 0,
                'max_lag': max(all_lags) if all_lags else 0,
                'avg_lag': round(sum(all_lags) / len(all_lags), 2) if all_lags else 0
            },
            'partition_stats': partition_stats,
            'bad_samples': self.bad_samples
        }
        return result

def main():
    parser = argparse.ArgumentParser(description='Kafka Lag Snapshot CLI')
    parser.add_argument('-i', '--input', required=True, help='Input CSV file')
    parser.add_argument('-o', '--output', default='result.json', help='Output JSON file')
    args = parser.parse_args()
    
    analyzer = KafkaLagAnalyzer(args.input)
    result = analyzer.analyze()
    
    print("=== Kafka Lag Snapshot Analysis ===")
    print(f"Total samples: {result['metadata']['total_samples']}")
    print(f"Valid samples: {result['metadata']['valid_samples']}")
    print(f"Bad samples: {result['metadata']['bad_samples']}")
    print(f"Total lag: {result['summary']['total_lag']}")
    print(f"Max lag: {result['summary']['max_lag']}")
    print(f"Avg lag: {result['summary']['avg_lag']}")
    print("\nPartition stats:")
    for p in sorted(result['partition_stats'], key=lambda x: x['max_lag'], reverse=True):
        print(f"  {p['consumer_group']}/{p['topic']}/p{p['partition']}: max={p['max_lag']}, latest={p['latest_lag']}, trend={p['trend']}")
    
    with open(args.output, 'w') as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\nResult saved to {args.output}")

if __name__ == '__main__':
    main()
