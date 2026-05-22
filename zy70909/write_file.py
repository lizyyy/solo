
import sys
code = open(sys.argv[1]).read()
with open(sys.argv[2], "w") as f:
    f.write(code)
print("done")

