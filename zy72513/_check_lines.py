
filepath = "learning_path_recommender/cli/main.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    r = repr(line)
    if 280 <= i <= 295:
        print(f"[L{i}] {r}")

