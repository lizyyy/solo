import React, { useState } from 'react';
import { Card, Tag, Space, Button, Drawer, Descriptions, Divider } from 'antd';
import {
  GitBranch,
  AlertCircle,
  ArrowRight,
  ZoomIn,
} from 'lucide-react';
import { useContractStore, useValidationStore } from '@/store';
import ContractChainGraph from '@/components/table/ContractChainGraph';
import StatusBadge from '@/components/common/StatusBadge';
import ValidationPanel from '@/components/common/ValidationPanel';
import { ForwardContract, RolloverApplication } from '@/types';
import {
  formatAmount,
  formatRate,
  formatDate,
  formatPoints,
} from '@/utils/formatters';

const ContractLink: React.FC = () => {
  const { contracts, rolloverApps } = useContractStore();
  const { linkValidation, getErrorsByType, loading: validationLoading } =
    useValidationStore();

  const [selectedContract, setSelectedContract] = useState<ForwardContract | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const linkErrors = getErrorsByType('link');

  const handleSelectContract = (contract: ForwardContract) => {
    setSelectedContract(contract);
    setDrawerVisible(true);
  };

  const getRelatedApplication = (contractId: string): RolloverApplication | undefined => {
    return rolloverApps.find(
      (a) => a.originalContractId === contractId || a.newContractId === contractId
    );
  };

  const getChain = (contractId: string): ForwardContract[] => {
    const chain: ForwardContract[] = [];
    let currentId: string | undefined = contractId;

    while (currentId) {
      const current = contracts.find((c) => c.id === currentId);
      if (!current) break;
      chain.unshift(current);
      currentId = current.rolloverFrom;
    }

    currentId = chain[chain.length - 1]?.rolloverTo;
    while (currentId) {
      const current = contracts.find((c) => c.id === currentId);
      if (!current) break;
      chain.push(current);
      currentId = current.rolloverTo;
    }

    return chain;
  };

  const stats = {
    totalChains: linkValidation.length,
    completeChains: linkValidation.filter((r) => r.isComplete).length,
    coverageIssues: linkValidation.filter((r) => r.hasCoverageGap).length,
    errorCount: linkErrors.filter((e) => e.severity === 'error').length,
    warningCount: linkErrors.filter((e) => e.severity === 'warning').length,
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <GitBranch size={20} className="text-primary-700" />
            <span className="font-semibold">合约链路总览</span>
          </div>
        }
        className="shadow-sm"
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-primary-700">{stats.totalChains}</div>
            <div className="text-sm text-gray-600">链路总数</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-success">{stats.completeChains}</div>
            <div className="text-sm text-gray-600">完整链路</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-warning">{stats.coverageIssues}</div>
            <div className="text-sm text-gray-600">覆盖缺口</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-error">{stats.errorCount}</div>
            <div className="text-sm text-gray-600">错误数</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-warning">{stats.warningCount}</div>
            <div className="text-sm text-gray-600">警告数</div>
          </div>
        </div>

        <ContractChainGraph
          contracts={contracts}
          applications={rolloverApps}
          validationResults={linkValidation}
          selectedContractId={selectedContract?.id}
          onSelectContract={handleSelectContract}
        />
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-warning" />
            <span className="font-semibold">链路图例说明</span>
          </div>
        }
        size="small"
        className="shadow-sm"
      >
        <div className="flex flex-wrap gap-6 text-sm">
          <Space>
            <div className="w-4 h-4 rounded bg-success" />
            <span>校验通过</span>
          </Space>
          <Space>
            <div className="w-4 h-4 rounded bg-warning" />
            <span>存在警告</span>
          </Space>
          <Space>
            <div className="w-4 h-4 rounded bg-error" />
            <span>存在错误</span>
          </Space>
          <Space>
            <Tag color="green">材料齐全</Tag>
            <span>后补材料已完整</span>
          </Space>
          <Space>
            <Tag color="orange">待补录</Tag>
            <span>即期汇率等材料待补</span>
          </Space>
        </div>
      </Card>

      <ValidationPanel errors={linkErrors} loading={validationLoading} />

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <ZoomIn size={18} />
            合约链路详情
          </div>
        }
        placement="right"
        width={600}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Button type="primary" size="small">
            导出链路
          </Button>
        }
      >
        {selectedContract && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <GitBranch size={20} className="text-primary-700" />
              </div>
              <div>
                <div className="font-semibold text-lg">{selectedContract.contractNo}</div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedContract.status} />
                  {selectedContract.isManuallyModified && (
                    <Tag color="orange">人工修正</Tag>
                  )}
                </div>
              </div>
            </div>

            <Descriptions
              title="合约基本信息"
              bordered
              column={1}
              size="small"
            >
              <Descriptions.Item label="币种对">
                {selectedContract.currencyPair}
              </Descriptions.Item>
              <Descriptions.Item label="名义金额">
                <span className="font-mono">
                  {formatAmount(selectedContract.notionalAmount)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="远期汇率">
                <span className="font-mono">
                  {formatRate(selectedContract.forwardRate)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="交易对手">
                {selectedContract.counterparty}
              </Descriptions.Item>
              <Descriptions.Item label="交易日">
                {formatDate(selectedContract.tradeDate)}
              </Descriptions.Item>
              <Descriptions.Item label="到期日">
                {formatDate(selectedContract.valueDate)}
              </Descriptions.Item>
            </Descriptions>

            {getRelatedApplication(selectedContract.id) && (
              <>
                <Divider orientation="left">展期申请信息</Divider>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="申请编号">
                    {getRelatedApplication(selectedContract.id)?.applicationNo}
                  </Descriptions.Item>
                  <Descriptions.Item label="展期点数">
                    <span
                      className={`font-mono font-semibold ${
                        getRelatedApplication(selectedContract.id)?.pointsDirection ===
                        'premium'
                          ? 'text-success'
                          : 'text-warning'
                      }`}
                    >
                      {formatPoints(
                        getRelatedApplication(selectedContract.id)?.rolloverPoints || 0
                      )}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="即期汇率">
                    {getRelatedApplication(selectedContract.id)?.spotRate ? (
                      <span className="font-mono">
                        {formatRate(
                          getRelatedApplication(selectedContract.id)?.spotRate || 0
                        )}
                      </span>
                    ) : (
                      <Tag color="orange">待补录</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="申请材料">
                    {getRelatedApplication(selectedContract.id)?.applicationMaterial}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            <Divider orientation="left">完整链路</Divider>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {getChain(selectedContract.id).map((c, idx) => (
                <React.Fragment key={c.id}>
                  <div
                    className={`p-3 rounded-lg border min-w-[150px] ${
                      c.id === selectedContract.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="font-mono text-xs font-medium">{c.contractNo}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatAmount(c.notionalAmount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(c.valueDate)}
                    </div>
                  </div>
                  {idx < getChain(selectedContract.id).length - 1 && (
                    <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <Divider orientation="left">影响分析</Divider>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-700 mb-2">
                本合约在链路中的影响权重：
                <span className="text-xl font-bold text-primary-700 ml-2">
                  {linkValidation.find((v) => v.contractId === selectedContract.id)?.errors.reduce(
                    (sum, e) => sum + e.impactOnResult,
                    0
                  ) || 0}
                  %
                </span>
              </div>
              <div className="text-xs text-gray-600">
                权重分配：链路完整性 30% + 覆盖性 25%
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ContractLink;
