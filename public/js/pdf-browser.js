// Export PDF directement dans le navigateur (démo en ligne, sans serveur)
import { buildPdfCore } from './pdf-core.js';
let ready;
export function load() {
  return ready ||= (async () => {
    if (!window.PDFDocument) await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'vendor/pdfkit.standalone.js'; s.onload = ok; s.onerror = () => ko(new Error('bibliothèque PDF non chargée')); document.head.appendChild(s); });
    const f = n => fetch('fonts/' + n).then(r => { if (!r.ok) throw new Error('police introuvable'); return r.arrayBuffer(); });
    // Polices des PDF : IBM Plex Sans Condensed (texte), Cormorant Garamond (titres), DejaVu (arabe et symboles), Caveat (notes manuscrites)
    const [R, B, T, I, AR, ARB, H] = await Promise.all([f('IBMPlexSansCondensed_400Regular.ttf'), f('IBMPlexSansCondensed_600SemiBold.ttf'), f('CormorantGaramond_700Bold.ttf'), f('CormorantGaramond_500Medium_Italic.ttf'), f('DejaVuSansCondensed.ttf'), f('DejaVuSansCondensed-Bold.ttf'), f('Caveat.ttf').catch(() => null)]);
    return { PDFDocument: window.PDFDocument, fonts: { R, B, T, I, AR, ARB, H: H || R } };
  })().catch(e => { ready = null; throw e; });
}
export async function buildPdfBlob(project, sections, lang) {
  const lib = await load();
  const readImage = src => /^data:image\/(png|jpe?g);base64,/.test(src) ? src : null;
  const doc = buildPdfCore({ ...lib, readImage, lang }, project, sections);
  return new Promise((ok, ko) => { const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => ok(new Blob(chunks, { type: 'application/pdf' }))); doc.on('error', ko); });
}
