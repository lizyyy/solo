"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_CONFIG = exports.OrderStatus = exports.PrintSide = exports.PaperType = void 0;
var PaperType;
(function (PaperType) {
    PaperType["A4"] = "A4";
    PaperType["A3"] = "A3";
    PaperType["B5"] = "B5";
})(PaperType || (exports.PaperType = PaperType = {}));
var PrintSide;
(function (PrintSide) {
    PrintSide["SINGLE"] = "single";
    PrintSide["DOUBLE"] = "double";
})(PrintSide || (exports.PrintSide = PrintSide = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "pending";
    OrderStatus["PAID"] = "paid";
    OrderStatus["CALLED"] = "called";
    OrderStatus["NEEDS_TOPUP"] = "needs_topup";
    OrderStatus["COMPLETED"] = "completed";
    OrderStatus["REFUNDED"] = "refunded";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
exports.PRICE_CONFIG = {
    [PaperType.A4]: { single: 0.2, double: 0.3 },
    [PaperType.A3]: { single: 0.5, double: 0.8 },
    [PaperType.B5]: { single: 0.15, double: 0.25 }
};
