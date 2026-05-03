import React, { useState, useEffect } from 'react';
import { detectIssues, analyzeCase } from './utils/issueDetector';
import { exportMarkdown, exportIssuesCsv } from './utils/exporter';
import { parseCsv, parseJsonl, parseYaml } from './utils/fileParser';
import { sampleData } from './utils/sampleData';
import CaseSidebar from './components/CaseSidebar';
import CaseDetail from './components/CaseDetail';
import ImportSection from './components/ImportSection';

function App() {
  const [cases, setCases] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [medications, setMedications] = useState([]);
  const [rules, setRules] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [issues, setIssues] = useState([]);
  const [analyzedCases, setAnalyzedCases] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSampleData = () => {
    setLoading(true);
    try {
      setCases(sampleData.cases);
      setVitals(sampleData.vitals);
      setMedications(sampleData.medications);
      setRules(sampleData.rules);
    } catch (error) {
      console.error('加载示例数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cases.length > 0) {
      const detectedIssues = detectIssues(cases, vitals, medications, rules);
      setIssues(detectedIssues);
      
      const analyzed = cases.map(caseItem => {
        const caseVitals = vitals.filter(v => v.caseId === caseItem.id || v.caseId === caseItem.caseId);
        const caseMeds = medications.filter(m => m.caseId === caseItem.id || m.caseId === caseItem.caseId);
        const caseIssues = detectedIssues.filter(i => 
          i.caseId === caseItem.id || i.caseId === caseItem.caseId
        );
        
        return {
          ...caseItem,
          vitals: caseVitals,
          medications: caseMeds,
          issues: caseIssues,
          ...analyzeCase(caseItem, caseVitals, caseMeds, rules, caseIssues)
        };
      });
      
      setAnalyzedCases(analyzed);
    }
  }, [cases, vitals, medications, rules]);

  const handleFileImport = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const content = e.target.result;
      
      try {
        if (type === 'cases' || type === 'medications') {
          const data = parseCsv(content);
          if (type === 'cases') {
            setCases(data);
          } else {
            setMedications(data);
          }
        } else if (type === 'vitals') {
          const data = parseJsonl(content);
          setVitals(data);
        } else if (type === 'rules') {
          const data = parseYaml(content);
          setRules(data);
        }
      } catch (error) {
        console.error('解析文件失败:', error);
        alert('文件解析失败，请检查文件格式');
      }
    };
    
    reader.readAsText(file);
  };

  const handleExportMarkdown = () => {
    if (!selectedCaseId) return;
    
    const selectedCase = analyzedCases.find(c => c.id === selectedCaseId || c.caseId === selectedCaseId);
    if (!selectedCase) return;
    
    const markdown = exportMarkdown(selectedCase);
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anesthesia_review_${selectedCaseId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportIssuesCsv = () => {
    const csv = exportIssuesCsv(issues);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'issues.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedCase = analyzedCases.find(c => c.id === selectedCaseId || c.caseId === selectedCaseId);

  return (
    <div className="app-container">
      <header className="header">
        <h1>麻醉监护记录复盘工具</h1>
        <div className="header-actions">
          <button 
            className="btn btn-primary" 
            onClick={loadSampleData}
            disabled={loading}
          >
            {loading ? '加载中...' : '加载示例数据'}
          </button>
          {selectedCase && (
            <button className="btn btn-success" onClick={handleExportMarkdown}>
              导出分析报告
            </button>
          )}
          {issues.length > 0 && (
            <button className="btn btn-warning" onClick={handleExportIssuesCsv}>
              导出问题列表
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            病例列表
            {analyzedCases.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                ({analyzedCases.length} 个病例)
              </span>
            )}
          </div>
          
          {analyzedCases.length > 0 ? (
            <div className="case-list">
              {analyzedCases.map((caseItem) => (
                <CaseSidebar
                  key={caseItem.id || caseItem.caseId}
                  caseData={caseItem}
                  isActive={selectedCaseId === (caseItem.id || caseItem.caseId)}
                  onClick={() => setSelectedCaseId(caseItem.id || caseItem.caseId)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>暂无病例数据</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                请导入数据或点击"加载示例数据"
              </p>
            </div>
          )}
        </aside>

        <main className="content-area">
          {selectedCase ? (
            <CaseDetail caseData={selectedCase} rules={rules} />
          ) : (
            <div className="no-selection">
              <ImportSection
                onImportCases={(e) => handleFileImport(e, 'cases')}
                onImportVitals={(e) => handleFileImport(e, 'vitals')}
                onImportMedications={(e) => handleFileImport(e, 'medications')}
                onImportRules={(e) => handleFileImport(e, 'rules')}
                casesCount={cases.length}
                vitalsCount={vitals.length}
                medicationsCount={medications.length}
                hasRules={!!rules}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
