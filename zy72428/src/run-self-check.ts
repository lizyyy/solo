import { selfCheckService } from './services/self-check-service';

console.log('\n正在运行街头艺人点位排班系统自检...\n');

const report = selfCheckService.runFullCheck();
console.log(selfCheckService.formatReport(report));

if (report.failed > 0 || report.warnings > 0) {
  console.log('\n是否自动修复可修复的问题？(y/n)');
  
  const autoFixResult = selfCheckService.autoFixIssues(report);
  if (autoFixResult.fixed.length > 0) {
    console.log(`\n已自动修复 ${autoFixResult.fixed.length} 个问题：`);
    for (const msg of autoFixResult.messages) {
      console.log(`  ✅ ${msg}`);
    }
    
    console.log('\n重新运行自检...\n');
    const newReport = selfCheckService.runFullCheck();
    console.log(selfCheckService.formatReport(newReport));
  } else {
    console.log('\n没有可自动修复的问题，请手动处理。');
  }
}
