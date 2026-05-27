import pathlib
p = pathlib.Path("app/main.py")
lines = p.read_text().splitlines()
new_lines = []
skip = False
for line in lines:
    if "from .services" in line:
        skip = True
        continue
    if line.startswith("init_db()") and skip:
        skip = False
    if not skip:
        new_lines.append(line)
p.write_text(chr(10).join(new_lines))
print("done, lines:", len(new_lines))
