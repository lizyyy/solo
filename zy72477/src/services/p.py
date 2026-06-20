import sys

L = []
def a(s):
    L.append(s)

a("import { workflowDao } from '../dao/workflowDao';")
a("import { redLineDao } from '../dao/redLineDao';")
a("import { inspectorDao } from '../dao/inspectorDao';")
a("import { shelterDao } from '../dao/shelterDao';")
a("import { changeHistoryDao } from '../dao/changeHistoryDao';")
a("import { capacityCheckDao } from '../dao/capacityCheckDao';")
a("import { capacityCheckService } from './capacityCheckService';")
a("import { WorkflowRecord, WorkflowStep, RedLineMap, GridInspectorReport, CapacityCheckResult } from '../types';")
a("import { generateBatchNo, generateReportNo } from '../utils/common';")
a("")

with open('/Users/lzy/pro/solo/workspaces/zy72477/src/services/workflowService.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(L) + '\n')
print('ok', len(L))
