
import { useExhibition } from '@/hooks/useExhibition';
import { Sidebar } from '@/components/Sidebar';
import { Overview } from '@/components/Overview';
import { ArtworkList } from '@/components/ArtworkList';
import { FlashLoans } from '@/components/FlashLoans';
import { LayoutList } from '@/components/LayoutList';
import { AnomalyCenter } from '@/components/AnomalyCenter';

function App() {
  const {
    currentUser,
    exhibition,
    activeTab,
    setActiveTab,
    selectedFlashLoan,
    setSelectedFlashLoan,
    switchUser,
    confirmAnomaly,
    updateArtworkUnit,
    submitFlashLoanRequest,
    overrideFlashLoanJudgment,
    getUnconfirmedAnomalies,
    getPendingConfirmations,
    mockUsers,
  } = useExhibition();

  const unconfirmedCount = getUnconfirmedAnomalies().length;

  const handleSwitchUser = () => {
    const nextUserId = currentUser.id === 'u1' ? 'u2' : 'u1';
    switchUser(nextUserId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Overview
            exhibition={exhibition}
            currentUser={currentUser}
            onConfirmAnomaly={confirmAnomaly}
            getPendingConfirmations={getPendingConfirmations}
          />
        );
      case 'artworks':
        return (
          <ArtworkList
            artworks={exhibition.artworks}
            currentUser={currentUser}
            onUpdateUnit={updateArtworkUnit}
          />
        );
      case 'flash-loans':
        return (
          <FlashLoans
            flashLoans={exhibition.flashLoans}
            selectedId={selectedFlashLoan}
            onSelect={setSelectedFlashLoan}
            currentUser={currentUser}
            onSubmit={submitFlashLoanRequest}
            onOverride={overrideFlashLoanJudgment}
            mockUsers={mockUsers}
          />
        );
      case 'layout':
        return (
          <LayoutList
            exhibition={exhibition}
            currentUser={currentUser}
          />
        );
      case 'anomalies':
        return (
          <AnomalyCenter
            exhibition={exhibition}
            currentUser={currentUser}
            onConfirmAnomaly={confirmAnomaly}
          />
        );
      default:
        return <Overview exhibition={exhibition} currentUser={currentUser} onConfirmAnomaly={confirmAnomaly} getPendingConfirmations={getPendingConfirmations} />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        unconfirmedCount={unconfirmedCount}
      />
      <main className="flex-1 p-8 bg-gray-50">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
