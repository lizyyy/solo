import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import parser
from database import SessionLocal
import schemas
import crud

db = SessionLocal()

test_lockfile = {
    "name": "test-project",
    "lockfileVersion": 2,
    "packages": {
        "node_modules/express": {
            "version": "4.18.2",
            "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
            "integrity": "sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ=="
        },
        "node_modules/lodash": {
            "version": "4.17.21",
            "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
            "integrity": "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="
        },
        "node_modules/react": {
            "version": "18.2.0",
            "resolved": "https://registry.npmmirror.com/react/-/react-18.2.0.tgz",
            "integrity": "sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ=="
        },
        "node_modules/suspicious-pkg": {
            "version": "1.0.0",
            "resolved": "https://unknown-registry.com/suspicious-pkg/-/suspicious-pkg-1.0.0.tgz",
            "integrity": "sha512-fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash=="
        }
    }
}

audit_create = schemas.LockfileAuditCreate(
    name="test-audit-001",
    lockfile_type="package-lock.json",
    content=json.dumps(test_lockfile),
    created_by="test-script",
    notes="自动生成的测试数据，包含正常包和异常包"
)

audit, _ = crud.create_lockfile_audit(db, audit_create)

packages, errors = parser.parse(audit_create.content, audit_create.lockfile_type)
for pkg in packages:
    package_create = schemas.PackageAuditCreate(
        package_name=pkg["package_name"],
        version=pkg["version"],
        registry=pkg["registry"],
        integrity_hash=pkg["integrity_hash"]
    )
    crud.create_package_audit(db, package_create, audit.id)

print(f"Created test audit with ID: {audit.id}")
print(f"Packages: {len(packages)}")
for pkg in packages:
    print(f"  - {pkg['package_name']}@{pkg['version']} from {pkg['registry']}")

if errors:
    print(f"\nErrors: {errors}")

db.close()
