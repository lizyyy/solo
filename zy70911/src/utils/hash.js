const crypto = require("crypto");

function generateMaterialHash(materials) {
  const sortedMaterials = JSON.stringify(materials, Object.keys(materials).sort());
  return crypto.createHash("sha256").update(sortedMaterials).digest("hex");
}

function generateId() {
  return crypto.randomUUID();
}

function now() {
  return Math.floor(Date.now() / 1000);
}

module.exports = {
  generateMaterialHash,
  generateId,
  now
};
