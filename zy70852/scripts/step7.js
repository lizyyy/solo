const fs = require("fs");
const path = require("path");

const itemPath = path.join(__dirname, "../src/services/itemService.js");
let content = fs.readFileSync(itemPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async issuePickupVoucher(itemId, issuer, expireDays) {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error("物品不存在");
    }
    if (item.status !== "completed") {
      throw new Error("物品未完成处理，无法开具领取凭证");
    }
    if (item.pickup_voucher_no) {
      throw new Error("该物品已开具领取凭证");
    }

    const voucherNo = "VOUCHER" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 1000);
    const expireTime = moment().add(expireDays || 7, "days").format("YYYY-MM-DD HH:mm:ss");

    await db.run(
      "INSERT INTO pickup_vouchers (voucher_no, item_id, item_name, issuer, expire_time) VALUES (?, ?, ?, ?, ?)",
      [voucherNo, itemId, item.item_name, issuer, expireTime]
    );

    await db.run(
      "UPDATE lost_items SET pickup_voucher_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [voucherNo, itemId]
    );

    await this.addProcessingHistory(
      itemId,
      "issue_voucher",
      "开具领取凭证",
      issuer,
      item.status,
      item.status,
      "凭证号: " + voucherNo + ", 有效期: " + expireDays + "天"
    );

    return {
      voucherNo,
      itemId,
      itemName: item.item_name,
      issuer,
      expireTime,
      status: "valid"
    };
  }

  async pickupItem(voucherNo, receiverName, receiverPhone, receiverIdCard, operator) {
    const voucher = await db.get(
      "SELECT * FROM pickup_vouchers WHERE voucher_no = ?",
      [voucherNo]
    );
    if (!voucher) {
      throw new Error("凭证不存在");
    }
    if (voucher.status !== "valid") {
      throw new Error("凭证状态无效");
    }
    if (moment(voucher.expire_time).isBefore(moment())) {
      throw new Error("凭证已过期");
    }

    const item = await this.getItemById(voucher.item_id);
    if (!item) {
      throw new Error("物品不存在");
    }

    await db.beginTransaction();
    try {
      await db.run(
        "UPDATE pickup_vouchers SET status = ?, used_time = CURRENT_TIMESTAMP WHERE voucher_no = ?",
        ["used", voucherNo]
      );

      const pickupTime = moment().format("YYYY-MM-DD HH:mm:ss");
      await db.run(
        "UPDATE lost_items SET status = ?, pickup_time = ?, receiver_name = ?, receiver_phone = ?, receiver_id_card = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ["picked_up", pickupTime, receiverName, receiverPhone, receiverIdCard, item.id]
      );

      await this.addProcessingHistory(
        item.id,
        "pickup",
        "物品已领取",
        operator,
        item.status,
        "picked_up",
        "领取人: " + receiverName + ", 凭证号: " + voucherNo
      );

      await db.commit();

      return {
        success: true,
        voucherNo,
        itemId: item.id,
        itemName: item.item_name,
        pickupTime,
        receiverName
      };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getVoucherByNo(voucherNo) {
    const voucher = await db.get(
      "SELECT * FROM pickup_vouchers WHERE voucher_no = ?",
      [voucherNo]
    );
    if (voucher) {
      const item = await db.get(
        "SELECT * FROM lost_items WHERE id = ?",
        [voucher.item_id]
      );
      voucher.item = item;
    }
    return voucher;
  }
`;

content = before + newCode + after;
fs.writeFileSync(itemPath, content);
console.log("添加了凭证管理和领取相关方法");
