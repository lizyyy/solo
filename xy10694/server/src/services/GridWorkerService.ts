import { v4 as uuidv4 } from 'uuid';
import GridWorker from '../models/GridWorker';
import ModificationHistory, { EntityType } from '../models/ModificationHistory';

interface CreateGridWorkerParams {
  name: string;
  phone: string;
  employeeId: string;
  gridCodes: string[];
  operatorId: string;
  operatorName: string;
}

interface UpdateGridWorkerParams extends Partial<CreateGridWorkerParams> {
  id: string;
  reason?: string;
}

class GridWorkerService {
  async createGridWorker(params: CreateGridWorkerParams): Promise<GridWorker> {
    const { operatorId, operatorName, gridCodes, ...data } = params;

    const gridWorker = await GridWorker.create({
      id: uuidv4(),
      ...data,
      gridCodes: JSON.stringify(gridCodes),
      isActive: true
    });

    return gridWorker;
  }

  async updateGridWorker(params: UpdateGridWorkerParams): Promise<GridWorker | null> {
    const { id, operatorId, operatorName, reason, gridCodes, ...updateData } = params;

    const gridWorker = await GridWorker.findByPk(id);
    if (!gridWorker) {
      return null;
    }

    const oldData = gridWorker.toJSON();
    
    if (gridCodes) {
      (updateData as any).gridCodes = JSON.stringify(gridCodes);
    }
    
    await gridWorker.update(updateData);

    for (const [key, value] of Object.entries(updateData)) {
      const oldValue = oldData[key as keyof typeof oldData];
      if (oldValue !== value) {
        await ModificationHistory.create({
          id: uuidv4(),
          entityType: EntityType.GRID_WORKER,
          entityId: id,
          fieldName: key,
          oldValue: String(oldValue || ''),
          newValue: String(value || ''),
          modifiedBy: operatorId,
          modifiedByName: operatorName,
          reason: reason || '更新网格员信息'
        });
      }
    }

    return gridWorker;
  }

  async getGridWorkerByGridCode(gridCode: string): Promise<GridWorker | null> {
    const workers = await GridWorker.findAll({
      where: { isActive: true }
    });

    for (const worker of workers) {
      const codes = JSON.parse(worker.gridCodes);
      if (codes.includes(gridCode)) {
        return worker;
      }
    }

    return null;
  }

  async getGridWorkerById(id: string): Promise<GridWorker | null> {
    return await GridWorker.findByPk(id);
  }

  async getActiveWorkers(): Promise<GridWorker[]> {
    return await GridWorker.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });
  }

  async getModificationHistory(workerId: string): Promise<ModificationHistory[]> {
    return await ModificationHistory.findAll({
      where: {
        entityType: EntityType.GRID_WORKER,
        entityId: workerId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

export default new GridWorkerService();
