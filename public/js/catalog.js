// Modell-Katalog (funktioniert auch offline) + Empfehlungen passend zum eigenen PC.
// Größen = ungefährer Download bzw. Speicherbedarf (Q4) in GB. Werte 0–10 = Stärke im Bereich.

export const CATEGORIES = [
  { id: 'allround', label: 'Allround', desc: 'Für fast alles: Fragen, Texte, Erklären' },
  { id: 'german', label: 'Gutes Deutsch', desc: 'Natürliche, fehlerfreie deutsche Antworten' },
  { id: 'code', label: 'Programmieren', desc: 'Code schreiben, Fehler finden, erklären' },
  { id: 'reasoning', label: 'Nachdenken', desc: 'Mathe, Logik, schwierige Aufgaben' },
  { id: 'vision', label: 'Bilder verstehen', desc: 'Fotos und Screenshots beschreiben' },
  { id: 'agent', label: 'Agent & Werkzeuge', desc: 'Am PC handeln, Websuche, Befehle' },
  { id: 'fast', label: 'Schnell & klein', desc: 'Antwortet sofort, auch auf schwachen PCs' },
];

// tags: [Tag, GB]; s: Stärken je Bereich
export const CATALOG = [
  { name: 'qwen3', desc: 'Sehr starkes Allround-Modell von Alibaba – mit Nachdenk-Modus und Werkzeugen.', tags: [['0.6b', 0.5], ['1.7b', 1.4], ['4b', 2.5], ['8b', 5.2], ['14b', 9.3], ['30b', 19], ['32b', 20]], caps: ['tools', 'thinking'], s: { allround: 9, german: 7, code: 8, reasoning: 9, agent: 9 } },
  { name: 'gemma3', desc: 'Googles offenes Modell – sehr gutes Deutsch, versteht ab 4b auch Bilder.', tags: [['1b', 0.8], ['4b', 3.3], ['12b', 8.1], ['27b', 17]], textOnly: ['1b'], caps: ['vision'], s: { allround: 8, german: 9, code: 6, reasoning: 6, vision: 8 } },
  { name: 'llama3.1', desc: 'Metas bewährtes Modell – zuverlässig, gut mit Werkzeugen.', tags: [['8b', 4.9], ['70b', 43]], caps: ['tools'], s: { allround: 7, german: 7, code: 6, reasoning: 6, agent: 8 } },
  { name: 'llama3.2', desc: 'Kleines Meta-Modell – schnell, auch auf Laptops.', tags: [['1b', 1.3], ['3b', 2.0]], caps: ['tools'], s: { allround: 5, german: 5, code: 4, reasoning: 4, agent: 6, fast: 8 } },
  { name: 'mistral-nemo', desc: 'Mistral (Europa) – sehr gutes Deutsch, großer Kontext.', tags: [['12b', 7.1]], caps: ['tools'], s: { allround: 7, german: 9, code: 6, reasoning: 6, agent: 7 } },
  { name: 'mistral-small3.2', desc: 'Starkes Mistral-Modell mit Bildverständnis und Werkzeugen.', tags: [['24b', 15]], caps: ['tools', 'vision'], s: { allround: 9, german: 9, code: 8, reasoning: 7, vision: 7, agent: 9 } },
  { name: 'phi4', desc: 'Microsofts Modell – stark bei Logik und Mathe, Deutsch mittel.', tags: [['14b', 9.1]], caps: [], s: { allround: 7, german: 5, code: 7, reasoning: 8 } },
  { name: 'phi4-mini', desc: 'Kleines Microsoft-Modell für schwache PCs.', tags: [['3.8b', 2.5]], caps: ['tools'], s: { allround: 5, german: 4, code: 5, reasoning: 5, fast: 7 } },
  { name: 'deepseek-r1', desc: 'Denkt ausführlich nach – gut für Logik, schwach im Deutschen.', tags: [['1.5b', 1.1], ['7b', 4.7], ['8b', 5.2], ['14b', 9.0], ['32b', 20]], caps: ['thinking'], s: { allround: 5, german: 3, code: 6, reasoning: 8 } },
  { name: 'qwen2.5', desc: 'Vorgänger von Qwen3 – solide und gut mit Werkzeugen.', tags: [['3b', 1.9], ['7b', 4.7], ['14b', 9.0], ['32b', 20]], caps: ['tools'], s: { allround: 7, german: 7, code: 7, reasoning: 7, agent: 8 } },
  { name: 'qwen2.5-coder', desc: 'Spezialist fürs Programmieren – sehr guter Code.', tags: [['1.5b', 1.0], ['3b', 1.9], ['7b', 4.7], ['14b', 9.0], ['32b', 20]], caps: ['tools'], s: { allround: 5, german: 5, code: 9, reasoning: 6, agent: 6 } },
  { name: 'qwen3-coder', desc: 'Neuer Code-Spezialist von Alibaba – sehr stark bei großen Projekten.', tags: [['30b', 19]], caps: ['tools'], s: { allround: 6, german: 6, code: 10, reasoning: 7, agent: 9 } },
  { name: 'devstral', desc: 'Mistrals Programmier-Agent – arbeitet selbstständig an Code.', tags: [['24b', 14]], caps: ['tools'], s: { allround: 6, german: 7, code: 9, reasoning: 6, agent: 9 } },
  { name: 'gpt-oss', desc: 'Offenes Modell von OpenAI – stark beim Nachdenken und mit Werkzeugen.', tags: [['20b', 14], ['120b', 65]], caps: ['tools', 'thinking'], s: { allround: 9, german: 8, code: 8, reasoning: 9, agent: 9 } },
  { name: 'magistral', desc: 'Mistrals Nachdenk-Modell – gutes Deutsch.', tags: [['24b', 14]], caps: ['thinking', 'tools'], s: { allround: 7, german: 8, code: 7, reasoning: 9 } },
  { name: 'llava', desc: 'Klassisches Bild-Modell – beschreibt Fotos.', tags: [['7b', 4.7], ['13b', 8.0]], caps: ['vision'], s: { allround: 4, german: 4, vision: 6 } },
  { name: 'llama3.2-vision', desc: 'Meta-Modell, das Bilder versteht.', tags: [['11b', 7.8]], caps: ['vision'], s: { allround: 6, german: 6, vision: 7 } },
  { name: 'qwen2.5vl', desc: 'Sehr gutes Bildverständnis, liest auch Text in Bildern.', tags: [['3b', 3.2], ['7b', 6.0]], caps: ['vision'], s: { allround: 6, german: 6, vision: 9 } },
  { name: 'granite3.3', desc: 'IBM-Modell – sachlich, gut mit Werkzeugen.', tags: [['2b', 1.5], ['8b', 4.9]], caps: ['tools'], s: { allround: 6, german: 5, code: 6, reasoning: 6, agent: 7 } },
  { name: 'smollm2', desc: 'Winzig und blitzschnell – für sehr schwache Rechner.', tags: [['360m', 0.7], ['1.7b', 1.8]], caps: ['tools'], s: { allround: 3, german: 2, code: 2, fast: 9 } },
];

