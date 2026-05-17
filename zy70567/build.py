
code = "#!/usr/bin/env node\n"
code += "\nconst fs = require(\"fs\");"
code += "\nconst { Command } = require(\"commander\");"
code += "\nconsole.log(\"CLI is working!\");"
with open("index.js", "w") as f:
    f.write(code)
print("done")
