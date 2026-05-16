#!/usr/bin/env node

import { Command } from "commander";
import { Validator } from "./validator";
import { Reporter } from "./reporter";

const program = new Command();

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
      const validator = new Validator(options);
      const result = await validator.run();

      const reporter = new Reporter();
      reporter.generate(result, options.output);

      if (options.failOnError && result.summary.errors > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
