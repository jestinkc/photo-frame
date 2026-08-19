const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { put, del } = require('@vercel/blob');

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

// Ensure DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is missing. Please define it in your .env file or Vercel environment.');
  process.exit(1);
}

// Initialize Postgres connection pool (Neon DB)
console.log('[System] Initializing connection to Postgres / Neon DB...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon Postgres SSL connections
  }
});

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

// Run DB setup on startup
initDb();

// Middleware to parse large JSON payloads (since we receive high-res Base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

// API: Get current server config
app.get('/api/config', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM config WHERE key = 'autoApprove'");
    const isAuto = result.rows[0]?.value === 'true';
    res.json({ autoApprove: isAuto });
  } catch (err) {
    console.error('Failed to query config from DB:', err);
    res.status(500).json({ error: 'Failed to read server configuration.' });
  }
});

// API: Set server config
app.post('/api/config', async (req, res) => {
  const valBool = !!req.body.autoApprove;
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

  try {
    let fileUrl = '';
    
    // Check if Vercel Blob token is available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Upload binary buffer to Vercel Blob Storage
      const blob = await put(filename, buffer, { access: 'public' });
      fileUrl = blob.url;
      console.log(`[Submission] Cloud saved ${filename} to Vercel Blob`);
    } else {
      // Local Fallback: Save file to local uploads directory for local testing
      const uploadsDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      fileUrl = `/uploads/${filename}`;
      console.log(`[Submission] Saved locally (fallback): ${filename}`);
    }
    
    // Query autoApprove config
    const configRes = await pool.query("SELECT value FROM config WHERE key = 'autoApprove'");
    const isAuto = configRes.rows[0]?.value === 'true';
    const status = isAuto ? 'approved' : 'pending';
    
    // Save record in PostgreSQL
    await pool.query(
      "INSERT INTO submissions (filename, url, status, timestamp) VALUES ($1, $2, $3, $4)",
      [filename, fileUrl, status, timestamp]
    );
    
    console.log(`[Submission] Database saved ${filename} as ${status}`);
    res.json({
      success: true,
      filename,
      status,
      url: fileUrl
    });
  } catch (err) {
    console.error('[Submit] Database/Blob upload failed:', err);
    res.status(500).json({ error: 'Failed to process submission.' });
  }
});

// API: List pending submissions
app.get('/api/pending', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT filename, url, timestamp FROM submissions WHERE status = 'pending' ORDER BY timestamp DESC"
    );
    res.json({ count: result.rowCount, images: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending submissions.' });
  }
});

// API: List approved submissions
app.get('/api/approved', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT filename, url, timestamp FROM submissions WHERE status = 'approved' ORDER BY timestamp DESC"
    );
    res.json({ count: result.rowCount, images: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch approved submissions.' });
  }
});

// API: Approve a pending photo frame
app.post('/api/approve', async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename parameter.' });
  }

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
});

// API: Reject/Delete a photo frame (either pending or approved)
app.post('/api/reject', async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename parameter.' });
  }

  try {
    // Find submission url
    const findRes = await pool.query("SELECT url FROM submissions WHERE filename = $1", [filename]);
    if (findRes.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found in DB.' });
    }
    
    const fileUrl = findRes.rows[0].url;

    // Delete binary file
    if (fileUrl.startsWith('http')) {
      // Delete from Vercel Blob
      await del(fileUrl);
      console.log(`[Reject] Deleted from Vercel Blob: ${fileUrl}`);
    } else {
      // Delete local fallback file
      const localPath = path.join(__dirname, 'uploads', filename);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`[Reject] Deleted local fallback file: ${localPath}`);
      }
    }

    // Delete from Postgres database
    await pool.query("DELETE FROM submissions WHERE filename = $1", [filename]);
    console.log(`[Moderation] Rejected & Deleted ${filename} from DB.`);
    res.json({ success: true, filename });
  } catch (err) {
    console.error('[Reject] Failed to delete from DB or Blob:', err);
    res.status(500).json({ error: 'Failed to reject submission.' });
  }
});

// Serve local fallback uploads directory if running locally
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
