import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storage';
import type { 
  ExchangeRequest, 
  UniformType, 
  Size,
  DistributionRecord 
} from '../types';
import { ArrowLeft, Save, Upload } from 'lucide-react';

const UNIFORM_TYPES: UniformType[] = ['夏装', '秋装', '冬装', '礼服'];
const SIZES: Size[] = ['110', '120', '130', '140', '150', '160', '170', '180', '190'];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function CreateRequestPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    classId: '',
    studentId: '',
    distributionId: '',
    uniformType: '夏装' as UniformType,
    originalSize: '130' as Size,
    requestedSize: '140' as Size,
    reason: '',
    createdBy: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);

  const classes = storageService.getClasses();
  const students = formData.classId 
    ? storageService.getStudentsByClass(formData.classId) 
    : [];
  const distributions = formData.studentId
    ? storageService.getDistributionByStudent(formData.studentId)
    : [];

  const selectedStudent = formData.studentId 
    ? storageService.getStudentById(formData.studentId)
    : null;
  const selectedDistribution = formData.distributionId
    ? storageService.getDistributionById(formData.distributionId)
    : null;

  useEffect(() => {
    if (selectedDistribution) {
      setFormData(prev => ({
        ...prev,
        uniformType: selectedDistribution.uniformType,
        originalSize: selectedDistribution.distributedSize,
      }));
    }
  }, [selectedDistribution]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.classId) newErrors.classId = '请选择班级';
    if (!formData.studentId) newErrors.studentId = '请选择学生';
    if (!formData.distributionId) newErrors.distributionId = '请选择关联的发放记录';
    if (formData.originalSize === formData.requestedSize) {
      newErrors.requestedSize = '申请尺码不能与原尺码相同';
    }
    if (!formData.reason.trim()) newErrors.reason = '请填写换领原因';
    if (!formData.createdBy.trim()) newErrors.createdBy = '请填写申请人';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const newRequest: ExchangeRequest = {
      id: generateId(),
      studentId: formData.studentId,
      classId: formData.classId,
      createdBy: formData.createdBy,
      createdAt: new Date().toISOString(),
      uniformType: formData.uniformType,
      originalSize: formData.originalSize,
      requestedSize: formData.requestedSize,
      reason: formData.reason,
      relatedDistributionId: formData.distributionId,
      status: 'pending_validation',
      validationHistory: [],
      currentValidationResult: null,
      retryCount: 0,
    };

    storageService.addExchangeRequest(newRequest);
    alert('换领申请创建成功！');
    navigate(`/requests/${newRequest.id}`);
  };

  const handleImport = () => {
    const input = prompt('请粘贴批量导入数据（JSON格式）：\n\n示例：\n[{"studentId": "student-1", "distributionId": "dist-1", "uniformType": "夏装", "originalSize": "130", "requestedSize": "140", "reason": "尺码偏小", "createdBy": "张老师"}]');
    
    if (!input) return;

    try {
      const data = JSON.parse(input);
      if (!Array.isArray(data)) {
        throw new Error('数据格式错误，需要数组');
      }

      let count = 0;
      data.forEach((item: any) => {
        if (!item.studentId || !item.distributionId) {
          return;
        }

        const student = storageService.getStudentById(item.studentId);
        if (!student) return;

        const newRequest: ExchangeRequest = {
          id: generateId(),
          studentId: item.studentId,
          classId: student.classId,
          createdBy: item.createdBy || '批量导入',
          createdAt: new Date().toISOString(),
          uniformType: item.uniformType || '夏装',
          originalSize: item.originalSize || '130',
          requestedSize: item.requestedSize || '140',
          reason: item.reason || '批量导入',
          relatedDistributionId: item.distributionId,
          status: 'pending_validation',
          validationHistory: [],
          currentValidationResult: null,
          retryCount: 0,
        };

        storageService.addExchangeRequest(newRequest);
        count++;
      });

      alert(`成功导入 ${count} 条申请！`);
      navigate('/requests');
    } catch (error) {
      alert('导入失败：' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <button
          onClick={handleImport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Upload className="w-4 h-4" />
          批量导入
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">新建换领申请</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                班级 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.classId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  classId: e.target.value, 
                  studentId: '', 
                  distributionId: '' 
                })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.classId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">请选择班级</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.classId && <p className="mt-1 text-sm text-red-600">{errors.classId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学生 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.studentId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  studentId: e.target.value, 
                  distributionId: '' 
                })}
                disabled={!formData.classId}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                  errors.studentId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">请选择学生</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentNo})
                  </option>
                ))}
              </select>
              {errors.studentId && <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                关联发放记录 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.distributionId}
                onChange={(e) => setFormData({ ...formData, distributionId: e.target.value })}
                disabled={!formData.studentId}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                  errors.distributionId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">请选择发放记录</option>
                {distributions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.uniformType} - {d.distributedSize} ({d.distributionDate})
                  </option>
                ))}
              </select>
              {errors.distributionId && <p className="mt-1 text-sm text-red-600">{errors.distributionId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                申请人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                placeholder="例如：张老师"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.createdBy ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.createdBy && <p className="mt-1 text-sm text-red-600">{errors.createdBy}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                服装类型
              </label>
              <select
                value={formData.uniformType}
                onChange={(e) => setFormData({ ...formData, uniformType: e.target.value as UniformType })}
                disabled={!!selectedDistribution}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                {UNIFORM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {selectedDistribution && (
                <p className="mt-1 text-xs text-gray-500">已根据发放记录自动填充</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  原尺码
                </label>
                <select
                  value={formData.originalSize}
                  onChange={(e) => setFormData({ ...formData, originalSize: e.target.value as Size })}
                  disabled={!!selectedDistribution}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  申请尺码 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.requestedSize}
                  onChange={(e) => setFormData({ ...formData, requestedSize: e.target.value as Size })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.requestedSize ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.requestedSize && <p className="mt-1 text-sm text-red-600">{errors.requestedSize}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              换领原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              placeholder="请详细说明换领原因..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.reason ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
          </div>

          {selectedStudent && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">学生登记尺码参考</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {Object.entries(selectedStudent.registeredSize).map(([type, size]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-blue-600">{type}</span>
                    <span className="font-medium text-blue-900">{size}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm">
                <span className="text-blue-600">尺码状态：</span>
                <span className={`font-medium ${selectedStudent.isSizeActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedStudent.isSizeActive ? '已生效' : '未生效'}
                </span>
              </div>
            </div>
          )}

          {selectedDistribution && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 mb-2">选中的发放记录</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">类型</span>
                  <span className="font-medium">{selectedDistribution.uniformType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">尺码</span>
                  <span className="font-medium">{selectedDistribution.distributedSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">日期</span>
                  <span className="font-medium">{selectedDistribution.distributionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">签字</span>
                  <span className={`font-medium ${selectedDistribution.recipientSignature ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedDistribution.recipientSignature ? '已签' : '未签'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/requests')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              创建申请
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
