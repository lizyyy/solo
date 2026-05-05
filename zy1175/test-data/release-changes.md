# Release Changes

## Version 2.1.0 (2026-04-01)

### Changes
- **Modified**: `checkout_start` event - Added `payment_method` field with enum values
- **Added**: `purchase_complete` event - New event for completed purchases
- **Removed**: `checkout_complete` event - Renamed to `purchase_complete`

## Version 2.0.0 (2026-01-01)

### Changes
- **Added**: `product_view` event - New event for product page views
- **Modified**: `add_to_cart` event - Added `price` field
- **Renamed**: `page_load` → `page_view`
