import { useState, useEffect } from 'react';
import BookList from './components/BookList';
import OverdueList from './components/OverdueList';
import BookDetail from './components/BookDetail';
import AddBookModal from './components/AddBookModal';
import BorrowModal from './components/BorrowModal';
import ReturnModal from './components/ReturnModal';
import CompensateModal from './components/CompensateModal';
import { getLocations, getTags, getResidents, getBooks, getOverdue } from './api';

function App() {
  const [activeTab, setActiveTab] = useState('books');
  const [locations, setLocations] = useState([]);
  const [tags, setTags] = useState([]);
  const [residents, setResidents] = useState([]);
  const [books, setBooks] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [bookForAction, setBookForAction] = useState(null);
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    location_id: '',
    status: '',
    tag_id: ''
  });

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (activeTab === 'books') {
      loadBooks();
    } else if (activeTab === 'overdue') {
      loadOverdue();
    }
  }, [activeTab, filters]);

  const loadMasterData = async () => {
    try {
      const [locRes, tagRes, resRes] = await Promise.all([
        getLocations(),
        getTags(),
        getResidents()
      ]);
      setLocations(locRes.data);
      setTags(tagRes.data);
      setResidents(resRes.data);
    } catch (err) {
      showNotification('error', '加载基础数据失败');
    }
  };

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.location_id) params.location_id = filters.location_id;
      if (filters.status) params.status = filters.status;
      if (filters.tag_id) params.tag_id = filters.tag_id;
      
      const res = await getBooks(params);
      setBooks(res.data);
    } catch (err) {
      showNotification('error', '加载图书列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadOverdue = async () => {
    setLoading(true);
    try {
      const res = await getOverdue();
      setOverdueList(res.data);
    } catch (err) {
      showNotification('error', '加载超期列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBorrow = (book) => {
    setBookForAction(book);
    setShowBorrowModal(true);
  };

  const handleReturn = (book) => {
    setBookForAction(book);
    setShowReturnModal(true);
  };

  const handleMarkLost = async (book) => {
    if (!window.confirm('确认标记这本书为丢失状态？')) return;
    
    try {
      const { markLost } = await import('./api');
      await markLost(book.id, { resident_id: book.active_borrow?.resident_id });
      showNotification('success', '已标记为丢失');
      loadBooks();
    } catch (err) {
      showNotification('error', err.response?.data?.error || '操作失败');
    }
  };

  const handleCompensate = (book) => {
    setBookForAction(book);
    setShowCompensateModal(true);
  };

  const handleViewDetail = (book) => {
    setSelectedBook(book);
  };

  const handleActionComplete = () => {
    loadBooks();
    if (activeTab === 'overdue') loadOverdue();
  };

  const statusMap = {
    'available': '可借阅',
    'borrowed': '借阅中',
    'lost': '已丢失',
    'compensated': '已赔偿'
  };

  const actionMap = {
    'added': '入库',
    'borrow': '借阅',
    'return': '归还',
    'lost': '丢失',
    'compensated': '赔偿'
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📚 图书漂流借阅追踪台</h1>
        <p>社区图书漂流系统 - 智能追踪每本书的流转历程</p>
      </div>

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          📖 图书列表
        </button>
        <button 
          className={`tab-btn ${activeTab === 'overdue' ? 'active' : ''}`}
          onClick={() => setActiveTab('overdue')}
        >
          ⏰ 超期提醒
        </button>
      </div>

      <div className="card">
        {activeTab === 'books' && (
          <BookList
            books={books}
            locations={locations}
            tags={tags}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            statusMap={statusMap}
            onAdd={() => setShowAddModal(true)}
            onBorrow={handleBorrow}
            onReturn={handleReturn}
            onMarkLost={handleMarkLost}
            onCompensate={handleCompensate}
            onViewDetail={handleViewDetail}
          />
        )}

        {activeTab === 'overdue' && (
          <OverdueList
            overdueList={overdueList}
            loading={loading}
            onReturn={handleReturn}
            onMarkLost={handleMarkLost}
          />
        )}
      </div>

      {showAddModal && (
        <AddBookModal
          locations={locations}
          tags={tags}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadBooks();
            showNotification('success', '图书添加成功');
          }}
          onError={(msg) => showNotification('error', msg)}
        />
      )}

      {showBorrowModal && bookForAction && (
        <BorrowModal
          book={bookForAction}
          locations={locations}
          residents={residents}
          onClose={() => setShowBorrowModal(false)}
          onSuccess={() => {
            setShowBorrowModal(false);
            handleActionComplete();
            showNotification('success', '借阅登记成功');
          }}
          onError={(msg) => showNotification('error', msg)}
        />
      )}

      {showReturnModal && bookForAction && (
        <ReturnModal
          book={bookForAction}
          locations={locations}
          onClose={() => setShowReturnModal(false)}
          onSuccess={(isCross) => {
            setShowReturnModal(false);
            handleActionComplete();
            showNotification('success', isCross ? '换点归还成功！' : '归还成功');
          }}
          onError={(msg) => showNotification('error', msg)}
        />
      )}

      {showCompensateModal && bookForAction && (
        <CompensateModal
          book={bookForAction}
          residents={residents}
          onClose={() => setShowCompensateModal(false)}
          onSuccess={() => {
            setShowCompensateModal(false);
            handleActionComplete();
            showNotification('success', '赔偿登记成功');
          }}
          onError={(msg) => showNotification('error', msg)}
        />
      )}

      {selectedBook && (
        <BookDetail
          book={selectedBook}
          actionMap={actionMap}
          statusMap={statusMap}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  );
}

export default App;
