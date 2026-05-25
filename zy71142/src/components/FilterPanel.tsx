import React from 'react';
import { X, Filter, Users, Layers, Eye } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';

interface FilterPanelProps {
  show: boolean;
  onClose: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ show, onClose }) => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const filteredClassrooms = useSimulationStore(state => state.filteredClassrooms);
  const setFilteredClassrooms = useSimulationStore(state => state.setFilteredClassrooms);
  const studentFilter = useSimulationStore(state => state.studentFilter);
  const setStudentFilter = useSimulationStore(state => state.setStudentFilter);
  
  if (!show || !selectedPlan) return null;
  
  const toggleClassroom = (classroomId: string) => {
    if (filteredClassrooms.includes(classroomId)) {
      setFilteredClassrooms(filteredClassrooms.filter(id => id !== classroomId));
    } else {
      setFilteredClassrooms([...filteredClassrooms, classroomId]);
    }
  };
  
  const selectAllClassrooms = () => {
    setFilteredClassrooms(selectedPlan.classrooms.map(c => c.id));
  };
  
  const clearClassrooms = () => {
    setFilteredClassrooms([]);
  };
  
  const studentFilterOptions = [
    { value: 'all', label: '全部', color: 'bg-slate-500' },
    { value: 'waiting', label: '等待中', color: 'bg-slate-500' },
    { value: 'moving', label: '移动中', color: 'bg-blue-500' },
    { value: 'inStair', label: '楼梯中', color: 'bg-amber-500' },
    { value: 'queued', label: '排队中', color: 'bg-red-500' },
    { value: 'arrived', label: '已到达', color: 'bg-green-500' },
  ] as const;
  
  const floors = Array.from(new Set(selectedPlan.classrooms.map(c => c.floor))).sort();
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50" onClick={onClose}>
      <div 
        className="bg-slate-900 h-full w-80 shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-purple-400" />
            筛选设置
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              学生状态筛选
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {studentFilterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setStudentFilter(option.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    studentFilter === option.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${option.color}`} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              班级筛选
            </h3>
            <div className="flex gap-2 mb-3">
              <button
                onClick={selectAllClassrooms}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                全选
              </button>
              <button
                onClick={clearClassrooms}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                清空
              </button>
            </div>
            
            <div className="space-y-4">
              {floors.map(floor => {
                const floorClassrooms = selectedPlan.classrooms
                  .filter(c => c.floor === floor)
                  .sort((a, b) => a.exitOrder - b.exitOrder);
                
                const allSelected = floorClassrooms.every(c => filteredClassrooms.includes(c.id));
                const someSelected = floorClassrooms.some(c => filteredClassrooms.includes(c.id));
                
                const toggleFloor = () => {
                  if (allSelected) {
                    setFilteredClassrooms(filteredClassrooms.filter(id => 
                      !floorClassrooms.some(c => c.id === id)
                    ));
                  } else {
                    const newSelected = new Set(filteredClassrooms);
                    floorClassrooms.forEach(c => newSelected.add(c.id));
                    setFilteredClassrooms(Array.from(newSelected));
                  }
                };
                
                return (
                  <div key={floor} className="bg-slate-800 rounded-lg p-3">
                    <button
                      onClick={toggleFloor}
                      className="w-full flex items-center justify-between mb-2 text-left"
                    >
                      <span className="text-white text-sm font-medium">{floor}楼</span>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        allSelected ? 'bg-blue-500 border-blue-500' : 
                        someSelected ? 'border-blue-500' : 'border-slate-500'
                      }`}>
                        {(allSelected || someSelected) && (
                          <div className={`w-2.5 h-2.5 ${
                            allSelected ? 'bg-white' : 'bg-blue-500'
                          }`} />
                        )}
                      </div>
                    </button>
                    <div className="space-y-1">
                      {floorClassrooms.map(classroom => {
                        const isSelected = filteredClassrooms.includes(classroom.id);
                        return (
                          <button
                            key={classroom.id}
                            onClick={() => toggleClassroom(classroom.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                              isSelected ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Eye className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                            <span className="flex-1 text-left truncate">{classroom.name}</span>
                            <span className="text-xs text-slate-500">
                              {classroom.studentCount}人
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400">
                💡 提示：筛选后3D场景中将只显示选中班级的学生，便于重点观察特定班级的疏散情况
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
