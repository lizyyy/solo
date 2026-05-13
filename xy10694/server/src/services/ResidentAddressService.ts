import { v4 as uuidv4 } from 'uuid';
import ResidentAddress from '../models/ResidentAddress';
import ModificationHistory, { EntityType } from '../models/ModificationHistory';

interface CreateAddressParams {
  residentName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  street: string;
  community: string;
  building?: string;
  unit?: string;
  room?: string;
  gridCode: string;
  operatorId: string;
  operatorName: string;
}

interface UpdateAddressParams extends Partial<CreateAddressParams> {
  id: string;
  reason?: string;
}

class ResidentAddressService {
  async createAddress(params: CreateAddressParams): Promise<ResidentAddress> {
    const { operatorId, operatorName, ...addressData } = params;

    const address = await ResidentAddress.create({
      id: uuidv4(),
      ...addressData,
      isVerified: false
    });

    return address;
  }

  async updateAddress(params: UpdateAddressParams): Promise<ResidentAddress | null> {
    const { id, operatorId, operatorName, reason, ...updateData } = params;

    const address = await ResidentAddress.findByPk(id);
    if (!address) {
      return null;
    }

    const oldData = address.toJSON();
    await address.update(updateData);

    for (const [key, value] of Object.entries(updateData)) {
      if (oldData[key as keyof typeof oldData] !== value) {
        await ModificationHistory.create({
          id: uuidv4(),
          entityType: EntityType.RESIDENT_ADDRESS,
          entityId: id,
          fieldName: key,
          oldValue: String(oldData[key as keyof typeof oldData] || ''),
          newValue: String(value || ''),
          modifiedBy: operatorId,
          modifiedByName: operatorName,
          reason: reason || '更新居民地址信息'
        });
      }
    }

    return address;
  }

  async getAddressById(id: string): Promise<ResidentAddress | null> {
    return await ResidentAddress.findByPk(id);
  }

  async getAddressList(page: number = 1, pageSize: number = 20): Promise<{ list: ResidentAddress[]; total: number }> {
    const { count, rows } = await ResidentAddress.findAndCountAll({
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']]
    });

    return { list: rows, total: count };
  }

  async verifyAddress(id: string): Promise<ResidentAddress | null> {
    const address = await ResidentAddress.findByPk(id);
    if (!address) {
      return null;
    }

    await address.update({ isVerified: true });
    return address;
  }

  async getModificationHistory(addressId: string): Promise<ModificationHistory[]> {
    return await ModificationHistory.findAll({
      where: {
        entityType: EntityType.RESIDENT_ADDRESS,
        entityId: addressId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

export default new ResidentAddressService();
