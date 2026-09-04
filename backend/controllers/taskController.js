const Task = require('../models/Task');
const Client = require('../models/Client');
const User = require('../models/User');
const { logAudit } = require('../middleware/auditLogger');
const { sendTaskAssignedPushNotification } = require('../services/pushNotificationService');

const { getFileUrl } = require('../middleware/uploadMiddleware');

// Create Task Assignment
exports.createTask = async (req, res) => {
  try {
    const {
      client: clientId,
      taskType,
      department,
      taskName,
      priority,
      assignedEmployee,
      dueDate,
      reminderDays,
      repeat,
      remarks,
      status
    } = req.body;

    let validClientId = null;

    if (clientId && clientId.trim() !== '') {
      const clientObj = await Client.findById(clientId);
      if (!clientObj) {
        return res.status(404).json({ message: 'Selected client not found' });
      }
      if (clientObj.status !== 'Active') {
        return res.status(400).json({ message: 'Cannot assign task to Inactive or Suspended client' });
      }
      validClientId = clientObj._id;
    }

    const fileAttachment = getFileUrl(req.file);

    const task = await Task.create({
      client: validClientId,
      taskType: taskType || (validClientId ? 'Client Task' : 'Common Task'),
      department: department || 'GST',
      taskName,
      priority: priority || 'Medium',
      assignedBy: req.user._id,
      assignedEmployee: assignedEmployee || req.user._id,
      dueDate,
      reminderDays: reminderDays || 3,
      repeat: repeat || 'One Time',
      status: status || 'Assigned',
      remarks,
      attachment: fileAttachment
    });

    await logAudit(req.user, 'Task Assignment', 'Task Board', `Assigned task ${taskName} to employee ID: ${assignedEmployee}`, req);

    // Asynchronously trigger lock-screen / Chrome Push Notification for assigned user
    const targetUserId = assignedEmployee || req.user._id;
    sendTaskAssignedPushNotification(task, targetUserId, req.user._id).catch(err => {
      console.error('[Push Notification trigger error]', err);
    });

    res.status(201).json({ message: 'Task assigned successfully', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Tasks with Date & Status Filters
exports.getTasks = async (req, res) => {
  try {
    const {
      department,
      assignedEmployee,
      status,
      priority,
      client,
      dateFilter,
      startDate,
      endDate,
      myTasksOnly,
      taskType,
      search
    } = req.query;

    let filter = {};

    const isSuperAdmin = req.user.role === 'Super Admin';
    const isAdmin = req.user.role.includes('Admin') && !isSuperAdmin;

    // Role & Hierarchy based task visibility rules
    if (isSuperAdmin) {
      if (myTasksOnly === 'true') {
        filter.assignedEmployee = req.user._id;
      } else if (assignedEmployee) {
        filter.assignedEmployee = assignedEmployee;
      }
    } else if (isAdmin) {
      if (myTasksOnly === 'true') {
        filter.assignedEmployee = req.user._id;
      } else if (assignedEmployee) {
        filter.assignedEmployee = assignedEmployee;
      } else {
        // Admin sees their assigned tasks + created tasks + department tasks
        filter.$or = [
          { department: req.user.department },
          { assignedEmployee: req.user._id },
          { assignedBy: req.user._id }
        ];
      }
    } else {
      // Junior Executive / Staff sees their assigned tasks or tasks in their department
      filter.$or = [
        { assignedEmployee: req.user._id },
        { department: req.user.department }
      ];
    }

    if (department) filter.department = department;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (client) filter.client = client;
    if (taskType) filter.taskType = taskType;

    // Date Filters
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      filter.dueDate = { $gte: start, $lte: end };
    } else if (dateFilter === 'thisWeek') {
      const first = now.getDate() - now.getDay();
      const start = new Date(now.setDate(first));
      const end = new Date(now.setDate(first + 6));
      filter.dueDate = { $gte: start, $lte: end };
    } else if (dateFilter === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      filter.dueDate = { $gte: start, $lte: end };
    } else if (dateFilter === 'overdue') {
      filter.dueDate = { $lt: now };
      filter.status = { $nin: ['Completed', 'Cancelled'] };
    } else if (startDate && endDate) {
      filter.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      if (filter.$or) {
        filter = {
          $and: [
            { $or: filter.$or },
            { $or: [{ taskName: searchRegex }, { remarks: searchRegex }] }
          ]
        };
      } else {
        filter.$or = [
          { taskName: searchRegex },
          { remarks: searchRegex }
        ];
      }
    }

    const tasks = await Task.find(filter)
      .populate('client', 'clientName tradeName pan gstin phone status')
      .populate('assignedEmployee', 'name email role department designation')
      .populate('assignedBy', 'name email role department designation')
      .sort({ dueDate: 1 })
      .lean();

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Task Status / Drag & Drop Column Shift
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const task = await Task.findById(req.params.id).populate('client');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const oldStatus = task.status;
    task.status = status;
    if (remarks) task.remarks = remarks;

    // Handle file attachment update if uploaded
    if (req.file) {
      task.attachment = getFileUrl(req.file);
    }

    await task.save();

    // Auto Task Recurring Trigger on Completion
    if (status === 'Completed' && oldStatus !== 'Completed' && task.repeat !== 'One Time' && task.client && task.client.status === 'Active') {
      const currentDueDate = new Date(task.dueDate);
      let nextDueDate = new Date(currentDueDate);

      if (task.repeat === 'Monthly') nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      else if (task.repeat === 'Quarterly') nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      else if (task.repeat === 'Yearly') nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);

      await Task.create({
        client: task.client._id,
        department: task.department,
        taskName: task.taskName,
        priority: task.priority,
        assignedEmployee: task.assignedEmployee,
        dueDate: nextDueDate,
        reminderDays: task.reminderDays,
        repeat: task.repeat,
        status: 'Pending',
        remarks: `Auto-spawned recurring task following completion of ${task.taskName}`,
        isAutoGenerated: true,
        parentTaskId: task._id
      });
    }

    await logAudit(req.user, 'Task Status Update', 'Task Board', `Updated task ${task.taskName} status to ${status}`, req);

    res.json({ message: `Task status updated to ${status}`, task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Task (Admin/Super Admin only)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    await Task.findByIdAndDelete(req.params.id);
    await logAudit(req.user, 'Task Deleted', 'Task Board', `Deleted task: ${task.taskName}`, req);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delegate / Reassign Task to Junior Executive or Staff
exports.delegateTask = async (req, res) => {
  try {
    const { assignedEmployee, remarks } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const assignedUser = await User.findById(assignedEmployee);
    if (!assignedUser) {
      return res.status(404).json({ message: 'Assigned employee not found' });
    }

    task.assignedBy = req.user._id;
    task.assignedEmployee = assignedUser._id;
    if (remarks) task.remarks = remarks;

    await task.save();

    await logAudit(
      req.user,
      'Delegate Task',
      'Task Board',
      `Delegated task ${task.taskName} to ${assignedUser.name} (${assignedUser.role})`,
      req
    );

    const updatedTask = await Task.findById(task._id)
      .populate('client', 'clientName tradeName pan gstin phone status')
      .populate('assignedEmployee', 'name email role department designation')
      .populate('assignedBy', 'name email role department designation');

    // Trigger Chrome / Mobile Push Notification to newly delegated employee
    sendTaskAssignedPushNotification(updatedTask, assignedUser._id, req.user._id).catch(err => {
      console.error('[Push Notification trigger error on delegation]', err);
    });

    res.json({ message: `Task delegated successfully to ${assignedUser.name}`, task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
