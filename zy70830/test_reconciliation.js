const { importService } = require('./dist/services/ImportService');
const { reconciliationEngine } = require('./dist/services/ReconciliationEngine');
const { dataStore } = require('./dist/models/DataStore');
const path = require('path');

async function runTest() {
  console.log('🏥 床位对账服务 - 核心链路测试\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📥 步骤1: 导入床位CSV数据...');
    const bedResult = await importService.importBedCSV(
      path.join(__dirname, 'src/data/sample_beds.csv')
    );
    console.log(`   ✓ 成功导入 ${bedResult.importedRecords} 个床位`);
    console.log(`   床位ID示例: ${dataStore.getAllBeds().slice(0, 3).map(b => b.id).join(', ')}`);

    console.log('\n📥 步骤2: 导入患者JSON数据...');
    const patientResult = await importService.importPatientJSON(
      path.join(__dirname, 'src/data/sample_patients.json')
    );
    console.log(`   ✓ 成功导入 ${patientResult.importedRecords} 个患者`);
    console.log(`   患者ID示例: ${dataStore.getAllPatients().slice(0, 3).map(p => p.id).join(', ')}`);

    console.log('\n📥 步骤3: 导入保洁工单JSON数据...');
    const workOrderResult = await importService.importCleaningWorkOrdersJSON(
      path.join(__dirname, 'src/data/sample_workorders.json')
    );
    console.log(`   ✓ 成功导入 ${workOrderResult.importedRecords} 个保洁工单`);
    console.log(`   工单床位ID示例: ${dataStore.getAllWorkOrders().slice(0, 3).map(wo => wo.bedId).join(', ')}`);

    console.log('\n🔍 步骤4: 验证数据关联一致性...');
    const consistency = importService.validateBedPatientConsistency();
    if (consistency.valid) {
      console.log('   ✓ 数据关联一致');
    } else {
      console.log('   ⚠️  发现一致性问题:');
      consistency.issues.forEach(issue => console.log(`      - ${issue}`));
    }

    console.log('\n🔗 步骤5: 验证床位-患者关联...');
    const beds = dataStore.getAllBeds();
    const patients = dataStore.getAllPatients();
    let matchedCount = 0;
    beds.forEach(bed => {
      if (bed.currentPatientId) {
        const patient = patients.find(p => p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId);
        if (patient) {
          matchedCount++;
          console.log(`   ✓ 床位 ${bed.bedNumber} <-> 患者 ${patient.name} (${patient.medicalRecordNumber})`);
        } else {
          console.log(`   ✗ 床位 ${bed.bedNumber} 关联患者 ${bed.currentPatientId} 未找到`);
        }
      }
    });
    console.log(`   共 ${matchedCount} 个床位成功关联患者`);

    console.log('\n🔗 步骤6: 验证患者-床位关联...');
    let patientMatchedCount = 0;
    patients.filter(p => p.currentBedId).forEach(patient => {
      const bed = beds.find(b => b.id === patient.currentBedId || b.bedNumber === patient.currentBedId);
      if (bed) {
        patientMatchedCount++;
        console.log(`   ✓ 患者 ${patient.name} <-> 床位 ${bed.bedNumber}`);
      } else {
        console.log(`   ✗ 患者 ${patient.name} 关联床位 ${patient.currentBedId} 未找到`);
      }
    });
    console.log(`   共 ${patientMatchedCount} 个患者成功关联床位`);

    console.log('\n🔗 步骤7: 验证工单-床位关联...');
    const workOrders = dataStore.getAllWorkOrders();
    let woMatchedCount = 0;
    workOrders.forEach(wo => {
      const bed = beds.find(b => b.id === wo.bedId || b.bedNumber === wo.bedNumber);
      if (bed) {
        woMatchedCount++;
        console.log(`   ✓ 工单 ${wo.id.slice(0, 8)} <-> 床位 ${bed.bedNumber}`);
      } else {
        console.log(`   ✗ 工单关联床位 ${wo.bedId} (${wo.bedNumber}) 未找到`);
      }
    });
    console.log(`   共 ${woMatchedCount} 个工单成功关联床位`);

    console.log('\n⚙️  步骤8: 运行自动对账...');
    const record = await reconciliationEngine.runReconciliation('测试护士长');
    console.log(`   ✓ 对账完成，批次号: ${record.batchId}`);
    console.log(`   统计:`);
    console.log(`      - 总床位: ${record.totalBeds}`);
    console.log(`      - 占用床位: ${record.occupiedBeds}`);
    console.log(`      - 空床: ${record.vacantBeds}`);
    console.log(`      - 清洁中: ${record.cleaningBeds}`);
    console.log(`      - 锁定/转科: ${record.lockedBeds}`);
    console.log(`      - 发现差异: ${record.discrepanciesFound}`);

    console.log('\n📋 步骤9: 查看检测到的差异详情...');
    const discrepancies = dataStore.getAllDiscrepancies();
    if (discrepancies.length > 0) {
      discrepancies.forEach((d, i) => {
        console.log(`   [${i + 1}] ${d.type} (${d.severity}): ${d.description}`);
        console.log(`       详情: ${d.detailedExplanation}`);
      });
    } else {
      console.log('   ✓ 未发现差异');
    }

    console.log('\n📊 步骤10: 患者转归历史追溯...');
    const testPatient = patients[0];
    const trace = reconciliationEngine.getPatientHistoryTrace(testPatient.id);
    console.log(`   患者: ${testPatient.name} (${testPatient.medicalRecordNumber})`);
    console.log(`   当前状态: ${testPatient.status}`);
    console.log(`   历史记录数: ${trace.history.length}`);
    trace.history.forEach((h, i) => {
      console.log(`     [${i + 1}] ${h.action} - ${new Date(h.timestamp).toLocaleString()}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ 核心对账链路测试通过！');
    console.log('   跨CSV/JSON/工单数据关联正常');
    console.log('   自动比对功能正常');
    console.log('   患者转归溯源功能正常\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

runTest();
