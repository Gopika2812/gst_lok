const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function setSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    let user = await User.findOne({ email: 'royallogu2026@gmail.com' });
    if (!user) {
      user = new User({
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
      user.name = 'Logunathan';
      user.password = 'Logu@81';
      user.role = 'Super Admin';
      user.department = 'Management';
      user.designation = 'Founder & Principal Auditor';
      user.status = 'Approved';
    }

    await user.save();
    console.log('Successfully saved Logunathan with password Logu@81');

    const testUser = await User.findOne({ email: 'royallogu2026@gmail.com' });
    const isMatch = await testUser.matchPassword('Logu@81');
    console.log('Verification match for Logu@81:', isMatch);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

setSuperAdmin();
