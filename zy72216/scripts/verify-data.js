const unifiedDataService = require('../services/unified-data-service');

console.log('='.repeat(60));
console.log('  私募持仓穿透核对 - 完整数据核对');
console.log('='.repeat(60));
console.log();

unifiedDataService.getAllRecordsWithDetails((err, records) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }

  const ningde = records.find(r => r.security_code === '300750');
  if (!ningde) {
    console.error('❌ 找不到宁德时代记录');
    process.exit(1);
  }

  console.log('【1. 列表数据核对（getAllRecordsWithDetails）】');
  console.log(`   状态:              ${ningde.status_label}`);
  console.log(`   change_logs:       ${ningde.change_logs ? ningde.change_logs.length + ' 条' : '缺失 ❌'}`);
  console.log(`   reconciliation_notes: ${ningde.reconciliation_notes ? ningde.reconciliation_notes.length + ' 条' : '缺失 ❌'}`);
  console.log(`   ex_right_screenshots: ${ningde.ex_right_screenshots ? ningde.ex_right_screenshots.length + ' 条' : '缺失 ❌'}`);
  console.log();

  if (ningde.change_logs && ningde.change_logs[0]) {
    const l = ningde.change_logs[0];
    console.log(`   改动字段:          ${l.field_label}`);
    console.log(`   原值 → 新值:       ${l.old_value} → ${l.new_value}`);
    console.log(`   改动原因:          ${l.change_reason}`);
    console.log(`   证据截图:          ${l.evidence_screenshot || '缺失 ❌'}`);
  } else {
    console.log('   ❌ 缺少改动日志');
  }
  console.log();

  if (ningde.reconciliation_notes && ningde.reconciliation_notes[0]) {
    console.log(`   对账说明:          ${ningde.reconciliation_notes[0].note_content}`);
  } else {
    console.log('   ❌ 缺少对账说明');
  }
  console.log();

  if (ningde.ex_right_screenshots && ningde.ex_right_screenshots[0]) {
    const s = ningde.ex_right_screenshots[0];
    console.log(`   除权日截图:        ${s.screenshot_path}`);
    console.log(`   截图备注:          ${s.remark || '无'}`);
    console.log(`   上传操作员:        ${s.upload_operator}`);
  } else {
    console.log('   ❌ 缺少除权日截图');
  }
  console.log();

  console.log('【2. 导出数据核对（getExportData）】');
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      console.error('❌ 导出错误:', err.message);
      process.exit(1);
    }

    const row = data.find(r => r['证券代码'] === '300750');
    if (!row) {
      console.log('❌ 导出数据中找不到宁德时代');
      process.exit(1);
    }

    const keys = ['处理状态', '是否人工改动', '改动类型', '人工改动记录', '人工改动证据截图', '除权日截图', '对账说明'];
    keys.forEach(k => {
      const val = row[k];
      const hasVal = val && val.length > 0;
      console.log(`   ${k.padEnd(18)} ${hasVal ? val : '缺失 ❌'}`);
    });
    console.log();

    console.log('【3. 三源同数一致性核对】');
    console.log('   （详情接口 / 列表接口 / 导出 三者数据一致）');
    console.log();

    unifiedDataService.getFullRecordById(ningde.id, (err, detail) => {
      if (err) {
        console.error('❌ 详情查询错误:', err.message);
        process.exit(1);
      }

      let allPass = true;

      function check(name, listVal, detailVal, exportVal) {
        const same = listVal === detailVal && detailVal === exportVal;
        if (!same) allPass = false;
        console.log(`   ${name.padEnd(16)} ${same ? '✅ 一致' : '❌ 不一致'}`);
        if (!same) {
          console.log(`     列表: ${listVal}`);
          console.log(`     详情: ${detailVal}`);
          console.log(`     导出: ${exportVal}`);
        }
      }

      check('处理状态',
        ningde.status_label,
        detail.status_label,
        row['处理状态']
      );

      check('是否人工改动',
        ningde.has_manual_change ? '是' : '否',
        detail.has_manual_change ? '是' : '否',
        row['是否人工改动']
      );

      check('当前到账日',
        ningde.current_settlement_date,
        detail.current_settlement_date,
        row['当前到账日']
      );

      const listChangeLog = ningde.change_logs[0].change_reason;
      const detailChangeLog = detail.change_logs[0].change_reason;
      check('改动原因',
        listChangeLog,
        detailChangeLog,
        row['人工改动记录'].includes(listChangeLog) ? listChangeLog : '不匹配'
      );

      const listNote = ningde.reconciliation_notes[0].note_content;
      const detailNote = detail.reconciliation_notes[0].note_content;
      check('对账说明',
        listNote,
        detailNote,
        row['对账说明']
      );

      const listScreenshot = ningde.ex_right_screenshots[0].screenshot_path;
      const detailScreenshot = detail.ex_right_screenshots[0].screenshot_path;
      check('除权日截图路径',
        listScreenshot,
        detailScreenshot,
        row['除权日截图'].includes(listScreenshot) ? listScreenshot : '不匹配'
      );

      const listEvidence = ningde.change_logs[0].evidence_screenshot;
      const detailEvidence = detail.change_logs[0].evidence_screenshot;
      check('人工改动证据截图',
        listEvidence,
        detailEvidence,
        row['人工改动证据截图'].includes(listEvidence) ? listEvidence : '不匹配'
      );

      console.log();
      if (allPass) {
        console.log('🎉 所有核对全部通过！三源同数确认一致。');
      } else {
        console.log('❌ 存在不一致项，请检查。');
        process.exit(1);
      }
      console.log();

      console.log('【4. 证据文件可访问性核对】');
      const http = require('http');
      const paths = [
        listScreenshot,
        listEvidence
      ];
      let checked = 0;
      let allOk = true;

      paths.forEach(p => {
        const url = `http://localhost:3000${p}`;
        http.get(url, (res) => {
          const ok = res.statusCode === 200;
          if (!ok) allOk = false;
          console.log(`   ${p.padEnd(50)} ${ok ? '✅ HTTP 200' : `❌ HTTP ${res.statusCode}`}`);
          checked++;
          if (checked === paths.length) {
            console.log();
            console.log(allOk ? '✅ 所有证据截图文件均可正常访问' : '❌ 部分证据截图无法访问');
            console.log();
            console.log('='.repeat(60));
            console.log('  核对完成');
            console.log('='.repeat(60));
            process.exit(allOk && allPass ? 0 : 1);
          }
        }).on('error', (e) => {
          console.log(`   ${p.padEnd(50)} ❌ ${e.message}`);
          allOk = false;
          checked++;
          if (checked === paths.length) {
            process.exit(1);
          }
        });
      });
    });
  });
});
