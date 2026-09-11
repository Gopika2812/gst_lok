import React, { useState, useEffect, useMemo } from 'react';
import GlacierCard from '../components/common/GlacierCard';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import { SortableHeader, sortTableData } from '../components/common/SortableHeader';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { printClientLedger } from '../utils/exportUtils';
import {
  BookOpen,
  Plus,
  Printer,
  CreditCard,
  Edit3,
  Trash2,
  X,
  Search,
  ArrowLeft,
  CheckCircle2,
  FileText,
  User,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';

const LedgerPage = () => {
  const { user } = useAuth();

  // View Mode: 'overview' (All Customers Summary) | 'statement' (Single Client Detailed Ledger)
  const [viewMode, setViewMode] = useState('overview');

  // Master Summary Data (All Customers)
  const [summaryData, setSummaryData] = useState({
    totalClients: 0,
    overallDebit: 0,
    overallCredit: 0,
    overallOutstanding: 0,
    clients: []
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summarySearch, setSummarySearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all' | 'pending' | 'cleared'
  const [summarySortConfig, setSummarySortConfig] = useState({ key: 'clientName', direction: 'asc' });

  // Single Client Statement Data
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementSearch, setStatementSearch] = useState('');
  const [statementSortConfig, setStatementSortConfig] = useState({ key: 'date', direction: 'asc' });

  // Transaction Modal State (Record Payment / Entry)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [modalClientId, setModalClientId] = useState('');
  const [clientInvoices, setClientInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Payment Form Data with Against-Invoice Support
  const [paymentAllocation, setPaymentAllocation] = useState('invoice'); // 'invoice' | 'account'
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [txData, setTxData] = useState({
    transactionType: 'Payment Received',
    referenceNumber: '',
    amount: '',
    paymentMode: 'Bank Transfer',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch Master Summary for All Customers
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/ledgers/summary');
      setSummaryData(res.data);
      if (res.data.clients && res.data.clients.length > 0) {
        setClients(res.data.clients);
      }
    } catch (err) {
      console.warn('Ledger summary endpoint unavailable, falling back to clients & invoices:', err.message);
      try {
        const [clientRes, invoiceRes] = await Promise.all([
          api.get('/clients'),
          api.get('/invoices').catch(() => ({ data: [] }))
        ]);

        const clientList = clientRes.data || [];
        const invoiceList = invoiceRes.data || [];

        // Build debit/credit map from invoices for each client
        const invoiceMap = {};
        for (const inv of invoiceList) {
          const cId = typeof inv.client === 'object' ? inv.client?._id : inv.client;
          if (cId) {
            if (!invoiceMap[cId]) {
              invoiceMap[cId] = { debit: 0, credit: 0, count: 0, lastDate: inv.invoiceDate || inv.createdAt };
            }
            invoiceMap[cId].debit += (Number(inv.total) || 0);
            invoiceMap[cId].credit += (Number(inv.paidAmount) || 0);
            invoiceMap[cId].count += 1;
            if (inv.createdAt && (!invoiceMap[cId].lastDate || new Date(inv.createdAt) > new Date(invoiceMap[cId].lastDate))) {
              invoiceMap[cId].lastDate = inv.createdAt;
            }
          }
        }

        let overallDebit = 0;
        let overallCredit = 0;
        let overallOutstanding = 0;

        const summaryList = clientList.map((client) => {
          const invStats = invoiceMap[client._id] || { debit: 0, credit: 0, count: 0, lastDate: null };
          const openingBal = Number(client.openingBalance) || 0;
          const closingBal = client.closingBalance !== undefined 
            ? Number(client.closingBalance) 
            : (openingBal + invStats.debit - invStats.credit);

          overallDebit += invStats.debit;
          overallCredit += invStats.credit;
          overallOutstanding += closingBal;

          return {
            _id: client._id,
            clientName: client.clientName,
            tradeName: client.tradeName,
            gstin: client.gstin,
            pan: client.pan,
            phone: client.phone,
            email: client.email,
            city: client.city,
            state: client.state,
            openingBalance: openingBal,
            totalDebit: invStats.debit,
            totalCredit: invStats.credit,
            closingBalance: closingBal,
            entriesCount: invStats.count,
            lastTransactionDate: invStats.lastDate || client.updatedAt || client.createdAt
          };
        });

        setSummaryData({
          totalClients: summaryList.length,
          overallDebit,
          overallCredit,
          overallOutstanding,
          clients: summaryList
        });
        setClients(summaryList);
      } catch (fallbackErr) {
        console.error('Failed to fetch fallback client ledger:', fallbackErr);
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Fetch Detailed Ledger Statement for a single Client
  const fetchLedger = async (clientId) => {
    if (!clientId) return;
    setStatementLoading(true);
    try {
      const res = await api.get(`/ledgers/client/${clientId}`);
      setLedgerData(res.data);
    } catch (err) {
      console.error('Failed to fetch client ledger:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClientId && viewMode === 'statement') {
      fetchLedger(selectedClientId);
    }
  }, [selectedClientId, viewMode]);

  // Open Individual Client Detailed Ledger
  const handleOpenClientStatement = (clientId) => {
    setSelectedClientId(clientId);
    setViewMode('statement');
  };

  // Back to All Customers Overview
  const handleBackToOverview = () => {
    setViewMode('overview');
    fetchSummary();
  };

  // Fetch Invoices when client is selected in the payment modal
  const fetchClientPendingInvoices = async (clientId) => {
    if (!clientId) {
      setClientInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const res = await api.get('/invoices', { params: { client: clientId } });
      const unpaidInvoices = res.data.filter((inv) => inv.paymentStatus !== 'Paid' && inv.pendingAmount > 0);
      setClientInvoices(unpaidInvoices);
      if (unpaidInvoices.length > 0) {
        setPaymentAllocation('invoice');
      } else {
        setPaymentAllocation('account');
      }
    } catch (err) {
      console.error('Failed to fetch client invoices:', err);
      setClientInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenCreateModal = (presetClientId = null) => {
    setEditingTransaction(null);
    const targetClientId = presetClientId || selectedClientId || (clients[0]?._id || '');
    setModalClientId(targetClientId);
    setSelectedInvoiceId('');
    setPaymentAllocation('account');
    setTxData({
      transactionType: 'Payment Received',
      referenceNumber: '',
      amount: '',
      paymentMode: 'Bank Transfer',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setFormError('');
    setIsTransactionModalOpen(true);

    if (targetClientId) {
      fetchClientPendingInvoices(targetClientId);
    }
  };

  // Open Edit Modal for a Ledger Entry
  const handleOpenEditModal = (entry) => {
    setEditingTransaction(entry);
    setModalClientId(selectedClientId);
    setSelectedInvoiceId('');
    setPaymentAllocation('account');
    setTxData({
      transactionType: entry.transactionType,
      referenceNumber: entry.referenceNumber || '',
      amount: entry.credit || entry.debit || '',
      paymentMode: entry.paymentMode || 'Bank Transfer',
      description: entry.description || '',
      date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setFormError('');
    setIsTransactionModalOpen(true);
  };

  // Handle Invoice Selection in Payment Modal
  const handleInvoiceSelect = (invId) => {
    setSelectedInvoiceId(invId);
    if (!invId) return;

    const selectedInv = clientInvoices.find((inv) => inv._id === invId);
    if (selectedInv) {
      setTxData((prev) => ({
        ...prev,
        amount: selectedInv.pendingAmount || selectedInv.total || '',
        referenceNumber: selectedInv.invoiceNumber || '',
        description: `Payment against Invoice ${selectedInv.invoiceNumber} (${selectedInv.serviceType})`
      }));
    }
  };

  // Handle Client Switch inside Payment Modal
  const handleModalClientChange = (clientId) => {
    setModalClientId(clientId);
    setSelectedInvoiceId('');
    fetchClientPendingInvoices(clientId);
  };

  // Submit Payment / Ledger Transaction
  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!modalClientId) {
      setFormError('Please select a client');
      return;
    }

    if (!txData.amount || Number(txData.amount) <= 0) {
      setFormError('Please enter a valid amount greater than 0');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingTransaction) {
        await api.put(`/ledgers/transaction/${editingTransaction._id}`, txData);
      } else {
        await api.post('/ledgers/transaction', {
          client: modalClientId,
          invoiceId: paymentAllocation === 'invoice' ? selectedInvoiceId : undefined,
          ...txData
        });
      }
      setIsTransactionModalOpen(false);

      // Refresh data
      if (viewMode === 'statement' && selectedClientId === modalClientId) {
        fetchLedger(selectedClientId);
      }
      fetchSummary();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Transaction Entry
  const handleDeleteTransaction = async (entry) => {
    if (
      window.confirm(
        `Are you sure you want to remove this ${entry.transactionType} entry (₹${(
          entry.credit || entry.debit
        )?.toLocaleString('en-IN')})? This will automatically recalculate the client's running balance.`
      )
    ) {
      try {
        await api.delete(`/ledgers/transaction/${entry._id}`);
        fetchLedger(selectedClientId);
        fetchSummary();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to remove transaction');
      }
    }
  };

  // Print Official Ledger for a single client
  const handlePrintLedger = (clientObj = null, customLedgerData = null) => {
    const targetClient = clientObj || ledgerData?.client;
    const targetData = customLedgerData || ledgerData;

    if (!targetData || !targetClient) {
      alert('Ledger data is not loaded yet for printing.');
      return;
    }

    printClientLedger({
      ledgerData: targetData,
      client: targetClient,
      user
    });
  };

  // Quick 1-Click Print from Master Table
  const handleQuickPrintFromSummary = async (clientSummaryItem) => {
    try {
      const res = await api.get(`/ledgers/client/${clientSummaryItem._id}`);
      handlePrintLedger(res.data.client, res.data);
    } catch (err) {
      alert('Failed to fetch ledger details for printing.');
    }
  };

  // Summary Sort Handler
  const handleSummarySort = (key) => {
    setSummarySortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Statement Sort Handler
  const handleStatementSort = (key) => {
    setStatementSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filtered & Sorted Master Summary Clients
  const filteredSummaryClients = useMemo(() => {
    let list = summaryData.clients || [];

    if (summarySearch.trim()) {
      const q = summarySearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.clientName?.toLowerCase().includes(q) ||
          c.tradeName?.toLowerCase().includes(q) ||
          c.gstin?.toLowerCase().includes(q) ||
          c.pan?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q)
      );
    }

    if (balanceFilter === 'pending') {
      list = list.filter((c) => (c.closingBalance || 0) > 0);
    } else if (balanceFilter === 'cleared') {
      list = list.filter((c) => (c.closingBalance || 0) <= 0);
    }

    return list;
  }, [summaryData.clients, summarySearch, balanceFilter]);

  const sortedSummaryClients = useMemo(() => {
    return sortTableData(filteredSummaryClients, summarySortConfig);
  }, [filteredSummaryClients, summarySortConfig]);

  // Filtered & Sorted Statement Entries
  const rawEntries = ledgerData?.entries || [];
  const filteredStatementEntries = useMemo(() => {
    if (!statementSearch.trim()) return rawEntries;
    const q = statementSearch.toLowerCase();
    return rawEntries.filter(
      (e) =>
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
        (e.transactionType && e.transactionType.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        String(e.debit).includes(q) ||
        String(e.credit).includes(q) ||
        String(e.runningBalance).includes(q)
    );
  }, [rawEntries, statementSearch]);

  const sortedStatementEntries = useMemo(() => {
    return sortTableData(filteredStatementEntries, statementSortConfig);
  }, [filteredStatementEntries, statementSortConfig]);

  const currentStatementClient = ledgerData?.client;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center space-x-2">
            {viewMode === 'statement' && (
              <button
                onClick={handleBackToOverview}
                className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>All Customers</span>
              </button>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-[#0A1E3F]">
              {viewMode === 'overview'
                ? 'Customer Ledgers & Accounts Receivable'
                : `Ledger Statement: ${currentStatementClient?.clientName || 'Client'}`}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'overview'
              ? 'Overall credit, debit & closing balances across all registered customers'
              : 'Complete running financial statement, invoice debits & receipts'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'statement' && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-[#0A1E3F] shadow-xs outline-none focus:border-[#C59B27] cursor-pointer"
            >
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.clientName} ({c.gstin || c.pan || 'Active'})
                </option>
              ))}
            </select>
          )}

          {viewMode === 'statement' && (
            <button
              onClick={() => handlePrintLedger()}
              className="flex items-center justify-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#0A1E3F] hover:bg-[#0A1E3F] hover:text-white transition shadow-2xs cursor-pointer"
            >
              <Printer className="h-4 w-4 text-[#C59B27]" />
              <span>Print Ledger</span>
            </button>
          )}

          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center justify-center space-x-1.5 rounded-xl bg-[#C59B27] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-[#A68018] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: ALL CUSTOMERS MASTER OVERVIEW                                */}
      {/* ========================================================================= */}
      {viewMode === 'overview' && (
        <>
          {/* Overall Key Performance Metric Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Active Clients"
              value={`${summaryData.totalClients || 0} Accounts`}
              color="navy"
            />
            <StatCard
              title="Overall Invoiced (Debit)"
              value={`₹${(summaryData.overallDebit || 0).toLocaleString('en-IN')}`}
              color="blue"
            />
            <StatCard
              title="Total Payments (Credit)"
              value={`₹${(summaryData.overallCredit || 0).toLocaleString('en-IN')}`}
              color="green"
            />
            <StatCard
              title="Net Outstanding Balance"
              value={`₹${(summaryData.overallOutstanding || 0).toLocaleString('en-IN')}`}
              color={summaryData.overallOutstanding > 0 ? 'amber' : 'green'}
            />
          </div>

          {/* Filter Bar */}
          <GlacierCard className="p-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex w-full sm:w-80 items-center rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Search className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search Customer, GSTIN, PAN, Phone..."
                  value={summarySearch}
                  onChange={(e) => setSummarySearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#C59B27] cursor-pointer"
                >
                  <option value="all">All Customer Accounts</option>
                  <option value="pending">With Outstanding Dues (Balance &gt; 0)</option>
                  <option value="cleared">Cleared / Zero Balance</option>
                </select>

                <button
                  onClick={fetchSummary}
                  title="Refresh Balances"
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </GlacierCard>

          {/* All Customers Master Ledger Table */}
          <GlacierCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[920px]">
                <thead className="bg-[#0A1E3F] text-white">
                  <tr>
                    <SortableHeader label="Customer Name" sortKey="clientName" currentSort={summarySortConfig} onSort={handleSummarySort} />
                    <SortableHeader label="GSTIN / PAN" sortKey="gstin" currentSort={summarySortConfig} onSort={handleSummarySort} />
                    <SortableHeader label="Contact Phone" sortKey="phone" currentSort={summarySortConfig} onSort={handleSummarySort} />
                    <SortableHeader label="Opening (₹)" sortKey="openingBalance" currentSort={summarySortConfig} onSort={handleSummarySort} align="right" />
                    <SortableHeader label="Total Invoiced (₹)" sortKey="totalDebit" currentSort={summarySortConfig} onSort={handleSummarySort} align="right" />
                    <SortableHeader label="Total Paid (₹)" sortKey="totalCredit" currentSort={summarySortConfig} onSort={handleSummarySort} align="right" />
                    <SortableHeader label="Outstanding Balance (₹)" sortKey="closingBalance" currentSort={summarySortConfig} onSort={handleSummarySort} align="right" />
                    <th className="p-3.5 text-center font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryLoading ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 font-semibold">
                        Loading customer ledgers and balances...
                      </td>
                    </tr>
                  ) : sortedSummaryClients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 font-semibold">
                        No customer accounts found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedSummaryClients.map((client) => {
                      const isPending = (client.closingBalance || 0) > 0;
                      return (
                        <tr key={client._id} className="hover:bg-slate-50 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{client.clientName}</div>
                            {client.tradeName && client.tradeName !== client.clientName && (
                              <div className="text-[10px] text-slate-500">{client.tradeName}</div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-700">
                            <div>{client.gstin || 'No GSTIN'}</div>
                            {client.pan && <div className="text-[10px] text-slate-400">PAN: {client.pan}</div>}
                          </td>
                          <td className="p-3.5 text-slate-600">{client.phone || '-'}</td>
                          <td className="p-3.5 text-right font-medium text-slate-600">
                            ₹{(client.openingBalance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-semibold text-rose-600">
                            ₹{(client.totalDebit || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-semibold text-emerald-600">
                            ₹{(client.totalCredit || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-bold">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                isPending
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              ₹{(client.closingBalance || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              {/* Open Detailed Statement Button */}
                              <button
                                onClick={() => handleOpenClientStatement(client._id)}
                                title="Open Detailed Customer Ledger"
                                className="inline-flex items-center space-x-1 rounded-lg bg-[#0A1E3F] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#163566] transition shadow-2xs cursor-pointer"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                <span>Ledger</span>
                              </button>

                              {/* Direct Print Icon */}
                              <button
                                onClick={() => handleQuickPrintFromSummary(client)}
                                title="Print Official Statement PDF"
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#0A1E3F] transition cursor-pointer"
                              >
                                <Printer className="h-4 w-4" />
                              </button>

                              {/* Record Payment Button */}
                              <button
                                onClick={() => handleOpenCreateModal(client._id)}
                                title="Record Receipt / Payment Entry"
                                className="rounded-lg border border-slate-200 p-1.5 text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                              >
                                <CreditCard className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlacierCard>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: INDIVIDUAL CUSTOMER STATEMENT VIEW                           */}
      {/* ========================================================================= */}
      {viewMode === 'statement' && (
        <>
          {/* Client Financial Summary Cards */}
          {currentStatementClient && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Opening Balance"
                value={`₹${(ledgerData.openingBalance || 0).toLocaleString('en-IN')}`}
                color="navy"
              />
              <StatCard
                title="Total Invoiced (Debit)"
                value={`₹${(ledgerData.totalDebit || 0).toLocaleString('en-IN')}`}
                color="blue"
              />
              <StatCard
                title="Total Payments (Credit)"
                value={`₹${(ledgerData.totalCredit || 0).toLocaleString('en-IN')}`}
                color="green"
              />
              <StatCard
                title="Closing Outstanding"
                value={`₹${(ledgerData.closingBalance || 0).toLocaleString('en-IN')}`}
                color={(ledgerData.closingBalance || 0) > 0 ? 'amber' : 'green'}
              />
            </div>
          )}

          {/* Statement Table Card */}
          <GlacierCard className="p-0 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-100 p-3.5 bg-slate-50 gap-3">
              <div className="flex items-center space-x-3">
                <h3 className="font-bold text-slate-800 text-sm whitespace-nowrap">
                  Statement: {currentStatementClient?.clientName}
                </h3>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 w-full sm:w-64">
                  <Search className="mr-1.5 h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={statementSearch}
                    onChange={(e) => setStatementSearch(e.target.value)}
                    className="w-full bg-transparent text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrintLedger()}
                  className="flex items-center justify-center space-x-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0A1E3F] hover:bg-[#0A1E3F] hover:text-white transition shadow-2xs cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-[#C59B27]" />
                  <span>Print Official Ledger</span>
                </button>
                <button
                  onClick={() => handleOpenCreateModal(selectedClientId)}
                  className="flex items-center justify-center space-x-1 rounded-lg bg-[#C59B27] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#A68018] transition shadow-2xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Record Payment</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-[#0A1E3F] text-white">
                  <tr>
                    <SortableHeader label="Date" sortKey="date" currentSort={statementSortConfig} onSort={handleStatementSort} />
                    <SortableHeader label="Transaction Type" sortKey="transactionType" currentSort={statementSortConfig} onSort={handleStatementSort} />
                    <SortableHeader label="Reference #" sortKey="referenceNumber" currentSort={statementSortConfig} onSort={handleStatementSort} />
                    <SortableHeader label="Description" sortKey="description" currentSort={statementSortConfig} onSort={handleStatementSort} />
                    <SortableHeader label="Debit (₹)" sortKey="debit" currentSort={statementSortConfig} onSort={handleStatementSort} align="right" />
                    <SortableHeader label="Credit (₹)" sortKey="credit" currentSort={statementSortConfig} onSort={handleStatementSort} align="right" />
                    <SortableHeader label="Running Balance (₹)" sortKey="runningBalance" currentSort={statementSortConfig} onSort={handleStatementSort} align="right" />
                    <th className="p-3.5 font-semibold text-center text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                        Loading ledger statement...
                      </td>
                    </tr>
                  ) : sortedStatementEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                        No transactions recorded for this client yet.
                      </td>
                    </tr>
                  ) : (
                    sortedStatementEntries.map((e) => (
                      <tr key={e._id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 text-slate-600">
                          {new Date(e.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3.5">
                          <Badge status={e.transactionType} />
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-800 font-bold">
                          {e.referenceNumber || '-'}
                        </td>
                        <td className="p-3.5 text-slate-600">{e.description || '-'}</td>
                        <td className="p-3.5 text-right font-semibold text-rose-600">
                          {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-emerald-600">
                          {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="p-3.5 text-right font-bold text-[#0A1E3F]">
                          ₹{e.runningBalance.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEditModal(e)}
                              title="Edit Transaction Entry"
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-amber-50 hover:text-[#C59B27] transition cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(e)}
                              title="Remove Transaction Entry"
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlacierCard>
        </>
      )}

      {/* ========================================================================= */}
      {/* RECORD PAYMENT / PAYMENT ENTRY MODAL (WITH AGAINST-INVOICE SUPPORT)        */}
      {/* ========================================================================= */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0A1E3F]">
                  {editingTransaction ? 'Edit Ledger / Payment Entry' : 'Record Payment / Ledger Receipt'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record receipts, apply against invoices, or post credit/debit adjustments
                </p>
              </div>
              <button
                onClick={() => setIsTransactionModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-600 border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleTransactionSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Select Customer */}
              <div>
                <label className="font-bold text-slate-700">Select Customer *</label>
                <select
                  required
                  disabled={!!editingTransaction}
                  value={modalClientId}
                  onChange={(e) => handleModalClientChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 outline-none focus:border-[#C59B27] cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.clientName} ({c.gstin || c.pan || 'Active'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type */}
              <div>
                <label className="font-bold text-slate-700">Transaction Type *</label>
                <select
                  value={txData.transactionType}
                  onChange={(e) => setTxData({ ...txData, transactionType: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 outline-none focus:border-[#C59B27] cursor-pointer"
                >
                  <option value="Payment Received">Payment Received (Receipt / Credit)</option>
                  <option value="Credit Note">Credit Note (Credit to Customer)</option>
                  <option value="Debit Note">Debit Note (Debit to Customer)</option>
                  <option value="Invoice">Manual Invoice / Fee Debit</option>
                </select>
              </div>

              {/* AGAINST INVOICE SELECTION BOX (When Payment Received & not editing) */}
              {!editingTransaction && txData.transactionType === 'Payment Received' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 text-xs">Payment Method / Allocation:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAllocation('invoice');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          paymentAllocation === 'invoice'
                            ? 'bg-[#0A1E3F] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Against Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAllocation('account');
                          setSelectedInvoiceId('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          paymentAllocation === 'account'
                            ? 'bg-[#0A1E3F] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        On Account
                      </button>
                    </div>
                  </div>

                  {paymentAllocation === 'invoice' && (
                    <div className="pt-2 border-t border-blue-200/60">
                      <label className="font-semibold text-blue-900 text-[11px]">Select Pending Invoice to Pay *</label>
                      {loadingInvoices ? (
                        <div className="p-2 text-xs text-slate-500 font-medium">Checking client pending invoices...</div>
                      ) : clientInvoices.length === 0 ? (
                        <div className="mt-1 flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>No unpaid invoices found for this client. Payment will be recorded on account.</span>
                        </div>
                      ) : (
                        <select
                          value={selectedInvoiceId}
                          onChange={(e) => handleInvoiceSelect(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-blue-300 bg-white p-2.5 text-xs font-bold text-[#0A1E3F] outline-none focus:border-[#C59B27] cursor-pointer"
                        >
                          <option value="">-- Choose Invoice to Pay --</option>
                          {clientInvoices.map((inv) => (
                            <option key={inv._id} value={inv._id}>
                              {inv.invoiceNumber} • {inv.serviceType} • Total: ₹{inv.total.toLocaleString('en-IN')} (Pending Due: ₹{inv.pendingAmount.toLocaleString('en-IN')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount & Payment Mode in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={txData.amount}
                    onChange={(e) => setTxData({ ...txData, amount: e.target.value })}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                    placeholder="e.g. 5000"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#C59B27]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Payment Mode</label>
                  <select
                    value={txData.paymentMode}
                    onChange={(e) => setTxData({ ...txData, paymentMode: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27] cursor-pointer"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Date & Reference # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={txData.date}
                    onChange={(e) => setTxData({ ...txData, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Reference / Voucher #</label>
                  <input
                    type="text"
                    value={txData.referenceNumber}
                    onChange={(e) => setTxData({ ...txData, referenceNumber: e.target.value })}
                    placeholder="e.g. UPI Ref / Cheque # / INV00126"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#C59B27]"
                  />
                </div>
              </div>

              {/* Description / Remarks */}
              <div>
                <label className="font-bold text-slate-700">Particulars / Description</label>
                <textarea
                  rows={2}
                  value={txData.description}
                  onChange={(e) => setTxData({ ...txData, description: e.target.value })}
                  placeholder="Optional details or payment notes..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#C59B27] px-5 py-2 font-bold text-white hover:bg-[#A68018] cursor-pointer disabled:opacity-50 shadow-md transition"
                >
                  {submitting ? 'Saving...' : editingTransaction ? 'Update Entry' : 'Save Payment Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerPage;
