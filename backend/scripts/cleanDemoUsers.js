const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function cleanUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const keepEmails = [
      'royallogu2020@gmail.com',
      'royalac2020@gmail.com',
      'siva.usha236@gmail.com'
    ];

    const deleteResult = await User.deleteMany({
      email: { $nin: keepEmails }
    });

    console.log(`Successfully deleted ${deleteResult.deletedCount} old/sample users.`);

    const remaining = await User.find({}, 'name email role department status');
    console.log('Active Users in Database:');
    console.table(remaining.map(u => ({
      ID: u._id.toString(),
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Department: u.department,
      Status: u.status
    })));

    process.exit(0);
  } catch (err) {
    console.error('Error cleaning users:', err);
    process.exit(1);
  }
}

cleanUsers();
