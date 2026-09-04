import React, { useState } from 'react';
import { X, UserPlus, ArrowRight, ShieldCheck, User } from 'lucide-react';
import api from '../../services/api';

const DelegateModal = ({ isOpen, onClose, task, employees = [], onDelegated, currentUser }) => {
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  // Filter employees: prefer Junior Executives / Staff in task's department or all staff
  const staffEmployees = employees.filter((e) => {
    if (e.role === 'Super Admin') return false;
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedEmployee) {
      setError('Please select a Junior Executive / Staff to assign');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.put(`/tasks/${task._id}/delegate`, {
        assignedEmployee,
        remarks: remarks || task.remarks
      });

      onDelegated && onDelegated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delegate task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0A1E3F]">Delegate Task to Staff</h3>
              <p className="text-xs text-slate-500">Assign task to a Junior Executive</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Task Info Summary */}
          <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
            <h4 className="text-xs font-extrabold text-[#0A1E3F]">{task.taskName}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dept: <strong className="text-slate-700">{task.department}</strong> • Currently Assigned To: <strong className="text-[#C59B27]">{task.assignedEmployee?.name || 'Unassigned'}</strong>
            </p>
          </div>

          {/* Select Junior Executive */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Select Junior Executive / Staff *</label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-[#C59B27]">
              <User className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
              <select
                required
                value={assignedEmployee}
                onChange={(e) => setAssignedEmployee(e.target.value)}
                className="w-full bg-transparent text-xs font-extrabold text-[#0A1E3F] outline-none cursor-pointer"
              >
                <option value="">-- Choose Junior Executive --</option>
                <optgroup label={`${task.department} Department Executives`}>
                  {staffEmployees
                    .filter((e) => e && e.department === task.department && (!e.role || !e.role.includes('Admin')))
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        👤 {e.name} ({e.designation || e.role})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="All Staff & Department Admins">
                  {staffEmployees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.role && e.role.includes('Admin') ? '👑' : '👤'} {e.name} ({e.designation || e.role} - {e.department})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Additional Instructions / Remarks */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Task Instructions for Junior</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Please verify customer documents before filing GSTR1..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end space-x-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-xl bg-[#C59B27] px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-[#A68018] transition"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? 'Delegating...' : 'Delegate Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DelegateModal;
