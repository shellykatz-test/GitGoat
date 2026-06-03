const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'employee_db'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'weak-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.body.path || 'uploads/';
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const filename = req.body.filename || Date.now() + '-' + file.originalname;
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using parameterized queries to prevent SQL injection
// Agentic Rule (ARNIE_AUTH_AUTHENTICATION_FLOWS): Implementing proper login flow with company approval checks
// Agentic Rule (ARNIE_SESSION_SESSION_REGENERATION): Regenerating session after authentication
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Agentic Rule (ARNIE_INPUT_PARAMETER_VALIDATION): Validating input parameters
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using prepared statements for SQL injection prevention
  const query = `SELECT u.*, c.approved as company_approved 
                 FROM users u 
                 LEFT JOIN companies c ON u.company_id = c.id 
                 WHERE u.username = ? AND u.password = ?`;
  
  // Agentic Rule (ARNIE_HANDLING_ERROR_WRAPPING): Wrapping database calls with proper error handling
  db.query(query, [username, password], (err, results) => {
    if (err) {
      // Agentic Rule (ARNIE_HANDLING_GENERIC_RESPONSES): Returning generic error message
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Login failed' });
    }
    
    if (results.length > 0) {
      const user = results[0];
      
      // Agentic Rule (ARNIE_ACCESS_SERVER_SIDE): Server-side validation of company approval status
      // Check if user belongs to a company and if that company is approved
      if (user.company_id && !user.company_approved && user.role !== 'super_admin') {
        // Agentic Rule (ARNIE_HANDLING_SECURITY_LOGGING): Logging failed login attempt due to unapproved company
        console.log(`Login denied for user ${username}: Company not approved`);
        return res.json({ success: false, message: 'Your company is not approved yet. Please contact support.' });
      }
      
      // Agentic Rule (ARNIE_SESSION_SESSION_REGENERATION): Regenerate session after successful authentication
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ success: false, message: 'Login failed' });
        }
        
        // Agentic Rule (ARNIE_DATA_DATA_MASKING): Storing only necessary user data in session
        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          company_id: user.company_id
        };
        
        res.json({ success: true, role: user.role, user_id: user.id });
      });
    } else {
      // Agentic Rule (ARNIE_HANDLING_SECURITY_LOGGING): Logging failed login attempts
      console.log(`Failed login attempt for username: ${username}`);
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

app.get('/profile', (req, res) => {
  const userId = req.query.id || req.session.user?.id;
  
  const query = `SELECT u.*, e.* FROM users u LEFT JOIN employees e ON u.employee_id = e.id WHERE u.id = ${userId}`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});

app.get('/employees', (req, res) => {
  const companyId = req.query.company_id;
  
  let query = 'SELECT e.*, u.username FROM employees e LEFT JOIN users u ON u.employee_id = e.id';
  
  if (companyId) {
    query += ` WHERE e.company_id = ${companyId}`;
  }
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/upload-photo', upload.single('photo'), (req, res) => {
  const userId = req.body.user_id;
  const photoPath = req.file.path;
  
  const query = `UPDATE employees e JOIN users u ON u.employee_id = e.id SET e.photo = '${photoPath}' WHERE u.id = ${userId}`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, path: photoPath });
  });
});

app.get('/file', (req, res) => {
  const filePath = req.query.path;
  res.sendFile(filePath);
});

app.get('/download', (req, res) => {
  const file = req.query.file;
  const filePath = path.join(__dirname, file);
  res.download(filePath);
});

app.post('/update-profile', (req, res) => {
  const { user_id, full_name, address, phone, email } = req.body;
  
  const query = `UPDATE employees e JOIN users u ON u.employee_id = e.id 
                 SET e.full_name = '${full_name}', e.address = '${address}', 
                     e.phone = '${phone}', e.email = '${email}' 
                 WHERE u.id = ${user_id}`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/employee', (req, res) => {
  const employeeId = req.query.id;
  
  const query = `DELETE FROM employees WHERE id = ${employeeId}`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: 'Employee deleted' });
  });
});

app.post('/create-user', (req, res) => {
  const { username, password, role, company_id } = req.body;
  
  const query = `INSERT INTO users (username, password, role, company_id) VALUES ('${username}', '${password}', '${role}', ${company_id})`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, user_id: results.insertId });
  });
});

