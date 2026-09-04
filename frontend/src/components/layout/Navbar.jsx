import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Search,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  Send,
  Lock,
  Radio
} from 'lucide-react';
import {
  registerServiceWorker,
  subscribeToPushNotifications,
  sendTestPushNotification,
  getNotificationPermission
} from '../../services/notificationService';

const Navbar = ({ onSearchChange, globalSearch, onToggleMobileMenu, isSidebarCollapsed }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [permStatus, setPermStatus] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testCountdown, setTestCountdown] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    registerServiceWorker();
    setPermStatus(getNotificationPermission());
  }, []);

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    setActionMessage(null);
    try {
      await subscribeToPushNotifications();
      setPermStatus('granted');
      setActionMessage({ type: 'success', text: '✅ Chrome & Mobile lock screen alerts enabled successfully!' });
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: err.message || 'Failed to enable notifications.' });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestLockScreen = async (delay = 5) => {
    setActionMessage(null);
    try {
      if (permStatus !== 'granted') {
        await subscribeToPushNotifications();
        setPermStatus('granted');
      }

      setTestCountdown(delay);
      await sendTestPushNotification(delay);

      const interval = setInterval(() => {
        setTestCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setActionMessage({ type: 'success', text: '🎯 Notification sent! Check your phone/lock-screen.' });
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setTestCountdown(null);
      setActionMessage({ type: 'error', text: err.message || 'Failed to trigger test push.' });
    }
  };

  const mockNotifications = [
    { id: 1, title: 'GST Filing Due Soon', text: 'GSTR-3B for monthly return due on 20th', time: '10m ago', icon: AlertTriangle, type: 'warning' },
    { id: 2, title: 'Certificate Received', text: 'Royal Accounting registration certificate updated', time: '1h ago', icon: CheckCircle2, type: 'success' },
    { id: 3, title: 'New Invoice Generated', text: 'INV-2026-0001 created successfully', time: '3h ago', icon: Calendar, type: 'info' }
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 sm:px-6 backdrop-blur-md">
      <div className="flex items-center flex-1 pr-2">
        {/* Sidebar Toggle Button (Desktop & Mobile) */}
        <button
          onClick={onToggleMobileMenu}
          className="mr-2 sm:mr-3 rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-[#0A1E3F] flex items-center justify-center"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label="Toggle sidebar menu"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5 hidden lg:block text-[#C59B27]" />
          ) : (
            <PanelLeftClose className="h-5 w-5 hidden lg:block text-slate-600" />
          )}
          <Menu className="h-5 w-5 lg:hidden" />
        </button>

        {/* Global Search Bar */}
        <div className="flex w-full max-w-[200px] xs:max-w-xs sm:max-w-none sm:w-72 md:w-96 items-center rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 sm:py-2 transition focus-within:border-[#C59B27] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#C59B27]/20">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={globalSearch || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search clients, invoices, tasks..."
            className="w-full bg-transparent text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Right Header Controls */}
      <div className="flex items-center space-x-4">
        {/* System Date Badge */}
        <div className="hidden items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex">
          <Calendar className="mr-1.5 h-3.5 w-3.5 text-[#0A1E3F]" />
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-[#0A1E3F]"
            title="Notifications & Screen-Lock Alerts"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C59B27] opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C59B27]"></span>
            </span>
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-slate-800 text-sm">Notifications & Alerts</h4>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Live</span>
                </div>
                {permStatus === 'granted' ? (
                  <span className="flex items-center text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Radio className="h-3 w-3 mr-1 text-emerald-500 animate-pulse" />
                    Lock-Screen Active
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Push Inactive
                  </span>
                )}
              </div>

              {/* Push Notification Activation Card */}
              <div className="my-3 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-900 to-[#0A1E3F] p-3 text-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="rounded-lg bg-white/10 p-1.5">
                      <Smartphone className="h-4 w-4 text-[#C59B27]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Mobile Lock-Screen Alerts</p>
                      <p className="text-[10px] text-slate-300">Get instant task alerts even when locked</p>
                    </div>
                  </div>
                </div>

                {testCountdown !== null ? (
                  <div className="mt-2.5 flex items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/30 p-2 text-center">
                    <Lock className="h-4 w-4 mr-1.5 text-amber-300 animate-bounce" />
                    <span className="text-xs font-medium text-amber-200">
                      🔒 Lock phone now! Alert in <b>{testCountdown}s</b>...
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {permStatus !== 'granted' ? (
                      <button
                        onClick={handleEnablePush}
                        disabled={isSubscribing}
                        className="col-span-2 flex items-center justify-center rounded-lg bg-[#C59B27] px-2.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-[#b08e4c] disabled:opacity-50"
                      >
                        {isSubscribing ? 'Enabling...' : '🔔 Enable Chrome & Mobile Alerts'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleTestLockScreen(5)}
                          className="flex items-center justify-center rounded-lg bg-[#C59B27] px-2 py-1.5 text-[11px] font-bold text-slate-950 transition hover:bg-[#b08e4c]"
                          title="Gives you 5 seconds to lock your mobile phone before firing push alert"
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          Test Lock Screen (5s)
                        </button>
                        <button
                          onClick={() => handleTestLockScreen(0)}
                          className="flex items-center justify-center rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/20"
                        >
                          <Send className="h-3 w-3 mr-1 text-[#C59B27]" />
                          Instant Test
                        </button>
                      </>
                    )}
                  </div>
                )}

                {actionMessage && (
                  <div className={`mt-2 rounded-lg p-1.5 text-[11px] ${actionMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'}`}>
                    {actionMessage.text}
                  </div>
                )}
              </div>

              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">Recent Activity</div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {mockNotifications.map((n) => (
                  <div key={n.id} className="py-2 flex items-start space-x-2.5 hover:bg-slate-50 rounded-lg p-1.5 transition">
                    <n.icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.type === 'warning' ? 'text-amber-500' : n.type === 'success' ? 'text-emerald-600' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{n.title}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{n.text}</p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Card */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 pr-3 transition hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A1E3F] border border-[#C59B27]/40 font-bold text-xs text-[#DFB135] shadow-sm">
              {user?.name ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2) : 'RA'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name || 'Logunathan'}</p>
              <div className="flex items-center space-x-1">
                <ShieldCheck className="h-3 w-3 text-[#C59B27]" />
                <span className="text-[10px] font-medium text-slate-500">{user?.role || 'Super Admin'}</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-800">{user?.name || 'Logunathan'}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email || 'royallogu2020@gmail.com'}</p>
              </div>
              <div className="py-1">
                <div className="px-3 py-1.5 text-xs text-slate-600 flex justify-between items-center">
                  <span>Department</span>
                  <span className="font-semibold text-[#0A1E3F]">{user?.department || 'Management'}</span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={logout}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
