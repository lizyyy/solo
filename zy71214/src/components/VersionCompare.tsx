import { useState } from 'react';
import { BusinessObject, Contract, Invoice, RemittanceApplication } from '@/types';
import { X, ArrowLeftRight, FileText } from 'lucide-react';

interface VersionCompareProps {
  business: BusinessObject;
  onClose?: () => void;
  version1?: number;
  version2?: number;
}

export const VersionCompare = ({ business, onClose, version1, version2 }: VersionCompareProps) => {
  const versions = Array.from({ length: business.currentVersion }, (_, i) => i + 1);
  const [leftVersion, setLeftVersion] = useState(version1 || 1);
  const [rightVersion, setRightVersion] = useState(version2 || business.currentVersion);
  const [docType, setDocType] = useState<'contract' | 'invoice' | 'application'>('contract');

  const getDocumentByVersion = (
    version: number
  ): Contract | Invoice | RemittanceApplication | undefined => {
    if (docType === 'contract') {
      return business.contracts.find((c) => c.version === version);
    } else if (docType === 'invoice') {
      return business.invoices.find((i) => i.version === version);
    } else {
      return business.applications.find((a) => a.version === version);
    }
  };

  const leftDoc = getDocumentByVersion(leftVersion);
  const rightDoc = getDocumentByVersion(rightVersion);

  const renderDocFields = (doc: Contract | Invoice | RemittanceApplication | undefined) => {
    if (!doc) {
      return (
        <div className="text-center py-12 text-slate-400">
          <FileText size={48} className="mx-auto mb-3 opacity-50" />
          <p>该版本无此类型文档</p>
        </div>
      );
    }

    const fields: { label: string; value: string | number }[] = [];

    if ('contractNo' in doc) {
      fields.push({ label: '合同编号', value: doc.contractNo });
      fields.push({ label: '合同日期', value: doc.contractDate });
      fields.push({ label: '货物描述', value: doc.goodsDescription });
      fields.push({ label: '甲方', value: doc.signatoryA });
      fields.push({ label: '乙方', value: doc.signatoryB });
    } else if ('invoiceNo' in doc) {
      fields.push({ label: '发票编号', value: doc.invoiceNo });
      fields.push({ label: '发票日期', value: doc.invoiceDate });
      fields.push({ label: '货物描述', value: doc.goodsDescription });
      fields.push({ label: '卖方', value: doc.sellerName });
      fields.push({ label: '买方', value: doc.buyerName });
    } else {
      fields.push({ label: '收款人', value: doc.payeeName });
      fields.push({ label: '收款银行', value: doc.payeeBank });
      fields.push({ label: '用途代码', value: doc.purposeCode });
      fields.push({ label: '用途说明', value: doc.purposeDescription });
    }

    fields.push({
      label: '金额',
      value: `${doc.amount.toLocaleString()} ${doc.currency}`,
    });
    fields.push({ label: '版本', value: `v${doc.version}` });
    if ('isSupplement' in doc) {
      fields.push({ label: '是否补件', value: doc.isSupplement ? '是' : '否' });
    }
    if ('uploader' in doc) {
      fields.push({ label: '上传人', value: doc.uploader });
      fields.push({
        label: '上传时间',
        value: new Date(doc.uploadTime).toLocaleString('zh-CN'),
      });
    } else {
      fields.push({ label: '提交人', value: doc.submitter });
      fields.push({
        label: '提交时间',
        value: new Date(doc.submitTime).toLocaleString('zh-CN'),
      });
    }

    return (
      <div className="space-y-3">
        {fields.map((field, idx) => {
          const hasChange =
            rightDoc &&
            leftDoc &&
            JSON.stringify(field.value) !==
              JSON.stringify(
                docType === 'contract'
                  ? (leftDoc as Contract)[field.label as keyof Contract]
                  : docType === 'invoice'
                  ? (leftDoc as Invoice)[field.label as keyof Invoice]
                  : (leftDoc as RemittanceApplication)[
                      field.label as keyof RemittanceApplication
                    ]
              );

          return (
            <div
              key={idx}
              className={`p-3 rounded ${hasChange ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}
            >
              <div className="text-xs text-slate-500 mb-1">{field.label}</div>
              <div
                className={`text-sm font-medium ${hasChange ? 'text-amber-700' : 'text-slate-700'}`}
              >
                {field.value}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const content = (
    <>
      {onClose && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="text-blue-600" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">版本对比</h3>
              <p className="text-sm text-slate-500">
                业务编号: {business.businessNo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className={`p-4 border-b border-slate-200 ${onClose ? 'bg-slate-50' : ''}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">文档类型:</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="contract">合同</option>
              <option value="invoice">发票</option>
              <option value="application">汇款申请</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">左侧版本:</span>
            <select
              value={leftVersion}
              onChange={(e) => setLeftVersion(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {versions.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </div>
          <ArrowLeftRight size={16} className="text-slate-400" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">右侧版本:</span>
            <select
              value={rightVersion}
              onChange={(e) => setRightVersion(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {versions.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={`p-4 overflow-y-auto ${onClose ? '' : 'max-h-96'}`}>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-center text-sm font-medium text-slate-600 mb-4 pb-2 border-b border-slate-200">
              版本 v{leftVersion}
            </div>
            {renderDocFields(leftDoc)}
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-center text-sm font-medium text-blue-600 mb-4 pb-2 border-b border-blue-200">
              版本 v{rightVersion}
            </div>
            {renderDocFields(rightDoc)}
          </div>
        </div>
      </div>
    </>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {content}
    </div>
  );
};
