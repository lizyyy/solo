"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function main() {
    try {
        const db = await (0, index_1.initDatabase)();
        await (0, index_1.initializeSchema)(db);
        console.log('Database initialization completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}
main();
