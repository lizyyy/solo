import * as dayjs from 'dayjs';
import { RuleParser } from './rule-parser';
import { ObjectParser } from './object-parser';
import { SimulationResult, CliOptions } from '../types';

export class LifecycleSimulator {
  private ruleParser: RuleParser;
  private objectParser: ObjectParser;

  constructor() {
    this.ruleParser = new RuleParser();
    this.objectParser = new ObjectParser();
  }

  run(options: CliOptions): SimulationResult {
    const simulationDate = options.simulationDate
      ? dayjs(options.simulationDate).toDate()
      : new Date();

    if (isNaN(simulationDate.getTime())) {
      throw new Error(`无效的预演日期格式: ${options.simulationDate}`);
    }

    const rules = this.ruleParser.loadRulesFromFile(options.rules);
    const { objects, badRows } = this.objectParser.parseDirectory(options.input);

    const matches = objects.map(obj => 
      this.ruleParser.matchObject(obj, simulationDate)
    );

    const matchedObjects = matches.filter(m => m.matchedRules.length > 0);
    const objectsToDelete = matches.filter(m => m.willBeDeleted);
    const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
    const sizeToDelete = objectsToDelete.reduce((sum, m) => sum + m.object.size, 0);

    return {
      summary: {
        totalObjects: objects.length,
        matchedObjects: matchedObjects.length,
        objectsToDelete: objectsToDelete.length,
        totalSize,
        sizeToDelete,
        badRows: badRows.length,
      },
      matches,
      badRows,
      rules,
      simulationDate,
    };
  }

  getRuleParser(): RuleParser {
    return this.ruleParser;
  }

  getObjectParser(): ObjectParser {
    return this.objectParser;
  }
}
