from app.database.connection import get_db_connection


class ReviewIssueModel:
    @staticmethod
    def create(plate_number, issue_type, issue_description, severity='warning'):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO review_issues (plate_number, issue_type, issue_description, severity)
                VALUES (?, ?, ?, ?)
            ''', (plate_number, issue_type, issue_description, severity))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM review_issues 
            WHERE plate_number = ? 
            ORDER BY detected_at DESC
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM review_issues ORDER BY detected_at DESC')
        return cursor.fetchall()

    @staticmethod
    def get_unresolved():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT ri.* FROM review_issues ri
            LEFT JOIN manual_decisions md ON ri.id = md.issue_id
            WHERE md.id IS NULL
            ORDER BY ri.detected_at DESC
        ''')
        return cursor.fetchall()

    @staticmethod
    def delete_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM review_issues WHERE plate_number = ?', (plate_number,))
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def clear_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM review_issues')
        conn.commit()


class ManualDecisionModel:
    @staticmethod
    def create(plate_number, decision_type, decision_reason, handler_name=None, issue_id=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO manual_decisions 
                (plate_number, issue_id, decision_type, decision_reason, handler_name)
                VALUES (?, ?, ?, ?, ?)
            ''', (plate_number, issue_id, decision_type, decision_reason, handler_name))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM manual_decisions 
            WHERE plate_number = ? 
            ORDER BY decision_time DESC
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM manual_decisions ORDER BY decision_time DESC')
        return cursor.fetchall()


class ProcessingNoteModel:
    @staticmethod
    def create(plate_number, note_content, note_type=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO processing_notes (plate_number, note_content, note_type)
                VALUES (?, ?, ?)
            ''', (plate_number, note_content, note_type))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM processing_notes 
            WHERE plate_number = ? 
            ORDER BY created_at DESC
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM processing_notes ORDER BY created_at DESC')
        return cursor.fetchall()

    @staticmethod
    def update(note_id, note_content):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                UPDATE processing_notes 
                SET note_content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (note_content, note_id))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def delete(note_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM processing_notes WHERE id = ?', (note_id,))
        conn.commit()
        return cursor.rowcount > 0
