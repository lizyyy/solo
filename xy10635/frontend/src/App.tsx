import React, { useState, useEffect } from 'react';
import { Case, Lawyer, Statistics, LeadFunnel } from './types';
import { caseApi, lawyerApi } from './services/api';
import StatsCards from './components/StatsCards';
import CasesList from './components/CasesList';
import LeadFunnelChart from './components/LeadFunnel';
import LawyersList from './components/LawyersList';
import CaseDetail from './components/CaseDetail';
import CreateCaseModal from './components/CreateCaseModal';
import CreateLawyerModal from './components/CreateLawyerModal';
import ExportModal from './components/ExportModal';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [leadFunnel, setLeadFunnel] = useState<LeadFunnel | null>(null);
  const [loading, setLoading] = useState({ cases: false, lawyers: false, statistics: false, funnel: false });
  
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showCreateLawyer, setShowCreateLawyer] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentView]);

  const loadData = async () => {
    try {
      if (currentView === 'dashboard' || currentView === 'cases') {
        setLoading(prev => ({ ...prev, cases: true, statistics: true }));
        const [casesRes, statsRes, funnelRes] = await Promise.all([
          caseApi.getCases(),
          caseApi.getStatistics(),
          caseApi.getLeadFunnel()
        ]);
        setCases(casesRes.data.data);
        setStatistics(statsRes.data);
        setLeadFunnel(funnelRes.data);
        setLoading(prev => ({ ...prev, cases: false, statistics: false, funnel: false }));
      }

      if (currentView === 'lawyers') {
        setLoading(prev => ({ ...prev, lawyers: true }));
        const lawyersRes = await lawyerApi.getLawyers();
        setLawyers(lawyersRes.data);
        setLoading(prev => ({ ...prev, lawyers: false }));
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    }
  };

  const handleViewCase = async (caseItem: Case) => {
    try {
      const caseRes = await caseApi.getCaseById(caseItem.id);
      setSelectedCase(caseRes.data);
      setShowCaseDetail(true);
    } catch (err: any) {
      setError(err.message || '加载案件详情失败');
    }
  };

  const handleCreateCase = async (data: any) => {
    try {
      await caseApi.createCase(data);
      setShowCreateCase(false);
      loadData();
    } catch (err: any) {
      setError(err.message || '创建案件失败');
    }
  };

  const handleCreateLawyer = async (data: any) => {
    try {
      await lawyerApi.createLawyer(data);
      setShowCreateLawyer(false);
      loadData();
    } catch (err: any) {
      setError(err.message || '创建律师失败');
    }
  };

  const handleChangeStatus = async (id: string, data: any) => {
    try {
      await caseApi.changeStatus(id, data);
      loadData();
      if (selectedCase && selectedCase.id === id) {
        const caseRes = await caseApi.getCaseById(id);
        setSelectedCase(caseRes.data);
      }
    } catch (err: any) {
      setError(err.message || '变更状态失败');
    }
  };

  const handleCheckConflict = async (id: string, data: any) => {
    try {
      const result = await caseApi.checkConflict(id, data);
      loadData();
      if (selectedCase && selectedCase.id === id) {
        const caseRes = await caseApi.getCaseById(id);
        setSelectedCase(caseRes.data);
      }
      return result.data;
    } catch (err: any) {
      setError(err.message || '冲突检查失败');
    }
  };

  const handleAssignLawyer = async (data: any) => {
    try {
      await lawyerApi.assignCase(data);
      loadData();
      if (selectedCase && selectedCase.id === data.case_id) {
        const caseRes = await caseApi.getCaseById(data.case_id);
        setSelectedCase(caseRes.data);
      }
    } catch (err: any) {
      setError(err.message || '指派律师失败');
    }
  };

  const handleReassignCase = async (data: any) => {
    try {
      await lawyerApi.reassignCase(data);
      loadData();
      if (selectedCase && selectedCase.id === data.case_id) {
        const caseRes = await caseApi.getCaseById(data.case_id);
        setSelectedCase(caseRes.data);
      }
    } catch (err: any) {
      setError(err.message || '转派案件失败');
    }
  };

  const handleCompleteFollowUp = async (reassignmentId: string, data: any) => {
    try {
      await lawyerApi.completeFollowUp(reassignmentId, data);
      loadData();
      if (selectedCase) {
        const caseRes = await caseApi.getCaseById(selectedCase.id);
        setSelectedCase(caseRes.data);
      }
    } catch (err: any) {
      setError(err.message || '完成回访失败');
    }
  };

  const handleExport = async (params: any) => {
    try {
      const response = await caseApi.exportCases(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cases_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowExport(false);
    } catch (err: any) {
      setError(err.message || '导出失败');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1>法律咨询冲突分派系统</h1>
          <nav className="nav">
            <button className={currentView === 'dashboard' ? 'active' : ''} onClick={() => setCurrentView('dashboard')}>
              仪表盘
            </button>
            <button className={currentView === 'cases' ? 'active' : ''} onClick={() => setCurrentView('cases')}>
              案件管理
            </button>
            <button className={currentView === 'lawyers' ? 'active' : ''} onClick={() => setCurrentView('lawyers')}>
              律师管理
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {error && (
            <div className="alert alert-error">
              {error}
              <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {(currentView === 'dashboard' || currentView === 'cases') && (
            <>
              <StatsCards statistics={statistics} loading={loading.statistics} />
            </>
          )}

          {currentView === 'dashboard' && (
            <LeadFunnelChart funnel={leadFunnel} loading={loading.funnel} />
          )}

          {(currentView === 'dashboard' || currentView === 'cases') && (
            <CasesList
              cases={cases}
              loading={loading.cases}
              onViewCase={handleViewCase}
              onCreateCase={() => setShowCreateCase(true)}
              onExport={() => setShowExport(true)}
            />
          )}

          {currentView === 'lawyers' && (
            <LawyersList
              lawyers={lawyers}
              loading={loading.lawyers}
              onCreateLawyer={() => setShowCreateLawyer(true)}
            />
          )}
        </div>
      </main>

      {showCaseDetail && selectedCase && (
        <CaseDetail
          caseData={selectedCase}
          lawyers={lawyers}
          onClose={() => {
            setShowCaseDetail(false);
            setSelectedCase(null);
          }}
          onUpdateCase={() => {}}
          onChangeStatus={handleChangeStatus}
          onCheckConflict={handleCheckConflict}
          onAssignLawyer={handleAssignLawyer}
          onReassignCase={handleReassignCase}
          onCompleteFollowUp={handleCompleteFollowUp}
        />
      )}

      {showCreateCase && (
        <CreateCaseModal
          onClose={() => setShowCreateCase(false)}
          onCreate={handleCreateCase}
        />
      )}

      {showCreateLawyer && (
        <CreateLawyerModal
          onClose={() => setShowCreateLawyer(false)}
          onCreate={handleCreateLawyer}
        />
      )}

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );
};

export default App;
