import React, { useState } from 'react';
import { X, Search, Download, CheckCircle2, Clock, AlertTriangle, XCircle, FileText, User, Building2, Receipt } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import InvoiceModal from '../billing/InvoiceModal';

const CardDetailModal = ({ isOpen, onClose, modalData, onRefresh, clients = [], employees = [] }) => {
  const [search, setSearch] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceInitialData, setInvoiceInitialData] = useState(null);

  const handleOpenInvoice = (task) => {
    const clientId = task.client?._id || task.client || '';
    setInvoiceInitialData({
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

  if (!isOpen || !modalData) return null;

  const { title, subtitle, type, items = [] } = modalData;

  const filteredItems = (items || []).filter((item) => {
    if (!item) return false;
    if (!search || !search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (item.client?.clientName && item.client.clientName.toLowerCase().includes(q)) ||
      (item.clientName && item.clientName.toLowerCase().includes(q)) ||
      (item.taskName && item.taskName.toLowerCase().includes(q)) ||
      (item.serviceType && item.serviceType.toLowerCase().includes(q)) ||
      (item.certificateType && item.certificateType.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q)) ||
      (item.assignedEmployee?.name && item.assignedEmployee.name.toLowerCase().includes(q)) ||
      (item.status && item.status.toLowerCase().includes(q)) ||
      (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q))
    );
  });

  const handleExport = () => {
    let headers = {};
    if (type === 'tasks') {
      headers = {
        'client.clientName': 'Client Name',
        'client.gstin': 'GSTIN',
        taskName: 'Service / Task Name',
        department: 'Department',
        'assignedEmployee.name': 'Assigned Executive',
        dueDate: 'Due Date',
        priority: 'Priority',
        status: 'Status'
      };
    } else if (type === 'invoices') {
      headers = {
        invoiceNumber: 'Invoice #',
        'client.clientName': 'Client Name',
        serviceType: 'Service Type',
        total: 'Total (₹)',
        paidAmount: 'Paid (₹)',
        pendingAmount: 'Pending (₹)',
        paymentStatus: 'Payment Status',
        'assignedEmployee.name': 'Assigned Executive'
      };
    } else if (type === 'clients') {
      headers = {
        clientName: 'Client Name',
        tradeName: 'Trade Name',
        gstin: 'GSTIN',
        pan: 'PAN',
        phone: 'Phone',
        status: 'Status',
        'responsibleEmployee.name': 'Responsible Staff'
      };
    } else if (type === 'certifications') {
      headers = {
        'client.clientName': 'Client Name',
        certificateType: 'Certificate / Service',
        department: 'Department',
        status: 'Status',
        'assignedEmployee.name': 'Assigned Staff'
      };
    }

    exportToCSV(`RoyalAccounting_${title.replace(/\s+/g, '_')}`, filteredItems, headers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-extrabold text-[#0A1E3F]">{title}</h3>
              <span className="rounded-full bg-[#0A1E3F] px-2.5 py-0.5 text-xs font-bold text-white">
                {filteredItems.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-[#C59B27]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="py-3 shrink-0">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs">
            <Search className="mr-2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client name, service, department, executive or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 grow">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#0A1E3F] text-white sticky top-0 z-10">
              {type === 'tasks' && (
                <tr>
                  <th className="p-3 font-semibold">Client Name</th>
                  <th className="p-3 font-semibold">Service / Task Name</th>
                  <th className="p-3 font-semibold">Department</th>
                  <th className="p-3 font-semibold">Assigned Executive</th>
                  <th className="p-3 font-semibold">Due Date</th>
                  <th className="p-3 font-semibold">Priority</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              )}
              {type === 'invoices' && (
                <tr>
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Client Name</th>
                  <th className="p-3 font-semibold">Service Type</th>
                  <th className="p-3 font-semibold">Total (₹)</th>
                  <th className="p-3 font-semibold">Paid (₹)</th>
                  <th className="p-3 font-semibold">Pending (₹)</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              )}
              {type === 'clients' && (
                <tr>
                  <th className="p-3 font-semibold">Client Name</th>
                  <th className="p-3 font-semibold">Trade Name</th>
                  <th className="p-3 font-semibold">GSTIN / PAN</th>
                  <th className="p-3 font-semibold">Contact Phone</th>
                  <th className="p-3 font-semibold">Responsible Staff</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              )}
              {type === 'certifications' && (
                <tr>
                  <th className="p-3 font-semibold">Client Name</th>
                  <th className="p-3 font-semibold">Certificate / Service Type</th>
                  <th className="p-3 font-semibold">Department</th>
                  <th className="p-3 font-semibold">Assigned Staff</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No records found matching this card criteria
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  if (type === 'tasks') {
                    const isOverdue =
                      new Date(item.dueDate) < new Date() &&
                      item.status !== 'Completed' &&
                      item.status !== "Can't Complete";
                    return (
                      <tr key={item._id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-800">
                          {item.client?.clientName || 'General Task'}
                          {item.client?.tradeName && (
                            <span className="block text-[10px] font-normal text-slate-400">{item.client.tradeName}</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-[#0A1E3F]">{item.taskName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[10px]">
                            {item.department}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {item.assignedEmployee?.name || 'Unassigned'}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-700">
                            {new Date(item.dueDate).toLocaleDateString('en-IN')}
                          </span>
                          {isOverdue && (
                            <span className="ml-1.5 text-[9px] font-extrabold text-rose-600 bg-rose-100 px-1 py-0.5 rounded">
                              OVERDUE
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                            item.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                            item.priority === 'Medium' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                              item.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              item.status === "Can't Complete" ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {item.status}
                            </span>
                            {item.status === 'Completed' && (
                              <button
                                type="button"
                                onClick={() => handleOpenInvoice(item)}
                                title={item.client?.clientName ? `Generate Bill / Invoice for ${item.client.clientName}` : 'Generate Bill / Invoice'}
                                className="inline-flex items-center space-x-1 rounded-lg bg-gradient-to-r from-amber-500 to-[#C59B27] hover:from-amber-600 hover:to-[#A68018] text-white px-2 py-0.5 text-[10px] font-extrabold shadow-2xs hover:shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                              >
                                <Receipt className="h-3 w-3" />
                                <span>Make Bill</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (type === 'invoices') {
                    return (
                      <tr key={item._id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-[#0A1E3F]">{item.invoiceNumber}</td>
                        <td className="p-3 font-bold text-slate-800">{item.client?.clientName || 'Valued Client'}</td>
                        <td className="p-3 font-semibold text-slate-600">{item.serviceType}</td>
                        <td className="p-3 font-extrabold text-[#C59B27]">₹{item.total?.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-semibold text-emerald-600">₹{item.paidAmount?.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-semibold text-rose-600">₹{item.pendingAmount?.toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                            item.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {item.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  if (type === 'clients') {
                    return (
                      <tr key={item._id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-800">{item.clientName}</td>
                        <td className="p-3 text-slate-600">{item.tradeName || '-'}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-700">
                          {item.gstin ? (
                            <span className="font-bold text-slate-800">{item.gstin}</span>
                          ) : (
                            item.pan || 'N/A'
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{item.phone || '-'}</td>
                        <td className="p-3 font-medium text-slate-700">
                          {item.responsibleEmployee?.name || 'Unassigned'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  if (type === 'certifications') {
                    return (
                      <tr key={item._id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-800">{item.client?.clientName || 'Client'}</td>
                        <td className="p-3 font-semibold text-[#0A1E3F]">{item.certificateType}</td>
                        <td className="p-3 font-medium text-slate-600">{item.department || 'Registration'}</td>
                        <td className="p-3 text-slate-700">{item.assignedEmployee?.name || 'Assigned Staff'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return null;
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 shrink-0">
          <span className="text-xs text-slate-400">Click anywhere outside to dismiss</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#0A1E3F] px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Invoice Generation Modal */}
      {isInvoiceModalOpen && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setInvoiceInitialData(null);
          }}
          onRefresh={() => {
            if (onRefresh) onRefresh();
          }}
          clients={clients}
          employees={employees}
          initialData={invoiceInitialData}
        />
      )}
    </div>
  );
};

export default CardDetailModal;
