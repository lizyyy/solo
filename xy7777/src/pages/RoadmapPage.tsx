import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ChevronDown, ChevronUp, Star, Clock, Zap, BookOpen, Monitor, Target } from 'lucide-react';
import { Header } from '../components/Layout';
import { getSkillsByPosition, getSkillById } from '../data/skills';
import { getTasksBySkill } from '../data/tasks';
import { getPositionById } from '../data/positions';
import { useApp } from '../context/AppContext';
import { Skill, SkillProgress } from '../types';

const levelLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
};

const levelColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
};

const categoryIcons: Record<string, React.ReactNode> = {
  '电脑基础': <Monitor className="w-5 h-5" />,
  '行业认知': <BookOpen className="w-5 h-5" />,
  '核心技能': <Target className="w-5 h-5" />,
  '进阶技能': <Star className="w-5 h-5" />,
};

export const RoadmapPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPosition, getSkillProgress, getTaskProgress, isPositionSelected } = useApp();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  if (!isPositionSelected || !selectedPosition) {
    navigate('/');
    return null;
  }

  const position = getPositionById(selectedPosition);
  const skills = getSkillsByPosition(selectedPosition);

  const computerBasicsSkills = skills.filter(s => s.isComputerBasics);
  const professionalSkills = skills.filter(s => !s.isComputerBasics);

  const getSkillStatusInfo = (skill: Skill) => {
    const progress = getSkillProgress(skill.id);
    const tasks = getTasksBySkill(skill.id);
    const completedTasks = tasks.filter(t => {
      const taskProgress = getTaskProgress(t.id);
      return taskProgress?.status === 'completed';
    }).length;

    let status: SkillProgress['status'] = 'locked';
    if (progress) {
      status = progress.status;
    }

    return { status, completedTasks, totalTasks: tasks.length };
  };

  const SkillCard: React.FC<{ skill: Skill; index: number }> = ({ skill, index }) => {
    const { status, completedTasks, totalTasks } = getSkillStatusInfo(skill);
    const isExpanded = expandedSkill === skill.id;
    const tasks = getTasksBySkill(skill.id);

    const statusIcon = () => {
      switch (status) {
        case 'completed':
          return <CheckCircle className="w-6 h-6 text-secondary" />;
        case 'in_progress':
        case 'available':
          return <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          </div>;
        case 'locked':
        default:
          return <Lock className="w-6 h-6 text-gray-300" />;
      }
    };

    const cardStyle = () => {
      switch (status) {
        case 'completed':
          return 'border-secondary/30 bg-secondary/5';
        case 'in_progress':
        case 'available':
          return 'border-primary/30 bg-primary/5';
        case 'locked':
        default:
          return 'border-gray-200 bg-gray-50 opacity-70';
      }
    };

    return (
      <div
        className={`card mb-3 border-l-4 ${cardStyle()}`}
        style={{ borderLeftColor: status === 'locked' ? '#E5E7EB' : skill.isComputerBasics ? '#10B981' : '#4F46E5' }}
      >
        <div
          className={`flex items-center gap-3 ${
            status !== 'locked' ? 'cursor-pointer' : 'cursor-not-allowed'
          }`}
          onClick={() => {
            if (status !== 'locked') {
              setExpandedSkill(isExpanded ? null : skill.id);
            }
          }}
        >
          {statusIcon()}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${status === 'locked' ? 'text-gray-400' : 'text-dark'}`}>
                {skill.name}
              </h4>
              <span className={`tag text-xs ${levelColors[skill.level]}`}>
                {levelLabels[skill.level]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
              {skill.description}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {skill.estimatedHours}小时
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Zap className="w-3 h-3" />
                {'★'.repeat(skill.difficulty)}{'☆'.repeat(5 - skill.difficulty)}
              </span>
              {totalTasks > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <CheckCircle className="w-3 h-3" />
                  {completedTasks}/{totalTasks}任务
                </span>
              )}
            </div>
          </div>
          {status !== 'locked' && (
            isExpanded ? (
              <ChevronUp className="w-5 h-5 text-primary" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
            <p className="text-sm text-gray-600 mb-4">{skill.description}</p>

            {tasks.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-dark mb-2">相关任务</h5>
                <div className="space-y-2">
                  {tasks.map(task => {
                    const taskProgress = useApp().getTaskProgress(task.id);
                    const isCompleted = taskProgress?.status === 'completed';
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg ${
                          isCompleted ? 'bg-secondary/10' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          )}
                          <span className={`text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                            {task.title}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">
                            {task.estimatedMinutes}分钟
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {skill.prerequisites.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-dark mb-2">前置技能</h5>
                <div className="flex flex-wrap gap-2">
                  {skill.prerequisites.map(prereqId => {
                    const prereq = getSkillById(prereqId);
                    return prereq ? (
                      <span key={prereqId} className="tag tag-gray text-xs">
                        {prereq.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/tasks')}
                className="btn-primary text-sm py-2 px-4"
              >
                开始学习
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="学习路线图"
        subtitle={position ? `${position.name}学习路径` : '选择你的方向开始学习'}
      />

      <div className="max-w-lg mx-auto px-4 py-6">
        {computerBasicsSkills.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-dark">电脑基础</h3>
                <p className="text-xs text-gray-500">所有运营岗位都需要的基础技能</p>
              </div>
            </div>
            {computerBasicsSkills.map((skill, index) => (
              <SkillCard key={skill.id} skill={skill} index={index} />
            ))}
          </div>
        )}

        {professionalSkills.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-dark">专业技能</h3>
                <p className="text-xs text-gray-500">{position?.name}专属技能树</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-gray-200" />
              
              {professionalSkills.map((skill, index) => (
                <div key={skill.id} className="relative pl-14">
                  <div className="absolute left-5 top-6 w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                  <SkillCard skill={skill} index={computerBasicsSkills.length + index} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 card bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <div className="text-center">
            <h4 className="font-bold text-dark mb-2">💡 学习小贴士</h4>
            <p className="text-sm text-gray-600">
              按照路线图一步步来，不要着急。每完成一个技能点，你就离目标更近一步。
              记住：慢慢来，比较快。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
