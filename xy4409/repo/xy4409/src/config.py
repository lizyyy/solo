import os
import yaml
from pathlib import Path


class Config:
    _instance = None
    _config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._load_config()
        return cls._instance

    @classmethod
    def _load_config(cls):
        config_path = os.environ.get(
            'PET_BOARDING_CONFIG',
            Path(__file__).parent.parent / 'config' / 'config.yaml'
        )
        
        with open(config_path, 'r', encoding='utf-8') as f:
            cls._config = yaml.safe_load(f)

    @property
    def server(self):
        return self._config.get('server', {})

    @property
    def paths(self):
        return self._config.get('paths', {})

    @property
    def processing(self):
        return self._config.get('processing', {})

    @property
    def risk(self):
        return self._config.get('risk', {})

    @property
    def pets(self):
        return self._config.get('pets', {})

    @property
    def incoming_dir(self):
        return Path(self.paths.get('incoming_dir', './data/incoming')).resolve()

    @property
    def archive_dir(self):
        return Path(self.paths.get('archive_dir', './data/archive')).resolve()

    @property
    def database_path(self):
        return Path(self.paths.get('database_path', './database/pet_boarding.db')).resolve()

    @property
    def export_dir(self):
        return Path(self.paths.get('export_dir', './exports')).resolve()

    @property
    def scan_interval(self):
        return self.processing.get('scan_interval', 300)

    @property
    def night_start_hour(self):
        return self.processing.get('night_start_hour', 22)

    @property
    def night_end_hour(self):
        return self.processing.get('night_end_hour', 6)

    @property
    def risk_check_hours(self):
        return self.processing.get('risk_check_hours', [22, 23, 0, 1, 2, 3, 4, 5])

    @property
    def missed_medication_threshold(self):
        return self.risk.get('missed_medication_threshold', 1)

    @property
    def unconfirmed_note_hours(self):
        return self.risk.get('unconfirmed_note_hours', 4)

    @property
    def mixed_cage_threshold(self):
        return self.risk.get('mixed_cage_threshold', 3)

    @property
    def night_abnormal_calls_threshold(self):
        return self.risk.get('night_abnormal_calls_threshold', 5)

    @property
    def default_medication_times(self):
        return self.pets.get('default_medication_times', ['08:00', '12:00', '18:00'])

    @property
    def server_host(self):
        return self.server.get('host', 'localhost')

    @property
    def server_port(self):
        return self.server.get('port', 5000)

    @property
    def server_debug(self):
        return self.server.get('debug', True)
