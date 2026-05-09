const path = require('path');
const utils = require('./utils');

const BUDGETS_FILE = path.join(utils.getDataDir(), 'budgets.json');
const INVOICES_FILE = path.join(utils.getDataDir(), 'invoices.json');
const APPROVALS_FILE = path.join(utils.getDataDir(), 'approvals.json');

function loadBudgets() {
  return utils.readJsonFile(BUDGETS_FILE) || [];
}

function saveBudgets(budgets) {
  utils.writeJsonFile(BUDGETS_FILE, budgets);
}

function loadInvoices() {
  return utils.readJsonFile(INVOICES_FILE) || [];
}

function saveInvoices(invoices) {
  utils.writeJsonFile(INVOICES_FILE, invoices);
}

function loadApprovals() {
  return utils.readJsonFile(APPROVALS_FILE) || [];
}

function saveApprovals(approvals) {
  utils.writeJsonFile(APPROVALS_FILE, approvals);
}

function addBudget(budget) {
  const budgets = loadBudgets();
  budget.id = utils.generateId();
  budget.createdAt = utils.getTimestamp();
  budgets.push(budget);
  saveBudgets(budgets);
  return budget;
}

function addInvoice(invoice) {
  const invoices = loadInvoices();
  invoice.id = utils.generateId();
  invoice.createdAt = utils.getTimestamp();
  invoices.push(invoice);
  saveInvoices(invoices);
  return invoice;
}

function addApproval(approval) {
  const approvals = loadApprovals();
  approval.id = utils.generateId();
  approval.createdAt = utils.getTimestamp();
  approvals.push(approval);
  saveApprovals(approvals);
  return approval;
}

function findBudgetByActivityId(activityId) {
  const budgets = loadBudgets();
  return budgets.find(b => b.activityId === activityId);
}

function findInvoicesByActivityId(activityId) {
  const invoices = loadInvoices();
  return invoices.filter(i => i.activityId === activityId);
}

function findApprovalByActivityId(activityId) {
  const approvals = loadApprovals();
  return approvals.find(a => a.activityId === activityId);
}

function getAllActivityIds() {
  const budgets = loadBudgets();
  const invoices = loadInvoices();
  const approvals = loadApprovals();
  
  const ids = new Set();
  budgets.forEach(b => ids.add(b.activityId));
  invoices.forEach(i => ids.add(i.activityId));
  approvals.forEach(a => ids.add(a.activityId));
  
  return Array.from(ids);
}

module.exports = {
  loadBudgets,
  saveBudgets,
  loadInvoices,
  saveInvoices,
  loadApprovals,
  saveApprovals,
  addBudget,
  addInvoice,
  addApproval,
  findBudgetByActivityId,
  findInvoicesByActivityId,
  findApprovalByActivityId,
  getAllActivityIds
};
