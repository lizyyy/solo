"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./lib/prisma"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
async function main() {
    try {
        await prisma_1.default.$connect();
        console.log('Database connected successfully');
        app_1.default.listen(PORT, () => {
            console.log(`Error Budget API server running on http://localhost:${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
main();
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await prisma_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await prisma_1.default.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map