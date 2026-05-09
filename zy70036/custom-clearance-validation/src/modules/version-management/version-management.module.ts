import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { PackingList } from '../../entities/packing-list.entity';
import { HsCodeVersion } from '../../entities/hs-code-version.entity';
import { ClearanceBatchModule } from '../clearance-batch/clearance-batch.module';
import { InvoiceController } from './invoice.controller';
import { PackingListController } from './packing-list.controller';
import { HsCodeVersionController } from './hs-code-version.controller';
import { VersionManagementController } from './version-management.controller';
import { InvoiceService } from './invoice.service';
import { PackingListService } from './packing-list.service';
import { HsCodeVersionService } from './hs-code-version.service';
import { VersionManagementService } from './version-management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, PackingList, HsCodeVersion]),
    ClearanceBatchModule,
  ],
  controllers: [
    InvoiceController,
    PackingListController,
    HsCodeVersionController,
    VersionManagementController,
  ],
  providers: [
    InvoiceService,
    PackingListService,
    HsCodeVersionService,
    VersionManagementService,
  ],
  exports: [
    InvoiceService,
    PackingListService,
    HsCodeVersionService,
    VersionManagementService,
  ],
})
export class VersionManagementModule {}
