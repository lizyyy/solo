const fs = require("fs");
const filePath = "src/controllers/itemController.js";
let content = fs.readFileSync(filePath, "utf-8");

const m1 = "\n  async maskSensitiveInfo(req, res) {\n    try {\n      const { itemId } = req.params;\n      const { operator, fieldsToMask } = req.body;\n      const result = await itemService.maskSensitiveInfo(\n        parseInt(itemId),\n        operator,\n        fieldsToMask\n      );\n      res.json({ success: true, data: result });\n    } catch (error) {\n      res.status(500).json({ success: false, error: error.message });\n    }\n  }\n";

const m2 = "\n  async batchMaskSensitiveInfo(req, res) {\n    try {\n      const { itemIds, operator, fieldsToMask } = req.body;\n      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {\n        return res.status(400).json({ success: false, error: \"请提供有效的物品ID列表\" });\n      }\n      const result = await itemService.batchMaskSensitiveInfo(\n        itemIds.map(function(id) { return parseInt(id); }),\n        operator,\n        fieldsToMask\n      );\n      res.json({ success: true, data: result });\n    } catch (error) {\n      res.status(500).json({ success: false, error: error.message });\n    }\n  }\n";

const insertPos = content.lastIndexOf("}");
content = content.substring(0, insertPos) + m1 + m2 + content.substring(insertPos);
fs.writeFileSync(filePath, content);
console.log("OK");
