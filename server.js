const express = require('express');
const fs = require('fs');
const path = require('path');

// Manually parse local .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    }
  });
}


const app = express();
const PORT = process.env.PORT || 3000;

// Configuration fallback (used only in Local Mode)
let autoApprove = false;

// Middleware to parse large JSON payloads (since we receive high-res Base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories (used only in Local Mode)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PENDING_DIR = path.join(UPLOADS_DIR, 'pending');
const APPROVED_DIR = path.join(UPLOADS_DIR, 'approved');

// Ensure upload directories exist (local fallback)
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Check if Postgres database connection is provided (Neon DB)
const useDb = !!process.env.DATABASE_URL;
let pool = null;

if (useDb) {
  console.log('[System] DATABASE_URL detected. Initializing Postgres / Neon DB...');
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Neon serverless postgres SSL connections
    }
  });
  initDb();
} else {
  console.log('[System] Running in Local Storage Mode (No Database detected)');
  ensureDirExists(UPLOADS_DIR);
  ensureDirExists(PENDING_DIR);
  ensureDirExists(APPROVED_DIR);
}

// Database schema initialization
async function initDb() {
  try {
    // 1. Create submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        url TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        timestamp BIGINT NOT NULL
      );
    `);

    // 2. Create config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 3. Inject default autoApprove value
    await pool.query(`
      INSERT INTO config (key, value)
      VALUES ('autoApprove', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('[Neon DB] Tables verified/created successfully.');
  } catch (err) {
    console.error('[Neon DB] Database initialization failed:', err);
  }
}

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

// API: Get current server config
app.get('/api/config', async (req, res) => {
  if (useDb) {
    try {
      const result = await pool.query("SELECT value FROM config WHERE key = 'autoApprove'");
      const isAuto = result.rows[0]?.value === 'true';
      res.json({ autoApprove: isAuto });
    } catch (err) {
      console.error('Failed to query config from DB:', err);
      res.status(500).json({ error: 'Failed to read server configuration.' });
    }
  } else {
    res.json({ autoApprove });
  }
});

// API: Set server config
app.post('/api/config', async (req, res) => {
  const valBool = !!req.body.autoApprove;
  
  if (useDb) {
    try {
      const valStr = valBool ? 'true' : 'false';
      await pool.query(
        "INSERT INTO config (key, value) VALUES ('autoApprove', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [valStr]
      );
      console.log(`[Config Update] Auto-Approve set to: ${valBool}`);
      res.json({ success: true, autoApprove: valBool });
    } catch (err) {
      console.error('Failed to update config in DB:', err);
      res.status(500).json({ error: 'Failed to update configuration.' });
    }
  } else {
    autoApprove = valBool;
    console.log(`[Config Update] Auto-Approve set to: ${autoApprove}`);
    res.json({ success: true, autoApprove });
  }
});

// API: Submit a photo frame
app.post('/api/submit', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing image payload.' });
  }

  // Parse the Base64 image
  const matches = image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: 'Invalid Base64 image format.' });
  }

  const ext = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const timestamp = Date.now();
  const filename = `frame_${timestamp}_${Math.floor(1000 + Math.random() * 9000)}.${ext}`;

  if (useDb) {
    try {
      // Vercel Blob client requires dynamic loading to prevent local crash if not installed
      const { put } = require('@vercel/blob');
      
      // Upload binary buffer to Vercel Blob Storage
      const blob = await put(filename, buffer, { access: 'public' });
      const fileUrl = blob.url;
      
      // Query autoApprove config
      const configRes = await pool.query("SELECT value FROM config WHERE key = 'autoApprove'");
      const isAuto = configRes.rows[0]?.value === 'true';
      const status = isAuto ? 'approved' : 'pending';
      
      // Save record in PostgreSQL
      await pool.query(
        "INSERT INTO submissions (filename, url, status, timestamp) VALUES ($1, $2, $3, $4)",
        [filename, fileUrl, status, timestamp]
      );
      
      console.log(`[Submission] Cloud saved ${filename} as ${status}`);
      res.json({
        success: true,
        filename,
        status,
        url: fileUrl
      });
    } catch (err) {
      console.error('[Submit] Database/Blob upload failed:', err);
      res.status(500).json({ error: 'Failed to process submission in cloud mode.' });
    }
  } else {
    // Local storage fallback
    const targetDir = autoApprove ? APPROVED_DIR : PENDING_DIR;
    const targetPath = path.join(targetDir, filename);

    fs.writeFile(targetPath, buffer, (err) => {
      if (err) {
        console.error('Failed to save file locally:', err);
        return res.status(500).json({ error: 'Failed to save submission.' });
      }

      console.log(`[Submission] Saved locally ${filename} to ${autoApprove ? 'approved' : 'pending'}`);
      res.json({
        success: true,
        filename,
        status: autoApprove ? 'approved' : 'pending',
        url: `/uploads/${autoApprove ? 'approved' : 'pending'}/${filename}`
      });
    });
  }
});

