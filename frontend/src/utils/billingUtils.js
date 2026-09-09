import api from '../services/api';

/**
 * Checks whether an invoice has already been generated for a given task.
 * Returns the matched invoice object or null.
 */
export const findTaskInvoice = (task, invoices = []) => {
  if (!task) return null;

  // 1. Direct link on task object
  if (task.invoice && typeof task.invoice === 'object' && task.invoice._id) {
    return task.invoice;
  }
  if (task.invoiceNumber) {
    // Look up full invoice in list if available
    const found = (invoices || []).find((inv) => inv.invoiceNumber === task.invoiceNumber);
    if (found) return found;
    return {
      _id: task.invoice || task.invoiceId,
      invoiceNumber: task.invoiceNumber
    };
  }

  // 2. Search against loaded invoices
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return null;
  }

  const taskClientId = task.client?._id || task.client || task.clientId;
  if (!taskClientId) return null;

  const taskNameNorm = (task.taskName || '').trim().toLowerCase();
  const taskDeptNorm = (task.department || '').trim().toLowerCase();

  return (
    invoices.find((inv) => {
      const invClientId = inv.client?._id || inv.client;
      if (!invClientId || String(invClientId) !== String(taskClientId)) {
        return false;
      }

      const invServiceNorm = (inv.serviceType || '').trim().toLowerCase();
      if (!invServiceNorm) return false;

      // Exact service name match
      if (invServiceNorm === taskNameNorm) return true;

      // Substring match e.g. "Income Tax Service - Gopala krishnan" contains "Income Tax"
      if (taskNameNorm && (invServiceNorm.includes(taskNameNorm) || taskNameNorm.includes(invServiceNorm))) {
        return true;
      }

      // Department matching (e.g. GST Filing, Income Tax, Book Keeping)
      if (taskDeptNorm && invServiceNorm.includes(taskDeptNorm)) {
        return true;
      }

      return false;
    }) || null
  );
};

/**
 * Opens the invoice PDF directly in a new browser tab for viewing and printing.
 */
export const viewOrPrintInvoice = async (invoiceOrId, invoiceNumber = '') => {
  try {
    const invId = typeof invoiceOrId === 'object' ? invoiceOrId?._id || invoiceOrId?.invoiceId : invoiceOrId;
    const invNum = typeof invoiceOrId === 'object' ? invoiceOrId?.invoiceNumber || invoiceNumber : invoiceNumber;

    if (!invId) {
      alert('Invoice ID not found.');
      return;
    }

    const response = await api.get(`/invoices/${invId}/pdf`, {
      responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Failed to preview/print invoice PDF:', err);
    alert('Failed to load invoice for printing. Please try again.');
  }
};
