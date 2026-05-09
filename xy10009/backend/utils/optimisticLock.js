class OptimisticLockError extends Error {
  constructor(message, currentVersion, providedVersion) {
    super(message || '数据已被其他用户修改，请刷新后重试');
    this.name = 'OptimisticLockError';
    this.currentVersion = currentVersion;
    this.providedVersion = providedVersion;
  }
}

const withOptimisticLock = async (model, id, updateData, user) => {
  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    const entity = await model.findByPk(id);
    
    if (!entity) {
      throw new Error('记录不存在');
    }

    const currentVersion = entity.version;
    const providedVersion = updateData.version || currentVersion;

    if (currentVersion !== providedVersion) {
      throw new OptimisticLockError(
        '数据已被其他用户修改，当前版本号：' + currentVersion + '，您的版本号：' + providedVersion,
        currentVersion,
        providedVersion
      );
    }

    try {
      const [updatedCount] = await model.update(
        { ...updateData, version: currentVersion + 1 },
        {
          where: {
            id: id,
            version: currentVersion
          },
          returning: true
        }
      );

      if (updatedCount > 0) {
        const updatedEntity = await model.findByPk(id);
        return updatedEntity;
      } else {
        retries++;
      }
    } catch (error) {
      throw error;
    }
  }

  throw new OptimisticLockError('更新失败，请稍后重试');
};

module.exports = {
  OptimisticLockError,
  withOptimisticLock
};