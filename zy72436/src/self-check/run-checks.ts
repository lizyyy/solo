import { runAllChecks, printCheckResults } from './checks';

function main() {
  const results = runAllChecks();
  printCheckResults(results);
  
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main();
