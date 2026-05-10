const AttachmentService = require('../services/AttachmentService');
const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');
const { getOperatorInfo } = require('../middleware/upload');

class AttachmentController {
  static async uploadAttachment(req, res) {
    try {
      const { enterpriseCode, periodCode, attachmentType, sourceSystem, uploadUser } = req.body;
      const file = req.file;

      if (!file) {
        return ResponseUtils.badRequest(res, '请上传文件');
      }

      if (!enterpriseCode || !periodCode || !attachmentType) {
        return ResponseUtils.badRequest(res, '企业代码、申报期和附件类型不能为空');
      }

      const operatorInfo = getOperatorInfo(req);

      const attachment = await AttachmentService.uploadAttachment(
        { enterpriseCode, periodCode, attachmentType, sourceSystem, uploadUser },
        file,
        operatorInfo
      );

      return ResponseUtils.success(res, attachment, '附件上传成功');
    } catch (error) {
      logger.error('[AttachmentController.uploadAttachment] 上传失败', error);
      return ResponseUtils.badRequest(res, error.message || '上传失败');
    }
  }

  static async getAttachments(req, res) {
    try {
      const result = await AttachmentService.getAttachments(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[AttachmentController.getAttachments] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getAttachmentById(req, res) {
    try {
      const { attachmentId } = req.params;
      const result = await AttachmentService.getAttachments({ attachmentId, page: 1, pageSize: 1 });
      
      if (result.attachments.length === 0) {
        return ResponseUtils.notFound(res, '附件不存在');
      }
      
      return ResponseUtils.success(res, result.attachments[0]);
    } catch (error) {
      logger.error('[AttachmentController.getAttachmentById] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getAttachmentHistory(req, res) {
    try {
      const { attachmentId } = req.params;
      const result = await AttachmentService.getAttachmentHistory(attachmentId);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[AttachmentController.getAttachmentHistory] 查询失败', error);
      return ResponseUtils.notFound(res, error.message || '查询失败');
    }
  }

  static async validateAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const attachment = await AttachmentService.validateAttachment(attachmentId, operatorInfo);
      return ResponseUtils.success(res, attachment, '附件校验完成');
    } catch (error) {
      logger.error('[AttachmentController.validateAttachment] 校验失败', error);
      return ResponseUtils.badRequest(res, error.message || '校验失败');
    }
  }

  static async manualCorrectAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const { reason, targetStatus } = req.body;

      if (!reason) {
        return ResponseUtils.badRequest(res, '修正原因不能为空');
      }

      const operatorInfo = getOperatorInfo(req);

      const attachment = await AttachmentService.manualCorrectAttachment(
        attachmentId,
        { reason, targetStatus },
        operatorInfo
      );

      return ResponseUtils.success(res, attachment, '人工修正成功');
    } catch (error) {
      logger.error('[AttachmentController.manualCorrectAttachment] 修正失败', error);
      return ResponseUtils.badRequest(res, error.message || '修正失败');
    }
  }
}

module.exports = AttachmentController;
