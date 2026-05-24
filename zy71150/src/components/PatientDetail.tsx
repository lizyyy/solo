import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { getVitalSignStatus, getGenderIcon } from '../utils/gameUtils';
import { 
  X, 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  Droplets,
  AlertCircle
} from 'lucide-react';

interface PatientDetailProps {
  patient: Patient;
}

export const PatientDetail: React.FC<PatientDetailProps> = ({ patient }) => {
  const selectPatient = useGameStore(state => state.selectPatient);

  const getStatusColor = (status: 'normal' | 'warning' | 'critical') => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
    }
  };

  const vitalSigns = [
    { key: 'heartRate', label: '心率', value: `${patient.vitalSigns.heartRate} bpm`, icon: Heart },
    { key: 'bloodPressure', label: '血压', value: patient.vitalSigns.bloodPressure, icon: Activity },
    { key: 'temperature', label: '体温', value: `${patient.vitalSigns.temperature.toFixed(1)}°C`, icon: Thermometer },
    { key: 'respiratoryRate', label: '呼吸', value: `${patient.vitalSigns.respiratoryRate}/min`, icon: Wind },
    { key: 'oxygenSaturation', label: '血氧', value: `${patient.vitalSigns.oxygenSaturation}%`, icon: Droplets }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white rounded-xl shadow-lg p-5 relative"
    >
      <button
        onClick={() => selectPatient(null)}
        className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-full transition-colors"
      >
        <X size={18} className="text-gray-500" />
      </button>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-bold text-gray-800">{patient.name}</span>
          <span className="text-lg text-gray-500">{getGenderIcon(patient.gender)}</span>
        </div>
        <p className="text-sm text-gray-500">{patient.age}岁</p>
      </div>

      <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={16} className="text-red-600" />
          <span className="font-semibold text-red-700">主诉</span>
        </div>
        <p className="text-red-600 text-sm">{patient.chiefComplaint}</p>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">生命体征</h4>
        <div className="grid grid-cols-2 gap-2">
          {vitalSigns.map(({ key, label, value, icon: Icon }) => {
            const status = getVitalSignStatus(key as keyof Patient['vitalSigns'], value);
            return (
              <div 
                key={key} 
                className={`p-2 rounded-lg ${getStatusColor(status)}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon size={14} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <span className="text-sm font-bold">{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">症状表现</h4>
        <div className="flex flex-wrap gap-1.5">
          {patient.symptoms.map((symptom, idx) => (
            <span 
              key={idx}
              className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
            >
              {symptom}
            </span>
          ))}
        </div>
      </div>

      {patient.reassessEvents.some(e => e.triggered) && (
        <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-orange-600" />
            <span className="font-semibold text-orange-700">病情变化</span>
          </div>
          <p className="text-orange-600 text-xs">患者症状已发生变化，请重新评估分诊等级</p>
        </div>
      )}
    </motion.div>
  );
};
