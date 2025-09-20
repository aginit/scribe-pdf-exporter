const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const multer = require('multer');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BACKUPS_DIR = path.join(__dirname, 'backups');

// Ensure upload and backup directories exist
fsExtra.ensureDirSync(UPLOADS_DIR);
fsExtra.ensureDirSync(BACKUPS_DIR);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const docId = req.body.documentId;
    const docUploadsDir = path.join(UPLOADS_DIR, docId);
    fsExtra.ensureDirSync(docUploadsDir);
    cb(null, docUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

async function loadUsers() {
  const defaultUsers = [
    {
      id: 'admin',
      username: 'admin',
      email: 'admin@local',
      password: await bcrypt.hash('ScribeExport25.', 10),
      createdAt: new Date().toISOString()
    }
  ];

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  if (users.length === 0) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
  return users;
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const users = await loadUsers();
      const user = users.find(u => u.username === username);

      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const users = await loadUsers();
  const user = users.find(u => u.id === id);
  done(null, user);
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login?error=1',
  failureFlash: false
}));


app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/login');
  });
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email
  });
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/export', isAuthenticated, async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'scribe-exporter-improved.js');
    const { spawn } = require('child_process');

    const exportProcess = spawn('node', [scriptPath], {
      env: { ...process.env }
    });

    let output = '';

    exportProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    exportProcess.stderr.on('data', (data) => {
      console.error(`Export error: ${data}`);
    });

    exportProcess.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'Export completed', output });
      } else {
        res.status(500).json({ success: false, message: 'Export failed', output });
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/downloads', isAuthenticated, (req, res) => {
  try {
    const downloadsDir = path.join(__dirname, 'downloads');
    const files = fs.readdirSync(downloadsDir);
    const filterType = req.query.type; // 'converted', 'pdf', 'all'

    let fileList = files
      .filter(file => !file.startsWith('.'))
      .map(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        const extension = file.split('.').pop().toLowerCase();
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          extension: extension,
          type: ['md', 'json', 'html'].includes(extension) ? 'converted' :
                extension === 'pdf' ? 'pdf' : 'other'
        };
      });

    // Apply filtering
    if (filterType === 'converted') {
      fileList = fileList.filter(file => file.type === 'converted');
    } else if (filterType === 'pdf') {
      fileList = fileList.filter(file => file.type === 'pdf');
    }
    // 'all' or no filter shows everything

    fileList = fileList.sort((a, b) => b.modified - a.modified);

    res.json({
      files: fileList,
      summary: {
        total: files.length - files.filter(f => f.startsWith('.')).length,
        converted: fileList.filter(f => f.type === 'converted').length,
        pdf: fileList.filter(f => f.type === 'pdf').length
      }
    });
  } catch (error) {
    console.error('Error listing downloads:', error);
    res.status(500).json({ error: 'Failed to list downloads' });
  }
});

