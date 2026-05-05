from datetime import datetime
from app import db

class ImportSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_name = db.Column(db.String(200), nullable=False)
    import_time = db.Column(db.DateTime, default=datetime.utcnow)
    file_type = db.Column(db.String(50), nullable=False)
    original_filename = db.Column(db.String(200), nullable=False)
    total_records = db.Column(db.Integer, default=0)
    valid_records = db.Column(db.Integer, default=0)
    bad_records = db.Column(db.Integer, default=0)
    
    bad_data = db.relationship('BadData', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<ImportSession {self.session_name}>'

class Bibliography(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(13), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(100), nullable=True)
    publisher = db.Column(db.String(100), nullable=True)
    publish_date = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(50), nullable=True)
    series = db.Column(db.String(100), nullable=True)
    page_count = db.Column(db.Integer, nullable=True)
    binding = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    price_lists = db.relationship('PriceList', backref='bibliography', lazy=True, cascade='all, delete-orphan')
    channel_listings = db.relationship('ChannelListing', backref='bibliography', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Bibliography {self.isbn}>'

class PriceList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bibliography_id = db.Column(db.Integer, db.ForeignKey('bibliography.id'), nullable=False)
    print_run = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default='CNY')
    effective_date = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<PriceList {self.print_run} - {self.price} {self.currency}>'

class ChannelListing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bibliography_id = db.Column(db.Integer, db.ForeignKey('bibliography.id'), nullable=False)
    channel_name = db.Column(db.String(100), nullable=False)
    channel_category = db.Column(db.String(100), nullable=True)
    channel_price = db.Column(db.Float, nullable=True)
    listing_status = db.Column(db.String(20), default='active')
    listing_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<ChannelListing {self.channel_name}>'

class ManualCorrection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(13), nullable=False, index=True)
    field_name = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=False)
    correction_reason = db.Column(db.String(200), nullable=True)
    corrector = db.Column(db.String(100), nullable=True)
    correction_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ManualCorrection {self.isbn} - {self.field_name}>'

class BadData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('import_session.id'), nullable=False)
    source_file = db.Column(db.String(200), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    data_type = db.Column(db.String(50), nullable=False)
    field_name = db.Column(db.String(100), nullable=True)
    error_code = db.Column(db.String(50), nullable=False)
    error_message = db.Column(db.Text, nullable=False)
    original_data = db.Column(db.Text, nullable=False)
    isbn = db.Column(db.String(13), nullable=True, index=True)
    fix_status = db.Column(db.String(20), default='pending')
    fix_note = db.Column(db.Text, nullable=True)
    fixed_at = db.Column(db.DateTime, nullable=True)
    fixed_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fix_history = db.relationship('FixHistory', backref='bad_data', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<BadData {self.id} - {self.error_code}>'

class FixHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bad_data_id = db.Column(db.Integer, db.ForeignKey('bad_data.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    old_status = db.Column(db.String(20), nullable=True)
    new_status = db.Column(db.String(20), nullable=False)
    note = db.Column(db.Text, nullable=True)
    actor = db.Column(db.String(100), nullable=True)
    action_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<FixHistory {self.id} - {self.action}>'
