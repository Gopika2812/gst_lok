const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Ledger = require('../models/Ledger');
const Task = require('../models/Task');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { logAudit } = require('../middleware/auditLogger');

// Generate Invoice Number e.g. INV00126 (INV + 3-digit counter + 2-digit year)
const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const counterStr = String(count + 1).padStart(3, '0');
  return `INV${counterStr}${yearSuffix}`;
};

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    const {
      client,
      serviceType,
      items,
      subTotal,
      gstPercent,
      gstAmount,
      discount,
      total,
      paidAmount,
      paymentMode,
      billingCycle,
      remarks,
      moveToTaskAssignment,
      assignedGroup,
      assignedEmployee,
      taskDueDate,
      taskPriority
    } = req.body;

    const clientDoc = await Client.findById(client);
    if (!clientDoc) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Duplicate Invoice Check (within last 15 seconds)
    const fifteenSecsAgo = new Date(Date.now() - 15 * 1000);
    const recentDuplicate = await Invoice.findOne({
      client,
      serviceType,
      total,
      createdAt: { $gte: fifteenSecsAgo }
    });
    if (recentDuplicate) {
      return res.status(400).json({
        message: `Duplicate submission detected: Invoice ${recentDuplicate.invoiceNumber} for this client was just generated.`
      });
    }

    const invoiceNumber = await generateInvoiceNumber();
    const paid = Number(paidAmount) || 0;
    const pending = total - paid;
    let paymentStatus = 'Pending';
    if (paid >= total) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';

    const invoice = await Invoice.create({
      invoiceNumber,
      client,
      serviceType,
      items: items || [{ description: serviceType, amount: subTotal }],
      subTotal,
      gstPercent: gstPercent || 18,
      gstAmount: gstAmount || 0,
      discount: discount || 0,
      total,
      paidAmount: paid,
      pendingAmount: pending,
      paymentStatus,
      paymentMode: paymentMode || 'Bank Transfer',
      billingCycle: billingCycle || 'Monthly',
      remarks,
      moveToTaskAssignment: !!moveToTaskAssignment,
      createdBy: req.user._id
    });

    // 1. Ledger Entry for Invoice
    const previousLedger = await Ledger.findOne({ client }).sort({ createdAt: -1 });
    const currentBalance = previousLedger ? previousLedger.runningBalance : clientDoc.closingBalance || 0;
    const newBalance = currentBalance + total;

    await Ledger.create({
      client,
      date: new Date(),
      transactionType: 'Invoice',
      referenceNumber: invoiceNumber,
      debit: total,
      credit: 0,
      runningBalance: newBalance,
      description: `Tax Invoice Generated: ${serviceType}`
    });

    // 2. If initial payment made, record payment in ledger
    if (paid > 0) {
      const balanceAfterPayment = newBalance - paid;
      await Ledger.create({
        client,
        date: new Date(),
        transactionType: 'Payment Received',
        referenceNumber: `REC-${invoiceNumber}`,
        debit: 0,
        credit: paid,
        runningBalance: balanceAfterPayment,
        description: `Payment received for Invoice ${invoiceNumber}`
      });
      clientDoc.closingBalance = balanceAfterPayment;
    } else {
      clientDoc.closingBalance = newBalance;
    }

    await clientDoc.save();

    // 3. Optional: Move to Task Assignment Workflow
    if (moveToTaskAssignment) {
      let dept = assignedGroup || 'GST';
      if (!assignedGroup) {
        if (serviceType.includes('Book Keeping') || serviceType.includes('Accounting')) dept = 'Book Keeping';
        else if (serviceType.includes('Income Tax') || serviceType.includes('IT')) dept = 'Income Tax';
        else if (serviceType.includes('Registration') || serviceType.includes('Certificate')) dept = 'Registration';
      }

      await Task.create({
        client,
        taskType: 'Client Task',
        department: dept,
        taskName: serviceType,
        priority: taskPriority || 'High',
        assignedBy: req.user._id,
        assignedEmployee: assignedEmployee || clientDoc.responsibleEmployee || req.user._id,
        dueDate: taskDueDate ? new Date(taskDueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        repeat: 'One Time',
        status: 'Assigned',
        remarks: remarks ? `${remarks} (Auto-assigned from Invoice ${invoiceNumber})` : `Auto-assigned from Invoice ${invoiceNumber}`
      });

      invoice.taskCreated = true;
      await invoice.save();
    }

    // 4. Mark originating / completed task as billed so bill cannot be made again
    if (req.body.taskId) {
      await Task.findByIdAndUpdate(req.body.taskId, {
        isBilled: true,
        invoice: invoice._id,
        invoiceNumber: invoice.invoiceNumber
      });
    } else {
      // Also match any completed task for this client with the same service name
      await Task.updateMany(
        {
          client,
          $or: [
            { taskName: serviceType },
            { taskName: { $regex: serviceType.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'i' } }
          ],
          status: 'Completed',
          isBilled: { $ne: true }
        },
        {
          isBilled: true,
          invoice: invoice._id,
          invoiceNumber: invoice.invoiceNumber
        }
      );
    }

    await logAudit(req.user, 'Invoice Created', 'Billing', `Generated invoice ${invoiceNumber} total ₹${total} for ${clientDoc.clientName}`, req);

    res.status(201).json({ message: 'Invoice generated successfully', invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Invoices
exports.getInvoices = async (req, res) => {
  try {
    const { client, paymentStatus, serviceType, search } = req.query;
    let filter = {};

    if (client) filter.client = client;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (serviceType) filter.serviceType = serviceType;
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { serviceType: { $regex: search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(filter)
      .populate('client', 'clientName tradeName gstin pan phone email')
      .populate('assignedEmployee', 'name email designation department role')
      .sort({ createdAt: -1 });

    // Migrate any legacy invoice numbers (e.g. INV-2026-0001) to clean short format (INV00126)
    for (const inv of invoices) {
      if (inv.invoiceNumber && inv.invoiceNumber.includes('-')) {
        const match = inv.invoiceNumber.match(/INV-(\d{4})-(\d+)/);
        if (match) {
          const year = match[1].slice(-2);
          const counter = String(match[2]).padStart(3, '0');
          inv.invoiceNumber = `INV${counter}${year}`;
          await Invoice.updateOne({ _id: inv._id }, { invoiceNumber: inv.invoiceNumber });
        }
      }
    }

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign Task Directly to Executive & Department from Completed/Generated Invoice
exports.assignTaskFromInvoice = async (req, res) => {
  try {
    const { department, assignedEmployee, taskName, dueDate, priority, remarks } = req.body;
    const invoice = await Invoice.findById(req.params.id).populate('client');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const task = await Task.create({
      client: invoice.client._id,
      taskType: 'Client Task',
      department: department || 'GST',
      taskName: taskName || invoice.serviceType,
      priority: priority || 'High',
      assignedBy: req.user._id,
      assignedEmployee: assignedEmployee || invoice.client.responsibleEmployee || req.user._id,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      repeat: 'One Time',
      status: 'Assigned',
      remarks: remarks ? `${remarks} (Assigned from Invoice ${invoice.invoiceNumber})` : `Assigned from Invoice ${invoice.invoiceNumber}`
    });

    invoice.taskCreated = true;
    invoice.assignedEmployee = assignedEmployee || invoice.client.responsibleEmployee || req.user._id;
    invoice.assignedGroup = department || 'GST';
    await invoice.save();

    await logAudit(
      req.user,
      'Task Assigned from Billing',
      'Billing',
      `Assigned task ${task.taskName} to ${department} for invoice ${invoice.invoiceNumber}`,
      req
    );

    res.json({ message: 'Task successfully assigned to department executive', task, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download Invoice PDF
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    generateInvoicePDF(invoice, invoice.client, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Email Invoice
exports.emailInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await logAudit(req.user, 'Email Invoice', 'Billing', `Emailed invoice ${invoice.invoiceNumber} to ${invoice.client.email}`, req);

    res.json({ message: `Invoice ${invoice.invoiceNumber} emailed successfully to ${invoice.client.email || 'client'}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Share WhatsApp Link
exports.getWhatsAppShareLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const message = `Hello ${invoice.client.clientName},\n\nYour Tax Invoice *${invoice.invoiceNumber}* from *Royal Accounting* for *${invoice.serviceType}* is ready.\n\nTotal Amount: ₹${invoice.total.toLocaleString('en-IN')}\nStatus: ${invoice.paymentStatus}\nPending: ₹${invoice.pendingAmount.toLocaleString('en-IN')}\n\nThank you for choosing Royal Accounting!`;

    const encodedMessage = encodeURIComponent(message);
    const phone = invoice.client.phone ? invoice.client.phone.replace(/[^0-9]/g, '') : '';
    const whatsappUrl = `https://wa.me/91${phone}?text=${encodedMessage}`;

    res.json({ whatsappUrl, message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Invoice (Edit Tax Invoice Details)
exports.updateInvoice = async (req, res) => {
  try {
    const {
      serviceType,
      items,
      subTotal,
      gstPercent,
      gstAmount,
      discount,
      total,
      paidAmount,
      paymentMode,
      billingCycle,
      remarks,
      paymentStatus: requestedStatus
    } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const finalTotal = Number(total) !== undefined && !isNaN(Number(total)) ? Number(total) : invoice.total;
    const paid = Number(paidAmount) !== undefined && !isNaN(Number(paidAmount)) ? Number(paidAmount) : invoice.paidAmount;
    const pending = finalTotal - paid;

    let paymentStatus = requestedStatus || 'Pending';
    if (paid >= finalTotal) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';
    else paymentStatus = 'Pending';

    if (serviceType) invoice.serviceType = serviceType;
    if (items) invoice.items = items;
    if (subTotal !== undefined) invoice.subTotal = subTotal;
    if (gstPercent !== undefined) invoice.gstPercent = gstPercent;
    if (gstAmount !== undefined) invoice.gstAmount = gstAmount;
    if (discount !== undefined) invoice.discount = discount;
    invoice.total = finalTotal;
    invoice.paidAmount = paid;
    invoice.pendingAmount = pending;
    invoice.paymentStatus = paymentStatus;
    if (paymentMode) invoice.paymentMode = paymentMode;
    if (billingCycle) invoice.billingCycle = billingCycle;
    if (remarks !== undefined) invoice.remarks = remarks;

    await invoice.save();

    // Update corresponding invoice Ledger entry if total or service changed
    const invLedger = await Ledger.findOne({ client: invoice.client, referenceNumber: invoice.invoiceNumber, transactionType: 'Invoice' });
    if (invLedger) {
      invLedger.debit = finalTotal;
      invLedger.description = `Tax Invoice Generated: ${invoice.serviceType}`;
      await invLedger.save();
    }

    // Recalculate client running balances
    const client = await Client.findById(invoice.client);
    if (client) {
      const entries = await Ledger.find({ client: invoice.client }).sort({ date: 1, createdAt: 1 });
      let running = client.openingBalance || 0;
      for (const entry of entries) {
        if (['Debit Note', 'Invoice'].includes(entry.transactionType)) {
          running += (entry.debit || 0);
        } else if (['Payment Received', 'Credit Note'].includes(entry.transactionType)) {
          running -= (entry.credit || 0);
        }
        entry.runningBalance = running;
        await entry.save();
      }
      client.closingBalance = running;
      await client.save();
    }

    await logAudit(req.user, 'Invoice Updated', 'Billing', `Updated invoice ${invoice.invoiceNumber} total ₹${finalTotal}`, req);

    res.json({ message: 'Invoice updated successfully', invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const clientId = invoice.client;
    const invNumber = invoice.invoiceNumber;

    // Remove ledger entries associated with this invoice
    await Ledger.deleteMany({ client: clientId, referenceNumber: { $in: [invNumber, `REC-${invNumber}`] } });
    await invoice.deleteOne();

    // Recalculate client balances
    const client = await Client.findById(clientId);
    if (client) {
      const entries = await Ledger.find({ client: clientId }).sort({ date: 1, createdAt: 1 });
      let running = client.openingBalance || 0;
      for (const entry of entries) {
        if (['Debit Note', 'Invoice'].includes(entry.transactionType)) {
          running += (entry.debit || 0);
        } else if (['Payment Received', 'Credit Note'].includes(entry.transactionType)) {
          running -= (entry.credit || 0);
        }
        entry.runningBalance = running;
        await entry.save();
      }
      client.closingBalance = running;
      await client.save();
    }

    await logAudit(req.user, 'Invoice Deleted', 'Billing', `Deleted invoice ${invNumber}`, req);

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
