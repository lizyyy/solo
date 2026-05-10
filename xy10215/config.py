import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'ortho_reminder.db')
EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
os.makedirs(EXPORT_DIR, exist_ok=True)

FOLLOWUP_STATUSES = [
    'scheduled',      
    'window_active',  
    'completed',      
    'overdue',        
    'cancelled',      
    'rescheduled'     
]

EVENT_TYPES = [
    'bracket_fall',   
    'delay_visit',    
    'pain_report',    
    'wire_break',     
    'other'           
]

RUN_STATUS = [
    'pending',
    'running',
    'success',
    'failed'
]
