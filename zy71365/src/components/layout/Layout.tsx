import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
