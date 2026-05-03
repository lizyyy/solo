const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { successResponse, createdResponse, paginatedResponse } = require('../utils/response');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');

const PRODUCT_CATEGORIES = ['phone', 'camera', 'headphone', 'laptop', 'tablet', 'other'];
const PRODUCT_CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
const PRODUCT_STATUSES = ['available', 'reserved', 'sold', 'removed'];

const getProducts = async (req, res, next) => {
  try {
    const { 
      category, 
      condition, 
      status = 'available',
      seller_id,
      keyword,
      page = 1, 
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const query = db('products')
      .leftJoin('users as sellers', 'products.seller_id', 'sellers.id')
      .select(
        'products.*',
        'sellers.name as seller_name',
        'sellers.avatar_url as seller_avatar'
      );

    if (category) {
      query.where('products.category', category);
    }
    if (condition) {
      query.where('products.condition', condition);
    }
    if (status) {
      query.where('products.status', status);
    }
    if (seller_id) {
      query.where('products.seller_id', seller_id);
    }
    if (keyword) {
      query.where(function() {
        this.where('products.title', 'like', `%${keyword}%`)
          .orWhere('products.description', 'like', `%${keyword}%`)
          .orWhere('products.brand', 'like', `%${keyword}%`)
          .orWhere('products.model', 'like', `%${keyword}%`);
      });
    }

    const countQuery = query.clone().clearSelect().count('products.id as count');
    const countResult = await countQuery.first();
    const total = parseInt(countResult.count);

    const validSortFields = ['created_at', 'price', 'condition'];
    const finalSortBy = validSortFields.includes(sort_by) ? `products.${sort_by}` : 'products.created_at';
    const finalSortOrder = sort_order === 'asc' ? 'asc' : 'desc';

    const offset = (page - 1) * limit;
    const products = await query
      .orderBy(finalSortBy, finalSortOrder)
      .limit(parseInt(limit))
      .offset(offset);

    const formattedProducts = products.map(product => ({
      ...product,
      accessories: product.accessories ? JSON.parse(product.accessories) : [],
      specs: product.specs ? JSON.parse(product.specs) : {}
    }));

    paginatedResponse(res, formattedProducts, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }, '获取成功');
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await db('products')
      .leftJoin('users as sellers', 'products.seller_id', 'sellers.id')
      .select(
        'products.*',
        'sellers.name as seller_name',
        'sellers.avatar_url as seller_avatar',
        'sellers.phone as seller_phone'
      )
      .where('products.id', id)
      .first();

    if (!product) {
      throw new NotFoundError('商品不存在');
    }

    const formattedProduct = {
      ...product,
      accessories: product.accessories ? JSON.parse(product.accessories) : [],
      specs: product.specs ? JSON.parse(product.specs) : {}
    };

    successResponse(res, formattedProduct, '获取成功');
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const {
      title,
      description,
      category = 'other',
      brand,
      model,
      serial_number_suffix,
      condition = 'good',
      accessories = [],
      specs = {},
      price,
      deposit_ratio = 0.3
    } = req.body;

    if (deposit_ratio < 0.1 || deposit_ratio > 0.5) {
      throw new ValidationError('订金比例必须在0.1到0.5之间');
    }

    const productId = uuidv4();

    await db('products').insert({
      id: productId,
      seller_id: sellerId,
      title,
      description,
      category,
      brand,
      model,
      serial_number_suffix,
      condition,
      accessories: JSON.stringify(accessories),
      specs: JSON.stringify(specs),
      price,
      deposit_ratio
    });

    const product = await db('products')
      .leftJoin('users as sellers', 'products.seller_id', 'sellers.id')
      .select(
        'products.*',
        'sellers.name as seller_name',
        'sellers.avatar_url as seller_avatar'
      )
      .where('products.id', productId)
      .first();

    const formattedProduct = {
      ...product,
      accessories: product.accessories ? JSON.parse(product.accessories) : [],
      specs: product.specs ? JSON.parse(product.specs) : {}
    };

    createdResponse(res, formattedProduct, '商品创建成功');
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      title,
      description,
      category,
      brand,
      model,
      serial_number_suffix,
      condition,
      accessories,
      specs,
      price,
      deposit_ratio,
      status
    } = req.body;

    const product = await db('products').where({ id }).first();
    if (!product) {
      throw new NotFoundError('商品不存在');
    }

    if (product.seller_id !== userId) {
      throw new AuthorizationError('您没有权限修改此商品');
    }

    if (product.status === 'sold') {
      throw new ValidationError('已售出的商品无法修改');
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model;
    if (serial_number_suffix !== undefined) updateData.serial_number_suffix = serial_number_suffix;
    if (condition !== undefined) updateData.condition = condition;
    if (accessories !== undefined) updateData.accessories = JSON.stringify(accessories);
    if (specs !== undefined) updateData.specs = JSON.stringify(specs);
    if (price !== undefined) updateData.price = price;
    if (deposit_ratio !== undefined) {
      if (deposit_ratio < 0.1 || deposit_ratio > 0.5) {
        throw new ValidationError('订金比例必须在0.1到0.5之间');
      }
      updateData.deposit_ratio = deposit_ratio;
    }
    if (status !== undefined) {
      if (!PRODUCT_STATUSES.includes(status)) {
        throw new ValidationError(`无效的商品状态: ${status}`);
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length > 0) {
      await db('products').where({ id }).update(updateData);
    }

    const updatedProduct = await db('products')
      .leftJoin('users as sellers', 'products.seller_id', 'sellers.id')
      .select(
        'products.*',
        'sellers.name as seller_name',
        'sellers.avatar_url as seller_avatar'
      )
      .where('products.id', id)
      .first();

    const formattedProduct = {
      ...updatedProduct,
      accessories: updatedProduct.accessories ? JSON.parse(updatedProduct.accessories) : [],
      specs: updatedProduct.specs ? JSON.parse(updatedProduct.specs) : {}
    };

    successResponse(res, formattedProduct, '商品更新成功');
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const product = await db('products').where({ id }).first();
    if (!product) {
      throw new NotFoundError('商品不存在');
    }

    if (product.seller_id !== userId) {
      throw new AuthorizationError('您没有权限删除此商品');
    }

    if (product.status === 'sold' || product.status === 'reserved') {
      throw new ValidationError('已售出或已预订的商品无法删除');
    }

    await db('products').where({ id }).update({ status: 'removed' });

    successResponse(res, null, '商品已删除');
  } catch (error) {
    next(error);
  }
};

const getMyProducts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = db('products')
      .select('*')
      .where('seller_id', userId);

    if (status) {
      query.where('status', status);
    }

    const countQuery = query.clone().clearSelect().count('id as count');
    const countResult = await countQuery.first();
    const total = parseInt(countResult.count);

    const offset = (page - 1) * limit;
    const products = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    const formattedProducts = products.map(product => ({
      ...product,
      accessories: product.accessories ? JSON.parse(product.accessories) : [],
      specs: product.specs ? JSON.parse(product.specs) : {}
    }));

    paginatedResponse(res, formattedProducts, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }, '获取成功');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES
};
