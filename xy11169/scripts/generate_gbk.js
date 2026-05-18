const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

const content = `检测编号,序列号,品牌型号,检测日期,外观成色,屏幕状态,电池健康,功能检测,回收估价
JC20240504001,SN2024050013,华为Mate40,2024-05-04,95新,正常,90%,全部正常,3500
JC20240504002,SN2024050014,OPPO Find X3,2024-05-04,9成新,正常,87%,全部正常,2800
`;

const gbkBuffer = iconv.encode(content, 'gbk');
const outputPath = path.join(__dirname, '../samples/gbk_report.csv');

fs.writeFileSync(outputPath, gbkBuffer);
console.log(`GBK编码文件已生成: ${outputPath}`);
