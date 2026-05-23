#!/usr/bin/env node

import { parseArgs, validateOptions, ValidationError } from './cli';
import { readVehicles, readFuelRecords, readMileageRecords, readDrivers, readRoutes } from './reader';
import { analyzeData } from './analyzer';
import { printConsoleSummary, writeCsvResults, writeMarkdownReport } from './output';

async function main() {
  try {
    const options = parseArgs();
    validateOptions(options);

    const vehiclesResult = readVehicles(options.vehicles);
    const fuelResult = readFuelRecords(options.fuel);
    const mileageResult = readMileageRecords(options.mileage);
    const driversResult = readDrivers(options.drivers);
    const routesResult = readRoutes(options.routes);

    const badRecords = [
      ...vehiclesResult.badRecords,
      ...fuelResult.badRecords,
      ...mileageResult.badRecords,
      ...driversResult.badRecords,
      ...routesResult.badRecords
    ];

    const result = analyzeData({
      vehicles: vehiclesResult.data,
      fuelRecords: fuelResult.data,
      mileageRecords: mileageResult.data,
      drivers: driversResult.data,
      routes: routesResult.data,
      badRecords
    }, options);

    printConsoleSummary(result);
    writeCsvResults(result, options.output);
    writeMarkdownReport(result, options.output, options.output);

    console.log(`\n📁 输出文件已保存到: ${options.output}/`);

    const exitCode = result.summary.abnormalVehicles > 0 || result.summary.totalBadRecords > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(error.message);
    } else {
      console.error('\n❌ 程序执行出错:');
      console.error((error as Error).message);
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

main();
