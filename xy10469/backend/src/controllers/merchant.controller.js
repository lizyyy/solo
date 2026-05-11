const Merchant = require('../models/Merchant.model');

exports.getAllMerchants = async (req, res) => {
  try {
    const { status, keyword } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { contactPerson: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword } }
      ];
    }
    
    const merchants = await Merchant.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: merchants
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMerchantById = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.id);
    if (!merchant) {
      return res.status(404).json({ success: false, message: '商户不存在' });
    }
    res.json({
      success: true,
      data: merchant
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMerchant = async (req, res) => {
  try {
    const merchant = new Merchant(req.body);
    await merchant.save();
    res.status(201).json({
      success: true,
      data: merchant,
      message: '商户创建成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateMerchant = async (req, res) => {
  try {
    const merchant = await Merchant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!merchant) {
      return res.status(404).json({ success: false, message: '商户不存在' });
    }
    res.json({
      success: true,
      data: merchant,
      message: '商户更新成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteMerchant = async (req, res) => {
  try {
    const merchant = await Merchant.findByIdAndDelete(req.params.id);
    if (!merchant) {
      return res.status(404).json({ success: false, message: '商户不存在' });
    }
    res.json({
      success: true,
      message: '商户删除成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};