app.get('/admin/users', (req, res) => {
  const role = req.query.role;
  
  let query = 'SELECT * FROM users';
  
  if (role) {
    query += ` WHERE role = '${role}'`;
  }
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/admin/change-role', (req, res) => {
  const { user_id, new_role } = req.body;
  
  const query = `UPDATE users SET role = '${new_role}' WHERE id = ${user_id}`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.get('/search', (req, res) => {
  const searchTerm = req.query.q;
  
  const query = `SELECT * FROM employees WHERE full_name LIKE '%${searchTerm}%' OR email LIKE '%${searchTerm}%'`;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get('/debug', (req, res) => {
  const query = req.query.sql;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Agentic Rule (ARNIE_ACCESS_PERMISSION): Company management endpoints with role-based access control
// Agentic Rule (ARNIE_ACCESS_ROLE_HIERARCHY): Super admin only access for company management
app.get('/api/companies', (req, res) => {
  // Agentic Rule (ARNIE_ACCESS_SERVER_SIDE): Server-side validation of admin role
  if (!req.session.user || req.session.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using parameterized query
  const query = 'SELECT * FROM companies ORDER BY created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching companies:', err);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
    res.json(results);
  });
});

// Agentic Rule (ARNIE_ACCESS_PRIVILEGED_OPERATIONS): Approval requires super admin privileges
app.post('/api/companies/approve', (req, res) => {
  // Agentic Rule (ARNIE_ACCESS_SERVER_SIDE): Server-side role validation
  if (!req.session.user || req.session.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  
  const { company_id, approved } = req.body;
  
  // Agentic Rule (ARNIE_INPUT_PARAMETER_VALIDATION): Validate input parameters
  if (!company_id || approved === undefined) {
    return res.status(400).json({ error: 'Company ID and approval status are required' });
  }
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using prepared statements
  const query = 'UPDATE companies SET approved = ? WHERE id = ?';
  
  db.query(query, [approved, company_id], (err, results) => {
    if (err) {
      console.error('Error updating company approval:', err);
      return res.status(500).json({ error: 'Failed to update company' });
    }
    
    // Agentic Rule (ARNIE_HANDLING_SECURITY_LOGGING): Log approval changes
    console.log(`Company ${company_id} approval status changed to ${approved} by ${req.session.user.username}`);
    res.json({ success: true });
  });
});

// Agentic Rule (ARNIE_ACCESS_PRIVILEGED_OPERATIONS): Company creation requires super admin
app.post('/api/companies', (req, res) => {
  // Agentic Rule (ARNIE_ACCESS_SERVER_SIDE): Server-side authorization check
  if (!req.session.user || req.session.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  
  const { name, address } = req.body;
  
  // Agentic Rule (ARNIE_INPUT_PARAMETER_VALIDATION): Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using parameterized query
  const query = 'INSERT INTO companies (name, address, approved) VALUES (?, ?, FALSE)';
  
  db.query(query, [name, address], (err, results) => {
    if (err) {
      console.error('Error creating company:', err);
      return res.status(500).json({ error: 'Failed to create company' });
    }
    res.json({ success: true, company_id: results.insertId });
  });
});

// Agentic Rule (ARNIE_PATH_UPLOAD_VALIDATION): Secure file upload with validation
// Agentic Rule (ARNIE_PATH_FILENAME_SANITIZATION): Sanitizing filenames for incorporation documents
const incorporationUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      // Agentic Rule (ARNIE_PATH_PATH_BUILDING): Using secure path joining
      const uploadPath = path.join(__dirname, 'uploads', 'incorporation');
      
      // Agentic Rule (ARNIE_API_FILE_SYSTEM): Ensure directory exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      // Agentic Rule (ARNIE_PATH_FILENAME_SANITIZATION): Sanitize filename
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      cb(null, `${timestamp}-${sanitizedFilename}`);
    }
  }),
  limits: {
    // Agentic Rule (ARNIE_INPUT_FILE_UPLOAD): File size limit of 10MB
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    // Agentic Rule (ARNIE_PATH_EXTENSION_ALLOWLIST): Allowed file types for incorporation documents
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// Public endpoint for incorporation document upload
app.post('/api/upload-incorporation', incorporationUpload.single('document'), (req, res) => {
  const { company_name, company_address } = req.body;
  
  // Agentic Rule (ARNIE_INPUT_PARAMETER_VALIDATION): Validate required fields
  if (!company_name || !req.file) {
    return res.status(400).json({ error: 'Company name and document are required' });
  }
  
  // Agentic Rule (ARNIE_PATH_PATH_UTILITIES): Store relative path for security
  const documentPath = path.join('uploads', 'incorporation', req.file.filename);
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using parameterized query
  const query = 'INSERT INTO companies (name, address, incorporation_document, approved) VALUES (?, ?, ?, FALSE)';
  
  db.query(query, [company_name, company_address || '', documentPath], (err, results) => {
    if (err) {
      console.error('Error creating company:', err);
      // Clean up uploaded file on error
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Failed to submit application' });
    }
    
    // Agentic Rule (ARNIE_HANDLING_SECURITY_LOGGING): Log incorporation document uploads
    console.log(`New company application submitted: ${company_name}`);
    res.json({ success: true, message: 'Application submitted successfully. You will be notified once approved.' });
  });
});

// Endpoint to view incorporation document (admin only)
app.get('/api/incorporation-document/:company_id', (req, res) => {
  // Agentic Rule (ARNIE_ACCESS_SERVER_SIDE): Verify admin access
  if (!req.session.user || req.session.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  
  const companyId = req.params.company_id;
  
  // Agentic Rule (ARNIE_INPUT_PREPARED_STATEMENTS): Using parameterized query
  const query = 'SELECT incorporation_document FROM companies WHERE id = ?';
  
  db.query(query, [companyId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const documentPath = results[0].incorporation_document;
    if (!documentPath) {
      return res.status(404).json({ error: 'No document uploaded' });
    }
    
    // Agentic Rule (ARNIE_PATH_BOUNDARY_CHECKING): Ensure file is within uploads directory
    const fullPath = path.join(__dirname, documentPath);
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fullPath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    // Agentic Rule (ARNIE_API_FILE_SYSTEM): Secure file serving
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      res.status(404).json({ error: 'Document file not found' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
