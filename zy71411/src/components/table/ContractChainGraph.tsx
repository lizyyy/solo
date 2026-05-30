import React, { useMemo } from 'react';
import { Tag, Button, Tooltip, Popover, Typography } from 'antd';
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  GitBranch,
  FileText,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { ForwardContract, RolloverApplication, LinkValidationResult } from '@/types';
import { STATUS_COLORS } from '@/utils/constants';
import {
  formatAmount,
  formatRate,
  formatDate,
  formatPoints,
} from '@/utils/formatters';
import StatusBadge from '@/components/common/StatusBadge';

const { Text, Paragraph } = Typography;

interface ContractChainProps {
  contracts: ForwardContract[];
  applications: RolloverApplication[];
  validationResults: LinkValidationResult[];
  selectedContractId?: string;
  onSelectContract?: (contract: ForwardContract) => void;
}

interface ChainNode {
  contract: ForwardContract;
  application?: RolloverApplication;
  validation?: LinkValidationResult;
}

const ContractChainGraph: React.FC<ContractChainProps> = ({
  contracts,
  applications,
  validationResults,
  selectedContractId,
  onSelectContract,
}) => {
  const [zoom, setZoom] = React.useState(1);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  const chains = useMemo(() => {
    const visited = new Set<string>();
    const result: ChainNode[][] = [];

    for (const contract of contracts) {
      if (visited.has(contract.id) || contract.rolloverTo) continue;

      const chain: ChainNode[] = [];
      let currentId: string | undefined = contract.id;

      while (currentId) {
        const current = contracts.find((c) => c.id === currentId);
        if (!current) break;

        const app = applications.find((a) => a.originalContractId === currentId);
        const validation = validationResults.find((v) => v.contractId === currentId);

        chain.unshift({
          contract: current,
          application: app,
          validation,
        });
        visited.add(currentId);

        currentId = current.rolloverFrom;
      }

      if (chain.length > 0) {
        result.push(chain);
      }
    }

    for (const contract of contracts) {
      if (visited.has(contract.id)) continue;

      result.push([
        {
          contract,
          application: applications.find((a) => a.originalContractId === contract.id),
          validation: validationResults.find((v) => v.contractId === contract.id),
        },
      ]);
    }

    return result;
  }, [contracts, applications, validationResults]);

  const toggleNode = (contractId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedNodes(newExpanded);
  };

  const getNodeStatus = (node: ChainNode) => {
    if (!node.validation) return 'info';
    if (node.validation.errors.some((e) => e.severity === 'error')) return 'error';
    if (node.validation.errors.some((e) => e.severity === 'warning')) return 'warning';
    return 'success';
  };

  const renderNode = (node: ChainNode, index: number, total: number) => {
    const status = getNodeStatus(node);
    const isExpanded = expandedNodes.has(node.contract.id);
    const isSelected = selectedContractId === node.contract.id;
    const color = STATUS_COLORS[status];

    const statusIcon =
      status === 'success' ? (
        <CheckCircle size={16} className="text-success" />
      ) : status === 'error' ? (
        <XCircle size={16} className="text-error" />
      ) : (
        <AlertTriangle size={16} className="text-warning" />
      );

    return (
      <React.Fragment key={node.contract.id}>
        <div
          className={`relative cursor-pointer transition-all duration-300 ${
            isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : ''
          }`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          onClick={() => onSelectContract?.(node.contract)}
        >
          <div
            className={`bg-white rounded-xl border-2 p-4 min-w-[280px] shadow-md hover:shadow-xl transition-all ${
              status === 'error'
                ? 'border-error hover:border-red-400'
                : status === 'warning'
                ? 'border-warning hover:border-amber-400'
                : 'border-success hover:border-green-400'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch size={16} style={{ color }} />
                  <span className="font-mono font-semibold text-sm text-gray-800">
                    {node.contract.contractNo}
                  </span>
                  {statusIcon}
                </div>
                <StatusBadge status={node.contract.status} />
              </div>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.contract.id);
                }}
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <Text type="secondary">币种对</Text>
                <Text strong>{node.contract.currencyPair}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">名义金额</Text>
                <Text strong className="font-mono">
                  {formatAmount(node.contract.notionalAmount)}
                </Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">远期汇率</Text>
                <Text strong className="font-mono">
                  {formatRate(node.contract.forwardRate)}
                </Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">到期日</Text>
                <Text>{formatDate(node.contract.valueDate)}</Text>
              </div>
            </div>

            {node.application && (
              <div
                className={`mt-3 pt-3 border-t ${
                  node.application.hasSupplementalData
                    ? 'border-success/30 bg-green-50/50 -mx-4 -mb-4 p-3 rounded-b-xl'
                    : 'border-warning/30 bg-amber-50/50 -mx-4 -mb-4 p-3 rounded-b-xl'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={12} className="text-primary-600" />
                  <span className="text-xs font-medium text-gray-600">
                    {node.application.applicationNo}
                  </span>
                  <Tag
                    color={node.application.hasSupplementalData ? 'green' : 'orange'}
                    className="m-0 text-[10px]"
                  >
                    {node.application.hasSupplementalData ? '材料齐全' : '待补录'}
                  </Tag>
                </div>

                {isExpanded && (
                  <div className="space-y-1 text-xs mt-2">
                    <div className="flex justify-between">
                      <Text type="secondary">展期点数</Text>
                      <Text
                        className={`font-mono ${
                          node.application.pointsDirection === 'premium'
                            ? 'text-success'
                            : 'text-warning'
                        }`}
                      >
                        {formatPoints(node.application.rolloverPoints)}
                      </Text>
                    </div>
                    {node.application.spotRate > 0 && (
                      <div className="flex justify-between">
                        <Text type="secondary">即期汇率</Text>
                        <Text className="font-mono">
                          {formatRate(node.application.spotRate)}
                        </Text>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <Text type="secondary">申请材料</Text>
                      <Text className="truncate max-w-[140px]">
                        {node.application.applicationMaterial}
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isExpanded && node.validation && node.validation.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-2">校验问题：</div>
                {node.validation.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded mb-1 ${
                      err.severity === 'error'
                        ? 'bg-red-50 text-error'
                        : 'bg-amber-50 text-warning'
                    }`}
                  >
                    <AlertTriangle size={10} className="inline mr-1" />
                    {err.errorMessage}
                  </div>
                ))}
              </div>
            )}
          </div>

          {node.validation && (
            <Popover
              title={
                <div className="flex items-center gap-2">
                  {statusIcon}
                  <span className="font-semibold">校验影响分析</span>
                </div>
              }
              content={
                <div className="w-72">
                  <Paragraph className="mb-2 text-sm">
                    本节点校验对最终结果的影响权重：
                    <Text strong className="text-lg text-primary-600 ml-1">
                      {node.validation.errors.length > 0
                        ? node.validation.errors.reduce(
                            (sum, e) => sum + e.impactOnResult,
                            0
                          )
                        : 0}
                      %
                    </Text>
                  </Paragraph>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <Text type="secondary">链路完整性</Text>
                        <Text strong={node.validation.isComplete}>
                          {node.validation.isComplete ? '通过' : '未通过'}
                        </Text>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            node.validation.isComplete ? 'bg-success' : 'bg-error'
                          }`}
                          style={{
                            width: node.validation.isComplete ? '100%' : '30%',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <Text type="secondary">金额覆盖性</Text>
                        <Text strong={!node.validation.hasCoverageGap}>
                          {node.validation.hasCoverageGap ? '存在缺口' : '完全覆盖'}
                        </Text>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            !node.validation.hasCoverageGap ? 'bg-success' : 'bg-error'
                          }`}
                          style={{
                            width: !node.validation.hasCoverageGap
                              ? '100%'
                              : node.validation.coverageGapAmount
                              ? `${Math.max(
                                  0,
                                  100 -
                                    (node.validation.coverageGapAmount /
                                      (node.contract.notionalAmount || 1)) *
                                      100
                                )}%`
                              : '50%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              }
              trigger="hover"
            >
              <div
                className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center cursor-help ${
                  status === 'success'
                    ? 'bg-success'
                    : status === 'error'
                    ? 'bg-error'
                    : 'bg-warning'
                }`}
              >
                {status === 'success' ? (
                  <CheckCircle size={14} className="text-white" />
                ) : status === 'error' ? (
                  <XCircle size={14} className="text-white" />
                ) : (
                  <AlertTriangle size={14} className="text-white" />
                )}
              </div>
            </Popover>
          )}
        </div>

        {index < total - 1 && (
          <div className="flex items-center px-2">
            <ArrowRight size={24} className="text-gray-300" strokeWidth={1.5} />
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full overflow-auto">
      <div className="flex justify-end gap-2 mb-4">
        <Tooltip title="缩小">
          <Button
            type="text"
            size="small"
            icon={<ZoomOut size={16} />}
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          />
        </Tooltip>
        <Tooltip title="放大">
          <Button
            type="text"
            size="small"
            icon={<ZoomIn size={16} />}
            onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
          />
        </Tooltip>
        <Tooltip title="重置">
          <Button
            type="text"
            size="small"
            icon={<Maximize2 size={16} />}
            onClick={() => setZoom(1)}
          />
        </Tooltip>
      </div>

      <div className="space-y-8">
        {chains.map((chain, chainIdx) => (
          <div key={chainIdx}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">链路 #{chainIdx + 1}</span>
              <Tag color={chain.length > 1 ? 'blue' : 'default'}>
                {chain.length} 个合约
              </Tag>
              {chain.length > 1 && (
                <Tag color="green">完整展期链路</Tag>
              )}
            </div>
            <div className="flex items-start overflow-x-auto pb-4">
              {chain.map((node, idx) => renderNode(node, idx, chain.length))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractChainGraph;
