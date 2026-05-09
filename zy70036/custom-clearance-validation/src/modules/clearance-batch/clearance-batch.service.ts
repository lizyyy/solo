import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClearanceBatch, ClearanceBatchStatus } from '../../entities/clearance-batch.entity';
import {
  CreateClearanceBatchDto,
  UpdateClearanceBatchDto,
  ClearanceBatchFilterDto,
} from './dto/clearance-batch.dto';

@Injectable()
export class ClearanceBatchService {
  constructor(
    @InjectRepository(ClearanceBatch)
    private readonly batchRepository: Repository<ClearanceBatch>,
  ) {}

  async create(dto: CreateClearanceBatchDto): Promise<ClearanceBatch> {
    const batch = this.batchRepository.create({
      ...dto,
      status: ClearanceBatchStatus.DRAFT,
    });
    return this.batchRepository.save(batch);
  }

  async findAll(filter: ClearanceBatchFilterDto): Promise<ClearanceBatch[]> {
    const queryBuilder = this.batchRepository.createQueryBuilder('batch');

    if (filter.batchNumber) {
      queryBuilder.andWhere('batch.batchNumber LIKE :batchNumber', {
        batchNumber: `%${filter.batchNumber}%`,
      });
    }

    if (filter.shipmentNumber) {
      queryBuilder.andWhere('batch.shipmentNumber LIKE :shipmentNumber', {
        shipmentNumber: `%${filter.shipmentNumber}%`,
      });
    }

    if (filter.status) {
      queryBuilder.andWhere('batch.status = :status', { status: filter.status });
    }

    queryBuilder.orderBy('batch.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<ClearanceBatch> {
    const batch = await this.batchRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`清关批次 ${id} 不存在`);
    }
    return batch;
  }

  async update(id: string, dto: UpdateClearanceBatchDto): Promise<ClearanceBatch> {
    const batch = await this.findOne(id);
    Object.assign(batch, dto);
    return this.batchRepository.save(batch);
  }

  async remove(id: string): Promise<void> {
    const result = await this.batchRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`清关批次 ${id} 不存在`);
    }
  }

  async updateStatus(id: string, status: ClearanceBatchStatus): Promise<ClearanceBatch> {
    const batch = await this.findOne(id);
    batch.status = status;
    return this.batchRepository.save(batch);
  }
}
