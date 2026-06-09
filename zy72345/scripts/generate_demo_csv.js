import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const demoDir = path.resolve(projectRoot, 'demo')

if (!fs.existsSync(demoDir)) {
  fs.mkdirSync(demoDir, { recursive: true })
}

const batch1 = [
  'value,old_table_status,remark',
  '120.5,normal,1月正常课时费',
  '88.0,normal,小班课',
  '-20.5,missing,"2月课程退款"',
  '150.0,normal,一对一辅导',
  '95.5,normal,周末集训'
]

const batch2 = [
  'value,old_table_status,remark',
  '110.0,normal,3月课时费A',
  '135.5,normal,3月课时费B',
  '200.0,normal,VIP班',
  '-15.0,missing,"3月教材退款"',
  '90.0,normal,普通班',
  '175.0,normal,一对一',
  '65.0,normal,试听课',
  '180.0,normal,集训营'
]

const batch1Dup = [...batch1]

const write = (name, lines) => {
  const p = path.join(demoDir, name)
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8')
  console.log(`已生成: file://${p}`)
}

write('batch1_sampling.csv', batch1)
write('batch2_new.csv', batch2)
write('batch1_duplicate.csv', batch1Dup)

console.log('\n演示CSV生成完毕！共3个文件：')
console.log('  - demo/batch1_sampling.csv     (5条，含1条负数标缺失)')
console.log('  - demo/batch2_new.csv          (8条，含另1条负数标缺失)')
console.log('  - demo/batch1_duplicate.csv    (与第一批完全一样，测试重复导入)')
