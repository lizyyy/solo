import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import priceListService from './priceListService';
import { PriceListStatus } from '../types';

const statusMap: Record<string, string> = {
  [PriceListStatus.DRAFT]: '草稿',
  [PriceListStatus.PENDING_EFFECTIVE]: '待生效',
  [PriceListStatus.EFFECTIVE]: '已生效',
  [PriceListStatus.ROLLED_BACK]: '已回滚'
};

export class ExportService {
  async exportPriceLists(params: { status?: string; keyword?: string }): Promise<string> {
    const { list } = await priceListService.getPriceListList({ ...params, page: 1, pageSize: 1000 });

    const records = await Promise.all(list.map(async (item) => {
      const stores = await priceListService.getPriceListStores(item.id);
      const items = await priceListService.getPriceListItems(item.id);
      
      return {
        价目表编号: item.version,
        价目表名称: item.name,
        状态: statusMap[item.status] || item.status,
        生效时间: item.effective_time || '-',
        门店数量: stores.length,
        门店列表: stores.map(s => s.store_name).join('、'),
        商品数量: items.length,
        创建人: item.created_by_name,
        创建时间: item.created_at,
        审批人: item.approver_name || '-',
        审批时间: item.approved_at || '-'
      };
    }));

    const exportPath = path.resolve(__dirname, '../../data/exports');
    const fileName = `价目表导出_${new Date().toISOString().slice(0, 10)}.csv`;
    const filePath = path.join(exportPath, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: '价目表编号', title: '价目表编号' },
        { id: '价目表名称', title: '价目表名称' },
        { id: '状态', title: '状态' },
        { id: '生效时间', title: '生效时间' },
        { id: '门店数量', title: '门店数量' },
        { id: '门店列表', title: '门店列表' },
        { id: '商品数量', title: '商品数量' },
        { id: '创建人', title: '创建人' },
        { id: '创建时间', title: '创建时间' },
        { id: '审批人', title: '审批人' },
        { id: '审批时间', title: '审批时间' }
      ],
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(records);
    return filePath;
  }

  async exportPriceListDetail(id: string): Promise<string> {
    const priceList = await priceListService.getPriceListById(id);
    if (!priceList) {
      throw new Error('价目表不存在');
    }

    const stores = await priceListService.getPriceListStores(id);
    const items = await priceListService.getPriceListItems(id);

    const records = items.map((item, index) => ({
      序号: index + 1,
      价目表编号: priceList.version,
      价目表名称: priceList.name,
      门店范围: stores.map(s => s.store_name).join('、'),
      商品编码: item.sku_code,
      商品名称: item.sku_name,
      原价: item.original_price,
      售价: item.sale_price,
      折扣: ((item.sale_price / item.original_price) * 100).toFixed(1) + '%'
    }));

    const exportPath = path.resolve(__dirname, '../../data/exports');
    const fileName = `价目表明细_${priceList.version}_${new Date().toISOString().slice(0, 10)}.csv`;
    const filePath = path.join(exportPath, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: '序号', title: '序号' },
        { id: '价目表编号', title: '价目表编号' },
        { id: '价目表名称', title: '价目表名称' },
        { id: '门店范围', title: '门店范围' },
        { id: '商品编码', title: '商品编码' },
        { id: '商品名称', title: '商品名称' },
        { id: '原价', title: '原价(元)' },
        { id: '售价', title: '售价(元)' },
        { id: '折扣', title: '折扣' }
      ],
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(records);
    return filePath;
  }
}

export default new ExportService();
