#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./cli");
const reader_1 = require("./reader");
const analyzer_1 = require("./analyzer");
const output_1 = require("./output");
async function main() {
    try {
        const options = (0, cli_1.parseArgs)();
        (0, cli_1.validateOptions)(options);
        const vehiclesResult = (0, reader_1.readVehicles)(options.vehicles);
        const fuelResult = (0, reader_1.readFuelRecords)(options.fuel);
        const mileageResult = (0, reader_1.readMileageRecords)(options.mileage);
        const driversResult = (0, reader_1.readDrivers)(options.drivers);
        const routesResult = (0, reader_1.readRoutes)(options.routes);
        const badRecords = [
            ...vehiclesResult.badRecords,
            ...fuelResult.badRecords,
            ...mileageResult.badRecords,
            ...driversResult.badRecords,
            ...routesResult.badRecords
        ];
        const result = (0, analyzer_1.analyzeData)({
            vehicles: vehiclesResult.data,
            fuelRecords: fuelResult.data,
            mileageRecords: mileageResult.data,
            drivers: driversResult.data,
            routes: routesResult.data,
            badRecords
        }, options);
        (0, output_1.printConsoleSummary)(result);
        (0, output_1.writeCsvResults)(result, options.output);
        (0, output_1.writeMarkdownReport)(result, options.output, options.output);
        console.log(`\n📁 输出文件已保存到: ${options.output}/`);
        const exitCode = result.summary.abnormalVehicles > 0 || result.summary.totalBadRecords > 0 ? 1 : 0;
        process.exit(exitCode);
    }
    catch (error) {
        if (error instanceof cli_1.ValidationError) {
            console.error(error.message);
        }
        else {
            console.error('\n❌ 程序执行出错:');
            console.error(error.message);
            console.error(error.stack);
        }
        process.exit(1);
    }
}
main();
