import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, User, Clock, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Building2, Trash2, UserPlus, Receipt, Printer } from 'lucide-react';
import Badge from '../common/Badge';
import { SortableHeader, sortTableData } from '../common/SortableHeader';
import InvoiceModal from '../billing/InvoiceModal';
import api from '../../services/api';
import { findTaskInvoice, viewOrPrintInvoice } from '../../utils/billingUtils';

const TaskTable = ({ tasks = [], onStatusChange, onDeleteTask, onDelegateTask, currentUser, onRefresh, invoices = [] }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceInitialData, setInvoiceInitialData] = useState(null);
  const [allInvoices, setAllInvoices] = useState(invoices);

  useEffect(() => {
    if (invoices && invoices.length > 0) {
      setAllInvoices(invoices);
    } else {
      api.get('/invoices').then((res) => setAllInvoices(res.data || [])).catch(() => {});
    }
  }, [invoices]);

  const handleOpenInvoice = (task) => {
    const clientId = task.client?._id || task.client || '';
    setInvoiceInitialData({
      taskId: task._id,
      client: clientId,
      clientId: clientId,
      clientObj: task.client,
      serviceType: task.taskName || task.department || 'GST Filing GSTR-3B & GSTR-1',
      department: task.department || 'GST',
      taskName: task.taskName,
      items: [
        {
          description: `${task.taskName || task.department || 'Professional Service'} Fee`,
          amount: 5000
        }
      ],
      remarks: task.remarks ? `Billing for completed task: ${task.taskName} - ${task.remarks}` : `Billing for completed task: ${task.taskName}`,
      moveToTaskAssignment: false
    });
    setIsInvoiceModalOpen(true);
  };

  const statusOptions = ['Assigned', 'In Progress', 'Completed', "Can't Complete"];

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Assigned':
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case "Can't Complete":
      case 'On Hold':
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const isSuperOrDeptAdmin = currentUser && (currentUser.role === 'Super Admin' || currentUser.role.includes('Admin'));

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedTasks = useMemo(() => {
    return sortTableData(tasks, sortConfig);
  }, [tasks, sortConfig]);

  return (
    <div className="glacier-card p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[950px]">
          <thead className="bg-[#0A1E3F] text-white">
            <tr>
              <SortableHeader label="Task Title & Details" sortKey="taskName" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Type & Department" sortKey="department" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Client Context" sortKey="client.clientName" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Hierarchy Flow (Assigned By ➔ To)" sortKey="assignedTo.name" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Priority" sortKey="priority" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Deadline" sortKey="dueDate" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Status Update" sortKey="status" currentSort={sortConfig} onSort={handleSort} align="center" />
              {isSuperOrDeptAdmin && <th className="p-3.5 text-center font-semibold text-white">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400 font-medium">
                  No tasks found matching your filter criteria.
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => {
                const isOverdue = new Date(task.dueDate) < new Date() && !['Completed', "Can't Complete"].includes(task.status);
                const createdDateTimeFormatted = (task.createdAt || task.assignedDate)
                  ? new Date(task.createdAt || task.assignedDate).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : new Date().toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                const matchedInvoice = findTaskInvoice(task, allInvoices);
                const isBilled = task.isBilled || !!matchedInvoice;

                return (
                  <tr key={task._id} className="hover:bg-slate-50 transition">
                    {/* Title & Remarks */}
                    <td className="p-3.5 max-w-[240px]">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <h4 className="font-extrabold text-slate-800 text-xs leading-snug">{task.taskName}</h4>
                      </div>
                      {task.remarks && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">{task.remarks}</p>
                      )}
                      <div className="mt-1 flex items-center space-x-1 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>Created: <strong className="font-semibold text-slate-600">{createdDateTimeFormatted}</strong></span>
                      </div>
                    </td>

                    {/* Task Type & Department */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          task.taskType === 'Client Task' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {task.taskType || (task.client ? 'Client Task' : 'Common Task')}
                        </span>
                        <p className="font-bold text-[#0A1E3F] text-xs">{task.department}</p>
                      </div>
                    </td>

                    {/* Client Context */}
                    <td className="p-3.5">
                      {task.client ? (
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{task.client.clientName}</p>
                          <p className="text-[10px] text-slate-500">{task.client.gstin || task.client.pan || 'Active Client'}</p>
                        </div>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                          Common Department Task
                        </span>
                      )}
                    </td>

                    {/* Hierarchy Flow */}
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1 text-[11px]">
                        <span className="font-semibold text-slate-700">{task.assignedBy?.name || 'Super Admin'}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="font-extrabold text-[#C59B27]">{task.assignedEmployee?.name || 'Staff'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        ({task.assignedEmployee?.designation || task.assignedEmployee?.role || 'Executive'})
                      </span>
                      {isSuperOrDeptAdmin && onDelegateTask && (
                        <button
                          onClick={() => onDelegateTask(task)}
                          title="Delegate / Reassign task to Junior Executive"
                          className="mt-1.5 flex items-center space-x-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100 transition cursor-pointer border border-blue-200"
                        >
                          <UserPlus className="h-3 w-3" />
                          <span>Delegate to Junior</span>
                        </button>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="p-3.5">
                      <Badge status={task.priority} />
                    </td>

                    {/* Deadline */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className={`flex items-center space-x-1 font-semibold text-xs ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {isOverdue && <span className="text-[9px] font-extrabold text-rose-600 uppercase">OVERDUE</span>}
                    </td>

                    {/* Interactive Status Selector */}
                    <td className="p-3.5 text-center">
                      <div className="flex flex-col items-center space-y-1.5">
                        <select
                          value={statusOptions.includes(task.status) ? task.status : (task.status === 'Pending' ? 'Assigned' : task.status)}
                          onChange={(e) => onStatusChange && onStatusChange(task._id, e.target.value)}
                          className={`rounded-xl border px-2.5 py-1.5 text-xs font-extrabold outline-none cursor-pointer shadow-xs transition ${getStatusBadgeStyle(task.status)}`}
                        >
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Can't Complete">Can't Complete</option>
                        </select>
                        {task.status === 'Completed' && (
                          isBilled ? (
                            <div className="inline-flex items-center space-x-1">
                              <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Generated</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => viewOrPrintInvoice(matchedInvoice || { _id: task.invoiceId || task.invoice, invoiceNumber: task.invoiceNumber })}
                                title={`View & Print Bill (${matchedInvoice?.invoiceNumber || task.invoiceNumber || 'Invoice'})`}
                                className="inline-flex items-center space-x-1 rounded-lg bg-[#0A1E3F] hover:bg-[#16385C] text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs hover:shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                              >
                                <Printer className="h-3 w-3 text-[#C59B27]" />
                                <span>Print</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenInvoice(task)}
                              title={task.client?.clientName ? `Generate Bill / Invoice for ${task.client.clientName}` : 'Generate Bill / Invoice'}
                              className="inline-flex items-center space-x-1 rounded-lg bg-gradient-to-r from-amber-500 to-[#C59B27] hover:from-amber-600 hover:to-[#A68018] text-white px-2 py-0.5 text-[10px] font-extrabold shadow-2xs hover:shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Make Bill</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>

                    {/* Admin Delete Action */}
                    {isSuperOrDeptAdmin && (
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onDeleteTask && onDeleteTask(task._id, task.taskName)}
                          title="Delete Task"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setInvoiceInitialData(null);
          }}
          onRefresh={() => {
            api.get('/invoices').then((res) => setAllInvoices(res.data || [])).catch(() => {});
            if (onRefresh) onRefresh();
          }}
          initialData={invoiceInitialData}
        />
      )}
    </div>
  );
};

export default TaskTable;
