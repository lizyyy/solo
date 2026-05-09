import { useRef, useState } from 'react';
import { Modal } from './Modal';

interface Props {
  onSubmit: (file: File) => void;
  onClose: () => void;
}

export function ImportModal({ onSubmit, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(file);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="导入返工单"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !file}>
            {loading ? '导入中...' : '导入'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => fileRef.current?.click()}
        >
          选择文件
        </button>
        {file && <span style={{ marginLeft: 12, color: '#666' }}>{file.name}</span>}
      </div>
      <div className="alert alert-info">
        支持的格式：.xlsx、.xls、.csv
        <br />
        列名：返工单号 (order_no)、产品名称 (product_name)、批次号 (batch_no)、批量 (qty)、不良数 (defect_qty)
      </div>
    </Modal>
  );
}
