import base64, sys
def b64write(path, b64):
    with open(path, "wb") as f:
        f.write(base64.b64decode(b64))
    print("Wrote", path)
b64write("_b64test.py", "cHJpbnQoInRlc3QgZnJvbSBiNjQiKQo=")
