const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    clientCode: { type: String, unique: true },
    clientName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    clientGroup: { type: String, default: 'General' },
    clientType: { type: String, enum: ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Individual', 'Trust/NGO'], default: 'Proprietorship' },
    responsibleEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leadSource: { type: String, default: 'Direct' },
    
    // Registration Mode
    registrationCategory: { type: String, enum: ['New Client', 'Registered Client', 'No Certification'], default: 'Registered Client' },
    noCertification: { type: Boolean, default: false },

    // Business Information
    tradeName: { type: String, trim: true },
    businessType: { type: String, default: 'Services' },
    cin: { type: String, trim: true },
    llpin: { type: String, trim: true },
    dateOfIncorporation: { type: Date },

    // Tax Information
    pan: { type: String, trim: true, uppercase: true },
    tan: { type: String, trim: true, uppercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    gstType: { type: String, enum: ['Regular', 'Composition', 'SEZ', 'Casual', 'Unregistered'], default: 'Regular' },
    state: { type: String, default: 'Tamil Nadu' },
    fiscalYearStart: { type: String, default: '04-01' },
    fiscalYearEnd: { type: String, default: '03-31' },

    // Address & Contact
    address: { type: String },
    contactPerson: { type: String },
    billingAddress: { type: String },
    city: { type: String, default: 'Chennai' },
    pincode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },

    // Financial
    openingBalance: { type: Number, default: 0 },
    openingBalanceDate: { type: Date, default: Date.now },
    creditLimit: { type: Number, default: 50000 },
    closingBalance: { type: Number, default: 0 },

    // Remarks & Files
    remarks: { type: String },
    panDoc: { type: String },
    gstDoc: { type: String },
    aadhaarDoc: { type: String },
    certificateDoc: { type: String },
    otherDocs: [{ name: String, fileUrl: String }],

    // Subscribed Services & Assigned Staff Reminders
    subscribedServices: [
      {
        department: { type: String, required: true },
        serviceName: { type: String, required: true },
        subServiceName: { type: String, required: true },
        assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        startDayOfMonth: { type: Number, default: 1 },
        dueDayOfMonth: { type: Number, default: 11 },
        periodicity: { type: String, default: 'Monthly' },
        status: { type: String, default: 'Active' }
      }
    ],

    // Status
    status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
