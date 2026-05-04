/**
 * Multer upload middleware.
 *
 * The handler temporarily stores files on local disk, then storageService
 * picks them up and forwards to Cloudinary (or keeps them locally as a
 * fallback). Either way, multer's local copy is cleaned up after the upload
 * step in the controller.
 *
 * We DON'T restrict by MIME type — DXF, DWG, STEP files often arrive with
 * generic application/octet-stream and would be wrongly rejected. Instead we
 * blocklist only obviously dangerous server-side executables.
 */
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 50 * 1024 * 1024; // 50 MB

const BLOCKED_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.cpl',
  '.sh', '.app', '.dmg',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not allowed for security reasons`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES },
});

const publicUrlFor = (req, filename) =>
  `${req.protocol}://${req.get('host')}/uploads/${filename}`;

module.exports = { upload, publicUrlFor, MAX_FILE_BYTES };
