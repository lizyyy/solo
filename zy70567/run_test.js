const fs = require("fs");
const { execSync } = require("child_process");

console.log("=== Testing index.js ===");
console.log("");

// Create test data
const testData = `192.168.1.0/24, TeamA, Web servers, Production
192.168.1.128/25, TeamB, DB servers, Production
10.0.0.0/8, TeamC, Internal, Staging
10.1.0.0/16, TeamA, VPN, Staging
bad_line_here
`;

fs.writeFileSync("auto_test.csv", testData, "utf8");
console.log("Test CSV created:");
console.log(fs.readFileSync("auto_test.csv", "utf8"));

// Run CLI
console.log("Running CLI...");
try {
  const output = execSync("node index.js -i auto_test.csv -j result.json", { encoding: "utf8", stdio: "pipe" });
  console.log("STDOUT:", output);
} catch (e) {
  console.log("STDOUT:", e.stdout);
  console.log("STDERR:", e.stderr);
  console.log("Exit code:", e.status);
}

// Check JSON output
if (fs.existsSync("result.json")) {
  console.log("\n=== JSON Output ===");
  const json = JSON.parse(fs.readFileSync("result.json", "utf8"));
  console.log("Total entries:", json.totalEntries);
  console.log("Valid entries:", json.validEntries);
  console.log("Bad entries:", json.badEntries.length);
  console.log("Overlapping pairs:", json.overlappingPairs.length);
  console.log("\nTeam summaries:");
  json.teamSummaries.forEach(ts => {
    console.log(`  ${ts.team}: ${ts.totalRanges} ranges, ${ts.overlappingCount} overlaps`);
  });
  
  if (json.overlappingPairs.length > 0) {
    console.log("\nOverlaps found:");
    json.overlappingPairs.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.overlapCidr}`);
      console.log(`     Entry1: ${p.entry1.cidr} (${p.entry1.team}, line ${p.entry1.lineNumber})`);
      console.log(`     Entry2: ${p.entry2.cidr} (${p.entry2.team}, line ${p.entry2.lineNumber})`);
    });
  }
}

console.log("\n=== Test Complete ===");
