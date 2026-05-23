with open('main.go', 'r') as f:
    lines = f.readlines()

with open('main.go', 'w') as f:
    for line in lines:
        if 'net/http' not in line:
            f.write(line)

print("Fixed")
