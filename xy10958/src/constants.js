const SIZE_MAPPINGS = {
  '110': '110',
  '120': '120',
  '130': '130',
  '140': '140',
  '150': '150',
  '160': '160',
  '170': '170',
  '180': '180',
  '190': '190',
  '110cm': '110',
  '120cm': '120',
  '130cm': '130',
  '140cm': '140',
  '150cm': '150',
  '160cm': '160',
  '170cm': '170',
  '180cm': '180',
  '190cm': '190',
  'S': 'S',
  'M': 'M',
  'L': 'L',
  'XL': 'XL',
  'XXL': 'XXL',
  'XXXL': 'XXXL',
  's': 'S',
  'm': 'M',
  'l': 'L',
  'xl': 'XL',
  'xxl': 'XXL',
  'xxxl': 'XXXL',
  '小号': 'S',
  '中号': 'M',
  '大号': 'L',
  '加大': 'XL',
  '加加大': 'XXL',
  '加加加大': 'XXXL',
};

const HEADER_VARIANTS = {
  name: ['姓名', '名字', '学生姓名', 'name', 'Name', 'NAME'],
  className: ['班级', '班别', '所在班级', 'class', 'Class', 'CLASS', '班级名称'],
  size: ['尺码', '尺寸', '校服尺码', 'size', 'Size', 'SIZE', '订购尺码'],
  supplement: ['增补', '补订', '追加', '补充', '是否增补', '增补数量'],
  remark: ['备注', '说明', '异常备注', '特殊说明', 'remark', 'Remark'],
};

const REQUIRED_FIELDS = ['name', 'className', 'size'];

const VALID_SIZES = ['110', '120', '130', '140', '150', '160', '170', '180', '190', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

module.exports = {
  SIZE_MAPPINGS,
  HEADER_VARIANTS,
  REQUIRED_FIELDS,
  VALID_SIZES,
};
