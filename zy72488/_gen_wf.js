const f = "/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Workflow.tsx";
let s = "";
s += "import X;\n";
require("fs").writeFileSync(f,s);
console.log("Lines:",s.split(/\n/).length);
