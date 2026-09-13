import React, { useState, useEffect, useMemo } from 'react';
import GlacierCard from '../components/common/GlacierCard';
import Badge from '../components/common/Badge';
import FilePreviewModal from '../components/common/FilePreviewModal';
import { SortableHeader, sortTableData } from '../components/common/SortableHeader';
import api from '../services/api';
import { Award, CheckCircle2, Clock, Upload, ArrowRight, ShieldCheck, Eye, FileText, Image as ImageIcon, X, Trash2, Search, Zap, Ban } from 'lucide-react';
import { formatFileSize, isImageFile, isPdfFile } from '../utils/fileUtils';

const CertificationPage = () => {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'applicationDate', direction: 'desc' });
  const [selectedCert, setSelectedCert] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [certWorkflowMode, setCertWorkflowMode] = useState('standard'); // 'standard' | 'no_cert'

  const [updateData, setUpdateData] = useState({
    certificateNumber: '',
    certificateReceived: 'Yes',
    receivedDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [certFile, setCertFile] = useState(null);
  const [certFilePreviewUrl, setCertFilePreviewUrl] = useState(null);

  // File Preview Modal State
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    fileUrl: '',
    fileName: '',
    fileType: '',
    title: '',
    subtitle: '',
    certNumber: ''
  });

  const fetchCertifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/certifications');
      setCertifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();
  }, []);

  // Cleanup object URL when unmounting or modal closes
  useEffect(() => {
    return () => {
      if (certFilePreviewUrl) {
        URL.revokeObjectURL(certFilePreviewUrl);
      }
    };
  }, [certFilePreviewUrl]);

  const handleOpenUpdate = (cert) => {
    setSelectedCert(cert);
    setCertWorkflowMode('standard');
    setUpdateData({
      certificateNumber: cert.certificateNumber || '',
      certificateReceived: cert.certificateReceived || 'Yes',
      receivedDate: cert.receivedDate ? new Date(cert.receivedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      remarks: cert.remarks || ''
    });
    setCertFile(null);
    setCertFilePreviewUrl(null);
    setIsUpdateModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setCertFile(null);
    if (certFilePreviewUrl) {
      URL.revokeObjectURL(certFilePreviewUrl);
      setCertFilePreviewUrl(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (certFilePreviewUrl) {
        URL.revokeObjectURL(certFilePreviewUrl);
      }
      setCertFile(file);
      const objUrl = URL.createObjectURL(file);
      setCertFilePreviewUrl(objUrl);
    }
  };

  const handleRemoveSelectedFile = () => {
    if (certFilePreviewUrl) {
      URL.revokeObjectURL(certFilePreviewUrl);
    }
    setCertFile(null);
    setCertFilePreviewUrl(null);
  };

  // Direct quick action: Mark No Certification & Move directly to Billing
  const handleDirectNoCertification = async (cert) => {
    const clientName = cert.client?.clientName || 'this client';
    if (!window.confirm(`Mark "${clientName}" as "No Certification Required" and move directly to the Billing phase?`)) {
      return;
    }
    try {
      await api.put(`/certifications/${cert._id}`, {
        isNoCertification: true,
        remarks: 'No Certification Required (Direct to Billing)'
      });
      fetchCertifications();
    } catch (err) {
      alert('Failed to update certification status');
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      if (certWorkflowMode === 'no_cert') {
        await api.put(`/certifications/${selectedCert._id}`, {
          isNoCertification: true,
          remarks: updateData.remarks || 'No Certification Required (Direct to Billing)'
        });
      } else {
        const formData = new FormData();
        formData.append('certificateNumber', updateData.certificateNumber);
        formData.append('certificateReceived', updateData.certificateReceived);
        formData.append('receivedDate', updateData.receivedDate);
        formData.append('remarks', updateData.remarks);
        formData.append('movedToBilling', true);

        if (certFile) {
          formData.append('uploadedCertificate', certFile);
        }

        await api.put(`/certifications/${selectedCert._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      handleCloseUpdateModal();
      fetchCertifications();
    } catch (err) {
      alert('Failed to update certification');
    }
  };

  const getDisplayCertType = (cert) => {
    if (!cert) return '';
    if (cert.certificateType && cert.certificateType !== 'Services') {
      return cert.certificateType;
    }
    if (cert.client?.subscribedServices && cert.client.subscribedServices.length > 0) {
      return cert.client.subscribedServices.map((s) => s.subServiceName || s.serviceName).join(', ');
    }
    return 'GST Registration';
  };

  const openPreview = ({ fileUrl, fileName, title, subtitle, certNumber, fileType = '' }) => {
    setPreviewModal({
      isOpen: true,
      fileUrl,
      fileName: fileName || 'Certificate Document',
      fileType,
      title: title || 'Certificate Preview',
      subtitle: subtitle || '',
      certNumber: certNumber || ''
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredCerts = useMemo(() => {
    if (!search.trim()) return certifications;
    const q = search.toLowerCase();
    return certifications.filter((c) =>
      (c.client?.clientName && c.client.clientName.toLowerCase().includes(q)) ||
      (c.certificateType && c.certificateType.toLowerCase().includes(q)) ||
      (c.certificateNumber && c.certificateNumber.toLowerCase().includes(q)) ||
      (c.status && c.status.toLowerCase().includes(q))
    );
  }, [certifications, search]);

  const sortedCerts = useMemo(() => {
    return sortTableData(filteredCerts, sortConfig);
  }, [filteredCerts, sortConfig]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0A1E3F]">Certification Status & Tracking (Module 2)</h1>
          <p className="text-xs text-slate-500">
            Workflow: Client Registration ➔ Waiting Certificate ➔ Certificate Received ➔ Move to Billing
          </p>
        </div>
        <div className="flex w-full sm:w-72 items-center rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search Certificate, Client, #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      {/* Workflow Visual Timeline Banner */}
      <GlacierCard className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 to-[#0A1E3F] text-white">
        <div className="flex overflow-x-auto items-center justify-between gap-3 text-xs font-semibold no-scrollbar">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">1</span>
            <span>Client Registration</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex items-center space-x-2 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs text-white">2</span>
            <span>Waiting Certificate</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex items-center space-x-2 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C59B27] text-xs text-white">3</span>
            <span>Certificate Received</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex items-center space-x-2 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">4</span>
            <span>Move to Billing</span>
          </div>
        </div>
      </GlacierCard>

      {/* Certifications Table */}
      <GlacierCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-[#0A1E3F] text-white">
              <tr>
                <SortableHeader label="Client Name" sortKey="client.clientName" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Certificate Type" sortKey="certificateType" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Application Date" sortKey="applicationDate" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Expected Date" sortKey="expectedDate" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Cert Number" sortKey="certificateNumber" currentSort={sortConfig} onSort={handleSort} />
                <th className="p-3.5 font-semibold">Certificate Doc</th>
                <SortableHeader label="Received?" sortKey="certificateReceived" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={handleSort} />
                <th className="p-3.5 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading certification records...</td>
                </tr>
              ) : sortedCerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">No pending certification tracking records</td>
                </tr>
              ) : (
                sortedCerts.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{c.client?.clientName || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.client?.phone || ''}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">{getDisplayCertType(c)}</td>
                    <td className="p-3.5 text-slate-600">
                      {c.applicationDate ? new Date(c.applicationDate).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {c.expectedDate ? new Date(c.expectedDate).toLocaleDateString('en-IN') : 'Existing Cert'}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-800">
                      {c.certificateNumber || 'Pending'}
                    </td>
                    <td className="p-3.5">
                      {c.uploadedCertificate ? (
                        <button
                          type="button"
                          onClick={() => openPreview({
                            fileUrl: c.uploadedCertificate,
                            fileName: `${c.client?.clientName || 'Client'}_${getDisplayCertType(c)}_Certificate`,
                            title: `${c.client?.clientName || 'Client'} - ${getDisplayCertType(c)} Certificate`,
                            subtitle: `Certificate No: ${c.certificateNumber || 'N/A'}`,
                            certNumber: c.certificateNumber || ''
                          })}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#C59B27] hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold transition shadow-2xs hover:shadow-xs cursor-pointer"
                          title="Preview Certificate"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview Doc</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No file</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {c.remarks && (c.remarks.includes('No Certification') || c.remarks.includes('Direct to Billing')) ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                          <Zap className="mr-1 h-3 w-3 text-emerald-600" /> Not Required
                        </span>
                      ) : (
                        <Badge status={c.certificateReceived === 'Yes' ? 'Yes' : 'Pending'} text={c.certificateReceived === 'Yes' ? 'Received' : 'Pending'} />
                      )}
                    </td>
                    <td className="p-3.5">
                      {c.remarks && (c.remarks.includes('No Certification') || c.remarks.includes('Direct to Billing')) ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                          Direct to Billing
                        </span>
                      ) : c.remarks && c.remarks.includes('Existing Client') ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                          Already Has Certificate
                        </span>
                      ) : (
                        <Badge status={c.status} />
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {c.status === 'Certificate Received' || c.movedToBilling ? (
                        <span className="inline-flex items-center text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Moved to Billing Phase
                        </span>
                      ) : (
                        <div className="flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
                          <button
                            onClick={() => handleOpenUpdate(c)}
                            className="rounded-lg bg-[#C59B27] px-3 py-1 text-xs font-bold text-white hover:bg-[#A68018] shadow-xs transition cursor-pointer"
                          >
                            Update Status
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectNoCertification(c)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition cursor-pointer flex items-center space-x-1"
                            title="No Certification Needed — Move directly to Billing"
                          >
                            <Zap className="h-3 w-3" />
                            <span>No Cert</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlacierCard>

      {/* Update Certificate Modal */}
      {isUpdateModalOpen && selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0A1E3F]">Update Certificate Status</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client: <span className="font-semibold text-slate-700">{selectedCert.client?.clientName}</span> <span className="text-slate-400">({getDisplayCertType(selectedCert)})</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseUpdateModal}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher inside Modal */}
            <div className="mt-3.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCertWorkflowMode('standard')}
                className={`flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                  certWorkflowMode === 'standard'
                    ? 'bg-white text-[#0A1E3F] shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#C59B27]" />
                <span>Certificate Received</span>
              </button>
              <button
                type="button"
                onClick={() => setCertWorkflowMode('no_cert')}
                className={`flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                  certWorkflowMode === 'no_cert'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>No Cert Required</span>
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-3.5 text-xs">
              {certWorkflowMode === 'no_cert' ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center space-x-2 font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Direct to Billing Pipeline</span>
                    </div>
                    <p className="text-emerald-700 leading-relaxed text-[11px]">
                      Selecting <strong>No Certification Required</strong> will complete this certificate requirement and immediately advance <strong>{selectedCert.client?.clientName}</strong> to the Billing phase. No certificate number or document upload is needed.
                    </p>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700">Remarks (Optional)</label>
                    <textarea
                      rows={2}
                      value={updateData.remarks}
                      onChange={(e) => setUpdateData({ ...updateData, remarks: e.target.value })}
                      placeholder="e.g. Routine service, no certificate tracking required..."
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-emerald-500 text-slate-800 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleCloseUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>Confirm & Move to Billing</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="font-semibold text-slate-700">Certificate Number *</label>
                    <input
                      type="text"
                      required
                      value={updateData.certificateNumber}
                      onChange={(e) => setUpdateData({ ...updateData, certificateNumber: e.target.value })}
                      placeholder="e.g. 33AAACA1234F1Z5"
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-[#C59B27] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700">Received Date</label>
                    <input
                      type="date"
                      value={updateData.receivedDate}
                      onChange={(e) => setUpdateData({ ...updateData, receivedDate: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-[#C59B27] text-slate-800"
                    />
                  </div>

                  {/* Upload Certificate File with Live Preview */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700">Upload Certificate File</label>
                      {certFile && (
                        <span className="text-[11px] text-emerald-600 font-bold">
                          {formatFileSize(certFile.size)}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 space-y-2">
                      <input
                        type="file"
                        id="cert-file-input"
                        accept="image/*,.pdf"
                        onChange={handleFileSelect}
                        className="w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                      />

                      {/* Selected File Live Preview Card */}
                      {certFile && certFilePreviewUrl && (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                            {isImageFile(certFile.name) ? (
                              <img
                                src={certFilePreviewUrl}
                                alt="thumb"
                                className="h-9 w-9 rounded-lg object-cover border border-emerald-300 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-emerald-100 text-[#C59B27] flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0 truncate">
                              <p className="font-bold text-slate-800 truncate text-[11px]">{certFile.name}</p>
                              <p className="text-[10px] text-slate-500">{formatFileSize(certFile.size)}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPreview({
                                fileUrl: certFilePreviewUrl,
                                fileName: certFile.name,
                                fileType: certFile.type,
                                title: `${selectedCert.client?.clientName || 'Client'} - Certificate Preview`,
                                subtitle: `File: ${certFile.name} (${formatFileSize(certFile.size)})`,
                                certNumber: updateData.certificateNumber
                              })}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#C59B27] text-white hover:bg-[#A68018] font-bold text-[11px] shadow-2xs transition"
                              title="Preview Selected Certificate"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveSelectedFile}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Remove File"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Previously Uploaded Certificate Reference */}
                      {!certFile && selectedCert.uploadedCertificate && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                          <span className="text-[11px] font-medium truncate pr-2">Currently stored certificate file</span>
                          <button
                            type="button"
                            onClick={() => openPreview({
                              fileUrl: selectedCert.uploadedCertificate,
                              fileName: `${selectedCert.certificateType}_Certificate`,
                              title: `${selectedCert.client?.clientName} - Existing Certificate`,
                              subtitle: `Certificate No: ${selectedCert.certificateNumber || 'N/A'}`,
                              certNumber: selectedCert.certificateNumber || ''
                            })}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[11px] shrink-0 shadow-2xs transition"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#C59B27]" />
                            <span>Preview Existing</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700">Remarks</label>
                    <textarea
                      rows={2}
                      value={updateData.remarks}
                      onChange={(e) => setUpdateData({ ...updateData, remarks: e.target.value })}
                      placeholder="Enter remarks or approval notes..."
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-[#C59B27] text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleCloseUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#C59B27] px-4 py-2 font-semibold text-white hover:bg-[#A68018] shadow-md transition cursor-pointer"
                    >
                      Confirm & Move to Billing
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Global File Preview Modal */}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        fileUrl={previewModal.fileUrl}
        fileName={previewModal.fileName}
        fileType={previewModal.fileType}
        title={previewModal.title}
        subtitle={previewModal.subtitle}
        certNumber={previewModal.certNumber}
      />
    </div>
  );
};

export default CertificationPage;
