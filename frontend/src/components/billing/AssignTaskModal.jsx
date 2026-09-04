import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, AlertCircle, CheckCircle2, ShieldCheck, Briefcase, UserCheck } from 'lucide-react';
import api from '../../services/api';

const AssignTaskModal = ({ isOpen, onClose, invoice, onRefresh, employees = [] }) => {
  const [department, setDepartment] = useState('GST');
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [taskName, setTaskName] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState('High');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localEmployees, setLocalEmployees] = useState(employees);

  useEffect(() => {
    if (employees && employees.length > 0) {
      setLocalEmployees(employees);
    } else if (isOpen) {
      api.get('/users').then((res) => setLocalEmployees(res.data)).catch(console.error);
    }
  }, [isOpen, employees]);

  useEffect(() => {
    if (invoice) {
      setTaskName(invoice.serviceType || 'GST Filing');

      // Auto-detect default department from service type
      const st = (invoice.serviceType || '').toLowerCase();
      if (st.includes('income tax') || st.includes('itr') || st.includes('tax audit')) {
        setDepartment('Income Tax');
      } else if (st.includes('book keeping') || st.includes('accounting') || st.includes('tally')) {
        setDepartment('Book Keeping');
      } else if (st.includes('registration') || st.includes('certificate') || st.includes('trademark')) {
        setDepartment('Registration');
      } else if (st.includes('accounts') || st.includes('audit')) {
        setDepartment('Accounts');
      } else {
        setDepartment(invoice.assignedGroup || 'GST');
      }

      if (invoice.assignedEmployee) {
        setAssignedEmployee(invoice.assignedEmployee._id || invoice.assignedEmployee);
      } else if (invoice.client?.responsibleEmployee) {
        setAssignedEmployee(invoice.client.responsibleEmployee._id || invoice.client.responsibleEmployee);
      } else {
        setAssignedEmployee('');
      }

      setRemarks(`Assigned after billing completion for Invoice ${invoice.invoiceNumber}`);
      setError('');
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const filteredEmployees = (localEmployees || []).filter((emp) => {
    if (!emp) return false;
    if (!department) return true;
    const dept = (department || '').toLowerCase();
    return (
      emp.department === department ||
      (emp.role && emp.role.toLowerCase().includes(dept)) ||
      emp.role === 'Super Admin'
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedEmployee) {
      setError('Please select an executive/person to assign this task to');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post(`/invoices/${invoice._id}/assign-task`, {
        department,
        assignedEmployee,
        taskName,
        dueDate,
        priority,
        remarks
      });

      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl bg-emerald-100/80 p-2 text-[#C59B27]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0A1E3F]">Assign Client to Executive</h3>
              <p className="text-xs text-slate-500">
                Invoice <span className="font-mono font-bold text-slate-700">{invoice.invoiceNumber}</span> • {invoice.client?.clientName || 'Client'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3.5 flex items-center rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
            <AlertCircle className="mr-2 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Client & Service Info Badge */}
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Client:</span>
              <span className="font-bold text-[#0A1E3F]">{invoice.client?.clientName || 'Valued Client'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Billing Amount:</span>
              <span className="font-extrabold text-[#C59B27]">₹{invoice.total?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Payment Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                invoice.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                invoice.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {invoice.paymentStatus}
              </span>
            </div>
          </div>

          {/* Service / Task Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-700">Task / Service Title *</label>
            <input
              type="text"
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              placeholder="e.g. GST Filing GSTR-3B & GSTR-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Department / Group */}
            <div>
              <label className="text-[11px] font-bold text-slate-700">Respective Department / Group *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              >
                <option value="GST">GST Department</option>
                <option value="Income Tax">Income Tax Department</option>
                <option value="Accounts">Accounts Department</option>
                <option value="Book Keeping">Book Keeping Department</option>
                <option value="Registration">Registration Department</option>
                <option value="Administration">Administration</option>
              </select>
            </div>

            {/* Respective Person / Executive */}
            <div>
              <label className="text-[11px] font-bold text-slate-700">Respective Person / Executive *</label>
              <select
                required
                value={assignedEmployee}
                onChange={(e) => setAssignedEmployee(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              >
                <option value="">-- Select Executive --</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.designation || emp.role} - {emp.department})
                  </option>
                ))}
                {filteredEmployees.length === 0 && localEmployees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.designation || emp.role} - {emp.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Due Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-700">Task Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] font-bold text-slate-700">Task Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
              >
                <option value="High">High Priority</option>
                <option value="Critical">Critical (Immediate)</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-[11px] font-bold text-slate-700">Special Instructions / Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Verify client bank statement before preparing ledger."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-[#C59B27] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 border-t border-slate-100 pt-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#C59B27] px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#A68018] disabled:opacity-50 cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              <span>{loading ? 'Assigning...' : 'Assign to Executive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTaskModal;
