import { parseParameterFile } from '../api/services/fileParseService.ts';

const csv = `产品ID,产品名称,alpha,beta,gamma,预测结论
REAL-001,春季薄款卫衣,0.3,0.2,0.15,1100
REAL-002,纯棉印花T恤,0.5,0.3,0.2,950
REAL-003,户外速干短裤,70%,0.4,25%,720
REAL-004,防紫外线遮阳帽,0.6,0.4,0.3,580
REAL-005,冰丝凉感防晒衣,0.45,0.25,0.2,1850
`;

const buf = Buffer.from(csv, 'utf8');
const result = await parseParameterFile(buf, 'test.csv', 'text/csv');
console.log('parseErrors:', result.parseErrors);
console.log('rows count:', result.rows.length);
for (const r of result.rows) {
  console.log(' ->', JSON.stringify(r));
}
