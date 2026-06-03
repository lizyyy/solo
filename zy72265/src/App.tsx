import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Shield, FileText, MapPin, BookOpen, User } from "lucide-react";
import { EnvelopeList } from "@/pages/EnvelopeList";
import { EnvelopeDetail } from "@/pages/EnvelopeDetail";
import BoundaryRules from "@/pages/BoundaryRules";
import PublishedEnvelopes from "@/pages/PublishedEnvelopes";
import { useEnvelopeStore } from "@/store/envelopeStore";

function Navbar() {
  const location = useLocation();
  const { currentUser, setCurrentUser } = useEnvelopeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: "/", label: "安全包络列表", icon: Shield },
    { path: "/published", label: "已发布说明", icon: FileText },
    { path: "/rules", label: "边界规则", icon: BookOpen },
  ];

  const users = ["许工", "巡检组", "现场班组", "系统管理员"];

  return (
    <nav className="bg-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <MapPin className="w-8 h-8 text-blue-400" />
            <span className="text-xl font-bold">工厂机械臂安全包络</span>
          </div>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              <User className="w-5 h-5" />
              <span>{currentUser}</span>
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                {users.map((user) => (
                  <button
                    key={user}
                    onClick={() => {
                      setCurrentUser(user);
                      setShowUserMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-slate-100 ${
                      currentUser === user ? "bg-blue-50 text-blue-600" : "text-slate-700"
                    }`}
                  >
                    {user}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<EnvelopeList />} />
            <Route path="/envelopes/:id" element={<EnvelopeDetail />} />
            <Route path="/published" element={<PublishedEnvelopes />} />
            <Route path="/rules" element={<BoundaryRules />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