// Helper (used in Local Mode): Scan local folder for images
function getLocalImagesFromDir(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .map(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        return {
          filename: file,
          timestamp: stat.mtimeMs,
          url: `/uploads/${path.basename(dirPath)}/${file}`
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err);
    return [];
  }
}

// API: List pending submissions
app.get('/api/pending', async (req, res) => {
  if (useDb) {
    try {
      const result = await pool.query(
        "SELECT filename, url, timestamp FROM submissions WHERE status = 'pending' ORDER BY timestamp DESC"
      );
      res.json({ count: result.rowCount, images: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch pending submissions.' });
    }
  } else {
    const images = getLocalImagesFromDir(PENDING_DIR);
    res.json({ count: images.length, images });
  }
});

// API: List approved submissions
app.get('/api/approved', async (req, res) => {
  if (useDb) {
    try {
      const result = await pool.query(
        "SELECT filename, url, timestamp FROM submissions WHERE status = 'approved' ORDER BY timestamp DESC"
      );
      res.json({ count: result.rowCount, images: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch approved submissions.' });
    }
  } else {
    const images = getLocalImagesFromDir(APPROVED_DIR);
    res.json({ count: images.length, images });
  }
});

// API: Approve a pending photo frame
app.post('/api/approve', async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename parameter.' });
  }

  if (useDb) {
    try {
      const result = await pool.query(
        "UPDATE submissions SET status = 'approved' WHERE filename = $1 RETURNING *",
        [filename]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Pending submission not found.' });
      }
      console.log(`[Moderation] Approved ${filename} in DB.`);
      res.json({ success: true, filename });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to approve submission.' });
    }
  } else {
    const sourcePath = path.join(PENDING_DIR, filename);
    const destPath = path.join(APPROVED_DIR, filename);

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Pending submission not found.' });
    }

    fs.rename(sourcePath, destPath, (err) => {
      if (err) {
        console.error('Failed to approve file locally:', err);
        return res.status(500).json({ error: 'Failed to approve submission.' });
      }
      console.log(`[Moderation] Approved locally ${filename}`);
      res.json({ success: true, filename });
    });
  }
});

// API: Reject/Delete a photo frame (either pending or approved)
app.post('/api/reject', async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename parameter.' });
  }

  if (useDb) {
    try {
      // Find submission url
      const findRes = await pool.query("SELECT url FROM submissions WHERE filename = $1", [filename]);
      if (findRes.rowCount === 0) {
        return res.status(404).json({ error: 'Submission not found in DB.' });
      }
      
      const fileUrl = findRes.rows[0].url;

      // Delete binary file from Vercel Blob
      const { del } = require('@vercel/blob');
      await del(fileUrl);

      // Delete from Postgres database
      await pool.query("DELETE FROM submissions WHERE filename = $1", [filename]);
      console.log(`[Moderation] Rejected & Deleted ${filename} from Blob & DB.`);
      res.json({ success: true, filename });
    } catch (err) {
      console.error('[Reject] Failed to delete from DB or Blob:', err);
      res.status(500).json({ error: 'Failed to reject submission.' });
    }
  } else {
    const pendingPath = path.join(PENDING_DIR, filename);
    const approvedPath = path.join(APPROVED_DIR, filename);

    let targetPath = null;
    if (fs.existsSync(pendingPath)) {
      targetPath = pendingPath;
    } else if (fs.existsSync(approvedPath)) {
      targetPath = approvedPath;
    }

    if (!targetPath) {
      return res.status(404).json({ error: 'File not found.' });
    }

    fs.unlink(targetPath, (err) => {
      if (err) {
        console.error('Failed to delete file locally:', err);
        return res.status(500).json({ error: 'Failed to delete submission.' });
      }
      console.log(`[Moderation] Rejected & Deleted locally ${filename}`);
      res.json({ success: true, filename });
    });
  }
});

// Serve uploads folder (local fallback)
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve other static project files from current workspace directory
app.use(express.static(__dirname));

// Start listening
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Hack Till Dawn III Live Photobooth Server Running`);
  console.log(`👉 Access Client at:   http://localhost:${PORT}`);
  console.log(`👉 Access Admin at:    http://localhost:${PORT}/admin.html`);
  console.log(`👉 Access Live Wall at: http://localhost:${PORT}/story.html`);
  console.log(`====================================================`);
});
