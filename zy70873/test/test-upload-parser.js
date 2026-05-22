const path = require('path');
const FileParserService = require('../src/services/FileParserService');

async function testUploadParser() {
  console.log('============================================');
  console.log('测试 parseUploadedFiles 文件识别逻辑');
  console.log('============================================\n');

  const mockFiles = [
    {
      originalname: 'showtimes.csv',
      path: path.join(__dirname, 'showtimes.csv')
    },
    {
      originalname: 'box_office.json',
      path: path.join(__dirname, 'box_office.json')
    },
    {
      originalname: 'contract_rules.json',
      path: path.join(__dirname, 'contract_rules.json')
    }
  ];

  console.log('📋 测试文件:');
  mockFiles.forEach(f => console.log(`  - ${f.originalname}`));
  console.log('');

  try {
    const result = await FileParserService.parseUploadedFiles(mockFiles);

    console.log('✅ 解析结果:');
    console.log(`   场次数据: ${result.showtimes.length} 条`);
    console.log(`   票房数据: ${result.boxOffices.length} 条`);
    console.log(`   合同规则: ${result.contractRules.length} 条`);
    console.log(`   错误信息: ${result.errors.length} 条`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      result.errors.forEach(e => console.log(`   - ${e}`));
    }

    if (result.boxOffices.length > 0) {
      console.log('\n📊 票房数据示例:');
      const bo = result.boxOffices[0];
      console.log(`   - 影院: ${bo.cinemaName}`);
      console.log(`   - 影片: ${bo.filmName}`);
      console.log(`   - 日期: ${bo.statDate}`);
      console.log(`   - 总票房: ${bo.totalBoxOffice}`);
      console.log(`   - 净票房: ${bo.netBoxOffice}`);
    }

    const allParsed = result.showtimes.length > 0 && 
                      result.boxOffices.length > 0 && 
                      result.contractRules.length > 0;

    console.log('\n============================================');
    if (allParsed) {
      console.log('🎉 所有文件类型识别成功！');
    } else {
      console.log('⚠️  部分文件未识别');
    }
    console.log('============================================');

    return allParsed;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

testUploadParser();
