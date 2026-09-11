const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Permission = require('../models/Permission');
const Client = require('../models/Client');
const Certification = require('../models/Certification');
const Invoice = require('../models/Invoice');
const Ledger = require('../models/Ledger');
const Task = require('../models/Task');
const FilingRecord = require('../models/FilingRecord');
const AuditLog = require('../models/AuditLog');
const ServiceMaster = require('../models/ServiceMaster');

const flushDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    console.log('[Flush] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[Flush] Connected to MongoDB successfully.');

    // 1. Clear sample business collections
    const clientResult = await Client.deleteMany({});
    const certResult = await Certification.deleteMany({});
    const invoiceResult = await Invoice.deleteMany({});
    const ledgerResult = await Ledger.deleteMany({});
    const taskResult = await Task.deleteMany({});
    const filingResult = await FilingRecord.deleteMany({});
    const auditResult = await AuditLog.deleteMany({});
    const serviceResult = await ServiceMaster.deleteMany({});

    console.log(`[Flush] Deleted ${clientResult.deletedCount} Clients`);
    console.log(`[Flush] Deleted ${certResult.deletedCount} Certifications`);
    console.log(`[Flush] Deleted ${invoiceResult.deletedCount} Invoices`);
    console.log(`[Flush] Deleted ${ledgerResult.deletedCount} Ledgers`);
    console.log(`[Flush] Deleted ${taskResult.deletedCount} Tasks`);
    console.log(`[Flush] Deleted ${filingResult.deletedCount} Filing Records`);
    console.log(`[Flush] Deleted ${auditResult.deletedCount} Audit Logs`);
    console.log(`[Flush] Deleted ${serviceResult.deletedCount} Service Masters`);

    // 2. Clear all users
    const userResult = await User.deleteMany({});
    console.log(`[Flush] Deleted ${userResult.deletedCount} existing Users`);

    // 3. Create Super Admin User: Logunathan
    const superAdmin = await User.create({
      name: 'Logunathan',
      email: 'royallogu2026@gmail.com',
      phone: '+91 99943 60994',
      password: 'Logu@81',
      role: 'Super Admin',
      status: 'Approved',
      department: 'Management',
      designation: 'Founder & Principal Auditor'
    });
    console.log('[Flush] Created Super Admin account (Logunathan / royallogu2026@gmail.com / Logu@81)');

    // 4. Create complete Super Admin permissions
    const defaultModules = {
      Dashboard: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Clients: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Registration: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Certification: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Billing: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      'GST Filing': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      'Book Keeping': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      'IT Filing': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Reports: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      'Task Board': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      Settings: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      'User Management': { view: true, create: true, edit: true, delete: true, approve: true, export: true }
    };

    await Permission.deleteMany({});
    await Permission.create({
      role: 'Super Admin',
      modules: defaultModules
    });
    console.log('[Flush] Permissions initialized for Super Admin');

    // 5. Seed default Master Services for Royal Accounting
    const defaultServices = [
      { department: 'GST Filing', serviceName: 'GST Returns', subServiceName: 'GSTR-1 (Outward Supplies)', startDayOfMonth: 1, dueDayOfMonth: 11, periodicity: 'Monthly', description: 'Monthly GSTR-1 return filing' },
      { department: 'GST Filing', serviceName: 'GST Returns', subServiceName: 'GSTR-3B (Summary Return)', startDayOfMonth: 1, dueDayOfMonth: 20, periodicity: 'Monthly', description: 'Monthly GSTR-3B return filing' },
      { department: 'GST Filing', serviceName: 'GST Annual', subServiceName: 'GSTR-9 (Annual Return)', startDayOfMonth: 1, dueDayOfMonth: 31, periodicity: 'Yearly', description: 'Annual GST reconciliation & filing' },
      { department: 'GST Filing', serviceName: 'GST Composition', subServiceName: 'CMP-08 (Composition Return)', startDayOfMonth: 1, dueDayOfMonth: 18, periodicity: 'Quarterly', description: 'Quarterly CMP-08 statement' },

      { department: 'Income Tax', serviceName: 'Income Tax Return', subServiceName: 'ITR-1 Sahaj (Individual)', startDayOfMonth: 1, dueDayOfMonth: 31, periodicity: 'Yearly', description: 'Income Tax Return for Salary/Income' },
      { department: 'Income Tax', serviceName: 'TDS Filing', subServiceName: 'TDS Return (Quarterly)', startDayOfMonth: 1, dueDayOfMonth: 31, periodicity: 'Quarterly', description: 'Quarterly TDS return statement' },
      { department: 'Income Tax', serviceName: 'Advance Tax', subServiceName: 'Advance Tax Calculation', startDayOfMonth: 1, dueDayOfMonth: 15, periodicity: 'Quarterly', description: 'Quarterly advance tax computation' },

      { department: 'Accounts', serviceName: 'Accounting', subServiceName: 'Monthly Bookkeeping & Ledger Entry', startDayOfMonth: 1, dueDayOfMonth: 10, periodicity: 'Monthly', description: 'Monthly sales/purchase book entry & tally audit' },
      { department: 'Accounts', serviceName: 'Reconciliation', subServiceName: 'Bank Statement Reconciliation', startDayOfMonth: 1, dueDayOfMonth: 15, periodicity: 'Monthly', description: 'Bank statement to ledger reconciliation' }
    ];

    for (const service of defaultServices) {
      await ServiceMaster.create(service);
    }
    console.log('[Flush] Master Services seeded for Royal Accounting');

    // 6. Create initial audit log
    await AuditLog.create({
      user: superAdmin._id,
      userName: superAdmin.name,
      userRole: superAdmin.role,
      action: 'Data Flush & Royal Accounting Setup',
      module: 'System',
      details: 'Flushed demo data. Initialized Super Admin Logunathan and default service masters.'
    });

    console.log('[Flush] Royal Accounting database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Flush Error]', error);
    process.exit(1);
  }
};

flushDB();
