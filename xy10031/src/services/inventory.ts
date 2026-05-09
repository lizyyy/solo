import { db } from './database'
import { logger } from './logger'

class InventoryService {
  async listProducts(params: {
    keyword?: string
    category?: string
    skip?: number
    take?: number
  }) {
    const { keyword, category, skip = 0, take = 50 } = params

    const where: any = {}
    if (keyword) {
      where.OR = [
        { sku: { contains: keyword } },
        { name: { contains: keyword } },
      ]
    }
    if (category) {
      where.category = category
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take,
        include: { inventory: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.product.count({ where }),
    ])

    return { products, total }
  }

  async createProduct(params: {
    sku: string
    name: string
    category?: string
    unit?: string
    description?: string
    quantity?: number
    minQuantity?: number
    location?: string
    userId: string
  }) {
    const exists = await db.product.findUnique({ where: { sku: params.sku } })
    if (exists) {
      throw new Error('SKU已存在')
    }

    const product = await db.product.create({
      data: {
        sku: params.sku,
        name: params.name,
        category: params.category,
        unit: params.unit,
        description: params.description,
      },
    })

    if (params.quantity !== undefined) {
      await db.inventory.create({
        data: {
          productId: product.id,
          quantity: params.quantity,
          minQuantity: params.minQuantity || 0,
          location: params.location,
        },
      })
    }

    await logger.info({
      userId: params.userId,
      action: 'CREATE',
      module: 'PRODUCT',
      details: { sku: params.sku, name: params.name },
    })

    return product
  }

  async updateProduct(
    id: string,
    params: {
      name?: string
      category?: string
      unit?: string
      description?: string
      userId: string
    }
  ) {
    const { userId, ...data } = params
    const product = await db.product.update({
      where: { id },
      data,
    })

    await logger.info({
      userId,
      action: 'UPDATE',
      module: 'PRODUCT',
      details: { productId: id, ...data },
    })

    return product
  }

  async updateInventory(
    productId: string,
    params: {
      quantity: number
      changeReason: string
      userId: string
      location?: string
      minQuantity?: number
    }
  ) {
    const { userId, changeReason, ...inventoryData } = params

    const current = await db.inventory.findUnique({
      where: { productId },
    })

    const oldQuantity = current?.quantity || 0

    const inventory = current
      ? await db.inventory.update({
          where: { productId },
          data: inventoryData,
        })
      : await db.inventory.create({
          data: { productId, ...inventoryData },
        })

    await db.inventoryHistory.create({
      data: {
        inventoryId: inventory.id,
        oldQuantity,
        newQuantity: params.quantity,
        changeReason,
        changedBy: userId,
      },
    })

    await logger.info({
      userId,
      action: 'UPDATE',
      module: 'INVENTORY',
      details: {
        productId,
        oldQuantity,
        newQuantity: params.quantity,
        changeReason,
      },
    })

    return inventory
  }

  async getInventoryHistory(inventoryId: string, take = 20) {
    return db.inventoryHistory.findMany({
      where: { inventoryId },
      take,
      orderBy: { changedAt: 'desc' },
    })
  }

  async getCategories() {
    const products = await db.product.findMany({
      select: { category: true },
      distinct: ['category'],
    })
    return products.map(p => p.category).filter(Boolean) as string[]
  }

  async getLowStock(minQuantity: number) {
    return db.inventory.findMany({
      where: { quantity: { lt: minQuantity } },
      include: { product: true },
      orderBy: { quantity: 'asc' },
    })
  }

  async batchUpdateInventory(items: {
    productId: string
    quantity: number
    changeReason: string
  }[], userId: string) {
    const results = []
    for (const item of items) {
      const result = await this.updateInventory(item.productId, {
        quantity: item.quantity,
        changeReason: item.changeReason,
        userId,
      })
      results.push(result)
    }
    return results
  }
}

export const inventoryService = new InventoryService()
