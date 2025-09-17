const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const mime = require('mime-types');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'data', 'uploads');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function createStorageKey(originalName, mimeType) {
  const extFromName = path.extname(originalName || '').toLowerCase();
  if (extFromName) {
    return `${Date.now()}-${nanoid()}${extFromName}`;
  }
  const derivedExt = mime.extension(mimeType || '') || 'bin';
  return `${Date.now()}-${nanoid()}.${derivedExt}`;
}

function saveBuffer(buffer, { originalName, mimeType }) {
  ensureUploadDir();
  const key = createStorageKey(originalName, mimeType);
  const filePath = path.join(UPLOAD_DIR, key);
  fs.writeFileSync(filePath, buffer);
  return { key, filePath };
}

function resolveFilePath(storageKey) {
  const normalized = path.basename(storageKey);
  return path.join(UPLOAD_DIR, normalized);
}

function openReadStream(storageKey) {
  const filePath = resolveFilePath(storageKey);
  return fs.createReadStream(filePath);
}

function fileStat(storageKey) {
  try {
    const filePath = resolveFilePath(storageKey);
    return fs.statSync(filePath);
  } catch (error) {
    return null;
  }
}

module.exports = {
  UPLOAD_DIR,
  ensureUploadDir,
  saveBuffer,
  openReadStream,
  fileStat,
};
