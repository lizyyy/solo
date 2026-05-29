#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from royalty_settlement import __version__
    print(f"Version: {__version__}")
    from royalty_settlement.models import PerformanceSheet
    from royalty_settlement.core import SettlementEngine
    from royalty_settlement.output import OutputFormatter
    print("All imports successful!")
    
    from datetime import date
    from royalty_settlement.models import Track, AuthorShare, PlatformFee, FeePeriod, AuthorRole
    
    sheet = PerformanceSheet(
        performance_name="Test Show",
        performance_date=date(2026, 5, 20),
        venue="Test Venue",
        total_box_office=100000.0,
        operator="Test User",
    )
    
    sheet.tracks = [
        Track(
            name="Test Track",
            duration_seconds=240,
            authors=[
                AuthorShare(author_id="A1", author_name="Test Author", role=AuthorRole.COMPOSER, ratio=1.0),
            ],
        ),
    ]
    
    sheet.platform_fees = [
        PlatformFee(fee_type="Service Fee", amount=10000.0, period=FeePeriod.CURRENT),
    ]
    
    engine = SettlementEngine()
    result, issues, warnings = engine.process(sheet)
    
    print(f"Success! Total: ¥{result.total_box_office:,.2f}")
    print(f"Fees: ¥{result.total_fees:,.2f}")
    print(f"Net: ¥{result.net_distributable:,.2f}")
    print(f"Items: {len(result.items)}")
    
    formatter = OutputFormatter(engine.output_dir)
    paths = formatter.save_all(result)
    print(f"Output files: {paths}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
