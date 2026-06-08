/**
 * Pre-procesa los marcos de dispositivo para optimizar el rendimiento de FFmpeg.
 *
 * Lee cada PNG en frames/ y lo guarda ya redimensionado en frames/optimized/
 * al tamaño final definido en frames/frames.json.
 *
 * Uso:
 *   npm run prepare-frames
 *   node scripts/prepare-frames.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const framesDir = path.join(__dirname, '..', 'frames');
const optimizedDir = path.join(framesDir, 'optimized');
const framesJsonPath = path.join(framesDir, 'frames.json');

async function main() {
  if (!fs.existsSync(framesJsonPath)) {
    console.error('frames/frames.json not found');
    process.exit(1);
  }

  const framesData = JSON.parse(fs.readFileSync(framesJsonPath, 'utf-8'));
  fs.mkdirSync(optimizedDir, { recursive: true });

  for (const [name, config] of Object.entries(framesData)) {
    const inputPath = path.join(framesDir, config.image);
    const outputPath = path.join(optimizedDir, config.image);

    if (!fs.existsSync(inputPath)) {
      console.warn(`  ⚠️  ${config.image} not found, skipping`);
      continue;
    }

    console.log(`  Processing: ${name} (${config.totalWidth}x${config.totalHeight})`);

    await sharp(inputPath)
      .resize(config.totalWidth, config.totalHeight, { fit: 'fill' })
      .png({ compressionLevel: 6 })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`  ✅ ${outputPath} (${(stats.size / 1024).toFixed(0)} KB)`);
  }

  console.log('\n✅ Frames optimized successfully');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
