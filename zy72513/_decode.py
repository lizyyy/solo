import base64, sys
data = sys.stdin.read()
content = base64.b64decode(data).decode("utf-8")
with open("learning_path_recommender/core/importer.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")