// Wie viel Speicher steht für ein Modell zur Verfügung?
// fast = passt komplett in den Grafikspeicher (bzw. Apple-Speicher) → flüssig
// ok   = läuft, aber teils über den Arbeitsspeicher → langsamer
export function budget(specs) {
  const gpu = (specs?.gpus || []).filter((g) => g.dedicated).sort((a, b) => b.vramGB - a.vramGB)[0];
  const ram = specs?.ramGB || 8;
  if (specs?.appleSilicon) return { fast: ram * 0.65, ok: ram * 0.75, gpu: 'Apple Silicon', vram: 0, ram, apple: true };
  if (gpu && gpu.vramGB >= 3) return { fast: gpu.vramGB * 0.9, ok: gpu.vramGB * 0.9 + ram * 0.45, gpu: gpu.name, vram: gpu.vramGB, ram };
  return { fast: Math.min(ram * 0.45, 6), ok: ram * 0.6, gpu: gpu?.name || '', vram: 0, ram, cpuOnly: true };
}

// Bestes Modell (Name + Größe) je Bereich, das auf diesen PC passt
export function recommend(specs) {
  const b = budget(specs);
  const disk = specs?.diskFreeGB ?? Infinity;
  const fit = (gb) => (gb <= b.fast ? 'fast' : gb <= b.ok ? 'ok' : 'no');
  const out = [];
  for (const cat of CATEGORIES) {
    let best = null;
    for (const m of CATALOG) {
      // "Schnell & klein": das klügste Allround-Modell bis ca. 3 GB
      const strength = cat.id === 'fast' ? Math.max(m.s.allround || 0, m.s.fast ? 3 : 0) : m.s[cat.id] || 0;
      if (!strength) continue;
      for (const [tag, gb] of m.tags) {
        const f = fit(gb);
        if (f === 'no' || gb * 1.1 > disk) continue;
        if (cat.id === 'vision' && (m.textOnly || []).includes(tag)) continue;
        if (cat.id === 'fast' && gb > 3) continue;
        // Punkte: Stärke + Größe (mehr Parameter = klüger), flüssig bevorzugt, Winzlinge nur bei "Schnell"
        const sizeBonus = Math.log2(1 + gb) * 1.6 - (cat.id !== 'fast' && gb < 1.5 ? 4 : 0);
        const score = strength * 2 + sizeBonus + (f === 'fast' ? 3 : -2);
        if (!best || score > best.score) best = { cat, model: m, tag, gb, fit: f, score };
      }
    }
    if (best) out.push({ ...best, name: `${best.model.name}:${best.tag}`, why: reason(best, b) });
  }
  return { budget: b, picks: out };
}

function reason(p, b) {
  const size = `${String(p.gb).replace('.', ',')} GB`;
  if (p.fit === 'fast') {
    if (b.cpuOnly) return `${size} – läuft flüssig auf deinem Prozessor.`;
    if (b.apple) return `${size} – passt gut in deinen Mac-Speicher (${String(b.ram).replace('.', ',')} GB) → schnell.`;
    return `${size} – passt komplett in ${b.gpu ? `deine Grafikkarte (${String(b.vram || b.ram).replace('.', ',')} GB)` : 'deinen Speicher'} → schnell.`;
  }
  return `${size} – läuft, nutzt aber teils den Arbeitsspeicher → etwas langsamer.`;
}

// Passt ein Download (Name:Tag) auf diesen PC? Für die Warnung vor zu großen Modellen.
export function sizeOf(fullName) {
  const [name, tag] = String(fullName).split(':');
  const m = CATALOG.find((x) => x.name === name);
  const t = m && (m.tags.find((x) => x[0] === tag) || (!tag && m.tags[0]));
  return t ? t[1] : null;
}
