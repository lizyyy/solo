const fs = require("fs"); const content = Buffer.from(process.argv[1], "base64").toString(); fs.writeFileSync("batchService.js", content); console.log("done");
