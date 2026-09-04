const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const { startRecurringTaskCron } = require('./utils/recurringTaskEngine');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const certificationRoutes = require('./routes/certificationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const taskRoutes = require('./routes/taskRoutes');
const filingRoutes = require('./routes/filingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const seedOrgHierarchy = require('./config/seedHierarchy');

const app = express();

// Connect Database
connectDB().then(() => {
  seedOrgHierarchy();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads Folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/filings', filingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/notifications', notificationRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    system: 'Royal Accounting - Auditor ERP System API',
    status: 'Active',
    version: '1.0.0'
  });
});

// Start Cron Engine for Recurring Monthly Tasks
startRecurringTaskCron();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] Auditor ERP Backend running on http://localhost:${PORT}`);
});
