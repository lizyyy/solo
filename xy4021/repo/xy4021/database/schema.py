from database.connection import DatabaseConnection


class DatabaseSchema:
    @staticmethod
    def initialize():
        db = DatabaseConnection()
        
        with db.get_cursor() as cursor:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS package_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    template_id INTEGER NOT NULL,
                    package_number TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT '待灭菌',
                    current_cycle_id INTEGER,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (template_id) REFERENCES package_templates (id),
                    FOREIGN KEY (current_cycle_id) REFERENCES cycles (id)
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cycles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cycle_number TEXT NOT NULL UNIQUE,
                    autoclave_id TEXT NOT NULL,
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    operator TEXT NOT NULL,
                    temperature REAL,
                    pressure REAL,
                    biological_indicator TEXT,
                    chemical_indicator TEXT,
                    status TEXT NOT NULL DEFAULT '进行中',
                    failure_reason TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cycle_packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cycle_id INTEGER NOT NULL,
                    package_id INTEGER NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    removed_at TIMESTAMP,
                    status_at_removal TEXT,
                    removal_reason TEXT,
                    FOREIGN KEY (cycle_id) REFERENCES cycles (id),
                    FOREIGN KEY (package_id) REFERENCES packages (id),
                    UNIQUE (cycle_id, package_id)
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS status_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    package_id INTEGER NOT NULL,
                    cycle_id INTEGER,
                    from_status TEXT,
                    to_status TEXT NOT NULL,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    operator TEXT,
                    reason TEXT,
                    notes TEXT,
                    FOREIGN KEY (package_id) REFERENCES packages (id),
                    FOREIGN KEY (cycle_id) REFERENCES cycles (id)
                )
            ''')

            cursor.execute('CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_packages_number ON packages(package_number)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cycles_number ON cycles(cycle_number)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cycles_status ON cycles(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cycle_packages_cycle ON cycle_packages(cycle_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cycle_packages_package ON cycle_packages(package_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_status_history_package ON status_history(package_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_status_history_cycle ON status_history(cycle_id)')

    @staticmethod
    def seed_default_data():
        db = DatabaseConnection()
        
        with db.get_cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM package_templates')
            count = cursor.fetchone()[0]
            
            if count == 0:
                default_templates = [
                    ('拔牙包', '拔牙手术用器械包'),
                    ('种植包', '种植手术用器械包'),
                    ('洁牙包', '洁牙治疗用器械包'),
                    ('检查包', '口腔检查用器械包'),
                    ('补牙包', '补牙治疗用器械包')
                ]
                
                for name, description in default_templates:
                    cursor.execute('''
                        INSERT INTO package_templates (name, description)
                        VALUES (?, ?)
                    ''', (name, description))
