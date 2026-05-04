/**
 * Storage service — vendor-agnostic file upload abstraction.
 *
 * Default provider: Cloudinary (free 25GB tier). Falls back to local disk if
 * Cloudinary credentials aren't set, so dev still works without signup.
 *
 * Cloudinary nuance: it has a `resource_type` distinction (image / video /
 * raw). DWG, DXF, STEP, PDF, ZIP all need `raw` to bypass image processing.
 * We default everything except images to raw — Cloudinary then serves the
 * file unchanged at a stable URL.
 *
 * Files are uploaded to a folder structure: taskora/<taskId>/<filename>
 * so they're easy to inspect or migrate later.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

let cloudinary = null;
let providerName = 'local';

function init() {
  if (providerName !== 'local') return; // already initialised

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    try {
      // eslint-disable-next-line global-require
      cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
      });
      providerName = 'cloudinary';
      logger.info('Cloudinary storage initialised');
    } catch (err) {
      logger.warn('Cloudinary credentials set but SDK init failed — falling back to local', err.message);
      providerName = 'local';
    }
  } else {
    logger.warn('Cloudinary not configured — using local disk (files will NOT survive Render redeploys)');
  }
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']);

function pickResourceType(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return IMAGE_EXTS.has(ext) ? 'image' : 'raw';
}

/**
 * Upload a multer-saved file to the configured backend.
 * Returns { url, publicId, storage } that goes into the Task.attachments[] entry.
 */
async function uploadFile({ localPath, originalName, taskId, mimeType }) {
  init();

  if (providerName === 'cloudinary') {
    const folder = `taskora/${taskId}`;
    const baseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(originalName).slice(1) || 'bin';
    const publicId = `${folder}/${Date.now()}-${baseName}-${crypto.randomBytes(3).toString('hex')}`;
    const resourceType = pickResourceType(originalName);

    const result = await cloudinary.uploader.upload(localPath, {
      public_id: publicId,
      resource_type: resourceType,
      // For 'raw', we keep the original file extension. For 'image' Cloudinary
      // figures it out itself.
      format: resourceType === 'raw' ? ext : undefined,
      // Don't auto-process or transform — we want the raw file back.
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    });

    // Best-effort delete of the temp file.
    fs.promises.unlink(localPath).catch(() => {});

    return {
      url: result.secure_url,
      publicId: result.public_id,
      storage: 'cloudinary',
      resourceType,
    };
  }

  // Local fallback. The /uploads route is already mounted in server.js.
  // Note: ephemeral on Render free tier — files will vanish on every redeploy.
  // Use Cloudinary for production.
  const filename = path.basename(localPath);
  const publicUrl = `/uploads/${filename}`; // relative; client prepends API base
  return {
    url: publicUrl,
    publicId: filename,
    storage: 'local',
  };
}

/**
 * Remove a previously-uploaded file from the backend that owns it.
 * Best-effort — does not throw if the file is already gone.
 */
async function deleteFile({ publicId, storage, resourceType }) {
  init();

  try {
    if (storage === 'cloudinary' && cloudinary) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType || 'raw',
        invalidate: true,
      });
    } else if (storage === 'local') {
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = path.resolve(uploadDir, publicId);
      await fs.promises.unlink(filePath).catch(() => {});
    }
  } catch (err) {
    logger.warn('Storage delete failed (non-fatal)', { publicId, err: err.message });
  }
}

function getProvider() {
  init();
  return providerName;
}

module.exports = { uploadFile, deleteFile, getProvider };