// Editor Routes
app.get('/editor', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

// Get document for editing
app.get('/api/documents/:id/edit', isAuthenticated, (req, res) => {
  try {
    const docId = req.params.id;
    const jsonPath = path.join(__dirname, 'downloads', docId);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const documentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Ensure the document has the expected structure
    if (!documentData.steps) {
      documentData.steps = [];
    }
    if (!documentData.title) {
      documentData.title = path.basename(docId, path.extname(docId));
    }

    res.json(documentData);
  } catch (error) {
    console.error('Error loading document for editing:', error);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

// Save edited document
app.put('/api/documents/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const docId = req.params.id;
    const documentData = req.body;
    const jsonPath = path.join(__dirname, 'downloads', docId);
    const htmlPath = jsonPath.replace('.json', '.html');

    // Create backup before saving
    if (fs.existsSync(jsonPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${path.basename(docId, '.json')}_${timestamp}.json`;
      const backupPath = path.join(BACKUPS_DIR, backupName);
      fs.copyFileSync(jsonPath, backupPath);
    }

    // Save the JSON file
    fs.writeFileSync(jsonPath, JSON.stringify(documentData, null, 2));

    // Regenerate HTML from the updated JSON
    if (!documentData.isDraft) {
      const htmlContent = generateHTMLFromJSON(documentData, docId);
      fs.writeFileSync(htmlPath, htmlContent);
    }

    res.json({
      success: true,
      message: documentData.isDraft ? 'Draft saved' : 'Document published',
      backup: true
    });
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

// Upload image
app.post('/api/upload-image', isAuthenticated, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const docId = req.body.documentId;
    const relativePath = path.join('/uploads', docId, req.file.filename);

    res.json({
      success: true,
      url: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get document versions/backups
app.get('/api/documents/:id/versions', isAuthenticated, (req, res) => {
  try {
    const docId = req.params.id;
    const docName = path.basename(docId, '.json');
    const backups = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith(docName + '_'))
      .map(file => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, file));
        return {
          name: file,
          created: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ versions: backups });
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

// Restore a version
app.post('/api/documents/:id/restore', isAuthenticated, (req, res) => {
  try {
    const docId = req.params.id;
    const { versionName } = req.body;

    const backupPath = path.join(BACKUPS_DIR, versionName);
    const targetPath = path.join(__dirname, 'downloads', docId);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Create backup of current version before restoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackupName = `${path.basename(docId, '.json')}_before_restore_${timestamp}.json`;
    const currentBackupPath = path.join(BACKUPS_DIR, currentBackupName);
    fs.copyFileSync(targetPath, currentBackupPath);

    // Restore the version
    fs.copyFileSync(backupPath, targetPath);

    res.json({ success: true, message: 'Version restored successfully' });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Helper function to generate HTML from JSON
function generateHTMLFromJSON(documentData, fileName) {
  const title = documentData.title || 'Document';

  let stepsHTML = '';
  documentData.steps.forEach((step, index) => {
    const stepImages = step.images && step.images.length > 0
      ? step.images.map(img => `<img src="${img}" alt="Step ${index + 1} image" onclick="openModal(this.src)">`).join('\n            ')
      : '';

    stepsHTML += `
        <div class="step">
            <div class="step-number">${index + 1}</div>
            <div class="step-content">
                <h2>${step.title || `Step ${index + 1}`}</h2>
                <div class="step-description">
                    ${step.description || ''}
                </div>
                ${stepImages ? `<div class="step-images">${stepImages}</div>` : ''}
            </div>
        </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        }

        .header .meta {
            opacity: 0.9;
            font-size: 0.9rem;
        }

        .content {
            padding: 2rem;
        }

        .step {
            display: flex;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .step:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
        }

        .step-number {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 1.5rem;
            flex-shrink: 0;
        }

        .step-content {
            flex: 1;
        }

        .step h2 {
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 1.3rem;
        }

        .step-description {
            color: #4a5568;
            margin-bottom: 1rem;
            line-height: 1.6;
        }

        .step-images {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .step-images img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            cursor: pointer;
            transition: transform 0.3s;
        }

        .step-images img:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            cursor: pointer;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90%;
            max-height: 90%;
        }

        .modal-content img {
            width: 100%;
            height: auto;
        }

        .close {
            position: absolute;
            top: 20px;
            right: 40px;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1001;
        }

        .close:hover {
            color: #f56565;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #718096;
            font-size: 0.9rem;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.8rem;
            }

            .step {
                flex-direction: column;
            }

            .step-number {
                margin-bottom: 1rem;
                margin-right: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <div class="meta">Generated on ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="content">
            ${stepsHTML}
        </div>
        <div class="footer">
            Scribe Document - Edited Version
        </div>
    </div>

    <div id="imageModal" class="modal" onclick="closeModal()">
        <span class="close">&times;</span>
        <div class="modal-content">
            <img id="modalImage" src="" alt="Enlarged image">
        </div>
    </div>

    <script>
        function openModal(src) {
            document.getElementById('imageModal').style.display = 'block';
            document.getElementById('modalImage').src = src;
        }

        function closeModal() {
            document.getElementById('imageModal').style.display = 'none';
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
    </script>
</body>
</html>`;
}

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.use('/downloads', isAuthenticated, express.static(path.join(__dirname, 'downloads')));
app.use('/uploads', isAuthenticated, express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));

app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/favicon.ico' || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/images')) {
    return next();
  }

  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  next();
});

app.listen(PORT, () => {
  console.log(`🔒 Secure server running on http://localhost:${PORT}`);
  console.log(`🔑 Login at http://localhost:${PORT}/login`);
  console.log(`👤 Admin credentials: admin / ScribeExport25.`);
});