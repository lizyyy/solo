const moment = require("moment");
const { get, all } = require("./database");

function evaluateCondition(c, ctx) {
  if (!c) return true;
  try { return new Function("x", "with(x){return "+c+"}")(ctx)===true; }
  catch(e){return false;}
}

module.exports = {
  evaluateCondition: evaluateCondition,
  calculateOverdueRent: function(){return {hasOverdue:false};},
  evaluateRepairLiability: function(){return {shouldDeduct:false};},
  checkDuplicateDeduction: async function(){return false;},
  getDepositBalance: async function(){return {totalDeposit:0,usedAmount:0,balance:0};},
  getActiveRules: async function(){return [];}
};
