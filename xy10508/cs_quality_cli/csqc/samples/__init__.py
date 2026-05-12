import os


SAMPLE_DIR = os.path.dirname(os.path.abspath(__file__))


def get_sample_path(data_type: str) -> str:
    sample_files = {
        'agents': 'agents.json',
        'rules': 'rules.json',
        'policies': 'policies.json',
        'sessions': 'sessions.json'
    }
    filename = sample_files.get(data_type)
    if filename:
        path = os.path.join(SAMPLE_DIR, filename)
        return path if os.path.exists(path) else None
    return None
