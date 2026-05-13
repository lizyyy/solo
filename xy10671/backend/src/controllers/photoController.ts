import { Request, Response } from 'express';
import { InspectionPhoto, OperationLog, sequelize } from '../models';

export const getPhotos = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { nodeId } = req.query;
    
    const where: any = { projectId };
    if (nodeId) where.nodeId = nodeId;
    
    const photos = await InspectionPhoto.findAll({
      where,
      order: [['uploadTime', 'DESC']]
    });
    res.json({ success: true, data: photos });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取照片列表失败' });
  }
};

export const uploadPhoto = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { projectId } = req.params;
    const { nodeId, photoName, description, uploadedBy, photoUrl, isInspectionPhoto } = req.body;
    
    const photo = await InspectionPhoto.create({
      projectId,
      nodeId: nodeId || null,
      photoName,
      photoUrl: photoUrl || `https://picsum.photos/seed/${Date.now()}/400/300`,
      description,
      uploadedBy,
      uploadTime: new Date(),
      isInspectionPhoto: isInspectionPhoto !== false
    }, { transaction });
    
    await OperationLog.create({
      projectId,
      operationType: 'PHOTO_UPLOAD',
      operationContent: `上传照片: ${photoName}`,
      operator: uploadedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: photo });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '上传照片失败' });
  }
};

export const deletePhoto = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { deletedBy } = req.body;
    
    const photo = await InspectionPhoto.findByPk(id, { transaction });
    if (!photo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '照片不存在' });
    }
    
    await photo.destroy({ transaction });
    
    await OperationLog.create({
      projectId: photo.projectId,
      operationType: 'PHOTO_DELETE',
      operationContent: `删除照片: ${photo.photoName}`,
      operator: deletedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '删除照片失败' });
  }
};
