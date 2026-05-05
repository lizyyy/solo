from marshmallow import fields, Schema
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field
from app.models import (
    ImportSession, Bibliography, PriceList, ChannelListing,
    ManualCorrection, BadData, FixHistory
)

class ImportSessionSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = ImportSession
        load_instance = True
        include_fk = True
        include_relationships = True
    
    bad_data = fields.Nested('BadDataSchema', many=True, exclude=('session',))

class BibliographySchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Bibliography
        load_instance = True
        include_fk = True
        include_relationships = True
    
    price_lists = fields.Nested('PriceListSchema', many=True, exclude=('bibliography',))
    channel_listings = fields.Nested('ChannelListingSchema', many=True, exclude=('bibliography',))

class PriceListSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = PriceList
        load_instance = True
        include_fk = True
        include_relationships = True

class ChannelListingSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = ChannelListing
        load_instance = True
        include_fk = True
        include_relationships = True

class ManualCorrectionSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = ManualCorrection
        load_instance = True
        include_fk = True

class BadDataSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = BadData
        load_instance = True
        include_fk = True
        include_relationships = True
    
    fix_history = fields.Nested('FixHistorySchema', many=True, exclude=('bad_data',))
    session = fields.Nested('ImportSessionSchema', exclude=('bad_data',))

class FixHistorySchema(SQLAlchemyAutoSchema):
    class Meta:
        model = FixHistory
        load_instance = True
        include_fk = True

import_session_schema = ImportSessionSchema()
import_sessions_schema = ImportSessionSchema(many=True)

bibliography_schema = BibliographySchema()
bibliographies_schema = BibliographySchema(many=True)

price_list_schema = PriceListSchema()
price_lists_schema = PriceListSchema(many=True)

channel_listing_schema = ChannelListingSchema()
channel_listings_schema = ChannelListingSchema(many=True)

manual_correction_schema = ManualCorrectionSchema()
manual_corrections_schema = ManualCorrectionSchema(many=True)

bad_data_schema = BadDataSchema()
bad_data_list_schema = BadDataSchema(many=True)

fix_history_schema = FixHistorySchema()
fix_histories_schema = FixHistorySchema(many=True)
