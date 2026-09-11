const User = require('../models/User');
const Permission = require('../models/Permission');
const { logAudit } = require('../middleware/auditLogger');

// Get All Users
exports.getUsers = async (req, res) => {
  try {
    const { status, role, department, search } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('reportsTo', 'name email role department designation')
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve User
exports.approveUser = async (req, res) => {
  try {
    const { role, department, designation, reportsTo } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'Approved';
    if (role) user.role = role;
    if (department) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (reportsTo !== undefined) user.reportsTo = reportsTo;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    await logAudit(req.user, 'Approve User', 'User Management', `Approved user: ${user.email} with Role: ${user.role}, Dept: ${user.department}`, req);

    res.json({ message: `User ${user.name} approved successfully`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reject User
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'Rejected';
    await user.save();

    await logAudit(req.user, 'Reject User', 'User Management', `Rejected user: ${user.email}`, req);

    res.json({ message: `User ${user.name} approval rejected`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle User Deactivation / Reactivation
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newStatus = user.status === 'Deactivated' ? 'Approved' : 'Deactivated';
    user.status = newStatus;
    await user.save();

    await logAudit(req.user, 'User Status Toggle', 'User Management', `Changed ${user.email} status to ${newStatus}`, req);

    res.json({ message: `User status changed to ${newStatus}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update User Role & Department
exports.updateUserRole = async (req, res) => {
  try {
    const { role, department, designation, reportsTo } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role || user.role;
    user.department = department || user.department;
    if (designation !== undefined) user.designation = designation;
    if (reportsTo !== undefined) user.reportsTo = reportsTo;
    await user.save();

    await logAudit(req.user, 'Update User Role', 'User Management', `Updated role of ${user.email} to ${user.role}`, req);

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create User (Admin Direct Creation)
exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, department, designation, reportsTo, status } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password: password || 'admin123',
      role: role || 'GST Executive',
      department: department || 'GST',
      designation: designation || '',
      reportsTo: reportsTo || null,
      status: status || 'Approved'
    });

    await logAudit(req.user, 'Create User', 'User Management', `Admin created user account: ${user.email}`, req);

    res.status(201).json({ message: `User ${user.name} created successfully`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update User (Full Edit)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, status, department, designation, reportsTo, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (status) user.status = status;
    if (department) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (reportsTo !== undefined) user.reportsTo = reportsTo;
    if (password && password.trim().length > 0) {
      user.password = password;
    }

    await user.save();

    await logAudit(req.user, 'Update User Profile', 'User Management', `Updated profile of user: ${user.email}`, req);

    res.json({ message: `User ${user.name} updated successfully`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.email === 'royallogu2026@gmail.com' || user.role === 'Super Admin') {
      return res.status(400).json({ message: 'Cannot delete primary Super Admin account' });
    }

    await User.findByIdAndDelete(req.params.id);
    await logAudit(req.user, 'Delete User', 'User Management', `Deleted user account: ${user.email}`, req);

    res.json({ message: `User ${user.name} deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Permission Matrix
exports.getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Permission Matrix (Super Admin only)
exports.updatePermissions = async (req, res) => {
  try {
    const { role, modules } = req.body;
    let perm = await Permission.findOne({ role });
    if (!perm) {
      perm = new Permission({ role, modules });
    } else {
      perm.modules = modules;
    }
    await perm.save();

    await logAudit(req.user, 'Update Permissions', 'Settings', `Updated permission matrix for role: ${role}`, req);

    res.json({ message: `Permissions updated for role ${role}`, perm });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

