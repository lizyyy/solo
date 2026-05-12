import { useState } from 'react';
import { StoreType } from '../store/useStore';
import { Film, User, FileText, AlertCircle, Check, ArrowLeft, Printer } from 'lucide-react';

interface PickupPageProps {
  store: StoreType;
}

type Step = 'input' | 'verify' | 'confirm';

const PickupPage = ({ store }: PickupPageProps) => {
  const { 
    state, 
    findPatientByIdCard, 
    verifyPickupCode, 
    printFilm, 
    getPatientExams, 
    getPatientPickups,
    setSelectedPatient,
    setSelectedExam,
    setSelectedPickup
  } = store;

  const [step, setStep] = useState<Step>('input');
  const [inputType, setInputType] = useState<'code' | 'idcard'>('code');
  const [codeInput, setCodeInput] = useState('');
  const [idCardInput, setIdCardInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    patient?: any;
    exams?: any[];
    pickups?: any[];
    pickup?: any;
  } | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<string>('');

  const handleVerify = () => {
    if (inputType === 'code') {
      const result = verifyPickupCode(codeInput.trim());
      if (result.success) {
        const pickup = (result as any).pickup;
        const exam = state.exams.find(e => e.examNo === pickup.examNo);
        const patient = state.patients.find(p => p.id === pickup.patientId);
        
        setVerificationResult({
          success: true,
          message: '取片码验证成功',
          patient,
          exams: exam ? [exam] : [],
          pickups: [pickup],
          pickup
        });
        setSelectedPickupId(pickup.id);
      } else {
        setVerificationResult({
          success: false,
          message: result.message
        });
      }
    } else {
      const patient = findPatientByIdCard(idCardInput.trim());
      if (!patient) {
        setVerificationResult({
          success: false,
          message: '未找到该患者信息，请检查身份证号是否正确'
        });
        return;
      }

      const exams = getPatientExams(patient.id);
      const pickups = getPatientPickups(patient.id).filter(p => p.status === 'active');

      if (exams.length === 0) {
        setVerificationResult({
          success: false,
          message: '该患者暂无检查记录',
          patient
        });
        return;
      }

      if (pickups.length === 0) {
        setVerificationResult({
          success: false,
          message: '该患者暂无可用的取片码',
          patient,
          exams
        });
        return;
      }

      setVerificationResult({
        success: true,
        message: '患者信息验证成功',
        patient,
        exams,
        pickups
      });
    }
    setStep('verify');
  };

  const handlePrint = () => {
    if (!selectedPickupId) {
      return;
    }
    const result = printFilm(selectedPickupId);
    if (result.success) {
      setStep('confirm');
    }
  };

  const resetForm = () => {
    setStep('input');
    setCodeInput('');
    setIdCardInput('');
    setVerificationResult(null);
    setSelectedPickupId('');
    setSelectedPatient(null);
    setSelectedExam(null);
    setSelectedPickup(null);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Film className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">取片服务</h2>
            <p className="text-sm text-gray-500">输入取片码或身份证号，快速打印胶片</p>
          </div>
        </div>

        {step === 'input' && (
          <div className="space-y-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setInputType('code')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  inputType === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                使用取片码
              </button>
              <button
                onClick={() => setInputType('idcard')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  inputType === 'idcard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                使用身份证
              </button>
            </div>

            {inputType === 'code' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  取片码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="例如：20260510-8876"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                <p className="mt-2 text-sm text-gray-500">取片码格式：8位数字-4位数字</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  身份证号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={idCardInput}
                  onChange={(e) => setIdCardInput(e.target.value)}
                  placeholder="请输入18位身份证号"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={
                (inputType === 'code' && !codeInput.trim()) ||
                (inputType === 'idcard' && !idCardInput.trim())
              }
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              验证并查询胶片
            </button>
          </div>
        )}

        {step === 'verify' && verificationResult && (
          <div className="space-y-6">
            <button
              onClick={resetForm}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>

            {!verificationResult.success ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-800">验证失败</h3>
                    <p className="text-red-700">{verificationResult.message}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {verificationResult.patient && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <User className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-blue-800">患者信息</h3>
                        <p className="text-blue-700">
                          {verificationResult.patient.name} | 
                          {verificationResult.patient.gender} | 
                          {verificationResult.patient.age}岁
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {verificationResult.pickups && verificationResult.pickups.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-gray-600" />
                      <span>可用取片记录</span>
                    </h3>
                    <div className="space-y-3">
                      {verificationResult.pickups.map(pickup => {
                        const exam = state.exams.find(e => e.examNo === pickup.examNo);
                        return (
                          <div
                            key={pickup.id}
                            onClick={() => setSelectedPickupId(pickup.id)}
                            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                              selectedPickupId === pickup.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-gray-900">
                                  {exam?.examType || '未知检查'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  取片码：<span className="font-mono">{pickup.pickupCode}</span>
                                </p>
                                <p className="text-sm text-gray-600">
                                  检查号：<span className="font-mono">{pickup.examNo}</span>
                                </p>
                                <p className="text-sm text-gray-600">
                                  检查日期：{exam?.examDate || '-'}
                                </p>
                                {exam && (
                                  <p className="text-sm text-gray-600">
                                    胶片数量：{exam.filmCount} 张
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  exam?.status === 'ready' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {exam?.status === 'ready' ? '✓ 可打印' : '处理中'}
                                </span>
                              </div>
                            </div>
                            {exam && selectedPickupId === pickup.id && (
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-sm text-gray-700">
                                  <strong>检查科室：</strong>{exam.department}
                                </p>
                                <p className="text-sm text-gray-700">
                                  <strong>主治医生：</strong>{exam.attendingDoctor}
                                </p>
                                <p className="text-sm text-gray-700">
                                  <strong>检查结果：</strong>{exam.examResult}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handlePrint}
                  disabled={!selectedPickupId}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <Printer className="h-5 w-5" />
                  <span>确认打印胶片</span>
                </button>
              </>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="text-center py-8">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">打印成功！</h3>
            <p className="text-gray-600 mb-8">请在取片口领取您的胶片</p>
            
            <button
              onClick={resetForm}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              继续取片
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PickupPage;
