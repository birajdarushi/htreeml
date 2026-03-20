// Create minimal valid PNG files
const fs = require('fs');
const path = require('path');

// Minimal 1x1 transparent PNG (base64)
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const filename = `icon${size}.png`;
  fs.writeFileSync(filename, pngBuffer);
  console.log(`Created ${filename}`);
});
