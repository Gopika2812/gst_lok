import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, UserCheck, AlertCircle, FileText, Building2, User, Search, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const TaskModal = ({ isOpen, onClose, onRefresh, employees = [], clients = [], defaultAssignee = null }) => {
  const { user: currentUser } = useAuth();

  const [taskName, setTaskName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [department, setDepartment] = useState('GST');
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');

  // Client Search state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef(null);

  const [localEmployees, setLocalEmployees] = useState(employees);
  const [localClients, setLocalClients] = useState(clients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employees && employees.length > 0) {
      setLocalEmployees(employees);
    } else if (isOpen) {
      api.get('/users').then((res) => setLocalEmployees(res.data || [])).catch(console.error);
    }
  }, [isOpen, employees]);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setLocalClients(clients);
    } else if (isOpen) {
      api.get('/clients').then((res) => setLocalClients(res.data || [])).catch(console.error);
    }
  }, [isOpen, clients]);

  useEffect(() => {
    if (defaultAssignee) {
      setAssignedEmployee(defaultAssignee._id || defaultAssignee);
      if (defaultAssignee.department) {
        setDepartment(defaultAssignee.department);
      }
    }
  }, [defaultAssignee, isOpen]);

  // Click outside to close client dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!taskName.trim()) {
      setError('Please enter a Task Title');
      return;
    }

    if (!assignedEmployee) {
      setError('Please select an Assigned Person');
      return;
    }

    if (!dueDate) {
      setError('Please select a Deadline date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/tasks', {
        client: selectedClient || null,
        taskType: selectedClient ? 'Client Task' : 'Common Task',
        department,
        taskName,
        priority,
        assignedEmployee,
        dueDate,
        repeat: 'One Time',
        remarks,
        status: 'Assigned'
      });

      // Reset Form State
      setTaskName('');
      setSelectedClient('');
      setClientSearchQuery('');
      setRemarks('');
      setDueDate('');
      setPriority('Medium');

      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  const currentClientObj = localClients.find((c) => c._id === selectedClient);

  const filteredClients = localClients.filter((c) => {
    const q = clientSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.clientName && c.clientName.toLowerCase().includes(q)) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleSelectClient = (client) => {
    if (!client) {
      setSelectedClient('');
      setIsClientDropdownOpen(false);
      return;
    }
    setSelectedClient(client._id);
    setIsClientDropdownOpen(false);
    if (!taskName.trim()) {
      setTaskName(`${department} Service - ${client.clientName}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded bg-[#C59B27] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider">
                {currentUser?.role === 'Super Admin' ? 'Super Admin' : 'Admin'} Task Assignment
              </span>
              <h3 className="text-lg font-bold text-[#0A1E3F]">Assign Task</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned By: <strong className="text-[#0A1E3F]">{currentUser?.name}</strong> ({currentUser?.role})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          {/* 1. Assigned Department */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-2">
              <Building2 className="h-4 w-4 text-[#C59B27]" />
              <span>Assigned Department *</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['GST', 'Income Tax', 'Accounts', 'Administration'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartment(d)}
                  className={`rounded-xl py-2.5 px-2 text-xs font-bold transition border ${
                    department === d
                      ? 'bg-[#C59B27] text-white border-[#C59B27] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Searchable Registered Client Selection */}
          <div ref={clientDropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <User className="h-4 w-4 text-[#0A1E3F]" />
                <span>Registered Client (Optional)</span>
              </label>
              {selectedClient && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient('');
                    setClientSearchQuery('');
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Custom Dropdown Trigger Button */}
            <div
              onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
              className={`w-full rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                isClientDropdownOpen
                  ? 'border-[#C59B27] bg-white ring-2 ring-[#C59B27]/20'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="truncate pr-2">
                {currentClientObj ? (
                  <span className="font-bold text-[#0A1E3F]">
                    {currentClientObj.clientName}
                    {currentClientObj.tradeName ? ` (${currentClientObj.tradeName})` : ''}
                    {currentClientObj.phone ? ` - ${currentClientObj.phone}` : ''}
                  </span>
                ) : (
                  <span className="text-slate-400">Select registered client or leave empty for general task...</span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isClientDropdownOpen ? 'rotate-180 text-[#C59B27]' : ''}`} />
            </div>

            {/* Search Dropdown Menu */}
            {isClientDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
                {/* Search Bar Input */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Search client by name, trade name, or phone..."
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-[#C59B27]"
                    />
                    {clientSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setClientSearchQuery('')}
                        className="absolute right-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Clients List */}
                <div className="overflow-y-auto max-h-48 divide-y divide-slate-50 p-1">
                  {/* Option: No Client */}
                  <div
                    onClick={() => handleSelectClient(null)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                      !selectedClient ? 'bg-amber-50 text-[#C59B27] font-bold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>No Client (Internal General Task)</span>
                    {!selectedClient && <Check className="h-4 w-4 text-[#C59B27]" />}
                  </div>

                  {filteredClients.map((client) => {
                    const isSelected = selectedClient === client._id;
                    return (
                      <div
                        key={client._id}
                        onClick={() => handleSelectClient(client)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                          isSelected ? 'bg-amber-50 text-[#0A1E3F] font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-[#0A1E3F] truncate">{client.clientName}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {client.tradeName && <span className="mr-2">{client.tradeName}</span>}
                            {client.phone && <span>{client.phone}</span>}
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-[#C59B27] shrink-0" />}
                      </div>
                    );
                  })}

                  {filteredClients.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No matching clients found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Task Title */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
              <FileText className="h-4 w-4 text-[#0A1E3F]" />
              <span>Task Title *</span>
            </label>
            <input
              type="text"
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Monthly GST Return Filing or Audit Review"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C59B27] focus:bg-white focus:ring-2 focus:ring-[#C59B27]/20"
            />
          </div>

          {/* 4. Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Description / Instructions</span>
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter detailed task description or guidelines for the executive..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 outline-none transition focus:border-[#C59B27] focus:bg-white focus:ring-2 focus:ring-[#C59B27]/20"
            />
          </div>

          {/* 5. Assigned Person, Task Priority, Deadline */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Assigned Person */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
                <UserCheck className="h-4 w-4 text-[#0A1E3F]" />
                <span>Assigned Person *</span>
              </label>
              <select
                required
                value={assignedEmployee}
                onChange={(e) => setAssignedEmployee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C59B27] focus:bg-white"
              >
                <option value="">-- Select Person --</option>
                <optgroup label="👑 Super Admin & Leadership">
                  {localEmployees
                    .filter((e) => e.role === 'Super Admin')
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.designation || 'Super Admin'} - {e.department})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Department Admins & Managers">
                  {localEmployees
                    .filter((e) => e.role && e.role.includes('Admin') && e.role !== 'Super Admin')
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.designation || e.role} - {e.department})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Junior Executives & Staff">
                  {localEmployees
                    .filter((e) => !e.role || !e.role.includes('Admin'))
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.designation || e.role} - {e.department})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Task Priority */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>Task Priority *</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C59B27] focus:bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            {/* Deadline */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
                <Calendar className="h-4 w-4 text-rose-500" />
                <span>Deadline *</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C59B27] focus:bg-white"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#C59B27] px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-[#A68018] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Assigning Task...' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
