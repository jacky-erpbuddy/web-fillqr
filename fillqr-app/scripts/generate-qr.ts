import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

const URL_TARGET = 'https://demo.fillqr.de';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public');

async function main() {
  await QRCode.toFile(path.join(outDir, 'qr-demo.png'), URL_TARGET, { width: 300, margin: 2 });
  const svg = await QRCode.toString(URL_TARGET, { type: 'svg', width: 300, margin: 2 });
  const fs = await import('fs');
  fs.writeFileSync(path.join(outDir, 'qr-demo.svg'), svg);
  console.log('QR-Code generiert: public/qr-demo.png + public/qr-demo.svg');
}

main().catch(console.error);
