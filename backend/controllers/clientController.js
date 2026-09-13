const Client = require('../models/Client');
const Ledger = require('../models/Ledger');
const Certification = require('../models/Certification');
const { logAudit } = require('../middleware/auditLogger');
const { getFileUrl } = require('../middleware/uploadMiddleware');

// Generate Client Code e.g. CLI-2026-0001
const generateClientCode = async () => {
  const count = await Client.countDocuments();
  return `CLI-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

// Create Client
exports.createClient = async (req, res) => {
  try {
    const clientData = { ...req.body };

    // Duplicate Checks: Prevent duplicate client entries by Phone, GSTIN, or PAN
    if (clientData.phone && clientData.phone.trim()) {
      const cleanPhone = clientData.phone.trim();
      const existingPhone = await Client.findOne({
        $or: [
          { phone: cleanPhone },
          { phone: `+91${cleanPhone}` },
          { phone: cleanPhone.replace('+91', '') }
        ]
      });
      if (existingPhone && (clientData.registrationCategory === 'New Client' || clientData.registrationCategory === 'No Certification')) {
        return res.status(400).json({
          message: `Duplicate Client Error: A client with phone number "${cleanPhone}" already exists (${existingPhone.clientName} - ${existingPhone.clientCode}).`
        });
      }
    }

    if (clientData.gstin && clientData.gstin.trim() && clientData.gstin.trim().toUpperCase() !== 'N/A') {
      const cleanGstin = clientData.gstin.trim().toUpperCase();
      const existingGstin = await Client.findOne({ gstin: cleanGstin });
      if (existingGstin) {
        return res.status(400).json({
          message: `Duplicate Client Error: A client with GSTIN "${cleanGstin}" already exists (${existingGstin.clientName} - ${existingGstin.clientCode}).`
        });
      }
    }

    if (clientData.pan && clientData.pan.trim() && clientData.pan.trim().toUpperCase() !== 'N/A') {
      const cleanPan = clientData.pan.trim().toUpperCase();
      const existingPan = await Client.findOne({ pan: cleanPan });
      if (existingPan && (clientData.registrationCategory === 'New Client' || clientData.registrationCategory === 'No Certification')) {
        return res.status(400).json({
          message: `Duplicate Client Error: A client with PAN "${cleanPan}" already exists (${existingPan.clientName} - ${existingPan.clientCode}).`
        });
      }
    }

    // Sanitize empty strings for ObjectId/Date fields
    if (!clientData.responsibleEmployee) delete clientData.responsibleEmployee;
    if (!clientData.dateOfIncorporation) delete clientData.dateOfIncorporation;

    // Normalize registrationCategory enum & noCertification flag
    const isNoCertification =
      clientData.registrationCategory === 'No Certification' ||
      (typeof clientData.registrationCategory === 'string' && clientData.registrationCategory.includes('No Certification')) ||
      clientData.noCertification === 'true' ||
      clientData.noCertification === true;

    if (isNoCertification) {
      clientData.registrationCategory = 'No Certification';
      clientData.noCertification = true;
    } else if (clientData.registrationCategory && clientData.registrationCategory.includes('New Client')) {
      clientData.registrationCategory = 'New Client';
      clientData.noCertification = false;
    } else {
      clientData.registrationCategory = 'Registered Client';
      clientData.noCertification = false;
    }

    // Parse subscribedServices if sent as JSON string via FormData
    if (clientData.subscribedServices && typeof clientData.subscribedServices === 'string') {
      try {
        clientData.subscribedServices = JSON.parse(clientData.subscribedServices);
      } catch (e) {
        clientData.subscribedServices = [];
      }
    }

    // Sanitize assignedStaff empty strings in subscribedServices to prevent ObjectId cast errors
    if (Array.isArray(clientData.subscribedServices)) {
      clientData.subscribedServices = clientData.subscribedServices.map((sub) => {
        const cleanedSub = { ...sub };
        if (!cleanedSub.assignedStaff || typeof cleanedSub.assignedStaff !== 'string' || !cleanedSub.assignedStaff.trim()) {
          delete cleanedSub.assignedStaff;
        }
        return cleanedSub;
      });
    }

    clientData.clientCode = await generateClientCode();
    clientData.createdBy = req.user._id;

    // Credit limit restricted to Super Admin
    if (req.user.role !== 'Super Admin') {
      clientData.creditLimit = 50000; // Default limit
    }

    clientData.openingBalance = Number(clientData.openingBalance) || 0;

    // Handle files if uploaded
    if (req.files) {
      if (req.files.panDoc && req.files.panDoc[0]) clientData.panDoc = getFileUrl(req.files.panDoc[0]);
      if (req.files.gstDoc && req.files.gstDoc[0]) clientData.gstDoc = getFileUrl(req.files.gstDoc[0]);
      if (req.files.aadhaarDoc && req.files.aadhaarDoc[0]) clientData.aadhaarDoc = getFileUrl(req.files.aadhaarDoc[0]);
      if (req.files.certificateDoc && req.files.certificateDoc[0]) clientData.certificateDoc = getFileUrl(req.files.certificateDoc[0]);
    }

    const client = await Client.create(clientData);

    // Automatically create Certification Tracking Record (Module 2) ONLY if client is NOT 'No Certification'
    if (!isNoCertification) {
      try {
        let derivedCertificateType = 'GST Registration';
        if (Array.isArray(clientData.subscribedServices) && clientData.subscribedServices.length > 0) {
          const subNames = clientData.subscribedServices.map((s) => s.subServiceName || s.serviceName).filter(Boolean);
          derivedCertificateType = subNames.join(', ');
        } else if (clientData.gstin) {
          derivedCertificateType = 'GST Registration';
        }

        if (clientData.registrationCategory === 'New Client') {
          await Certification.create({
            client: client._id,
            certificateType: derivedCertificateType,
            applicationDate: new Date(),
            status: 'Waiting For Certificate',
            certificateReceived: 'No',
            movedToBilling: false,
            remarks: 'New Client Registration - Pending Certificate Approval'
          });
        } else if (clientData.registrationCategory === 'Registered Client') {
          // Existing Client (Option 2): Already Has Certificate -> Auto-marked as Certificate Received & Ready for Billing
          await Certification.create({
            client: client._id,
            certificateType: derivedCertificateType || (client.gstin ? 'GST Certificate' : 'PAN / Incorporation'),
            applicationDate: new Date(),
            certificateNumber: client.gstin || client.pan || 'EX-CERTIFIED',
            status: 'Certificate Received',
            certificateReceived: 'Yes',
            movedToBilling: true,
            remarks: 'Existing Client - Certificate Already Present (Ready for Billing)'
          });
        }
      } catch (certError) {
        console.error('Certification tracking creation notice:', certError.message);
      }
    }

    // Initial Ledger Opening Balance record
    if (client.openingBalance && client.openingBalance !== 0) {
      await Ledger.create({
        client: client._id,
        date: client.openingBalanceDate || new Date(),
        transactionType: 'Opening Balance',
        referenceNumber: 'INIT-OP-BAL',
        debit: client.openingBalance > 0 ? client.openingBalance : 0,
        credit: client.openingBalance < 0 ? Math.abs(client.openingBalance) : 0,
        runningBalance: client.openingBalance,
        description: 'Opening Balance Setup'
      });
      client.closingBalance = client.openingBalance;
      await client.save();
    }

    await logAudit(req.user, 'Client Registration', 'Clients', `Created client: ${client.clientName} (${client.clientCode})`, req);

    res.status(201).json({ message: 'Client created successfully', client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lookup Client by Phone Number
exports.lookupByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const searchPhone = phone.trim();

    const client = await Client.findOne({
      $or: [
        { phone: searchPhone },
        { phone: `+91${searchPhone}` },
        { phone: searchPhone.replace('+91', '') }
      ]
    })
      .populate('responsibleEmployee', 'name email role')
      .lean();

    if (!client) {
      return res.status(404).json({ message: 'No existing client found with this phone number.' });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Clients
exports.getClients = async (req, res) => {
  try {
    const { status, clientType, registrationCategory, search } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (clientType) filter.clientType = clientType;
    if (registrationCategory) filter.registrationCategory = registrationCategory;
    if (search) {
      filter.$or = [
        { clientName: { $regex: search, $options: 'i' } },
        { tradeName: { $regex: search, $options: 'i' } },
        { pan: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(filter)
      .populate('responsibleEmployee', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Client
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate('responsibleEmployee', 'name email phone role');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Client
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const updateData = { ...req.body };

    if (!updateData.responsibleEmployee) delete updateData.responsibleEmployee;
    if (!updateData.dateOfIncorporation) delete updateData.dateOfIncorporation;

    if (updateData.registrationCategory !== undefined || updateData.noCertification !== undefined) {
      if (
        updateData.registrationCategory === 'No Certification' ||
        (typeof updateData.registrationCategory === 'string' && updateData.registrationCategory.includes('No Certification')) ||
        updateData.noCertification === 'true' ||
        updateData.noCertification === true
      ) {
        updateData.registrationCategory = 'No Certification';
        updateData.noCertification = true;
      } else if (updateData.registrationCategory && updateData.registrationCategory.includes('New Client')) {
        updateData.registrationCategory = 'New Client';
        updateData.noCertification = false;
      } else {
        updateData.registrationCategory = 'Registered Client';
        updateData.noCertification = false;
      }
    }

    // Parse subscribedServices if sent as JSON string via FormData
    if (updateData.subscribedServices && typeof updateData.subscribedServices === 'string') {
      try {
        updateData.subscribedServices = JSON.parse(updateData.subscribedServices);
      } catch (e) {
        updateData.subscribedServices = [];
      }
    }

    // Sanitize assignedStaff empty strings in subscribedServices to prevent ObjectId cast errors
    if (Array.isArray(updateData.subscribedServices)) {
      updateData.subscribedServices = updateData.subscribedServices.map((sub) => {
        const cleanedSub = { ...sub };
        if (!cleanedSub.assignedStaff || typeof cleanedSub.assignedStaff !== 'string' || !cleanedSub.assignedStaff.trim()) {
          delete cleanedSub.assignedStaff;
        }
        return cleanedSub;
      });
    }

    // Strict Rule: Only Super Admin can edit Credit Limit
    if (req.user.role !== 'Super Admin' && updateData.creditLimit !== undefined) {
      delete updateData.creditLimit;
    }

    // Handle files if uploaded
    if (req.files) {
      if (req.files.panDoc && req.files.panDoc[0]) updateData.panDoc = getFileUrl(req.files.panDoc[0]);
      if (req.files.gstDoc && req.files.gstDoc[0]) updateData.gstDoc = getFileUrl(req.files.gstDoc[0]);
      if (req.files.aadhaarDoc && req.files.aadhaarDoc[0]) updateData.aadhaarDoc = getFileUrl(req.files.aadhaarDoc[0]);
      if (req.files.certificateDoc && req.files.certificateDoc[0]) updateData.certificateDoc = getFileUrl(req.files.certificateDoc[0]);
    }

    const updatedClient = await Client.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await logAudit(req.user, 'Client Updated', 'Clients', `Updated client details for ${updatedClient.clientName}`, req);

    res.json({ message: 'Client updated successfully', client: updatedClient });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Soft Deactivate / Reactivate Client
exports.toggleClientStatus = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    client.status = newStatus;
    await client.save();

    await logAudit(req.user, 'Client Status Change', 'Clients', `Changed client ${client.clientName} status to ${newStatus}`, req);

    res.json({ message: `Client status changed to ${newStatus}`, client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
