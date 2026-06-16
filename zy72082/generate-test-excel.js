import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

const lectureData = [
  ['路线编号', '仓库代码', '冷藏温度(℃)', '运输距离(km)', '载重(吨)'],
  ['R-001', 'WH-A', -18.5, 120, 8],
  ['R-001', 'WH-B', -22.0, 85, 12],
  ['R-002', 'WH-A', -15.0, 200, 6],
  ['R-002', 'WH-C', -20.5, 150, 10],
  ['R-003', 'WH-B', -25.0, 95, 15],
]

const screenshotData = [
  ['线路ID', '仓库ID', '温度(°F)', '里程(英里)', '重量(kg)'],
  ['R-001', 'WH-A', 0.5, 74.56, 8000],
  ['R-001', 'WH-B', -7.6, 52.82, 12000],
  ['R-002', 'WH-A', 5, 124.27, 6000],
  ['R-002', 'WH-C', -4.9, 93.21, 10000],
  ['R-003', 'WH-B', -13, 59.03, 15000],
]

const ws1 = XLSX.utils.aoa_to_sheet(lectureData)
const wb1 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb1, ws1, '冷链台账')
const xlsxBuffer1 = XLSX.write(wb1, { bookType: 'xlsx', type: 'buffer' })
writeFileSync('/Users/lzy/pro/solo/workspaces/zy72082/test_lecture.xlsx', xlsxBuffer1)
console.log('Created: test_lecture.xlsx')

const ws2 = XLSX.utils.aoa_to_sheet(screenshotData)
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb2, ws2, '物流轨迹')
const xlsxBuffer2 = XLSX.write(wb2, { bookType: 'xlsx', type: 'buffer' })
writeFileSync('/Users/lzy/pro/solo/workspaces/zy72082/test_screenshot.xlsx', xlsxBuffer2)
console.log('Created: test_screenshot.xlsx')
