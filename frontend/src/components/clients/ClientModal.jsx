import React, { useState, useEffect } from 'react';
import { X, Building, CreditCard, ShieldCheck, Search, CheckCircle2, AlertCircle, PhoneCall, Layers, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const ClientModal = ({ isOpen, onClose, onRefresh, employees = [], client = null }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';

  const [registrationCategory, setRegistrationCategory] = useState('New Client');
  const [existingClientId, setExistingClientId] = useState(null);

  // Phone Lookup State for Option 2
  const [searchPhone, setSearchPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResultMsg, setLookupResultMsg] = useState('');
  const [lookupStatus, setLookupStatus] = useState(null);

  // Step 2 Search & Filter State
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceDeptTab, setServiceDeptTab] = useState('All');

  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    email: '',
    clientType: 'Proprietorship',
    tradeName: '',
    businessType: 'Services',
    pan: '',
    tan: '',
    gstin: '',
    state: 'Tamil Nadu',
    address: '',
    contactPerson: '',
    city: 'Chennai',
    pincode: '',
    openingBalance: 0,
    creditLimit: 50000,
    remarks: ''
  });

  const [masterServices, setMasterServices] = useState([]);
  const [subscribedServices, setSubscribedServices] = useState([]);

  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/services').then((res) => setMasterServices(res.data)).catch(console.error);
      if (client) {
        setExistingClientId(client._id);
        setRegistrationCategory(client.registrationCategory || 'Registered Client');
        setSearchPhone(client.phone || '');
        setLookupStatus('success');
        setLookupResultMsg(`Editing: ${client.clientName}`);
        setFormData({
          clientName: client.clientName || '',
          phone: client.phone || '',
          email: client.email || '',
          clientType: client.clientType || 'Proprietorship',
          tradeName: client.tradeName || '',
          businessType: client.businessType || 'Services',
          pan: client.pan || '',
          tan: client.tan || '',
          gstin: client.gstin || '',
          state: client.state || 'Tamil Nadu',
          address: client.address || '',
          contactPerson: client.contactPerson || '',
          city: client.city || 'Chennai',
          pincode: client.pincode || '',
          openingBalance: client.openingBalance || 0,
          creditLimit: client.creditLimit || 50000,
          remarks: client.remarks || ''
        });
        setSubscribedServices(client.subscribedServices || []);
        setFiles({});
        setError('');
      } else {
        resetModalState();
      }
    }
  }, [isOpen, client]);

  if (!isOpen) return null;

  const resetModalState = () => {
    setExistingClientId(null);
    setSearchPhone('');
    setLookupLoading(false);
    setLookupResultMsg('');
    setLookupStatus(null);
    setServiceSearchQuery('');
    setServiceDeptTab('All');
    setSubscribedServices([]);
    setFiles({});
    setError('');
    setFormData({
      clientName: '',
      phone: '',
      email: '',
      clientType: 'Proprietorship',
      tradeName: '',
      businessType: 'Services',
      pan: '',
      tan: '',
      gstin: '',
      state: 'Tamil Nadu',
      address: '',
      contactPerson: '',
      city: 'Chennai',
      pincode: '',
      openingBalance: 0,
      creditLimit: 50000,
      remarks: ''
    });
  };

  const handleCategorySwitch = (cat) => {
    setRegistrationCategory(cat);
    if (cat === 'New Client') {
      resetModalState();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  // Phone Lookup for Existing Clients (Option 2)
  const handlePhoneLookup = async () => {
    if (!searchPhone.trim()) {
      setLookupResultMsg('Please enter a valid phone number.');
      setLookupStatus('not_found');
      return;
    }

    setLookupLoading(true);
    setLookupResultMsg('');
    setLookupStatus(null);

    try {
      const res = await api.get(`/clients/lookup-phone/${encodeURIComponent(searchPhone.trim())}`);
      const client = res.data;

      setExistingClientId(client._id);
      setLookupStatus('success');
      setLookupResultMsg(`Client Found: ${client.clientName}`);

      // Auto-fill form fields
      setFormData({
        clientName: client.clientName || '',
        phone: client.phone || searchPhone,
        email: client.email || '',
        clientType: client.clientType || 'Proprietorship',
        tradeName: client.tradeName || '',
        businessType: client.businessType || 'Services',
        pan: client.pan || '',
        tan: client.tan || '',
        gstin: client.gstin || '',
        state: client.state || 'Tamil Nadu',
        address: client.address || '',
        contactPerson: client.contactPerson || '',
        city: client.city || 'Chennai',
        pincode: client.pincode || '',
        openingBalance: client.openingBalance || 0,
        creditLimit: client.creditLimit || 50000,
        remarks: client.remarks || ''
      });

      if (client.subscribedServices && Array.isArray(client.subscribedServices)) {
        setSubscribedServices(client.subscribedServices);
      }
    } catch (err) {
      setExistingClientId(null);
      setLookupStatus('not_found');
      setLookupResultMsg('No record found for this phone number. You can enter details below to register.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleToggleSubService = (serviceItem) => {
    const existsIndex = subscribedServices.findIndex((s) => s.subServiceName === serviceItem.subServiceName);
    if (existsIndex > -1) {
      setSubscribedServices(subscribedServices.filter((_, idx) => idx !== existsIndex));
    } else {
      setSubscribedServices([
        ...subscribedServices,
        {
          department: serviceItem.department,
          serviceName: serviceItem.serviceName,
          subServiceName: serviceItem.subServiceName,
          startDayOfMonth: serviceItem.startDayOfMonth,
          dueDayOfMonth: serviceItem.dueDayOfMonth,
          periodicity: serviceItem.periodicity
        }
      ]);
    }
  };

  const handleSubServiceStaffChange = (subServiceName, staffId) => {
    setSubscribedServices((prev) =>
      prev.map((s) => (s.subServiceName === subServiceName ? { ...s, assignedStaff: staffId } : s))
    );
  };

  // Filter master services by search query and department tab
  const filteredMasterServices = (masterServices || []).filter((s) => {
    if (!s) return false;
    const q = (serviceSearchQuery || '').toLowerCase().trim();
    const subName = (s.subServiceName || '').toLowerCase();
    const sName = (s.serviceName || '').toLowerCase();
    const dept = (s.department || '').toLowerCase();

    const matchesSearch =
      !q ||
      subName.includes(q) ||
      sName.includes(q) ||
      dept.includes(q);

    const matchesDept =
      serviceDeptTab === 'All' ||
      s.department === serviceDeptTab ||
      (serviceDeptTab === 'GST Filing' && s.department === 'GST') ||
      (serviceDeptTab === 'Income Tax' && s.department === 'IT Filing');

    return matchesSearch && matchesDept;
  });

  const handleSelectAllFiltered = () => {
    const newSubs = [...subscribedServices];
    filteredMasterServices.forEach((ms) => {
      if (!newSubs.some((s) => s.subServiceName === ms.subServiceName)) {
        newSubs.push({
          department: ms.department,
          serviceName: ms.serviceName,
          subServiceName: ms.subServiceName,
          startDayOfMonth: ms.startDayOfMonth,
          dueDayOfMonth: ms.dueDayOfMonth,
          periodicity: ms.periodicity
        });
      }
    });
    setSubscribedServices(newSubs);
  };

  const handleDeselectAllFiltered = () => {
    const filteredSubNames = filteredMasterServices.map((ms) => ms.subServiceName);
    setSubscribedServices(subscribedServices.filter((s) => !filteredSubNames.includes(s.subServiceName)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        data.append(key, formData[key]);
      });
      data.append('registrationCategory', registrationCategory);
      data.append('subscribedServices', JSON.stringify(subscribedServices));

      if (files.panDoc) data.append('panDoc', files.panDoc);
      if (files.gstDoc) data.append('gstDoc', files.gstDoc);
      if (files.aadhaarDoc) data.append('aadhaarDoc', files.aadhaarDoc);
      if (files.certificateDoc) data.append('certificateDoc', files.certificateDoc);

      if (existingClientId) {
        await api.put(`/clients/${existingClientId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/clients', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0A1E3F]">Client Registration</h3>
            <p className="text-xs text-slate-500">Add or update client service subscriptions</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-600 border border-rose-200">{error}</div>}

        {/* Clean Option Switcher */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleCategorySwitch('New Client')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              registrationCategory === 'New Client'
                ? 'bg-white text-[#0A1E3F] shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            New Client Registration
          </button>
          <button
            type="button"
            onClick={() => handleCategorySwitch('Registered Client')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              registrationCategory === 'Registered Client'
                ? 'bg-[#C59B27] text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Existing Client (Phone Lookup)
          </button>
        </div>

        {/* Phone Lookup for Existing Clients */}
        {registrationCategory === 'Registered Client' && (
          <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="Enter Phone Number (e.g. 9840011223)..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#C59B27]"
              />
              <button
                type="button"
                onClick={handlePhoneLookup}
                disabled={lookupLoading}
                className="rounded-xl bg-[#0A1E3F] px-4 py-2 text-xs font-bold text-white hover:bg-[#16385C] transition shrink-0 flex items-center space-x-1"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{lookupLoading ? 'Searching...' : 'Search'}</span>
              </button>
            </div>

            {lookupResultMsg && (
              <div className={`text-xs font-semibold px-2 py-1 rounded-lg ${lookupStatus === 'success' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {lookupResultMsg}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* STEP 1: Basic Information */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-[#0A1E3F] flex items-center space-x-1.5">
              <Building className="h-4 w-4 text-[#C59B27]" />
              <span>Step 1: Basic Details</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Client Name *</label>
                <input
                  type="text"
                  name="clientName"
                  required
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="e.g. Apex Logistics"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Phone Number *</label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98400 11223"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@company.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: Service Subscriptions with Search & Multi-Select */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-[#0A1E3F] flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-[#C59B27]" />
                <span>Step 2: Subscribed Services ({subscribedServices.length} Selected)</span>
              </h4>

              {/* Quick Select All / Deselect All */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-[10px] font-bold text-[#C59B27] hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="text-[10px] font-bold text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Search Input & Department Filter Tabs */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  placeholder="Search service e.g. GSTR-1, ITR, Bookkeeping..."
                  className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>

              <div className="flex space-x-1 overflow-x-auto shrink-0">
                {['All', 'GST Filing', 'Income Tax', 'Accounts'].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setServiceDeptTab(dept)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition whitespace-nowrap ${
                      serviceDeptTab === dept
                        ? 'bg-[#0A1E3F] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered Master Services Multi-Select Grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
              {filteredMasterServices.length === 0 ? (
                <div className="col-span-2 py-4 text-center text-xs text-slate-400">
                  No matching services found for "{serviceSearchQuery}"
                </div>
              ) : (
                filteredMasterServices.map((ms) => {
                  const isSelected = subscribedServices.some((s) => s.subServiceName === ms.subServiceName);
                  const selectedSub = subscribedServices.find((s) => s.subServiceName === ms.subServiceName);

                  return (
                    <div
                      key={ms._id}
                      className={`rounded-xl p-2.5 border transition ${
                        isSelected ? 'border-[#C59B27] bg-emerald-50/60 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSubService(ms)}
                            className="h-4 w-4 rounded accent-[#C59B27] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">{ms.subServiceName}</span>
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {ms.department}
                        </span>
                      </div>

                      {/* Staff Assignment per Subscribed Service */}
                      {isSelected && employees && employees.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-600 shrink-0">Assign Staff:</span>
                          <select
                            value={selectedSub?.assignedStaff || ''}
                            onChange={(e) => handleSubServiceStaffChange(ms.subServiceName, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-[#C59B27]"
                          >
                            <option value="">-- Assign Executive --</option>
                            {employees
                              .filter((emp) => !ms.department || emp.department === ms.department || emp.role?.includes(ms.department) || emp.role === 'Super Admin')
                              .map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                  {emp.name} ({emp.designation || emp.role})
                                </option>
                              ))}
                            <optgroup label="All Staff Members">
                              {employees.map((emp) => (
                                <option key={`all-${emp._id}`} value={emp._id}>
                                  {emp.name} ({emp.department})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 3: Business & Tax Details */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-[#0A1E3F] flex items-center space-x-1.5">
              <CreditCard className="h-4 w-4 text-[#C59B27]" />
              <span>Step 3: Tax & Business Details</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Trade Name</label>
                <input
                  type="text"
                  name="tradeName"
                  value={formData.tradeName}
                  onChange={handleChange}
                  placeholder="Trade Name"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">PAN Number</label>
                <input
                  type="text"
                  name="pan"
                  value={formData.pan}
                  onChange={handleChange}
                  placeholder="AAACA1234F"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs uppercase outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">GSTIN Number</label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  placeholder="33AAACA1234F1Z5"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs uppercase outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: Financials & Location */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-[#0A1E3F] flex items-center space-x-1.5">
              <ShieldCheck className="h-4 w-4 text-[#C59B27]" />
              <span>Step 4: Financial Setup</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Opening Balance (₹)</label>
                <input
                  type="number"
                  name="openingBalance"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Credit Limit (₹)</label>
                <input
                  type="number"
                  name="creditLimit"
                  disabled={!isSuperAdmin}
                  value={formData.creditLimit}
                  onChange={handleChange}
                  className={`mt-1 w-full rounded-xl border p-2 text-xs outline-none ${
                    isSuperAdmin ? 'border-slate-200 focus:border-[#C59B27]' : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700">City / Location</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#C59B27]"
                />
              </div>
            </div>
          </div>

          {/* STEP 5: Document Uploads */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-[#0A1E3F]">Step 5: Document Uploads</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-600">PAN Image</label>
                <input type="file" accept="image/*,.pdf" name="panDoc" onChange={handleFileChange} className="mt-1 w-full text-slate-500 text-[11px]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600">GST Cert Image</label>
                <input type="file" accept="image/*,.pdf" name="gstDoc" onChange={handleFileChange} className="mt-1 w-full text-slate-500 text-[11px]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600">Aadhaar Image</label>
                <input type="file" accept="image/*,.pdf" name="aadhaarDoc" onChange={handleFileChange} className="mt-1 w-full text-slate-500 text-[11px]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600">Incorporation Cert</label>
                <input type="file" accept="image/*,.pdf" name="certificateDoc" onChange={handleFileChange} className="mt-1 w-full text-slate-500 text-[11px]" />
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#C59B27] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#A68018] transition"
            >
              {loading ? 'Saving...' : existingClientId ? 'Update Client' : 'Register Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
