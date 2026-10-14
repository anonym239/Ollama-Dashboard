// Dateianhänge einlesen: Bilder (für Vision-Modelle), PDFs und Textdateien.

const MAX_TEXT = 250_000;
const MAX_IMAGE_SIDE = 2048;
const PDFJS = '/vendor/pdfjs/'; // pdf.js 4.4.168 lokal mitgeliefert (Apache-2.0)

const readAs = (file, how) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r[how](file);
});

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function readImage(file) {
  let dataUrl = await readAs(file, 'readAsDataURL');
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    // Zu große oder exotische Formate (z. B. GIF/WebP/BMP) in JPEG/PNG umwandeln
    if (scale < 1 || !/^image\/(png|jpeg)$/.test(file.type)) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      dataUrl = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
    }
  } catch { /* Original verwenden */ }
  return { kind: 'image', name: file.name || 'Bild.png', size: file.size, dataUrl, base64: dataUrl.split(',')[1] };
}

let pdfjsPromise = null;
async function readPdf(file) {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ PDFJS + 'pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
      return m;
    }).catch((e) => { pdfjsPromise = null; throw e; });
  }
  const pdfjs = await pdfjsPromise;
  const pdf = await pdfjs.getDocument({ data: await readAs(file, 'readAsArrayBuffer') }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(`--- Seite ${p} ---\n` + content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
  }
  return pages.join('\n\n');
}

function looksBinary(text) {
  const sample = text.slice(0, 4000);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0 || c === 0xfffd) bad++;
  }
  return bad > sample.length * 0.02;
}

export async function readAttachment(file) {
  if (file.type.startsWith('image/')) return readImage(file);

  let text;
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    try {
      text = await readPdf(file);
    } catch (e) {
      throw new Error(`PDF konnte nicht gelesen werden (${e.message}).`);
    }
  } else {
    text = await readAs(file, 'readAsText');
    if (looksBinary(text)) throw new Error(`„${file.name}“ ist keine Text-, PDF- oder Bilddatei.`);
  }

  let truncated = false;
  if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); truncated = true; }
  return { kind: 'text', name: file.name, size: file.size, text, truncated };
}

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

// Text-Anhänge in die Nachricht an das Modell einbauen
export function buildContent(text, files = []) {
  const docs = files.filter((f) => f.kind === 'text');
  if (!docs.length) return text;
  const parts = docs.map((f) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const lang = /^(js|ts|py|json|html|css|md|java|c|cpp|cs|go|rs|php|rb|sh|sql|xml|yaml|yml)$/.test(ext) ? ext : '';
    return `### Datei: ${f.name}${f.truncated ? ' (gekürzt)' : ''}\n\`\`\`${lang}\n${f.text}\n\`\`\``;
  });
  return `${parts.join('\n\n')}\n\n${text}`.trim();
}
