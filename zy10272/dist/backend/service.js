"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.updateOrderInfo = updateOrderInfo;
exports.callOrder = callOrder;
exports.callNextOrder = callNextOrder;
exports.topupOrder = topupOrder;
exports.refundOrder = refundOrder;
exports.completeOrder = completeOrder;
exports.getAllOrders = getAllOrders;
exports.getOrder = getOrder;
exports.getActiveOrdersList = getActiveOrdersList;
exports.getQueueOrdersList = getQueueOrdersList;
exports.saveUploadedFile = saveUploadedFile;
const uuid_1 = require("uuid");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("../types");
const storage_1 = require("./storage");
function calculatePrice(paperType, printSide, pageCount, copies) {
    const pricePerPage = types_1.PRICE_CONFIG[paperType][printSide];
    const totalPages = pageCount * copies;
    const totalAmount = totalPages * pricePerPage;
    return { pricePerPage, totalPages, totalAmount };
}
function calculateBalance(totalAmount, prepaidAmount) {
    return Math.round((prepaidAmount - totalAmount) * 100) / 100;
}
function determineStatus(totalAmount, prepaidAmount) {
    const balance = calculateBalance(totalAmount, prepaidAmount);
    if (balance >= 0) {
        return types_1.OrderStatus.PAID;
    }
    else {
        return types_1.OrderStatus.NEEDS_TOPUP;
    }
}
function createOrder(request) {
    if (request.idempotencyKey) {
        const existingOrder = (0, storage_1.getOrderByIdempotencyKey)(request.idempotencyKey);
        if (existingOrder) {
            return existingOrder;
        }
    }
    if (!request.customerName?.trim()) {
        throw new Error('客户姓名不能为空');
    }
    if (request.pageCount < 1) {
        throw new Error('页数必须大于0');
    }
    if (request.copies < 1) {
        throw new Error('份数必须大于0');
    }
    if (request.prepaidAmount < 0) {
        throw new Error('预付金额不能为负数');
    }
    let file;
    if (request.fileId) {
        file = (0, storage_1.getFileById)(request.fileId);
    }
    const { pricePerPage, totalPages, totalAmount } = calculatePrice(request.paperType, request.printSide, request.pageCount, request.copies);
    const balance = calculateBalance(totalAmount, request.prepaidAmount);
    const status = determineStatus(totalAmount, request.prepaidAmount);
    const now = new Date();
    const order = {
        id: (0, uuid_1.v4)(),
        orderNumber: (0, storage_1.getNextOrderNumber)(),
        customerName: request.customerName.trim(),
        paperType: request.paperType,
        printSide: request.printSide,
        pageCount: request.pageCount,
        copies: request.copies,
        totalPages,
        pricePerPage,
        totalAmount,
        prepaidAmount: request.prepaidAmount,
        balance,
        status,
        idempotencyKey: request.idempotencyKey,
        file,
        createdAt: now,
        updatedAt: now
    };
    (0, storage_1.addOrder)(order);
    return order;
}
function updateOrderInfo(id, request) {
    const order = (0, storage_1.getOrderById)(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.status === types_1.OrderStatus.COMPLETED || order.status === types_1.OrderStatus.REFUNDED) {
        throw new Error('已完成或已退款的订单不能修改');
    }
    const paperType = request.paperType || order.paperType;
    const printSide = request.printSide || order.printSide;
    const pageCount = request.pageCount !== undefined ? request.pageCount : order.pageCount;
    const copies = request.copies !== undefined ? request.copies : order.copies;
    const prepaidAmount = request.prepaidAmount !== undefined ? request.prepaidAmount : order.prepaidAmount;
    if (pageCount < 1) {
        throw new Error('页数必须大于0');
    }
    if (copies < 1) {
        throw new Error('份数必须大于0');
    }
    if (prepaidAmount < 0) {
        throw new Error('预付金额不能为负数');
    }
    const { pricePerPage, totalPages, totalAmount } = calculatePrice(paperType, printSide, pageCount, copies);
    const balance = calculateBalance(totalAmount, prepaidAmount);
    let status = order.status;
    if (status !== types_1.OrderStatus.CALLED) {
        status = determineStatus(totalAmount, prepaidAmount);
    }
    const updatedOrder = {
        ...order,
        paperType,
        printSide,
        pageCount,
        copies,
        totalPages,
        pricePerPage,
        totalAmount,
        prepaidAmount,
        balance,
        status,
        updatedAt: new Date()
    };
    (0, storage_1.updateOrder)(updatedOrder);
    return updatedOrder;
}
function callOrder(id) {
    const order = (0, storage_1.getOrderById)(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.status === types_1.OrderStatus.COMPLETED || order.status === types_1.OrderStatus.REFUNDED) {
        throw new Error('订单已完成或已退款，不能叫号');
    }
    if (order.status === types_1.OrderStatus.CALLED) {
        throw new Error('该订单已叫号');
    }
    const updatedOrder = {
        ...order,
        status: types_1.OrderStatus.CALLED,
        calledAt: new Date(),
        updatedAt: new Date()
    };
    (0, storage_1.updateOrder)(updatedOrder);
    return updatedOrder;
}
function callNextOrder() {
    const queue = (0, storage_1.getQueueOrders)();
    if (queue.length === 0) {
        return null;
    }
    const nextOrder = queue[0];
    return callOrder(nextOrder.id);
}
function topupOrder(id, amount) {
    const order = (0, storage_1.getOrderById)(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.status === types_1.OrderStatus.COMPLETED || order.status === types_1.OrderStatus.REFUNDED) {
        throw new Error('订单已完成或已退款');
    }
    if (amount <= 0) {
        throw new Error('补差金额必须大于0');
    }
    const newPrepaidAmount = Math.round((order.prepaidAmount + amount) * 100) / 100;
    const newBalance = calculateBalance(order.totalAmount, newPrepaidAmount);
    let status = order.status;
    if (newBalance >= 0 && status === types_1.OrderStatus.NEEDS_TOPUP) {
        status = types_1.OrderStatus.PAID;
    }
    const updatedOrder = {
        ...order,
        prepaidAmount: newPrepaidAmount,
        balance: newBalance,
        status,
        updatedAt: new Date()
    };
    (0, storage_1.updateOrder)(updatedOrder);
    return updatedOrder;
}
function refundOrder(id) {
    const order = (0, storage_1.getOrderById)(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.status === types_1.OrderStatus.REFUNDED) {
        throw new Error('该订单已退款');
    }
    if (order.status === types_1.OrderStatus.COMPLETED) {
        throw new Error('已完成订单不能退款');
    }
    const updatedOrder = {
        ...order,
        status: types_1.OrderStatus.REFUNDED,
        updatedAt: new Date()
    };
    (0, storage_1.updateOrder)(updatedOrder);
    return updatedOrder;
}
function completeOrder(id) {
    const order = (0, storage_1.getOrderById)(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.status === types_1.OrderStatus.COMPLETED) {
        throw new Error('该订单已完成');
    }
    if (order.status === types_1.OrderStatus.REFUNDED) {
        throw new Error('已退款订单不能完成');
    }
    if (order.balance < 0) {
        throw new Error('请先完成补差后再确认完成');
    }
    const updatedOrder = {
        ...order,
        status: types_1.OrderStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date()
    };
    (0, storage_1.updateOrder)(updatedOrder);
    return updatedOrder;
}
function getAllOrders() {
    return (0, storage_1.getOrders)();
}
function getOrder(id) {
    return (0, storage_1.getOrderById)(id);
}
function getActiveOrdersList() {
    return (0, storage_1.getActiveOrders)();
}
function getQueueOrdersList() {
    return (0, storage_1.getQueueOrders)();
}
function saveUploadedFile(originalName, fileSize, mimeType, tempPath) {
    const fileId = (0, uuid_1.v4)();
    const ext = path.extname(originalName) || '.bin';
    const storedName = `${fileId}${ext}`;
    const storedPath = path.join((0, storage_1.getUploadsDir)(), storedName);
    fs.renameSync(tempPath, storedPath);
    const fileInfo = {
        id: fileId,
        fileName: originalName,
        fileSize,
        fileType: mimeType,
        storedPath
    };
    (0, storage_1.addFile)(fileInfo);
    return { fileId, fileName: originalName };
}
