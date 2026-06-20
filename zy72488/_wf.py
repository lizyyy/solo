import base64
import sys

# Part 1 - imports
data = []
data.append("import { useState, useMemo } from 'react';")
data.append("import {")
data.append("  Bus, FileText, CheckCircle, AlertTriangle, Database, FileCheck,")
data.append("  Layers, Hash, MapPin, User, Clock, ChevronRight, CheckSquare,")
data.append("  ArrowRight, Search,")
data.append("} from 'lucide-react';")
data.append("import { useStore } from '@/store/useStore';")
data.append("import StatusBadge from '@/components/StatusBadge';")
data.append("import { cn } from '@/lib/utils';")
data.append("import type { Workflow as WorkflowType, Point } from '@/types';")
data.append("")
data.append("const statusLabels: Record<string, string> = {")
data.append("  normal: '正常', pending: '待处理', conflict: '有冲突',")
data.append("  'pending-review': '待复核', 'not-needed': '无需复核',")
data.append("  approved: '已通过', rejected: '已驳回',")
data.append("};")
data.append("")
data.append("console.log('Lines:', len(data))")

with open('/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Workflow.tsx', 'w') as f:
    f.write('\n'.join(data) + '\n')
print('OK')
