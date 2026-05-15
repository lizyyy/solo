import random
import uuid
from typing import List

from models import RequestSample, DownstreamSegment


def generate_demo_samples(count: int = 10, api_name: str = "demo_api") -> List[RequestSample]:
    samples = []
    
    segment_names = [
        "auth_service", "db_query", "cache_lookup", 
        "external_api", "data_processing", "response_build"
    ]
    
    for i in range(count):
        request_id = f"demo-{str(uuid.uuid4())[:8]}"
        
        num_segments = random.randint(3, 6)
        selected_segments = random.sample(segment_names, num_segments)
        
        segments = []
        current_time = 0
        total_time = 0
        
        for seg_name in selected_segments:
            if random.random() < 0.15:
                duration = random.randint(2000, 15000)
            else:
                duration = random.randint(20, 800)
            
            segment = DownstreamSegment(
                name=seg_name,
                start_time=current_time,
                end_time=current_time + duration,
                duration_ms=duration,
                status_code=random.choice([200, 200, 200, 201, 404, 500, None]) if random.random() > 0.3 else None,
                error="Connection timeout" if duration > 10000 and random.random() > 0.5 else None
            )
            segments.append(segment)
            current_time += duration
            total_time += duration
        
        if random.random() < 0.1:
            total_time = random.randint(12000, 30000)
        
        sample = RequestSample(
            request_id=request_id,
            api_name=api_name,
            total_time_ms=total_time,
            segments=segments,
            metadata={
                'user_id': f"user_{random.randint(1, 1000)}",
                'environment': random.choice(['prod', 'staging', 'test']),
                'region': random.choice(['cn-north', 'cn-south', 'cn-east'])
            }
        )
        
        samples.append(sample)
    
    return samples
