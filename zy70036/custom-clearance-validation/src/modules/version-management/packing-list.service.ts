import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackingList } from '../../entities/packing-list.entity';
import { DocumentStatus } from '../../entities/invoice.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import {
  CreatePackingListDto,
  UpdatePackingListDto,
  PackingListFilterDto,
} from './dto/packing-list.dto';

@Injectable()
export class PackingListService {
  constructor(
    @InjectRepository(PackingList)
    private readonly packingListRepository: Repository<PackingList>,
    private readonly batchService: ClearanceBatchService,
  ) {}

  async create(dto: CreatePackingListDto): Promise<PackingList> {
    await this.batchService.findOne(dto.batchId);

    const existingLists = await this.packingListRepository.find({
      where: { batchId: dto.batchId },
      order: { version: 'DESC' },
    });

    const newVersion = existingLists.length > 0 ? existingLists[0].version + 1 : 1;

    await this.packingListRepository.update(
      { batchId: dto.batchId },
      { status: DocumentStatus.DRAFT },
    );

    const packingList = this.packingListRepository.create({
      ...dto,
      version: newVersion,
      status: DocumentStatus.SUBMITTED,
    });

    return this.packingListRepository.save(packingList);
  }

  async findAll(filter: PackingListFilterDto): Promise<PackingList[]> {
    const queryBuilder = this.packingListRepository.createQueryBuilder('packingList');

    if (filter.batchId) {
      queryBuilder.andWhere('packingList.batchId = :batchId', { batchId: filter.batchId });
    }

    if (filter.packingListNumber) {
      queryBuilder.andWhere('packingList.packingListNumber LIKE :packingListNumber', {
        packingListNumber: `%${filter.packingListNumber}%`,
      });
    }

    if (filter.status) {
      queryBuilder.andWhere('packingList.status = :status', { status: filter.status });
    }

    queryBuilder.orderBy('packingList.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<PackingList> {
    const packingList = await this.packingListRepository.findOne({ where: { id } });
    if (!packingList) {
      throw new NotFoundException(`箱单 ${id} 不存在`);
    }
    return packingList;
  }

  async findByBatch(batchId: string): Promise<PackingList[]> {
    return this.packingListRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
    });
  }

  async findLatestByBatch(batchId: string): Promise<PackingList | null> {
    const lists = await this.packingListRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
      take: 1,
    });
    return lists.length > 0 ? lists[0] : null;
  }

  async update(id: string, dto: UpdatePackingListDto): Promise<PackingList> {
    const packingList = await this.findOne(id);
    Object.assign(packingList, dto);
    return this.packingListRepository.save(packingList);
  }

  async remove(id: string): Promise<void> {
    const result = await this.packingListRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`箱单 ${id} 不存在`);
    }
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<PackingList> {
    const packingList = await this.findOne(id);
    packingList.status = status;
    return this.packingListRepository.save(packingList);
  }
}
