exports.seed = function(knex) {
  return knex('inspection_reports').del()
    .then(function () {
      return knex('inspection_reports').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440501',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          submitted_by: '550e8400-e29b-41d4-a716-446655440002',
          overall_result: 'pass',
          notes: '整体符合卖家描述，充电盒有轻微划痕但已在描述中说明，功能全部正常。配件齐全，可以确认放款。',
          additional_evidence_urls: JSON.stringify(['https://example.com/inspection/final_report.pdf'])
        }
      ]);
    });
};
