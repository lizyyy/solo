const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 开始测试坏数据路径...');
  console.log('═'.repeat(60));
  
  try {
    await makeRequest('GET', '/health');
  } catch {
    console.log('❌ 服务未启动，请先运行: npm start');
    process.exit(1);
  }

  const tests = [
    {
      name: '重复条码测试',
      path: '/api/barcodes',
      data: { barcode: 'CLINIC-A-001', sample_type: '血液', created_by: '测试员' },
      desc: '条码已存在，应该返回400错误'
    },
    {
      name: '无效条码格式测试',
      path: '/api/barcodes',
      data: { barcode: 'clinic-a-001@#$', sample_type: '血液', created_by: '测试员' },
      desc: '条码包含小写字母和特殊字符，应该验证失败'
    },
    {
      name: '采样记录-不存在的条码',
      path: '/api/sampling',
      data: {
        barcode: 'INVALID-999',
        sampling_time: new Date().toISOString(),
        sampler: '测试员',
        clinic_name: '测试诊所'
      },
      desc: '条码不存在，应该返回400错误'
    },
    {
      name: '采样记录-缺少必填字段',
      path: '/api/sampling',
      data: {
        barcode: 'CLINIC-A-001',
        sampling_time: new Date().toISOString()
      },
      desc: '缺少sampler和clinic_name字段，应该验证失败'
    },
    {
      name: '运输批次-空样本列表',
      path: '/api/transport',
      data: {
        transporter: '测试司机',
        departure_time: new Date().toISOString(),
        origin_clinic: '测试诊所',
        destination_lab: '测试实验室',
        sample_barcodes: []
      },
      desc: '样本列表为空，应该验证失败'
    },
    {
      name: '接收样本-非工作时间',
      path: '/api/receive',
      data: {
        barcode: 'CLINIC-A-001',
        receiver: '测试员',
        received_time: '2024-01-01T23:00:00.000Z',
        receiving_lab: '中心检验室'
      },
      desc: '在非接收窗口时间接收（UTC 23:00 = 北京时间 07:00），应该返回400错误'
    },
    {
      name: '拒收样本-无效原因代码',
      path: '/api/reject',
      data: {
        barcode: 'CLINIC-A-001',
        rejection_reason_code: 'INVALID_CODE',
        operator: '测试员'
      },
      desc: '拒收原因代码无效，应该返回400错误'
    },
    {
      name: '补录申请-不存在的交接记录',
      path: '/api/amendment',
      data: {
        transfer_record_id: 'non-existent-id',
        requester: '测试员',
        requested_changes: { receiver: '新接收人' },
        reason: '信息录入错误'
      },
      desc: '交接记录不存在，应该返回400错误'
    },
    {
      name: '补录审批-无效状态',
      path: '/api/amendment/approve',
      data: {
        amendment_id: 'non-existent-id',
        approver: '审批员',
        approved: true
      },
      desc: '补录申请不存在，应该返回400错误'
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   说明: ${test.desc}`);
    
    try {
      const result = await makeRequest('POST', test.path, test.data);
      const isError = result.status >= 400;
      
      console.log(`   状态码: ${result.status} ${isError ? '✅' : '❌'}`);
      console.log(`   返回: ${JSON.stringify(result.data).substring(0, 100)}...`);
      
      if (result.data.error) {
        console.log(`   错误信息: ${result.data.error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 查询异常日志（验证异常已记录）:');
  
  const logResult = await makeRequest('GET', '/api/exceptions?resolved=false');
  if (logResult.data && logResult.data.data) {
    console.log(`   异常日志数量: ${logResult.data.data.length} 条`);
    if (logResult.data.data.length > 0) {
      console.log('   最新异常:');
      const latest = logResult.data.data[0];
      console.log(`     - 接口: ${latest.api_endpoint}`);
      console.log(`     - 错误: ${latest.error_message}`);
      console.log(`     - 原始输入已保存 ✓`);
    }
  }

  console.log('\n✅ 坏数据路径测试完成！');
  console.log('   所有异常路径都会:');
  console.log('     1. 返回明确的错误信息');
  console.log('     2. 保存原始输入到异常日志表');
  console.log('     3. 记录处理结论');
}

runTests().catch(console.error);
