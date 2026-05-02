from typing import List, Dict, Any


class MetricsAggregator:
    @staticmethod
    def aggregate_by_agent(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        agent_stats = {}
        
        for result in results:
            agent_id = result['agent_id']
            agent_name = result['agent_name']
            
            if agent_id not in agent_stats:
                agent_stats[agent_id] = {
                    'agent_id': agent_id,
                    'agent_name': agent_name,
                    'call_count': 0,
                    'total_violations': 0,
                    'violation_types': {'opening_missing': 0, 'promise_conflict': 0, 'sensitive_word': 0, 'long_silence': 0},
                    'total_duration': 0
                }
            
            agent_stats[agent_id]['call_count'] += 1
            agent_stats[agent_id]['total_violations'] += result['violation_count']
            agent_stats[agent_id]['total_duration'] += result['call_duration']
            
            for violation in result['violations']:
                v_type = violation['type']
                if v_type in agent_stats[agent_id]['violation_types']:
                    agent_stats[agent_id]['violation_types'][v_type] += 1
        
        for agent in agent_stats.values():
            agent['avg_violations_per_call'] = agent['total_violations'] / agent['call_count'] if agent['call_count'] > 0 else 0
            agent['avg_call_duration'] = agent['total_duration'] / agent['call_count'] if agent['call_count'] > 0 else 0
        
        return list(agent_stats.values())
    
    @staticmethod
    def aggregate_by_violation_type(results: List[Dict[str, Any]]) -> Dict[str, int]:
        type_counts = {'opening_missing': 0, 'promise_conflict': 0, 'sensitive_word': 0, 'long_silence': 0}
        
        for result in results:
            for violation in result['violations']:
                v_type = violation['type']
                if v_type in type_counts:
                    type_counts[v_type] += 1
        
        return type_counts
    
    @staticmethod
    def get_all_violations(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        all_violations = []
        for result in results:
            for violation in result['violations']:
                all_violations.append({
                    'call_id': result['call_id'],
                    'agent_id': result['agent_id'],
                    'agent_name': result['agent_name'],
                    **violation
                })
        return all_violations