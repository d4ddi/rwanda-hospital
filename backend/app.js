const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'rwanda_hospital_secret_key';

// Ensure uploads directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwanda_hospital', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Schemas (same as before, but with avatar field)
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'doctor', 'nurse', 'patient'], default: 'patient' },
  phone: String,
  avatar: String,
  createdAt: { type: Date, default: Date.now }
});

const PatientSchema = new mongoose.Schema({
  patientId: String,
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: String,
  phone: String,
  email: String,
  address: String,
  emergencyContact: String,
  medicalHistory: String,
  bloodType: String,
  allergies: String,
  avatar: String,
  createdAt: { type: Date, default: Date.now }
});

const DoctorSchema = new mongoose.Schema({
  doctorId: String,
  firstName: String,
  lastName: String,
  specialization: String,
  phone: String,
  email: String,
  licenseNumber: String,
  department: String,
  experience: Number,
  avatar: String,
  createdAt: { type: Date, default: Date.now }
});

const AppointmentSchema = new mongoose.Schema({
  patientId: String,
  doctorId: String,
  appointmentDate: Date,
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  reason: String,
  notes: String,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  createdAt: { type: Date, default: Date.now }
});

const MedicalRecordSchema = new mongoose.Schema({
  patientId: String,
  doctorId: String,
  diagnosis: String,
  prescription: String,
  treatment: String,
  notes: String,
  followUpDate: Date,
  attachments: [String],
  createdAt: { type: Date, default: Date.now }
});

const BillingSchema = new mongoose.Schema({
  patientId: String,
  amount: Number,
  description: String,
  status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
  dueDate: Date,
  paymentMethod: String,
  invoiceNumber: String,
  createdAt: { type: Date, default: Date.now }
});

const DepartmentSchema = new mongoose.Schema({
  name: String,
  description: String,
  headDoctor: String,
  staffCount: Number,
  createdAt: { type: Date, default: Date.now }
});

const InventorySchema = new mongoose.Schema({
  itemName: String,
  category: String,
  quantity: Number,
  unitPrice: Number,
  supplier: String,
  expiryDate: Date,
  status: { type: String, enum: ['available', 'low', 'out'], default: 'available' },
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  userId: String,
  title: String,
  message: String,
  type: { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', UserSchema);
const Patient = mongoose.model('Patient', PatientSchema);
const Doctor = mongoose.model('Doctor', DoctorSchema);
const Appointment = mongoose.model('Appointment', AppointmentSchema);
const MedicalRecord = mongoose.model('MedicalRecord', MedicalRecordSchema);
const Billing = mongoose.model('Billing', BillingSchema);
const Department = mongoose.model('Department', DepartmentSchema);
const Inventory = mongoose.model('Inventory', InventorySchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Upload avatar route
app.post('/api/upload/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Update user avatar
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { avatar: `/uploads/${req.file.filename}` },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: user.avatar,
      user: user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Registration - Updated to prevent non-admin registration as admin
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    
    // Prevent registration as admin unless explicitly allowed (for security)
    // Only allow doctor, nurse, or patient roles for public registration
    const allowedRoles = ['doctor', 'nurse', 'patient'];
    const finalRole = allowedRoles.includes(role) ? role : 'patient';
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: finalRole,
      phone
    });

    await user.save();
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// TEMPORARY: Create admin user (REMOVE AFTER FIRST USE)
app.post('/api/auth/create-admin', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin user already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      phone
    });

    await admin.save();
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        avatar: admin.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name, phone },
      { new: true }
    ).select('-password');
    
    res.json({
      message: 'Profile updated successfully',
      user: user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reports Routes
app.get('/api/reports/daily', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = {
      date: today,
      type: 'daily',
      totalPatients: await Patient.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      totalAppointments: await Appointment.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      completedAppointments: await Appointment.countDocuments({
        status: 'completed',
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      newDoctors: await Doctor.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      revenue: await Billing.aggregate([
        { $match: { 
            status: 'paid',
            createdAt: { $gte: today, $lt: tomorrow }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/reports/weekly', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = {
      startDate: weekAgo,
      endDate: today,
      type: 'weekly',
      totalPatients: await Patient.countDocuments({
        createdAt: { $gte: weekAgo, $lt: today }
      }),
      totalAppointments: await Appointment.countDocuments({
        createdAt: { $gte: weekAgo, $lt: today }
      }),
      completedAppointments: await Appointment.countDocuments({
        status: 'completed',
        createdAt: { $gte: weekAgo, $lt: today }
      }),
      newDoctors: await Doctor.countDocuments({
        createdAt: { $gte: weekAgo, $lt: today }
      }),
      revenue: await Billing.aggregate([
        { $match: { 
            status: 'paid',
            createdAt: { $gte: weekAgo, $lt: today }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/reports/monthly', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const stats = {
      startDate: monthAgo,
      endDate: today,
      type: 'monthly',
      totalPatients: await Patient.countDocuments({
        createdAt: { $gte: monthAgo, $lt: today }
      }),
      totalAppointments: await Appointment.countDocuments({
        createdAt: { $gte: monthAgo, $lt: today }
      }),
      completedAppointments: await Appointment.countDocuments({
        status: 'completed',
        createdAt: { $gte: monthAgo, $lt: today }
      }),
      newDoctors: await Doctor.countDocuments({
        createdAt: { $gte: monthAgo, $lt: today }
      }),
      revenue: await Billing.aggregate([
        { $match: { 
            status: 'paid',
            createdAt: { $gte: monthAgo, $lt: today }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Patients Routes
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Doctors Routes
app.get('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ createdAt: -1 });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const doctor = new Doctor(req.body);
    await doctor.save();
    res.status(201).json(doctor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Appointments Routes
app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId')
      .populate('doctorId')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Medical Records Routes
app.get('/api/medical-records', authenticateToken, async (req, res) => {
  try {
    const records = await MedicalRecord.find()
      .populate('patientId')
      .populate('doctorId')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/medical-records', authenticateToken, async (req, res) => {
  try {
    const record = new MedicalRecord(req.body);
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Billing Routes
app.get('/api/billing', authenticateToken, async (req, res) => {
  try {
    const bills = await Billing.find()
      .populate('patientId')
      .sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/billing', authenticateToken, async (req, res) => {
  try {
    const bill = new Billing(req.body);
    await bill.save();
    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/billing/:id', authenticateToken, async (req, res) => {
  try {
    const bill = await Billing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Departments Routes
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/departments', authenticateToken, async (req, res) => {
  try {
    const department = new Department(req.body);
    await department.save();
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Inventory Routes
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.find().sort({ createdAt: -1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Notifications Routes
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notification = new Notification({
      ...req.body,
      userId: req.user.userId
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dashboard Statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      totalPatients: await Patient.countDocuments(),
      totalDoctors: await Doctor.countDocuments(),
      totalAppointments: await Appointment.countDocuments(),
      pendingAppointments: await Appointment.countDocuments({ status: 'pending' }),
      completedAppointments: await Appointment.countDocuments({ status: 'completed' }),
      totalRevenue: await Billing.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      lowInventory: await Inventory.countDocuments({ status: 'low' }),
      outOfStock: await Inventory.countDocuments({ status: 'out' })
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});