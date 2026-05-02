import type { StabilityRules, ParsingError } from '@/types';

export async function parseRulesYaml(content: string): Promise<{ rules: StabilityRules; errors: ParsingError[] }> {
  const errors: ParsingError[] = [];
  
  const lines = content.trim().split('\n');
  const rules: StabilityRules = {
    maxTotalWeight: 0,
    maxDeckWeight: 0,
    maxCargoHoldWeight: 0,
    balanceLimits: {
      maxPortStarboardDifference: 0,
      maxForeAftDifference: 0,
    },
    dangerousGoods: {
      isolationDistance: 0,
      incompatibleClasses: {},
    },
  };

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (!value) {
      currentSection = key;
      continue;
    }

    const numValue = parseFloat(value);

    if (currentSection === '') {
      if (key === 'maxTotalWeight') {
        if (!isNaN(numValue)) rules.maxTotalWeight = numValue;
        else errors.push({ field: 'maxTotalWeight', message: 'Invalid number', rowIndex: i });
      } else if (key === 'maxDeckWeight') {
        if (!isNaN(numValue)) rules.maxDeckWeight = numValue;
        else errors.push({ field: 'maxDeckWeight', message: 'Invalid number', rowIndex: i });
      } else if (key === 'maxCargoHoldWeight') {
        if (!isNaN(numValue)) rules.maxCargoHoldWeight = numValue;
        else errors.push({ field: 'maxCargoHoldWeight', message: 'Invalid number', rowIndex: i });
      }
    } else if (currentSection === 'balanceLimits') {
      if (key === 'maxPortStarboardDifference') {
        if (!isNaN(numValue)) rules.balanceLimits.maxPortStarboardDifference = numValue;
        else errors.push({ field: 'maxPortStarboardDifference', message: 'Invalid number', rowIndex: i });
      } else if (key === 'maxForeAftDifference') {
        if (!isNaN(numValue)) rules.balanceLimits.maxForeAftDifference = numValue;
        else errors.push({ field: 'maxForeAftDifference', message: 'Invalid number', rowIndex: i });
      }
    } else if (currentSection === 'dangerousGoods') {
      if (key === 'isolationDistance') {
        if (!isNaN(numValue)) rules.dangerousGoods.isolationDistance = numValue;
        else errors.push({ field: 'isolationDistance', message: 'Invalid number', rowIndex: i });
      } else if (value) {
        const classes = value.split(',').map(c => c.trim());
        rules.dangerousGoods.incompatibleClasses[key] = classes;
      }
    }
  }

  const requiredValues = [
    { field: 'maxTotalWeight', value: rules.maxTotalWeight },
    { field: 'maxDeckWeight', value: rules.maxDeckWeight },
    { field: 'maxCargoHoldWeight', value: rules.maxCargoHoldWeight },
    { field: 'maxPortStarboardDifference', value: rules.balanceLimits.maxPortStarboardDifference },
    { field: 'maxForeAftDifference', value: rules.balanceLimits.maxForeAftDifference },
    { field: 'isolationDistance', value: rules.dangerousGoods.isolationDistance },
  ];

  for (const { field, value } of requiredValues) {
    if (value <= 0) {
      errors.push({ field, message: 'Must be a positive number' });
    }
  }

  return { rules, errors };
}