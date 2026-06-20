
import sys
def write_file(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        for l in lines:
            f.write(l + "
")
    print(f"Written {len(lines)} lines to {path}")

