const fs = require("fs"); fs.writeFileSync("src/utils/config.ts", "export function loadDatabaseConfig() { return {}; }"); console.log("done");
