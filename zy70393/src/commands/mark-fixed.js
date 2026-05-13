import chalk from 'chalk';
import { markFixed, getMarkedFixed } from '../storage.js';

export async function handleMarkFixed(issueId, options) {
  const note = options.note || '';
  
  markFixed(issueId, note);
  
  console.log(chalk.green(`✓ 已标记风险 ${issueId} 为已修复`));
  if (note) {
    console.log(chalk.gray(`  备注: ${note}`));
  }
  
  const markedList = getMarkedFixed();
  console.log(chalk.gray(`\n当前已标记修复的风险: ${markedList.length} 个`));
}
