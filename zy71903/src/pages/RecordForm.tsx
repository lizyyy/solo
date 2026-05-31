import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Music,
  FileText,
  Hand,
  Info,
  Lightbulb,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SourceTag } from '../components/ui/SourceTag';
import { FriendlyErrorList, FriendlyErrorMessage } from '../components/ui/FriendlyErrorMessage';
import { validationService } from '../services/ValidationService';
import { BeatRecord, DataSource, RecordStatus } from '../types';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';

export function RecordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { success, error } = useToast();

  const {
    records,
    students,
    sections,
    addRecord,
    updateRecord,
    addMismatchRecord,
  } = useStore();

  const existingRecord = editId ? records.find((r) => r.id === editId) : null;

  const [formData, setFormData] = useState({
    studentId: existingRecord?.studentId || '',
    rehearsalDate: existingRecord?.rehearsalDate || format(new Date(), 'yyyy-MM-dd'),
    measureStart: existingRecord?.measureStart || 0,
    measureEnd: existingRecord?.measureEnd || 0,
    tempo: existingRecord?.tempo || 88,
    source: existingRecord?.source || DataSource.METRONOME,
    remarks: existingRecord?.remarks || '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showTips, setShowTips] = useState(true);

  const selectedStudent = students.find((s) => s.id === formData.studentId);
  const selectedSection = selectedStudent ? sections.find((s) => s.id === selectedStudent.sectionId) : null;

  const validation = useMemo(() => {
    const recordToValidate: Partial<BeatRecord> = {
      ...formData,
      id: editId || 'new',
      studentName: selectedStudent?.name || '',
      sectionName: selectedSection?.name || '',
      status: existingRecord?.status || RecordStatus.PENDING,
      createdBy: '声部长',
      createdAt: '',
      updatedAt: '',
      isDuplicate: false,
    };
    return validationService.validateRecord(recordToValidate, records);
  }, [formData, records, selectedStudent, selectedSection, editId, existingRecord]);

  const discontinuousWarnings = useMemo(() => {
    if (!formData.studentId || !formData.rehearsalDate) return [];
    return validationService.detectDiscontinuous(
      records,
      formData.studentId,
      formData.rehearsalDate
    );
  }, [formData.studentId, formData.rehearsalDate, records]);

  const handleChange = (field: string, value: string | number | DataSource) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleStudentChange = (studentId: string) => {
    handleChange('studentId', studentId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const allFields = ['studentId', 'rehearsalDate', 'measureStart', 'measureEnd', 'tempo', 'source'];
    setTouched(allFields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    if (!validation.isValid) {
      error('请检查填写内容', '有必填项未填写或格式有误');
      return;
    }

    if (!selectedStudent || !selectedSection) {
      error('请选择学生');
      return;
    }

    const recordData = {
      ...formData,
      studentId: formData.studentId,
      studentName: selectedStudent.name,
      sectionId: selectedStudent.sectionId,
      sectionName: selectedSection.name,
      status: existingRecord?.status || RecordStatus.PENDING,
      createdBy: '声部长',
      isDuplicate: validation.warnings.some((w) => w.id.startsWith('err-dup')),
      duplicateOfId: validation.warnings.find((w) => w.relatedRecordId)?.relatedRecordId,
    };

    if (editId && existingRecord) {
      updateRecord(editId, recordData, '编辑修改', '声部长');
      
      const mismatch = validationService.detectMismatch({
        ...recordData,
        id: editId,
        createdAt: existingRecord.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (mismatch) {
        addMismatchRecord(mismatch);
      }
      
      success('记录已更新');
    } else {
      addRecord(recordData);
      
      const mismatch = validationService.detectMismatch({
        ...recordData,
        id: 'temp',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (mismatch) {
        addMismatchRecord(mismatch);
      }
      
      success('记录已创建');
    }

    navigate('/');
  };

  const getFieldErrors = (field: string) => {
    if (!touched[field]) return [];
    return [
      ...validation.errors.filter((e) => e.field === field),
      ...validation.warnings.filter((e) => e.field === field),
    ];
  };

  const sourceOptions = [
    { value: DataSource.METRONOME, label: '节拍器', icon: Music, color: 'blue' },
    { value: DataSource.MUSIC_SHEET, label: '选曲表', icon: FileText, color: 'orange' },
    { value: DataSource.MANUAL, label: '手工录入', icon: Hand, color: 'gray' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">
              {editId ? '编辑记录' : '新增记录'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {editId ? '修改已有的节拍记录' : '录入新的节拍记录'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  学生 <span className="text-red-500">*</span>
                </label>
                <select
                  className={`input-field ${getFieldErrors('studentId').length > 0 ? 'input-error' : ''}`}
                  value={formData.studentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, studentId: true }))}
                >
                  <option value="">请选择学生</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.instrument}
                    </option>
                  ))}
                </select>
                {selectedSection && (
                  <p className="text-xs text-gray-500">声部：{selectedSection.name}</p>
                )}
                <FriendlyErrorList errors={getFieldErrors('studentId')} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  排练日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className={`input-field ${getFieldErrors('rehearsalDate').length > 0 ? 'input-error' : ''}`}
                  value={formData.rehearsalDate}
                  onChange={(e) => handleChange('rehearsalDate', e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, rehearsalDate: true }))}
                />
                <FriendlyErrorList errors={getFieldErrors('rehearsalDate')} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  起始小节 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className={`input-field font-mono ${getFieldErrors('measureStart').length > 0 ? 'input-error' : ''}`}
                  value={formData.measureStart || ''}
                  onChange={(e) => handleChange('measureStart', parseInt(e.target.value) || 0)}
                  onBlur={() => setTouched((p) => ({ ...p, measureStart: true }))}
                  placeholder="例如：1"
                />
                <FriendlyErrorList errors={getFieldErrors('measureStart')} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  结束小节 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className={`input-field font-mono ${getFieldErrors('measureEnd').length > 0 ? 'input-error' : ''}`}
                  value={formData.measureEnd || ''}
                  onChange={(e) => handleChange('measureEnd', parseInt(e.target.value) || 0)}
                  onBlur={() => setTouched((p) => ({ ...p, measureEnd: true }))}
                  placeholder="例如：48"
                />
                <FriendlyErrorList errors={getFieldErrors('measureEnd')} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  速度 ♩= <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className={`input-field font-mono ${getFieldErrors('tempo').length > 0 ? 'input-error' : ''}`}
                  value={formData.tempo || ''}
                  onChange={(e) => handleChange('tempo', parseInt(e.target.value) || 0)}
                  onBlur={() => setTouched((p) => ({ ...p, tempo: true }))}
                  placeholder="例如：88"
                />
                <FriendlyErrorList errors={getFieldErrors('tempo')} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  数据来源 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {sourceOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = formData.source === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleChange('source', option.value)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
                          <span className={`font-medium ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                            {option.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {option.value === DataSource.METRONOME && '自动记录，可信度高'}
                          {option.value === DataSource.MUSIC_SHEET && '来自选曲表，可能晚补'}
                          {option.value === DataSource.MANUAL && '手工填写，仔细核对'}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <FriendlyErrorList errors={getFieldErrors('source')} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">备注</label>
                <textarea
                  className="input-field min-h-[100px] resize-none"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="如有特殊情况（如分谱不同、休息等），请在此说明..."
                />
              </div>
            </div>

            {touched.measureStart && touched.measureEnd && discontinuousWarnings.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">与其他记录的衔接检查</h4>
                <FriendlyErrorList errors={discontinuousWarnings} />
              </div>
            )}

            {validation.warnings.filter((w) => !w.field).length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">请注意</h4>
                <FriendlyErrorList
                  errors={validation.warnings.filter((w) => !w.field)}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-ghost"
              >
                取消
              </button>
              <button type="submit" className="btn btn-primary">
                <Save className="w-4 h-4" />
                {editId ? '保存修改' : '创建记录'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          {showTips && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-secondary-500" />
                  填写小贴士
                </h3>
                <button
                  onClick={() => setShowTips(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  收起
                </button>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <p className="flex items-start gap-2">
                  <span className="text-secondary-500">•</span>
                  小节号一定要从小到大写，比如1-48，不要写成48-1
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-secondary-500">•</span>
                  速度一般在40-200之间，太快或太慢都要检查一下
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-secondary-500">•</span>
                  节拍器记录最可靠，选曲表可能会晚补，手工录入要仔细核对
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-secondary-500">•</span>
                  如果和其他记录重叠了，记得在备注里说明原因
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-secondary-500">•</span>
                  有问题找声部长或指挥，别自己硬扛哦
                </p>
              </div>
            </div>
          )}

          {formData.studentId && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                该学生当日其他记录
              </h3>
              {records
                .filter(
                  (r) =>
                    r.studentId === formData.studentId &&
                    r.rehearsalDate === formData.rehearsalDate &&
                    r.id !== editId
                )
                .sort((a, b) => a.measureStart - b.measureStart)
                .map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-gray-50 rounded-lg mb-2 last:mb-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm">
                        {r.measureStart} - {r.measureEnd}
                      </span>
                      <SourceTag source={r.source} showIcon={false} />
                    </div>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={r.status} showIcon={false} />
                      <span className="text-xs text-gray-400">♩={r.tempo}</span>
                    </div>
                  </div>
                ))}
              {records.filter(
                (r) =>
                  r.studentId === formData.studentId &&
                  r.rehearsalDate === formData.rehearsalDate &&
                  r.id !== editId
              ).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  当日暂无其他记录
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
