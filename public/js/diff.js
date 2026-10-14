// Zeilenweiser Vergleich zweier Texte (wie "git diff") – ohne Abhängigkeiten.
// Ergebnis: Liste von { type: 'same' | 'add' | 'del', text, a, b } (a/b = Zeilennummer alt/neu)

export function diffLines(oldText, newText) {
  const a = oldText ? String(oldText).replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n') : [];
  const b = newText ? String(newText).replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n') : [];
  // Gleichen Anfang und gleiches Ende abschneiden (schnell, und meist ist das meiste gleich)
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  const out = [];
  for (let i = 0; i < start; i++) out.push({ type: 'same', text: a[i], a: i + 1, b: i + 1 });
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  if (n && m && n * m <= 4_000_000) {
    // Längste gemeinsame Teilfolge (LCS) per Tabelle
    const w = m + 1;
    const t = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        t[i * w + j] = midA[i] === midB[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        out.push({ type: 'same', text: midA[i], a: start + i + 1, b: start + j + 1 }); i++; j++;
      } else if (j < m && (i >= n || t[i * w + j + 1] > t[(i + 1) * w + j])) {
        out.push({ type: 'add', text: midB[j], b: start + j + 1 }); j++;
      } else {
        out.push({ type: 'del', text: midA[i], a: start + i + 1 }); i++;
      }
    }
  } else {
    // Sehr große Änderung: alles alte raus, alles neue rein
    midA.forEach((text, i) => out.push({ type: 'del', text, a: start + i + 1 }));
    midB.forEach((text, j) => out.push({ type: 'add', text, b: start + j + 1 }));
  }
  for (let k = 0; k < a.length - endA; k++) out.push({ type: 'same', text: a[endA + k], a: endA + k + 1, b: endB + k + 1 });
  return out;
}

export function diffStats(lines) {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === 'add') added++;
    else if (l.type === 'del') removed++;
  }
  return { added, removed };
}

// Unveränderte Bereiche einklappen: nur 3 Zeilen Kontext um Änderungen herum
export function foldDiff(lines, context = 3) {
  const keep = new Uint8Array(lines.length);
  lines.forEach((l, i) => {
    if (l.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = 1;
  });
  const out = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (skipped) { out.push({ type: 'fold', count: skipped }); skipped = 0; }
      out.push(l);
    } else skipped++;
  });
  if (skipped) out.push({ type: 'fold', count: skipped });
  return out;
}
