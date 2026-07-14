function normalizeMultipartFilename(value) {
  const filename = String(value || "");
  if (!filename || !/[\u0080-\u00ff]/.test(filename)) return filename;
  const decoded = Buffer.from(filename, "latin1").toString("utf8");
  if (!decoded || decoded.includes("\uFFFD") || decoded === filename) return filename;
  return decoded;
}

module.exports = { normalizeMultipartFilename };
