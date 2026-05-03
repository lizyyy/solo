import json
import os
import shutil
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
import copy


class StateStorage:
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        self._ensure_directory()
        
        self.current_session: Dict[str, Any] = {
            'session_id': None,
            'created_at': None,
            'updated_at': None,
            'clusters': [],
            'complaints': [],
            'work_orders': [],
            'street_keywords': {},
            'history': []
        }

    def _ensure_directory(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        os.makedirs(os.path.join(self.storage_dir, 'sessions'), exist_ok=True)
        os.makedirs(os.path.join(self.storage_dir, 'backups'), exist_ok=True)

    def create_new_session(self, 
                            complaints: List[Dict[str, Any]],
                            work_orders: Optional[List[Dict[str, Any]]] = None,
                            street_keywords: Optional[Dict[str, List[str]]] = None,
                            clusters: Optional[List[Dict[str, Any]]] = None) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        session_id = f"session_{timestamp}"

        self.current_session = {
            'session_id': session_id,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'clusters': clusters or [],
            'complaints': self._serialize_datetime(complaints),
            'work_orders': self._serialize_datetime(work_orders or []),
            'street_keywords': street_keywords or {},
            'history': []
        }

        self._save_session()

        return session_id

    def load_session(self, session_id: str) -> bool:
        session_file = os.path.join(self.storage_dir, 'sessions', f"{session_id}.json")
        
        if not os.path.exists(session_file):
            return False

        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                self.current_session = json.load(f)
            
            self.current_session['complaints'] = self._deserialize_datetime(
                self.current_session.get('complaints', [])
            )
            self.current_session['work_orders'] = self._deserialize_datetime(
                self.current_session.get('work_orders', [])
            )
            
            return True
        except (json.JSONDecodeError, KeyError):
            return False

    def _save_session(self) -> bool:
        if not self.current_session.get('session_id'):
            return False

        session_file = os.path.join(
            self.storage_dir, 'sessions', 
            f"{self.current_session['session_id']}.json"
        )

        try:
            serializable_session = copy.deepcopy(self.current_session)
            serializable_session['complaints'] = self._serialize_datetime(
                serializable_session.get('complaints', [])
            )
            serializable_session['work_orders'] = self._serialize_datetime(
                serializable_session.get('work_orders', [])
            )

            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(serializable_session, f, ensure_ascii=False, indent=2)

            return True
        except Exception:
            return False

    def _serialize_datetime(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for item in items:
            serialized = {}
            for key, value in item.items():
                if isinstance(value, datetime):
                    serialized[key] = value.isoformat()
                else:
                    serialized[key] = value
            result.append(serialized)
        return result

    def _deserialize_datetime(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for item in items:
            deserialized = {}
            for key, value in item.items():
                if isinstance(value, str) and key in ['call_time', 'create_time', 'created_at', 'updated_at']:
                    try:
                        deserialized[key] = datetime.fromisoformat(value)
                    except (ValueError, TypeError):
                        deserialized[key] = value
                else:
                    deserialized[key] = value
            result.append(deserialized)
        return result

    def save_clusters(self, clusters: List[Dict[str, Any]], 
                       action: str = "update") -> bool:
        if not self.current_session.get('session_id'):
            return False

        self._record_history(action)

        self.current_session['clusters'] = self._serialize_datetime(clusters)
        self.current_session['updated_at'] = datetime.now().isoformat()

        return self._save_session()

    def update_cluster(self, cluster_id: str, 
                       updates: Dict[str, Any]) -> bool:
        clusters = self.current_session.get('clusters', [])
        
        for i, cluster in enumerate(clusters):
            if cluster.get('cluster_id') == cluster_id:
                self._record_history(f"update_{cluster_id}")
                
                for key, value in updates.items():
                    clusters[i][key] = value
                
                clusters[i]['updated_at'] = datetime.now().isoformat()
                
                self.current_session['clusters'] = clusters
                self.current_session['updated_at'] = datetime.now().isoformat()
                
                return self._save_session()
        
        return False

    def update_cluster_status(self, cluster_id: str, status: str) -> bool:
        valid_statuses = ['pending_review', 'reviewing', 'confirmed', 
                          'need_split', 'need_merge', 'assigned']
        
        if status not in valid_statuses:
            return False
        
        return self.update_cluster(cluster_id, {'status': status})

    def assign_department(self, cluster_id: str, department: str) -> bool:
        return self.update_cluster(cluster_id, {
            'assigned_department': department,
            'status': 'assigned'
        })

    def add_review_note(self, cluster_id: str, note: str) -> bool:
        clusters = self.current_session.get('clusters', [])
        
        for cluster in clusters:
            if cluster.get('cluster_id') == cluster_id:
                existing_notes = cluster.get('review_notes', '')
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                new_note = f"[{timestamp}] {note}"
                
                if existing_notes:
                    updated_notes = f"{existing_notes}\n{new_note}"
                else:
                    updated_notes = new_note
                
                return self.update_cluster(cluster_id, {
                    'review_notes': updated_notes
                })
        
        return False

    def split_cluster(self, cluster_id: str, 
                      new_clusters: List[Dict[str, Any]]) -> bool:
        clusters = self.current_session.get('clusters', [])
        
        original_cluster = None
        original_index = -1
        for i, cluster in enumerate(clusters):
            if cluster.get('cluster_id') == cluster_id:
                original_cluster = cluster
                original_index = i
                break
        
        if original_cluster is None:
            return False

        self._record_history(f"split_{cluster_id}")

        del clusters[original_index]
        clusters.extend(new_clusters)

        self.current_session['clusters'] = clusters
        self.current_session['updated_at'] = datetime.now().isoformat()

        return self._save_session()

    def merge_clusters(self, cluster_ids: List[str], 
                        merged_cluster: Dict[str, Any]) -> bool:
        clusters = self.current_session.get('clusters', [])
        
        to_remove = set(cluster_ids)
        new_clusters = [c for c in clusters if c.get('cluster_id') not in to_remove]
        
        if len(new_clusters) == len(clusters):
            return False

        self._record_history(f"merge_{'_'.join(cluster_ids)}")

        new_clusters.append(merged_cluster)

        self.current_session['clusters'] = new_clusters
        self.current_session['updated_at'] = datetime.now().isoformat()

        return self._save_session()

    def get_clusters(self, status_filter: Optional[str] = None,
                      district_filter: Optional[str] = None,
                      urgency_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        clusters = self.current_session.get('clusters', [])
        
        if status_filter:
            clusters = [c for c in clusters if c.get('status') == status_filter]
        
        if district_filter:
            clusters = [c for c in clusters if c.get('district') == district_filter]
        
        if urgency_filter:
            clusters = [c for c in clusters if c.get('urgency_level') == urgency_filter]

        return clusters

    def get_cluster(self, cluster_id: str) -> Optional[Dict[str, Any]]:
        clusters = self.current_session.get('clusters', [])
        
        for cluster in clusters:
            if cluster.get('cluster_id') == cluster_id:
                return cluster
        
        return None

    def get_statistics(self) -> Dict[str, Any]:
        clusters = self.current_session.get('clusters', [])
        
        total_clusters = len(clusters)
        total_complaints = sum(c.get('count', 0) for c in clusters)
        
        status_counts = {}
        district_counts = {}
        urgency_counts = {}
        
        for cluster in clusters:
            status = cluster.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
            
            district = cluster.get('district', '未知')
            district_counts[district] = district_counts.get(district, 0) + 1
            
            urgency = cluster.get('urgency_level', '普通')
            urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1

        assigned_count = sum(1 for c in clusters if c.get('assigned_department'))

        return {
            'total_clusters': total_clusters,
            'total_complaints': total_complaints,
            'status_counts': status_counts,
            'district_counts': district_counts,
            'urgency_counts': urgency_counts,
            'assigned_count': assigned_count,
            'pending_count': status_counts.get('pending_review', 0),
            'session_info': {
                'session_id': self.current_session.get('session_id'),
                'created_at': self.current_session.get('created_at'),
                'updated_at': self.current_session.get('updated_at')
            }
        }

    def _record_history(self, action: str):
        history = self.current_session.get('history', [])
        
        history.append({
            'action': action,
            'timestamp': datetime.now().isoformat(),
            'cluster_count': len(self.current_session.get('clusters', []))
        })

        if len(history) > 100:
            history = history[-100:]

        self.current_session['history'] = history

    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions_dir = os.path.join(self.storage_dir, 'sessions')
        if not os.path.exists(sessions_dir):
            return []

        sessions = []
        for filename in os.listdir(sessions_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(sessions_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        session_data = json.load(f)
                        sessions.append({
                            'session_id': session_data.get('session_id'),
                            'created_at': session_data.get('created_at'),
                            'updated_at': session_data.get('updated_at'),
                            'cluster_count': len(session_data.get('clusters', [])),
                            'complaint_count': len(session_data.get('complaints', []))
                        })
                except (json.JSONDecodeError, KeyError):
                    continue

        sessions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return sessions

    def create_backup(self) -> str:
        if not self.current_session.get('session_id'):
            return ""

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"{self.current_session['session_id']}_backup_{timestamp}.json"
        backup_path = os.path.join(self.storage_dir, 'backups', backup_filename)

        try:
            shutil.copy2(
                os.path.join(self.storage_dir, 'sessions', 
                           f"{self.current_session['session_id']}.json"),
                backup_path
            )
            return backup_filename
        except Exception:
            return ""

    def delete_session(self, session_id: str) -> bool:
        session_file = os.path.join(self.storage_dir, 'sessions', f"{session_id}.json")
        
        if os.path.exists(session_file):
            try:
                os.remove(session_file)
                
                if self.current_session.get('session_id') == session_id:
                    self.current_session = {
                        'session_id': None,
                        'created_at': None,
                        'updated_at': None,
                        'clusters': [],
                        'complaints': [],
                        'work_orders': [],
                        'street_keywords': {},
                        'history': []
                    }
                
                return True
            except Exception:
                pass
        
        return False
