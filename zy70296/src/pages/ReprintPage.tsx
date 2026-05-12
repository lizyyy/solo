import { useState } from 'react';
import { StoreType } from '../store/useStore';
import { RefreshCw, FileText, AlertCircle, Check, ArrowLeft } from 'lucide-react';

interface ReprintPageProps {
  store: StoreType;
}

const ReprintPage = ({ store }: StoreType) => {
  const { 
    state, 
    findPatientByIdCard, 
    findExamByExamNo, 
    findPickupByCode,
    requestReprint
  } = store;

  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [idCard, setIdCard] = useState('');
  const [examNo, setExamNo] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [reason, setReason] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<{
    patient: any;
    exam: any;
    pickup: any;
  } | null>(null);

  const reasonOptions = [
    '胶片丢失',
    '胶片损坏',
    '胶片模糊',
    '胶片打印错误',
    '需要多份胶片',
    '其他原因'
  ];

  const handleVerify = () => {
    setError('');

    const patient = idCard ? findPatientByIdCard(idCard.trim()) : null;
    const exam = examNo ? findExamByExamNo(examNo.trim()) : null;
    const pickup = pickupCode ? findPickupByCode(pickupCode.trim()) : null;

    if (!patient && !exam && !pickup) {
      setError('请至少提供身份证号、检查号或取片码中的一项');
      return;
    }

    if (patient && exam && exam.patientId !== patient.id) {
      setError('患者信息与检查号不匹配');
      return;
    }

    if (exam && pickup && pickup.examNo !== exam.examNo) {
      setError('检查号与取片码不匹配');
      return;
    }

    const finalPatient = patient || (exam ? state.patients.find(p => p.id === exam.patientId) : 
                                      pickup ? state.patients.find(p => p.id === pickup.patientId) : null);
    const finalExam = exam || (pickup ? state.exams.find(e => e.examNo === pickup.examNo) : null);
    const finalPickup = pickup || (exam ? state.filmPickups.find(p => p.examNo === exam.examNo) : null);

    if (!finalPatient) {
      setError('未找到患者信息');
      return;
    }

    if (!finalExam) {
      setError('未找到检查记录');
      return;
    }

    setFormData({
      patient: finalPatient,
      exam: finalExam,
      pickup: finalPickup
    });
    setStep('confirm');
  };

  const handleSubmit = () => {
    if (!reason || !applicantName) {
      setError('请填写补打原因和申请人');
      return;
    }

    if (!formData) return;

    const result = requestReprint({
      examNo: formData.exam.examNo,
      patientId: formData.patient.id,
      pickupCode: formData.pickup?.pickupCode || '',
      reason,
      applicantName
    });

    if (result.success) {
      setStep('success');
    }
  };

  const resetForm = () => {
    setStep('input');
    setIdCard('');
    setExamNo('');
    setPickupCode('');
    setReason('');
    setApplicantName('');
    setError('');
    setFormData(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 p-2 rounded-lg">
            <RefreshCw className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">补打申请</h2>
            <p className="text-sm text-gray-500">胶片丢失或损坏时，申请补打胶片</p>
          </div>
        </div>

        {step === 'input' && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  身份证号
                </label>
                <input
                  type="text"
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  placeholder="请输入患者身份证号"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  检查号
                </label>
                <input
                  type="text"
                  value={examNo}
                  onChange={(e) => setExamNo(e.target.value)}
                  placeholder="例如：EX20260510001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                取片码 <span className="text-gray-400">(可选)</span>
              </label>
              <input
                type="text"
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value)}
                placeholder="例如：20260510-8876"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>提示：</strong>请至少提供身份证号或检查号。系统将根据提供的信息自动匹配患者和检查记录。
              </p>
            </div>

            <button
              onClick={handleVerify}
              disabled={!idCard && !examNo}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              查询检查记录
            </button>
          </div>
        )}

        {step === 'confirm' && formData && (
          <div className="space-y-6">
            <button
              onClick={() => setStep('input')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回修改</span>
            </button>

            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">检查记录信息</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">患者姓名：</span>
                  <span className="font-medium text-gray-900">{formData.patient.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">性别/年龄：</span>
                  <span className="font-medium text-gray-900">
                    {formData.patient.gender}/{formData.patient.age}岁
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">检查号：</span>
                  <span className="font-mono font-medium text-gray-900">{formData.exam.examNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">检查类型：</span>
                  <span className="font-medium text-gray-900">{formData.exam.examType}</span>
                </div>
                <div>
                  <span className="text-gray-500">检查日期：</span>
                  <span className="font-medium text-gray-900">
                    {formData.exam.examDate} {formData.exam.examTime}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">胶片数量：</span>
                  <span className="font-medium text-gray-900">{formData.exam.filmCount} 张</span>
                </div>
                <div>
                  <span className="text-gray-500">检查科室：</span>
                  <span className="font-medium text-gray-900">{formData.exam.department}</span>
                </div>
                <div>
                  <span className="text-gray-500">主治医生：</span>
                  <span className="font-medium text-gray-900">{formData.exam.attendingDoctor}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  补打原因 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {reasonOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setReason(opt)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        reason === opt
                          ? 'bg-green-100 text-green-800 border-2 border-green-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  申请人 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="请输入申请人姓名"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!reason || !applicantName}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              提交补打申请
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">申请已提交</h3>
            <p className="text-gray-600 mb-2">您的补打申请已提交，请等待审核</p>
            <p className="text-sm text-gray-500 mb-8">审核通过后，胶片将自动打印</p>
            
            <button
              onClick={resetForm}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              继续申请
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">我的补打申请记录</h3>
        {state.reprintRequests.length > 0 ? (
          <div className="space-y-3">
            {state.reprintRequests.map(request => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">
                      {request.patientName} - {request.reason}
                    </p>
                    <p className="text-sm text-gray-600">
                      检查号：<span className="font-mono">{request.examNo}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      申请人：{request.applicantName}
                    </p>
                    <p className="text-sm text-gray-600">
                      申请时间：{new Date(request.appliedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    request.status === 'pending' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : request.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {request.status === 'pending' ? '待审核' : 
                     request.status === 'approved' ? '已批准' : '已拒绝'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无补打申请记录</p>
        )}
      </div>
    </div>
  );
};

export default ReprintPage;
