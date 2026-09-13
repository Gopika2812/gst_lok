const Certification = require('../models/Certification');
const Client = require('../models/Client');
const { logAudit } = require('../middleware/auditLogger');
const { getFileUrl } = require('../middleware/uploadMiddleware');

// Create Certification Request
exports.createCertification = async (req, res) => {
  try {
    const { client, certificateType, applicationDate, expectedDate, certificateNumber, remarks } = req.body;

    const cert = await Certification.create({
      client,
      certificateType,
      applicationDate: applicationDate || new Date(),
      expectedDate,
      certificateNumber,
      remarks,
      status: 'Waiting For Certificate',
      certificateReceived: 'No'
    });

    await logAudit(req.user, 'Certification Created', 'Certification', `Initiated certificate tracking for client ID: ${client}`, req);

    res.status(201).json({ message: 'Certification record created', certification: cert });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Certifications
exports.getCertifications = async (req, res) => {
  try {
    const { status, certificateReceived, search } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (certificateReceived) filter.certificateReceived = certificateReceived;

    const certs = await Certification.find(filter)
      .populate('client', 'clientName tradeName pan gstin phone email status subscribedServices')
      .sort({ createdAt: -1 });

    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Certification (Mark Received, Upload Certificate Document, or Set No Certification)
exports.updateCertification = async (req, res) => {
  try {
    const { status, remarks, movedToBilling, certificateNumber, certificateReceived, receivedDate, isNoCertification } = req.body;
    const cert = await Certification.findById(req.params.id);

    if (!cert) {
      return res.status(404).json({ message: 'Certificate request not found' });
    }

    if (isNoCertification === true || isNoCertification === 'true') {
      cert.status = 'Certificate Received';
      cert.certificateReceived = 'Yes';
      cert.movedToBilling = true;
      cert.certificateNumber = certificateNumber || 'N/A (No Cert)';
      cert.remarks = remarks || 'No Certification Required (Direct to Billing)';
      cert.receivedDate = receivedDate || new Date();

      if (cert.client) {
        await Client.findByIdAndUpdate(cert.client, {
          registrationCategory: 'No Certification',
          noCertification: true
        });
      }

      await cert.save();
      await logAudit(req.user, 'Certification Bypassed', 'Certification', `Marked No Certification (Direct to Billing) for cert ID: ${cert._id}`, req);

      return res.json({ message: 'Marked No Certification - Moved directly to Billing', certification: cert });
    }

    if (status) cert.status = status;
    if (remarks !== undefined) cert.remarks = remarks;
    if (certificateNumber !== undefined) cert.certificateNumber = certificateNumber;
    if (certificateReceived !== undefined) cert.certificateReceived = certificateReceived;
    if (receivedDate) cert.receivedDate = receivedDate;
    if (movedToBilling !== undefined) cert.movedToBilling = movedToBilling;

    if (cert.certificateReceived === 'Yes' || certificateReceived === 'Yes') {
      cert.status = 'Certificate Received';
      if (!cert.receivedDate) cert.receivedDate = receivedDate || new Date();
    }

    if (req.file) {
      cert.uploadedCertificate = getFileUrl(req.file);
    }

    await cert.save();

    await logAudit(req.user, 'Certification Updated', 'Certification', `Updated certificate status for cert ID: ${cert._id}`, req);

    res.json({ message: 'Certification status updated', certification: cert });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete / Remove Certification Record
exports.deleteCertification = async (req, res) => {
  try {
    const cert = await Certification.findByIdAndDelete(req.params.id);
    if (!cert) {
      return res.status(404).json({ message: 'Certificate record not found' });
    }
    if (cert.client) {
      await Client.findByIdAndUpdate(cert.client, {
        registrationCategory: 'No Certification',
        noCertification: true
      });
    }
    await logAudit(req.user, 'Certification Deleted', 'Certification', `Removed certificate tracking for cert ID: ${req.params.id}`, req);
    res.json({ message: 'Certification record removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
