const User = require('../models/User');

const seedOrgHierarchy = async () => {
  try {
    // 1. Super Admin (Logunathan - Founder & Principal Auditor)
    let logunathan = await User.findOne({ email: 'royallogu2026@gmail.com' });
    if (!logunathan) {
      logunathan = await User.create({
        name: 'Logunathan',
        email: 'royallogu2026@gmail.com',
        phone: '+91 99943 60994',
        password: 'Logu@81',
        role: 'Super Admin',
        department: 'Management',
        designation: 'Founder & Principal Auditor',
        status: 'Approved'
      });
    } else {
      logunathan.name = 'Logunathan';
      logunathan.role = 'Super Admin';
      logunathan.department = 'Management';
      logunathan.designation = 'Founder & Principal Auditor';
      logunathan.status = 'Approved';
      await logunathan.save();
    }

    // Clean up legacy emails
    await User.deleteMany({
      email: { $in: ['royallogu2020@gmail.com', 'sainath@vigneshassociates.com', 'superadmin@vigneshassociates.com'] }
    });

    console.log('[Seed] Super Admin (Logunathan / royallogu2026@gmail.com) verified successfully.');

    // 2. Seed Default Master Services & Sub-Services
    const ServiceMaster = require('../models/ServiceMaster');
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
      const exists = await ServiceMaster.findOne({ department: service.department, subServiceName: service.subServiceName });
      if (!exists) {
        await ServiceMaster.create(service);
      }
    }

    console.log('[Seed] Master Services verified for Royal Accounting.');
  } catch (err) {
    console.error('[Seed Error] Failed to seed hierarchy:', err);
  }
};

module.exports = seedOrgHierarchy;
