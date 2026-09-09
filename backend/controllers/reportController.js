const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Task = require('../models/Task');
const User = require('../models/User');
const Certification = require('../models/Certification');

// Executive Dashboard Counters & Summary (with Date, Department & User Filtration)
exports.getDashboardSummary = async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    const userDept = req.user?.department || '';
    const userId = req.user?._id;

    const isSuperAdmin = userRole === 'Super Admin';
    const isAdmin = userRole.includes('Admin') && !isSuperAdmin;

    const { dateFilter, startDate, endDate, department, employeeId } = req.query;

    // 1. Calculate Date Range
    const now = new Date();
    let startRange = null;
    let endRange = null;

    if (startDate && endDate) {
      startRange = new Date(startDate);
      startRange.setHours(0, 0, 0, 0);
      endRange = new Date(endDate);
      endRange.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'Today') {
      startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (dateFilter === 'This Week') {
      const firstDay = now.getDate() - now.getDay();
      startRange = new Date(now.getFullYear(), now.getMonth(), firstDay, 0, 0, 0);
      endRange = new Date(now.getFullYear(), now.getMonth(), firstDay + 6, 23, 59, 59);
    } else if (dateFilter === 'This Month') {
      startRange = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endRange = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // Default / 'All Time'
      startRange = null;
      endRange = null;
    }

    // 2. Build Filters
    let taskFilter = {};
    let clientFilter = {};
    let invoiceFilter = {};
    let certFilter = {};

    // Role-based baseline
    if (isSuperAdmin) {
      // Super Admin sees everything
    } else if (isAdmin) {
      taskFilter.department = userDept;
      certFilter.department = userDept;
    } else {
      taskFilter.assignedEmployee = userId;
      certFilter.assignedEmployee = userId;
      invoiceFilter.assignedEmployee = userId;
    }

    // Department Filter
    if (department && department !== 'All') {
      taskFilter.department = department;
      certFilter.department = department;
    }

    // Employee Filter
    if (employeeId && employeeId !== 'All') {
      taskFilter.assignedEmployee = employeeId;
      invoiceFilter.assignedEmployee = employeeId;
      clientFilter.responsibleEmployee = employeeId;
    }

    // Date Filters
    let taskDateQuery = {};
    let clientDateQuery = {};
    let invoiceDateQuery = {};

    if (startRange && endRange) {
      if (dateFilter === 'Today') {
        taskDateQuery = {
          $or: [
            { dueDate: { $gte: startRange, $lte: endRange } },
            { createdAt: { $gte: startRange, $lte: endRange } },
            { status: { $in: ['Assigned', 'In Progress'] } }
          ]
        };
      } else {
        taskDateQuery = {
          $or: [
            { dueDate: { $gte: startRange, $lte: endRange } },
            { createdAt: { $gte: startRange, $lte: endRange } }
          ]
        };
      }
      clientDateQuery = { createdAt: { $gte: startRange, $lte: endRange } };
      invoiceDateQuery = { invoiceDate: { $gte: startRange, $lte: endRange } };
    }

    // Parallelize all queries safely
    const [
      totalClients,
      registeredClientsCount,
      activeClients,
      pendingCertificatesCount,
      allFilteredTasks,
      allFilteredInvoices,
      allClientsList,
      allPendingCertificates
    ] = await Promise.all([
      Client.countDocuments(clientFilter).catch(() => 0),
      Client.countDocuments(startRange && endRange ? { ...clientFilter, ...clientDateQuery } : clientFilter).catch(() => 0),
      Client.countDocuments({ ...clientFilter, status: 'Active' }).catch(() => 0),
      Certification.countDocuments({ ...certFilter, status: 'Waiting For Certificate' }).catch(() => 0),
      Task.find({ ...taskFilter, ...taskDateQuery })
        .populate('client', 'clientName tradeName gstin pan phone email')
        .populate('assignedEmployee', 'name email role department designation')
        .populate('assignedBy', 'name role')
        .populate('invoice', 'invoiceNumber invoiceDate total paymentStatus')
        .sort({ dueDate: 1, createdAt: -1 })
        .lean()
        .catch(() => []),
      Invoice.find({ ...invoiceFilter, ...invoiceDateQuery })
        .populate('client', 'clientName tradeName gstin pan phone email')
        .populate('assignedEmployee', 'name email role department')
        .sort({ invoiceDate: -1 })
        .lean()
        .catch(() => []),
      Client.find(clientFilter)
        .populate('responsibleEmployee', 'name email department')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []),
      Certification.find({ ...certFilter, status: 'Waiting For Certificate' })
        .populate('client', 'clientName tradeName gstin pan phone')
        .populate('assignedEmployee', 'name email department')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => [])
    ]);

    const tasksList = allFilteredTasks || [];
    const invoicesList = allFilteredInvoices || [];

    // Compute Task Process Counters from filtered tasks
    const todaysTasks = tasksList.filter((t) => {
      if (!t) return false;
      const created = t.createdAt ? new Date(t.createdAt) : null;
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const isToday = (d) => d && !isNaN(d.getTime()) && d.toDateString() === now.toDateString();
      return isToday(created) || isToday(due) || t.status === 'Assigned';
    });

    const inProgressTasks = tasksList.filter((t) => t && t.status === 'In Progress');
    const completedTasks = tasksList.filter((t) => t && t.status === 'Completed');
    const cantCompleteTasks = tasksList.filter((t) => t && (t.status === "Can't Complete" || t.status === 'On Hold'));
    const overdueTasks = tasksList.filter((t) => {
      if (!t || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      return !isNaN(due.getTime()) && due < now && t.status !== 'Completed' && t.status !== "Can't Complete";
    });

    // Billing Counters
    const totalBillingValue = invoicesList.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const totalCollected = invoicesList.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const totalPending = invoicesList.reduce((sum, inv) => sum + (Number(inv.pendingAmount) || 0), 0);

    res.json({
      counters: {
        totalClients: totalClients || 0,
        registeredClientsCount: registeredClientsCount || 0,
        activeClients: activeClients || 0,
        pendingCertificatesCount: pendingCertificatesCount || 0,
        todaysTasksCount: todaysTasks.length,
        inProgressTasksCount: inProgressTasks.length,
        completedTasksCount: completedTasks.length,
        cantCompleteTasksCount: cantCompleteTasks.length,
        overdueTasksCount: overdueTasks.length,
        totalBillingValue,
        totalCollected,
        totalPending
      },
      details: {
        todaysTasks,
        inProgressTasks,
        completedTasks,
        cantCompleteTasks,
        overdueTasks,
        allFilteredTasks: tasksList,
        allFilteredInvoices: invoicesList,
        allClientsList: allClientsList || [],
        allPendingCertificates: allPendingCertificates || []
      }
    });
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    res.status(500).json({ message: error.message });
  }
};

// Client Report
exports.getClientReport = async (req, res) => {
  try {
    const clients = await Client.find().populate('responsibleEmployee', 'name email').lean();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Billing & Outstanding Revenue Report
exports.getBillingReport = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('client', 'clientName tradeName pan gstin').lean();
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Employee Performance Matrix
exports.getEmployeePerformanceReport = async (req, res) => {
  try {
    const staff = await User.find({ status: 'Approved' }).select('name email role department').lean();
    const performance = await Promise.all(
      staff.map(async (emp) => {
        const [assigned, completed, pending, overdue] = await Promise.all([
          Task.countDocuments({ assignedEmployee: emp._id }),
          Task.countDocuments({ assignedEmployee: emp._id, status: 'Completed' }),
          Task.countDocuments({ assignedEmployee: emp._id, status: 'Pending' }),
          Task.countDocuments({
            assignedEmployee: emp._id,
            dueDate: { $lt: new Date() },
            status: { $ne: 'Completed' }
          })
        ]);
        const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 100;

        return {
          employee: emp,
          assigned,
          completed,
          pending,
          overdue,
          completionRate
        };
      })
    );
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
