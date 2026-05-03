import { ParsedData, VariableAxisIssue, RuleResult } from '../types';

interface AxisRequest {
  fontName: string;
  axisTag: string;
  requestedValue: number;
}

export function checkVariableAxisRanges(
  data: ParsedData,
  axisRequests?: AxisRequest[]
): RuleResult<VariableAxisIssue> {
  const issues: VariableAxisIssue[] = [];
  const defaultRequests = generateDefaultAxisRequests(data);
  const allRequests = axisRequests ? [...defaultRequests, ...axisRequests] : defaultRequests;

  for (const request of allRequests) {
    const font = data.fonts.get(request.fontName);
    if (!font) continue;

    if (!font.isVariable || !font.variableAxes) continue;

    const axis = font.variableAxes.find(a => a.tag === request.axisTag);
    if (!axis) continue;

    const { requestedValue, fontName, axisTag } = request;
    const { min, max, name } = axis;

    if (requestedValue < min) {
      issues.push({
        fontName,
        axisTag,
        axisName: name,
        requestedValue,
        minValue: min,
        maxValue: max,
        issueType: 'underflow'
      });
    } else if (requestedValue > max) {
      issues.push({
        fontName,
        axisTag,
        axisName: name,
        requestedValue,
        minValue: min,
        maxValue: max,
        issueType: 'overflow'
      });
    }
  }

  return {
    name: 'Variable Font Axis Range Check',
    description: '检查变量字体轴的请求值是否在有效范围内',
    passed: issues.length === 0,
    issues
  };
}

function generateDefaultAxisRequests(data: ParsedData): AxisRequest[] {
  const requests: AxisRequest[] = [];

  for (const [fontName, font] of data.fonts) {
    if (!font.isVariable || !font.variableAxes) continue;

    for (const axis of font.variableAxes) {
      requests.push({
        fontName,
        axisTag: axis.tag,
        requestedValue: axis.default
      });

      if (axis.tag === 'wght') {
        const commonWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        for (const weight of commonWeights) {
          if (weight !== axis.default) {
            requests.push({
              fontName,
              axisTag: 'wght',
              requestedValue: weight
            });
          }
        }
      }

      if (axis.tag === 'wdth') {
        const commonWidths = [50, 75, 100, 125, 150];
        for (const width of commonWidths) {
          if (width !== axis.default) {
            requests.push({
              fontName,
              axisTag: 'wdth',
              requestedValue: width
            });
          }
        }
      }

      if (axis.tag === 'ital' || axis.tag === 'slnt') {
        const commonValues = [0, 1, 15];
        for (const val of commonValues) {
          if (val !== axis.default) {
            requests.push({
              fontName,
              axisTag: axis.tag,
              requestedValue: val
            });
          }
        }
      }
    }
  }

  return requests;
}
