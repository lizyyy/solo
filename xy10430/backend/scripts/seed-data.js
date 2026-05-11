const sequelize = require('../src/config/database');
const { 
  CargoType, 
  Shipment, 
  TemperatureRecord, 
  TransportNode, 
  SignOff,
  Claim,
  ClaimApproval
} = require('../src/models');

const generateTemperatureRecords = (shipmentId, startTime, hours, minTemp, maxTemp, hasOvertemp = false) => {
  const records = [];
  const start = new Date(startTime);
  
  for (let i = 0; i < hours * 12; i++) {
    const time = new Date(start.getTime() + i * 5 * 60 * 1000);
    let temp = minTemp + Math.random() * (maxTemp - minTemp);
    let isOvertemp = false;
    
    if (hasOvertemp && i > hours * 6 && i < hours * 9) {
      temp = maxTemp + 3 + Math.random() * 5;
      isOvertemp = true;
    }
    
    records.push({
      shipmentId,
      recordTime: time,
      temperature: parseFloat(temp.toFixed(2)),
      humidity: parseFloat((40 + Math.random() * 30).toFixed(1)),
      isOvertemp,
      source: 'device'
    });
  }
  return records;
};

const seed = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('数据库表已重建');

    const cargoTypes = await CargoType.bulkCreate([
      {
        name: '医药品',
        minTemp: 2,
        maxTemp: 8,
        maxOvertimeMinutes: 30,
        claimMultiplier: 1.5,
        description: '疫苗、生物制剂等敏感医药品'
      },
      {
        name: '生鲜',
        minTemp: 0,
        maxTemp: 4,
        maxOvertimeMinutes: 60,
        claimMultiplier: 1.0,
        description: '肉类、海鲜、蔬菜等生鲜产品'
      },
      {
        name: '蛋糕',
        minTemp: 2,
        maxTemp: 6,
        maxOvertimeMinutes: 20,
        claimMultiplier: 0.8,
        description: '奶油蛋糕、芝士蛋糕等甜点'
      }
    ]);
    console.log('货物类型数据已创建');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const shipments = await Shipment.bulkCreate([
      {
        shipmentNo: 'YP20240115001',
        cargoTypeId: cargoTypes[0].id,
        customerName: '北京协和医院',
        origin: '上海生物医药园',
        destination: '北京协和医院冷链仓库',
        cargoValue: 150000,
        status: 'signed_off',
        departureTime: twoDaysAgo,
        estimatedArrivalTime: new Date(twoDaysAgo.getTime() + 24 * 60 * 60 * 1000),
        actualArrivalTime: yesterday,
        remarks: '新冠疫苗运输，需全程温控'
      },
      {
        shipmentNo: 'SX20240115002',
        cargoTypeId: cargoTypes[1].id,
        customerName: '广州海鲜批发市场',
        origin: '深圳盐田港',
        destination: '广州黄沙海鲜市场',
        cargoValue: 85000,
        status: 'claim_pending',
        departureTime: threeDaysAgo,
        estimatedArrivalTime: new Date(threeDaysAgo.getTime() + 8 * 60 * 60 * 1000),
        actualArrivalTime: new Date(threeDaysAgo.getTime() + 9 * 60 * 60 * 1000),
        remarks: '进口三文鱼冷链运输'
      },
      {
        shipmentNo: 'DG20240115003',
        cargoTypeId: cargoTypes[2].id,
        customerName: '上海迪士尼乐园',
        origin: '上海松江区蛋糕工厂',
        destination: '上海迪士尼乐园',
        cargoValue: 25000,
        status: 'claim_pending',
        departureTime: yesterday,
        estimatedArrivalTime: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
        actualArrivalTime: new Date(yesterday.getTime() + 3 * 60 * 60 * 1000),
        remarks: '定制生日蛋糕配送'
      },
      {
        shipmentNo: 'YP20240115004',
        cargoTypeId: cargoTypes[0].id,
        customerName: '上海华山医院',
        origin: '苏州生物医药基地',
        destination: '上海华山医院',
        cargoValue: 95000,
        status: 'claim_pending',
        departureTime: twoDaysAgo,
        estimatedArrivalTime: new Date(twoDaysAgo.getTime() + 4 * 60 * 60 * 1000),
        actualArrivalTime: new Date(twoDaysAgo.getTime() + 5 * 60 * 60 * 1000),
        remarks: '胰岛素运输'
      }
    ]);
    console.log('运单数据已创建');

    for (const [index, shipment] of shipments.entries()) {
      const cargoType = cargoTypes[index % cargoTypes.length];
      const hasOvertemp = index > 0;
      
      const tempRecords = generateTemperatureRecords(
        shipment.id,
        shipment.departureTime,
        12,
        parseFloat(cargoType.minTemp),
        parseFloat(cargoType.maxTemp),
        hasOvertemp
      );
      await TemperatureRecord.bulkCreate(tempRecords);
    }
    console.log('温度记录数据已创建');

    await TransportNode.bulkCreate([
      {
        shipmentId: shipments[0].id,
        nodeType: 'warehouse',
        nodeName: '上海生物医药园冷库',
        location: '上海市浦东新区',
        arrivalTime: twoDaysAgo,
        departureTime: new Date(twoDaysAgo.getTime() + 30 * 60 * 1000),
        responsibleParty: '上海冷链仓储有限公司',
        operatorName: '张师傅',
        nodeOrder: 1
      },
      {
        shipmentId: shipments[0].id,
        nodeType: 'transit',
        nodeName: 'G2京沪高速',
        location: '京沪高速',
        arrivalTime: new Date(twoDaysAgo.getTime() + 30 * 60 * 1000),
        departureTime: new Date(yesterday.getTime() - 2 * 60 * 60 * 1000),
        responsibleParty: '顺丰冷链物流',
        operatorName: '李师傅',
        nodeOrder: 2
      },
      {
        shipmentId: shipments[0].id,
        nodeType: 'delivery',
        nodeName: '北京协和医院',
        location: '北京市东城区',
        arrivalTime: yesterday,
        responsibleParty: '北京协和医院',
        operatorName: '王护士',
        nodeOrder: 3
      },
      {
        shipmentId: shipments[1].id,
        nodeType: 'warehouse',
        nodeName: '盐田港冷链码头',
        location: '深圳市盐田区',
        arrivalTime: threeDaysAgo,
        departureTime: new Date(threeDaysAgo.getTime() + 2 * 60 * 60 * 1000),
        responsibleParty: '盐田港冷链集团',
        operatorName: '陈经理',
        nodeOrder: 1
      },
      {
        shipmentId: shipments[1].id,
        nodeType: 'transit',
        nodeName: 'G4京港澳高速',
        location: '广深高速',
        arrivalTime: new Date(threeDaysAgo.getTime() + 2 * 60 * 60 * 1000),
        departureTime: new Date(threeDaysAgo.getTime() + 8 * 60 * 60 * 1000),
        responsibleParty: '京东冷链物流',
        operatorName: '赵师傅',
        nodeOrder: 2
      },
      {
        shipmentId: shipments[1].id,
        nodeType: 'delivery',
        nodeName: '广州黄沙海鲜市场',
        location: '广州市荔湾区',
        arrivalTime: new Date(threeDaysAgo.getTime() + 9 * 60 * 60 * 1000),
        responsibleParty: '广州海鲜市场管理处',
        operatorName: '刘老板',
        nodeOrder: 3
      },
      {
        shipmentId: shipments[2].id,
        nodeType: 'warehouse',
        nodeName: '松江蛋糕工厂',
        location: '上海市松江区',
        arrivalTime: yesterday,
        departureTime: new Date(yesterday.getTime() + 30 * 60 * 1000),
        responsibleParty: '好利来蛋糕',
        operatorName: '张师傅',
        nodeOrder: 1
      },
      {
        shipmentId: shipments[2].id,
        nodeType: 'transit',
        nodeName: 'G60沪昆高速',
        location: '上海市区',
        arrivalTime: new Date(yesterday.getTime() + 30 * 60 * 1000),
        departureTime: new Date(yesterday.getTime() + 2.5 * 60 * 60 * 1000),
        responsibleParty: '美团冷链配送',
        operatorName: '王师傅',
        nodeOrder: 2
      },
      {
        shipmentId: shipments[2].id,
        nodeType: 'delivery',
        nodeName: '上海迪士尼乐园',
        location: '上海市浦东新区',
        arrivalTime: new Date(yesterday.getTime() + 3 * 60 * 60 * 1000),
        responsibleParty: '迪士尼餐饮部',
        operatorName: '李经理',
        nodeOrder: 3
      },
      {
        shipmentId: shipments[3].id,
        nodeType: 'warehouse',
        nodeName: '苏州生物医药基地',
        location: '苏州市工业园区',
        arrivalTime: twoDaysAgo,
        departureTime: new Date(twoDaysAgo.getTime() + 1 * 60 * 60 * 1000),
        responsibleParty: '信达生物制药',
        operatorName: '周经理',
        nodeOrder: 1
      },
      {
        shipmentId: shipments[3].id,
        nodeType: 'transit',
        nodeName: 'G2京沪高速',
        location: '沪宁高速',
        arrivalTime: new Date(twoDaysAgo.getTime() + 1 * 60 * 60 * 1000),
        departureTime: new Date(twoDaysAgo.getTime() + 4.5 * 60 * 60 * 1000),
        responsibleParty: 'UPS冷链物流',
        operatorName: '吴师傅',
        nodeOrder: 2
      },
      {
        shipmentId: shipments[3].id,
        nodeType: 'delivery',
        nodeName: '上海华山医院',
        location: '上海市静安区',
        arrivalTime: new Date(twoDaysAgo.getTime() + 5 * 60 * 60 * 1000),
        responsibleParty: '华山医院药房',
        operatorName: '郑药师',
        nodeOrder: 3
      }
    ]);
    console.log('运输节点数据已创建');

    await SignOff.bulkCreate([
      {
        shipmentId: shipments[0].id,
        signOffTime: yesterday,
        signOffResult: 'normal',
        isExempt: false,
        receiverName: '王护士',
        receiverPhone: '13800138001',
        packageCondition: 'good',
        temperatureAtSignoff: 5.2,
        signOffRemarks: '温度正常，包装完好，已签收',
        operatorName: '李师傅'
      },
      {
        shipmentId: shipments[1].id,
        signOffTime: new Date(threeDaysAgo.getTime() + 9 * 60 * 60 * 1000),
        signOffResult: 'overtemp_serious',
        isExempt: false,
        receiverName: '刘老板',
        receiverPhone: '13800138002',
        packageCondition: 'partial_damaged',
        temperatureAtSignoff: 12.5,
        signOffRemarks: '发现部分三文鱼有解冻迹象，温度异常',
        operatorName: '赵师傅'
      },
      {
        shipmentId: shipments[2].id,
        signOffTime: new Date(yesterday.getTime() + 3 * 60 * 60 * 1000),
        signOffResult: 'overtemp_warning',
        isExempt: false,
        receiverName: '李经理',
        receiverPhone: '13800138003',
        packageCondition: 'good',
        temperatureAtSignoff: 8.2,
        signOffRemarks: '奶油有轻微融化迹象，温度偏高',
        operatorName: '王师傅'
      },
      {
        shipmentId: shipments[3].id,
        signOffTime: new Date(twoDaysAgo.getTime() + 5 * 60 * 60 * 1000),
        signOffResult: 'overtemp_serious',
        isExempt: false,
        receiverName: '郑药师',
        receiverPhone: '13800138004',
        packageCondition: 'damaged',
        temperatureAtSignoff: 15.3,
        signOffRemarks: '保温箱温度异常，部分药品可能失效',
        operatorName: '吴师傅'
      }
    ]);
    console.log('签收数据已创建');

    const claims = await Claim.bulkCreate([
      {
        claimNo: 'CLM-20240115-ABC001',
        shipmentId: shipments[1].id,
        claimType: 'overtemp',
        status: 'approved',
        claimAmount: 42500,
        approvedAmount: 42500,
        claimReason: '运输过程中温度异常，导致部分三文鱼解冻变质',
        overtempSummary: '运输途中发生2次超温，累计超温145分钟，最大温度偏差8.5℃',
        responsibleNode: 'G4京港澳高速',
        responsibleParty: '京东冷链物流',
        overtempDuration: 145,
        isDuplicate: false,
        isExemptClaim: false,
        exceedsLimit: false
      },
      {
        claimNo: 'CLM-20240115-ABC002',
        shipmentId: shipments[2].id,
        claimType: 'overtemp',
        status: 'pending_review',
        claimAmount: 12000,
        claimReason: '蛋糕配送过程中温度偏高，奶油轻微融化影响品质',
        overtempSummary: '配送途中发生1次超温，累计超温35分钟，最大温度偏差4.2℃',
        responsibleNode: 'G60沪昆高速',
        responsibleParty: '美团冷链配送',
        overtempDuration: 35,
        isDuplicate: false,
        isExemptClaim: false,
        exceedsLimit: false
      },
      {
        claimNo: 'CLM-20240115-ABC003',
        shipmentId: shipments[3].id,
        claimType: 'overtemp',
        status: 'rejected',
        claimAmount: 200000,
        claimReason: '胰岛素运输温度超标，可能导致药品全部失效',
        overtempSummary: '运输途中发生3次超温，累计超温210分钟，最大温度偏差10.3℃',
        responsibleNode: 'G2京沪高速',
        responsibleParty: 'UPS冷链物流',
        overtempDuration: 210,
        isDuplicate: false,
        isExemptClaim: false,
        exceedsLimit: true
      },
      {
        claimNo: 'CLM-20240115-ABC004',
        shipmentId: shipments[1].id,
        claimType: 'overtemp',
        status: 'rejected',
        claimAmount: 50000,
        claimReason: '三文鱼质量问题',
        isDuplicate: true,
        isExemptClaim: false,
        exceedsLimit: false
      }
    ]);
    console.log('索赔数据已创建');

    await ClaimApproval.bulkCreate([
      {
        claimId: claims[0].id,
        approvalStep: 1,
        approverRole: '客服',
        approverName: '张客服',
        action: 'submit',
        remarks: '提交索赔申请，附温度记录和签收单'
      },
      {
        claimId: claims[0].id,
        approvalStep: 2,
        approverRole: '审批人',
        approverName: '李经理',
        action: 'approve',
        decision: '批准赔付42500元',
        remarks: '超温情况属实，按货值50%赔付'
      },
      {
        claimId: claims[1].id,
        approvalStep: 1,
        approverRole: '客服',
        approverName: '王客服',
        action: 'submit',
        remarks: '提交蛋糕索赔，需进一步核实影响程度'
      },
      {
        claimId: claims[2].id,
        approvalStep: 1,
        approverRole: '客服',
        approverName: '赵客服',
        action: 'submit',
        remarks: '提交胰岛素索赔，金额超限额需审批'
      },
      {
        claimId: claims[2].id,
        approvalStep: 2,
        approverRole: '审批人',
        approverName: '王总',
        action: 'reject',
        decision: '驳回索赔',
        remarks: '索赔金额200000元超过货值95000元的1.5倍赔偿限额(142500元)，且无法提供药品全部失效的证明'
      },
      {
        claimId: claims[3].id,
        approvalStep: 1,
        approverRole: '客服',
        approverName: '刘客服',
        action: 'submit',
        remarks: '重复索赔已标记'
      },
      {
        claimId: claims[3].id,
        approvalStep: 2,
        approverRole: '审批人',
        approverName: '张经理',
        action: 'reject',
        decision: '驳回重复索赔',
        remarks: '该运单已有索赔CLM-20240115-ABC001，属于重复索赔'
      }
    ]);
    console.log('审批记录数据已创建');

    console.log('\n========================================');
    console.log('样例数据初始化完成！');
    console.log('========================================');
    console.log('\n创建的样例数据：');
    console.log('- 货物类型：3种（医药品、生鲜、蛋糕）');
    console.log('- 运单：4个');
    console.log('  1. YP20240115001 - 医药品 - 正常签收（无索赔）');
    console.log('  2. SX20240115002 - 生鲜 - 严重超温（已赔付）');
    console.log('  3. DG20240115003 - 蛋糕 - 短时超温（待复核）');
    console.log('  4. YP20240115004 - 医药品 - 严重超温（金额超限驳回）');
    console.log('- 索赔：4个');
    console.log('  - 已批准赔付：1个');
    console.log('  - 待审核：1个');
    console.log('  - 已驳回：2个（1个金额超限，1个重复索赔）');
    console.log('\n========================================');

    process.exit(0);
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
};

seed();
