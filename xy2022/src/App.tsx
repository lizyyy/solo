import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import DogsPage from './pages/DogsPage';
import AddressesPage from './pages/AddressesPage';
import WalletPage from './pages/WalletPage';
import CouponsPage from './pages/CouponsPage';
import FavoritesPage from './pages/FavoritesPage';
import ReviewsPage from './pages/ReviewsPage';
import ChatPage from './pages/ChatPage';
import ReportPage from './pages/ReportPage';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/dogs" element={<DogsPage />} />
          <Route path="/profile/addresses" element={<AddressesPage />} />
          <Route path="/profile/wallet" element={<WalletPage />} />
          <Route path="/profile/coupons" element={<CouponsPage />} />
          <Route path="/profile/favorites" element={<FavoritesPage />} />
          <Route path="/profile/reviews" element={<ReviewsPage />} />
          <Route path="/profile/chat" element={<ChatPage />} />
          <Route path="/profile/report" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
