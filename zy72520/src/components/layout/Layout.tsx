import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-6 py-8 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
