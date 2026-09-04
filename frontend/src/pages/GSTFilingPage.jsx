import React, { useState, useEffect, useMemo } from 'react';
import GlacierCard from '../components/common/GlacierCard';
import Badge from '../components/common/Badge';
import { SortableHeader, sortTableData } from '../components/common/SortableHeader';
import InvoiceModal from '../components/billing/InvoiceModal';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileCheck,
  Upload,
  Download,
  CheckCircle2,
  Plus,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Search,
  X,
  Filter,
  Receipt
} from 'lucide-react';

const GSTFilingPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filings, setFilings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskForUpload, setSelectedTaskForUpload] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceInitialData, setInvoiceInitialData] = useState(null);

  const handleOpenInvoice = (task) => {
    const clientId = task.client?._id || task.client || '';
    setInvoiceInitialData({
      client: clientId,
      clientId: clientId,
      clientObj: task.client,
      serviceType: task.taskName || 'GST Filing GSTR-3B & GSTR-1',
      department: 'GST',
      taskName: task.taskName || 'GST Filing',
      items: [
        {
          description: `${task.taskName || 'GST Filing'} Fee`,
          amount: 5000
        }
      ],
      remarks: task.remarks ? `Billing for completed GST filing: ${task.remarks}` : `Billing for completed GST filing: ${task.taskName || ''}`,
      moveToTaskAssignment: false
    });
    setIsInvoiceModalOpen(true);
  };

  const [formData, setFormData] = useState({
    client: '',
    filingPeriod: 'August 2026',
    acknowledgementNumber: '',
    remarks: ''
  });
  const [fileDoc, setFileDoc] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchGSTWorkspaceData = async () => {
    setLoading(true);
    try {
      const [taskRes, filRes, clientRes] = await Promise.all([
        api.get('/tasks', { params: { department: 'GST' } }),
        api.get('/filings', { params: { department: 'GST' } }),
        api.get('/clients')
      ]);
      setTasks(taskRes.data);
      setFilings(filRes.data);
      setClients(clientRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGSTWorkspaceData();
  }, []);

  const handleStatusChange = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      fetchGSTWorkspaceData();
    } catch (err) {
      alert('Failed to update task status');
      fetchGSTWorkspaceData();
    }
  };

  const handleOpenUploadModal = (clientObj = null, taskObj = null) => {
    if (clientObj) {
      setFormData({
        client: clientObj._id || clientObj,
        filingPeriod: 'August 2026',
        acknowledgementNumber: '',
        remarks: taskObj ? `Filed for Task: ${taskObj.taskName}` : ''
      });
      setSelectedTaskForUpload(taskObj);
    } else {
      setFormData({
        client: '',
        filingPeriod: 'August 2026',
        acknowledgementNumber: '',
        remarks: ''
      });
      setSelectedTaskForUpload(null);
    }
    setFileDoc(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const data = new FormData();
      data.append('client', formData.client);
      data.append('department', 'GST');
      data.append('filingPeriod', formData.filingPeriod);
      data.append('acknowledgementNumber', formData.acknowledgementNumber);
      data.append('remarks', formData.remarks);
      if (fileDoc) data.append('filedDocument', fileDoc);

      await api.post('/filings', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // If uploaded from a specific task, mark the task completed
      if (selectedTaskForUpload) {
        await api.put(`/tasks/${selectedTaskForUpload._id}/status`, {
          status: 'Completed',
          remarks: `Return filed with ACK: ${formData.acknowledgementNumber}`
        });
      }

      setIsModalOpen(false);
      fetchGSTWorkspaceData();
    } catch (err) {
      alert('Failed to upload GST filing record');
    } finally {
      setUploading(false);
    }
  };

  const [taskSortConfig, setTaskSortConfig] = useState({ key: 'dueDate', direction: 'asc' });
  const [filingSortConfig, setFilingSortConfig] = useState({ key: 'filingDate', direction: 'desc' });

  const filteredTasks = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    return (tasks || []).filter((t) => {
      if (!t) return false;
      const matchesSearch =
        !q ||
        (t.taskName && t.taskName.toLowerCase().includes(q)) ||
        (t.client?.clientName && t.client.clientName.toLowerCase().includes(q)) ||
        (t.client?.gstin && t.client.gstin.toLowerCase().includes(q)) ||
        (t.assignedEmployee?.name && t.assignedEmployee.name.toLowerCase().includes(q));

      const matchesStatus = !statusFilter || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  const sortedTasks = useMemo(() => {
    return sortTableData(filteredTasks, taskSortConfig);
  }, [filteredTasks, taskSortConfig]);

  const sortedFilings = useMemo(() => {
    return sortTableData(filings, filingSortConfig);
  }, [filings, filingSortConfig]);

  const handleTaskSort = (key) => {
    setTaskSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilingSort = (key) => {
    setFilingSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#0A1E3F]">GST Filing Workspace</h1>
          <p className="text-xs text-slate-500">
            Assigned Client Queue • Status Updates (<span className="font-semibold text-blue-600">Assigned</span> ➔ <span className="font-semibold text-amber-600">In Progress</span> ➔ <span className="font-semibold text-emerald-600">Completed</span>) • Upload Filed Acknowledgements
          </p>
        </div>
        <button
          onClick={() => handleOpenUploadModal()}
          className="flex items-center justify-center space-x-1.5 rounded-xl bg-[#C59B27] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#A68018] w-full sm:w-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Filed Return</span>
        </button>
      </div>

      {/* SECTION 1: ASSIGNED GST TASKS WORKSPACE */}
      <GlacierCard className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A1E3F]">Active GST Filing Tasks Queue</h3>
              <p className="text-[11px] text-slate-500">
                Assigned client returns to process & complete ({sortedTasks.length} tasks)
              </p>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <Search className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Client, Return, GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-36 sm:w-48 bg-transparent text-xs outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#C59B27] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Assigned">Assigned (New)</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Can't Complete">Can't Complete</option>
            </select>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-[#0A1E3F] text-white">
              <tr>
                <SortableHeader label="Client Name" sortKey="client.clientName" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="GSTIN" sortKey="client.gstin" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="Return / Service" sortKey="taskName" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="Assigned Executive" sortKey="assignedEmployee.name" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="Due Date" sortKey="dueDate" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="Priority" sortKey="priority" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <SortableHeader label="Process Status" sortKey="status" currentSort={taskSortConfig} onSort={handleTaskSort} />
                <th className="p-3 text-center font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Loading assigned tasks...</td>
                </tr>
              ) : sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No active GST filing tasks assigned yet. Tasks assigned from Billing or Client Master will appear here.
                  </td>
                </tr>
              ) : (
                sortedTasks.map((t) => {
                  const isOverdue = new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== "Can't Complete";
                  return (
                    <tr key={t._id} className={`hover:bg-slate-50 transition ${isOverdue ? 'bg-rose-50/30' : ''}`}>
                      <td className="p-3 font-bold text-slate-800">
                        {t.client?.clientName || 'General GST Task'}
                        {t.client?.tradeName && (
                          <span className="block text-[10px] font-normal text-slate-400">{t.client.tradeName}</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        {t.client?.gstin ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700">{t.client.gstin}</span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-3 font-semibold text-[#0A1E3F]">{t.taskName}</td>
                      <td className="p-3 text-slate-700 font-medium">
                        {t.assignedEmployee?.name || 'Assigned Staff'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold text-slate-700">
                            {new Date(t.dueDate).toLocaleDateString('en-IN')}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center text-[9px] font-extrabold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="mr-0.5 h-3 w-3" /> OVERDUE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                          t.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                          t.priority === 'Medium' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t._id, e.target.value)}
                          className={`rounded-xl border px-2.5 py-1 text-xs font-bold outline-none cursor-pointer transition ${
                            t.status === 'Completed' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' :
                            t.status === 'In Progress' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                            t.status === "Can't Complete" ? 'border-rose-300 bg-rose-50 text-rose-800' :
                            'border-amber-300 bg-amber-50 text-amber-800'
                          }`}
                        >
                          <option value="Assigned">Assigned (New)</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Can't Complete">Can't Complete</option>
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        {t.status !== 'Completed' ? (
                          <button
                            onClick={() => handleOpenUploadModal(t.client, t)}
                            title="Upload Filing Proof & Mark Completed"
                            className="inline-flex items-center space-x-1 rounded-lg bg-[#C59B27] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[#A68018] transition cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload Return</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenInvoice(t)}
                              title={t.client?.clientName ? `Generate Bill / Invoice for ${t.client.clientName}` : 'Generate Bill / Invoice'}
                              className="inline-flex items-center space-x-1 rounded-lg bg-gradient-to-r from-amber-500 to-[#C59B27] hover:from-amber-600 hover:to-[#A68018] text-white px-2 py-0.5 text-[10px] font-extrabold shadow-2xs hover:shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Make Bill</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlacierCard>

      {/* SECTION 2: FILED GST RETURNS HISTORY */}
      <GlacierCard title="Filed GST Returns History" subtitle="Submitted returns, ACK numbers & download proofs" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#0A1E3F] text-white">
              <tr>
                <SortableHeader label="Client Name" sortKey="client.clientName" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="GSTIN" sortKey="client.gstin" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="Filing Period" sortKey="filingPeriod" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="ACK Number" sortKey="acknowledgementNumber" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="Filing Date" sortKey="filingDate" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="Filed By" sortKey="filedBy.name" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <SortableHeader label="Status" sortKey="status" currentSort={filingSortConfig} onSort={handleFilingSort} />
                <th className="p-3.5 text-center font-semibold text-white">Proof File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Loading GST filing records...</td>
                </tr>
              ) : sortedFilings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">No GST filing records submitted yet</td>
                </tr>
              ) : (
                sortedFilings.map((f) => (
                  <tr key={f._id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-800">{f.client?.clientName}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-700">{f.client?.gstin || 'N/A'}</td>
                    <td className="p-3.5 font-semibold text-[#0A1E3F]">{f.filingPeriod}</td>
                    <td className="p-3.5 font-mono text-[11px] text-emerald-700">{f.acknowledgementNumber || 'ACK-PENDING'}</td>
                    <td className="p-3.5 text-slate-600">{new Date(f.filingDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-3.5 font-medium text-slate-800">{f.filedBy?.name || 'GST Staff'}</td>
                    <td className="p-3.5">
                      <Badge status={f.status} />
                    </td>
                    <td className="p-3.5 text-center">
                      {f.filedDocumentUrl ? (
                        <a
                          href={f.filedDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#C59B27] hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>View Proof</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400">No file</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlacierCard>

      {/* Upload Filing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0A1E3F]">Upload GST Filing Acknowledgement</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Client *</label>
                <select
                  required
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold text-slate-800 focus:border-[#C59B27]"
                >
                  <option value="">-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.clientName} ({c.gstin || 'No GSTIN'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Filing Period *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. August 2026, Q2 2026-27"
                  value={formData.filingPeriod}
                  onChange={(e) => setFormData({ ...formData, filingPeriod: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold text-slate-800 focus:border-[#C59B27]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Acknowledgement Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AA3308260001234"
                  value={formData.acknowledgementNumber}
                  onChange={(e) => setFormData({ ...formData, acknowledgementNumber: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold text-slate-800 focus:border-[#C59B27]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Upload Filing Proof (PDF / Image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFileDoc(e.target.files[0])}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-slate-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none text-slate-800 focus:border-[#C59B27] resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-xl bg-[#C59B27] px-5 py-2 font-bold text-white shadow-md hover:bg-[#A68018] disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Submit & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setInvoiceInitialData(null);
          }}
          onRefresh={fetchGSTWorkspaceData}
          clients={clients}
          initialData={invoiceInitialData}
        />
      )}
    </div>
  );
};

export default GSTFilingPage;
