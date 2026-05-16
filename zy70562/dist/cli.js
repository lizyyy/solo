#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const validator_1 = require("./validator");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name("prom-rule-linter")
    .description("Prometheus Rule Lint CLI")
    .version("1.0.0");
program
    .option("-i, --input <path>", "Input path to Prometheus rules", ".")
    .option("-o, --output <path>", "Output directory for reports")
    .option("-v, --verbose", "Verbose output")
    .option("--fail-on-error", "Exit with non-zero code on errors")
    .action(async (options) => {
    try {
        const validator = new validator_1.Validator(options);
        const result = await validator.run();
        const reporter = new reporter_1.Reporter();
        reporter.generate(result, options.output);
        if (options.failOnError && result.summary.errors > 0) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
});
program.parseAsync(process.argv);
