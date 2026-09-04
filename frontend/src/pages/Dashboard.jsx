import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import GlacierCard from '../components/common/GlacierCard';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import TaskModal from '../components/tasks/TaskModal';
import ClientModal from '../components/clients/ClientModal';
import TaskTable from '../components/tasks/TaskTable';
import CardDetailModal from '../components/dashboard/CardDetailModal';
import api from '../services/api';
import { exportToCSV, printExecutiveReport } from '../utils/exportUtils';
import {
  Users,
  Award,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Filter,
  BarChart2,
  ShieldCheck,
  CheckSquare,
  FileCheck,
  XCircle,
  PlayCircle,
  Download,
  Printer,
  ChevronDown,
  UserCheck,
  Building2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Eye
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtration States: Default 'All Time' so all existing data is immediately shown
  const [dateFilter, setDateFilter] = useState('All Time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState('All');

  // Modals & Dropdowns
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [cardModalData, setCardModalData] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [myTasks, setMyTasks] = useState([]);

  const isSuperAdmin = user?.role === 'Super Admin';
  const isAdmin = user?.role && user.role.includes('Admin') && !isSuperAdmin;
  const isExecutive = !isSuperAdmin && !isAdmin;

  // Click outside to close Export menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async (isInitial = false) => {
    if (isInitial || !summary) setLoading(true);
    try {
      const [sumRes, clientRes, userRes, taskRes] = await Promise.all([
        api.get('/reports/dashboard-summary', {
          params: {
            dateFilter,
            startDate: fromDate || undefined,
            endDate: toDate || undefined,
            department: selectedDept !== 'All' ? selectedDept : undefined,
            employeeId: selectedEmployee !== 'All' ? selectedEmployee : undefined
          }
        }),
        isSuperAdmin || isAdmin ? api.get('/clients') : Promise.resolve({ data: [] }),
        isSuperAdmin || isAdmin ? api.get('/users') : Promise.resolve({ data: [] }),
        api.get('/tasks', { params: { myTasksOnly: isExecutive ? true : false } })
      ]);
      setSummary(sumRes.data);
      setClients(clientRes.data);
      setEmployees(userRes.data);
      setMyTasks(taskRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false);
  }, [dateFilter, fromDate, toDate, selectedDept, selectedEmployee]);

  const handleQuickPreset = (preset) => {
    setDateFilter(preset);
    const now = new Date();
    if (preset === 'Today') {
      const todayStr = now.toISOString().split('T')[0];
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'This Week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    } else if (preset === 'This Month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    } else if (preset === 'All Time') {
      setFromDate('');
      setToDate('');
    }
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      fetchDashboardData();
    } catch (err) {
      alert('Failed to update task status');
    }
  };

  const counters = summary?.counters || {};
  const details = summary?.details || {};

  const handleCardClick = (title, subtitle, type, items) => {
    setCardModalData({
      title,
      subtitle,
      type,
      items: items || []
    });
  };

  const handleExportCSV = () => {
    setIsExportMenuOpen(false);
    const tasksToExport = details.allFilteredTasks || [];
    const headers = {
      'client.clientName': 'Client Name',
      'client.gstin': 'GSTIN',
      taskName: 'Service / Task Name',
      department: 'Department',
      'assignedEmployee.name': 'Assigned Executive',
      dueDate: 'Due Date',
      priority: 'Priority',
      status: 'Status'
    };
    exportToCSV(`RoyalAccounting_OperationsReport_${dateFilter}`, tasksToExport, headers);
  };

  const handlePrintReport = () => {
    setIsExportMenuOpen(false);
    const selectedEmpObj = employees.find((e) => e._id === selectedEmployee);
    printExecutiveReport({
      filters: {
        dateFilter: fromDate && toDate ? `${fromDate} to ${toDate}` : dateFilter,
        department: selectedDept,
        employeeName: selectedEmpObj ? `${selectedEmpObj.name} (${selectedEmpObj.role})` : 'All Executives'
      },
      counters,
      tasks: details.allFilteredTasks || [],
      user
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Profile Card & Quick Actions */}
      <div className="relative z-20 overflow-visible rounded-3xl bg-gradient-to-r from-[#0A1E3F] via-[#16385C] to-[#07152B] p-4 sm:p-6 text-white shadow-xl border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-[#C59B27] text-lg sm:text-xl font-bold text-white shadow-md border border-white/20">
              {user?.name ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2) : 'VA'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-white">Welcome back, {user?.name || 'User'}</h1>
                <span className="rounded-full bg-[#C59B27] px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-xs">
                  {user?.role || 'Staff'}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1">
                Firm Operations • Department: <strong className="text-white font-bold">{user?.department || 'General'}</strong>
                {isExecutive && <span className="ml-2 font-medium text-emerald-300">• My Daily Work Dashboard</span>}
              </p>
            </div>
          </div>

          {/* Action Buttons & Professional Export */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Professional Export Dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center space-x-1.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/20 transition hover:bg-white/20 cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4 text-[#C59B27]" />
                <span>Export Report</span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform duration-150 ${isExportMenuOpen ? 'rotate-180 text-[#C59B27]' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white p-2 text-slate-800 shadow-2xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-[#C59B27] shrink-0" />
                    <span>Export to Excel / CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0A1E3F] transition cursor-pointer mt-1"
                  >
                    <Printer className="h-4 w-4 text-[#0A1E3F] shrink-0" />
                    <span>Print Executive Summary</span>
                  </button>
                </div>
              )}
            </div>

            {(isSuperAdmin || isAdmin) && (
              <>
                {isSuperAdmin && (
                  <button
                    onClick={() => setIsClientModalOpen(true)}
                    className="flex items-center space-x-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/20 transition hover:bg-white/20 cursor-pointer"
                  >
                    <span>Add Client</span>
                  </button>
                )}
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="flex items-center space-x-1.5 rounded-xl bg-[#C59B27] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#A68018] cursor-pointer"
                >
                  <span>Assign Task</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FILTER CONTROL BAR: From / To Date Pickers + Quick Presets + Dept + User Filters */}
      <GlacierCard className="p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Quick Preset Buttons */}
          <div className="flex items-center space-x-1 rounded-xl bg-slate-100 p-1 overflow-x-auto no-scrollbar">
            {['All Time', 'Today', 'This Week', 'This Month'].map((preset) => (
              <button
                key={preset}
                onClick={() => handleQuickPreset(preset)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  dateFilter === preset
                    ? 'bg-white text-[#0A1E3F] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Explicit From Date ➔ To Date Pickers */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDateFilter('Custom');
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold">➔</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDateFilter('Custom');
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              />
            </div>
          </div>

          {/* Department & User Wise Filtration */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Department Filter */}
            <div className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
              >
                <option value="All">All Departments</option>
                <option value="GST">GST Department</option>
                <option value="Income Tax">Income Tax Department</option>
                <option value="Accounts">Accounts Department</option>
                <option value="Book Keeping">Book Keeping Department</option>
                <option value="Registration">Registration Department</option>
                <option value="Administration">Administration</option>
              </select>
            </div>

            {/* User / Executive Wise Filter */}
            {(isSuperAdmin || isAdmin) && (
              <div className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1">
                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer max-w-[160px]"
                >
                  <option value="All">All Executives</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </GlacierCard>

      {/* 1st ROW: FIRM TASK PROCESS OVERVIEW (SHOW IN 1ST AS REQUESTED) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-[#0A1E3F] uppercase tracking-wider">
            {isExecutive
              ? 'My Daily Task Workflow (Click card to inspect details)'
              : 'Firm Task Process Overview (Click card to inspect client & service status)'}
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">
            Period: <strong className="text-[#0A1E3F]">{fromDate && toDate ? `${fromDate} to ${toDate}` : dateFilter}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div
            onClick={() =>
              handleCardClick(
                "Today's Assigned Tasks",
                'Tasks assigned, due, or created for today',
                'tasks',
                details.todaysTasks
              )
            }
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <StatCard
              title="Today's Tasks"
              value={counters.todaysTasksCount || 0}
              subtitle="Assigned or created today"
              icon={Calendar}
              color="navy"
            />
          </div>

          <div
            onClick={() =>
              handleCardClick(
                'In Progress Tasks',
                'Tasks currently undergoing executive work',
                'tasks',
                details.inProgressTasks
              )
            }
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <StatCard
              title="In Progress Tasks"
              value={counters.inProgressTasksCount || 0}
              subtitle="Currently undergoing work"
              icon={Clock}
              color="blue"
            />
          </div>

          <div
            onClick={() =>
              handleCardClick(
                'Completed Tasks',
                'Tasks successfully completed and verified',
                'tasks',
                details.completedTasks
              )
            }
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <StatCard
              title="Completed Tasks"
              value={counters.completedTasksCount || 0}
              subtitle="Successfully completed"
              icon={CheckCircle2}
              color="green"
            />
          </div>

          <div
            onClick={() =>
              handleCardClick(
                "Can't Complete / On Hold",
                'Tasks waiting on client documents or on hold',
                'tasks',
                details.cantCompleteTasks
              )
            }
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <StatCard
              title="Can't Complete"
              value={counters.cantCompleteTasksCount || 0}
              subtitle="On hold / pending info"
              icon={XCircle}
              color="amber"
            />
          </div>

          <div
            onClick={() =>
              handleCardClick(
                'Overdue Tasks',
                'Tasks that have passed their deadline date without completion',
                'tasks',
                details.overdueTasks
              )
            }
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <StatCard
              title="Overdue Tasks"
              value={counters.overdueTasksCount || 0}
              subtitle="Passed deadline date"
              icon={AlertTriangle}
              color="rose"
            />
          </div>
        </div>
      </div>

      {/* 2nd ROW: SUPERADMIN ONLY METRICS (CLIENT COUNT, REGISTERED, CERTIFICATION, BILLING VALUE) */}
      {isSuperAdmin && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-[#C59B27]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0A1E3F]">
              Executive Firm KPI Summary (Click any card to inspect records)
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              onClick={() =>
                handleCardClick(
                  'Total Onboarded Clients',
                  'All active client records across departments',
                  'clients',
                  details.allClientsList
                )
              }
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <StatCard
                title="Total Clients"
                value={counters.totalClients || 0}
                subtitle="All onboarded active clients"
                icon={Users}
                color="navy"
              />
            </div>

            <div
              onClick={() =>
                handleCardClick(
                  'Registered Clients',
                  `Clients registered in selected period (${dateFilter})`,
                  'clients',
                  details.allClientsList
                )
              }
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <StatCard
                title="Registered Clients"
                value={counters.registeredClientsCount || 0}
                subtitle={`Registered for ${dateFilter}`}
                icon={FileCheck}
                color="blue"
              />
            </div>

            <div
              onClick={() =>
                handleCardClick(
                  'Certification Pending Clients',
                  'Clients awaiting certification approval & upload',
                  'certifications',
                  details.allPendingCertificates
                )
              }
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <StatCard
                title="Certification Pending"
                value={counters.pendingCertificatesCount || 0}
                subtitle="Waiting for certificate upload"
                icon={Award}
                color="amber"
              />
            </div>

            <div
              onClick={() =>
                handleCardClick(
                  'Total Billing Value Invoices',
                  `Invoices generated in selected period (${dateFilter})`,
                  'invoices',
                  details.allFilteredInvoices
                )
              }
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <StatCard
                title="Total Billing Value"
                value={`₹${(counters.totalBillingValue || 0).toLocaleString('en-IN')}`}
                subtitle={`Collected: ₹${(counters.totalCollected || 0).toLocaleString('en-IN')}`}
                icon={Receipt}
                color="green"
              />
            </div>
          </div>
        </div>
      )}

      {/* CLIENT SUBSCRIBED SERVICE REMINDERS (START DATE ➔ DUE DATE) */}
      <GlacierCard
        title="Client Service Filing Reminders"
        subtitle="Active Start Date to Due Date Tracking (Completed services are automatically dismissed for the month)"
      >
        <div className="mt-2 space-y-3">
          {(() => {
            const isServiceCompletedThisMonth = (client, service) => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();

              return myTasks.some((t) => {
                const taskDate = new Date(t.dueDate || t.createdAt);
                const sameClient = String(t.client?._id || t.client) === String(client._id);
                const sameMonth = taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
                const sameService =
                  (t?.taskName && service?.subServiceName && t.taskName.toLowerCase().includes(service.subServiceName.toLowerCase())) ||
                  (service?.subServiceName && t?.taskName && service.subServiceName.toLowerCase().includes(t.taskName.toLowerCase())) ||
                  (t?.department && service?.department && t.department === service.department);
                return sameClient && sameMonth && sameService && t.status === 'Completed';
              });
            };

            const activeReminders = clients.flatMap((client) =>
              (client.subscribedServices || []).filter((service) => {
                if (isExecutive) {
                  const isAssigned =
                    String(service.assignedStaff) === String(user?._id) ||
                    String(client.responsibleEmployee?._id || client.responsibleEmployee) === String(user?._id);
                  if (!isAssigned) return false;
                }
                if (selectedDept !== 'All' && service.department !== selectedDept) return false;
                return !isServiceCompletedThisMonth(client, service);
              }).map((service, idx) => ({ client, service, idx }))
            );

            if (activeReminders.length === 0) {
              return (
                <div className="py-6 text-center text-xs text-slate-400">
                  {clients.length === 0
                    ? 'No client service subscriptions configured yet.'
                    : 'All client service reminders for this period are completed and up to date! 🎉'}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeReminders.map(({ client, service, idx }) => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();

                  const startDate = new Date(year, month, service.startDayOfMonth || 1);
                  const dueDate = new Date(year, month, service.dueDayOfMonth || 11);

                  const startDateStr = startDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });
                  const dueDateStr = dueDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });

                  const assignedStaffObj =
                    employees.find((e) => String(e._id) === String(service.assignedStaff)) ||
                    client.responsibleEmployee;

                  return (
                    <div
                      key={`${client._id}-${idx}`}
                      className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 hover:bg-slate-100/60 transition space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#0A1E3F] text-white">
                            {service.department}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">{service.subServiceName}</h4>
                          <p className="text-[11px] font-semibold text-[#C59B27]">{client.clientName}</p>
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Due: {dueDateStr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                        <span>
                          Window: <strong>{startDateStr}</strong> ➔ <strong>{dueDateStr}</strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Assigned Staff:</span>
                        <strong className="text-slate-800">{assignedStaffObj?.name || 'Assigned Executive'}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </GlacierCard>

      {/* EXECUTIVE / STAFF TAILORED WORKFLOW TABLE */}
      {isExecutive ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#0A1E3F] flex items-center space-x-2">
              <CheckSquare className="h-4 w-4 text-[#C59B27]" />
              <span>My Daily Assigned Tasks</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">Showing {myTasks.length} tasks</span>
          </div>

          <TaskTable
            tasks={myTasks}
            onStatusChange={handleTaskStatusChange}
            currentUser={user}
          />
        </div>
      ) : null}

      {/* CARD DETAIL POPUP MODAL (Shows client name, service, executive & status upon clicking any card) */}
      <CardDetailModal
        isOpen={!!cardModalData}
        onClose={() => setCardModalData(null)}
        modalData={cardModalData}
        onRefresh={fetchDashboardData}
        clients={clients}
        employees={employees}
      />

      {/* Task & Client Modals for Super Admin / Admin */}
      {(isSuperAdmin || isAdmin) && (
        <>
          <TaskModal
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            onRefresh={fetchDashboardData}
            clients={clients}
            employees={employees}
          />
          {isSuperAdmin && (
            <ClientModal
              isOpen={isClientModalOpen}
              onClose={() => setIsClientModalOpen(false)}
              onRefresh={fetchDashboardData}
              employees={employees}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
