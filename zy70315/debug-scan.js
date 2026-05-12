const storage = require('./storage');
const samples = require('./samples');

samples.initSamples();

const refundTemplate = storage.getTemplateByType('refund');
console.log('Refund Template:');
console.log('  escalationChain:', refundTemplate.escalationChain);
console.log('');

const process2 = storage.createProcess(
  refundTemplate.id,
  'applicant_wang',
  {
    amount: 80000,
    description: '大金额退款',
    orderId: 'ORD-2024-001',
    reason: '商品质量问题'
  }
);

console.log('Process 2 created:');
console.log('  ID:', process2.process.id);
console.log('  Node 0 name:', process2.nodes[0].name);
console.log('  Node 0 assignee:', process2.nodes[0].assignee);
console.log('  Node 0 timeoutAt:', process2.nodes[0].timeoutAt);
console.log('');

process2.nodes[0].timeoutAt = new Date(Date.now() - 60000);
console.log('After setting timeout to past:');
console.log('  Node 0 timeoutAt:', process2.nodes[0].timeoutAt);
console.log('');

const template = storage.getTemplate(process2.process.templateId);
console.log('Template check:');
console.log('  Has template:', !!template);
console.log('  Has escalationChain:', !!template.escalationChain);
console.log('  escalationChain:', template.escalationChain);
console.log('');

const currentAssigneeIndex = template.escalationChain.indexOf(process2.nodes[0].assignee);
console.log('Escalation check:');
console.log('  Current assignee:', process2.nodes[0].assignee);
console.log('  Index in chain:', currentAssigneeIndex);
console.log('  Chain length:', template.escalationChain.length);
console.log('');

if (currentAssigneeIndex !== -1 && currentAssigneeIndex < template.escalationChain.length - 1) {
  console.log('  Will escalate to:', template.escalationChain[currentAssigneeIndex + 1]);
} else {
  console.log('  Will escalate to (last):', template.escalationChain[template.escalationChain.length - 1]);
}
console.log('');

const overdueProcesses = storage.getOverdueProcesses();
console.log('Overdue processes check:');
console.log('  Count:', overdueProcesses.length);
overdueProcesses.forEach((item, i) => {
  console.log(`  ${i}: process=${item.process.id}, node=${item.node.name}, status=${item.node.status}`);
});
console.log('');

const scan1 = storage.scanAndEscalate();
console.log('Scan 1 result:');
console.log('  totalScanned:', scan1.totalScanned);
console.log('  overdueCount:', scan1.overdueCount);
console.log('  escalatedCount:', scan1.escalatedCount);
console.log('  skippedCount:', scan1.skippedCount);
console.log('  failedCount:', scan1.failedCount);
console.log('');

console.log('Node after scan:');
const updatedNodes = storage.getProcessNodes(process2.process.id);
console.log('  Node 0 status:', updatedNodes[0].status);
console.log('  Node 0 escalated:', updatedNodes[0].escalated);
console.log('  Node 0 assignee:', updatedNodes[0].assignee);
console.log('');

console.log('Histories:');
const histories = storage.getProcessHistories(process2.process.id);
histories.forEach((h, i) => {
  console.log(`  ${i}: [${h.source}] ${h.actionType} - ${h.operator}`);
});
