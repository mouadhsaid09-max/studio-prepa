// Export PDF côté serveur local : branche le constructeur partagé sur Node (pdfkit, polices DejaVu, fichiers images)
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildPdfCore, SECTIONS } from './public/js/pdf-core.js';
export { SECTIONS };
const require = createRequire(import.meta.url);
const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'fonts');
const fonts = { R: path.join(PUB, 'IBMPlexSansCondensed_400Regular.ttf'), B: path.join(PUB, 'IBMPlexSansCondensed_600SemiBold.ttf'), T: path.join(PUB, 'Anton.ttf'), I: path.join(PUB, 'IBMPlexSansCondensed_400Regular_Italic.ttf'),
  AR: path.join(FONT_DIR, 'DejaVuSansCondensed.ttf'), ARB: path.join(FONT_DIR, 'DejaVuSansCondensed-Bold.ttf'), H: path.join(PUB, 'Caveat.ttf') };
export function buildPdf(project, sections, assetFile, lang = 'fr') {
  const readImage = src => {
    if (/^data:image\/(png|jpe?g);base64,/.test(src)) return src;
    const f = assetFile(src);
    return f && /\.(jpe?g|png)$/i.test(f) && fs.existsSync(f) ? fs.readFileSync(f) : null;
  };
  return buildPdfCore({ PDFDocument, fonts, readImage, lang }, project, sections);
}
