import pathlib
p = pathlib.Path("app/main.py")
text = p.read_text()
p2 = pathlib.Path("app/schemas.py")
if p2.exists():
    schemas_text = p2.read_text()
else:
    schemas_text = ""
print("schema lines:", len(schemas_text.splitlines()))
print("main lines:", len(text.splitlines()))
