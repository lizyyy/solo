var fs = require("fs");
function decodeFile(b64Path, outPath) {
  var lines = fs.readFileSync(b64Path, "utf8").trim().split(/\s+/).join("");
  var buf = Buffer.from(lines, "base64");
  fs.writeFileSync(outPath, buf);
  console.log("Decoded", buf.length, "bytes to", outPath);
}
decodeFile(process.argv[2], process.argv[3]);
