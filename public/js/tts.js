// Sprachausgabe (Text-to-Speech) & Spracheingabe über die Web-Speech-API des Browsers.
import { toSpeech } from './markdown.js';

const synth = window.speechSynthesis;

export class Speaker {
  constructor() {
    this.settings = { voiceURI: '', rate: 1, pitch: 1 };
    this.spokenUpTo = 0;
    this.queue = 0;
    this.gen = 0;
    this.onstate = () => {};
    this.currentId = null;
    // Chrome hängt bei langen Sätzen manchmal – regelmäßig anstupsen
    if (/Chrome/.test(navigator.userAgent)) setInterval(() => { if (synth && synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10000);
  }

  get supported() { return !!synth; }

  voices() {
    if (!synth) return [];
    return synth.getVoices().slice().sort((a, b) => {
      const ad = a.lang.startsWith('de') ? 0 : 1;
      const bd = b.lang.startsWith('de') ? 0 : 1;
      return ad - bd || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
    });
  }

  pickVoice() {
    const all = this.voices();
    return all.find((v) => v.voiceURI === this.settings.voiceURI) ||
      all.find((v) => v.lang.startsWith(navigator.language.slice(0, 2))) ||
      all.find((v) => v.lang.startsWith('de')) || all[0] || null;
  }

  sayRaw(text) {
    text = text.replace(/\s+/g, ' ').trim();
    if (!synth || !text || !/[\p{L}\p{N}]/u.test(text)) return;
    // Lange Abschnitte in Sätze teilen (stabiler in allen Browsern)
    const parts = text.match(/[^.!?;:]+[.!?;:]*\s*/g) || [text];
    for (const part of parts) {
      if (!part.trim()) continue;
      const u = new SpeechSynthesisUtterance(part.trim());
      const v = this.pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = this.settings.rate;
      u.pitch = this.settings.pitch;
      this.queue++;
      const gen = this.gen;
      const finish = () => {
        if (gen !== this.gen) return;
        this.queue = Math.max(0, this.queue - 1);
        if (!this.queue) this.onstate(false, this.currentId);
      };
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    }
    this.onstate(true, this.currentId);
  }

  // Ganze Nachricht vorlesen
  speak(markdown, id = null) {
    this.stop();
    this.currentId = id;
    this.sayRaw(toSpeech(markdown));
  }

  // Während des Streamings: fertige Sätze direkt vorlesen
  beginStream(id) {
    this.stop();
    this.currentId = id;
    this.spokenUpTo = 0;
  }

  feed(markdown, done = false) {
    let md = markdown;
    if (!done) {
      // Nur bis zum letzten abgeschlossenen Satz/Zeile verarbeiten
      let cut = -1;
      const re = /[.!?:](\s)|\n/g;
      let m;
      while ((m = re.exec(md))) cut = m.index + m[0].length;
      if (cut < 0) return;
      md = md.slice(0, cut);
    }
    const text = toSpeech(md);
    if (text.length <= this.spokenUpTo) return;
    const fresh = text.slice(this.spokenUpTo);
    this.spokenUpTo = text.length;
    this.sayRaw(fresh);
  }

  stop() {
    if (!synth) return;
    this.gen++;
    this.queue = 0;
    synth.cancel();
    this.onstate(false, this.currentId);
    this.currentId = null;
  }

  get speaking() { return !!synth && (synth.speaking || synth.pending); }
}

export class Dictation {
  constructor(onText, onState) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.active = false;
    this.onState = onState;
    if (!SR) return;
    this.rec = new SR();
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.lang = navigator.language || 'de-DE';
    this.rec.onresult = (e) => {
      if (this.discard) return;
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onText(finalText, interim);
    };
    this.rec.onend = () => { this.active = false; onState(false); };
    this.rec.onerror = (e) => { this.active = false; onState(false, e.error); };
  }

  // Sofort beenden und noch ausstehende Ergebnisse verwerfen
  abort() {
    if (!this.supported || !this.active) return;
    this.active = false;
    this.discard = true;
    try { this.rec.abort(); } catch { /* egal */ }
  }

  toggle() {
    if (!this.supported) return;
    if (this.active) { this.rec.stop(); return; }
    try {
      this.discard = false;
      this.rec.start();
      this.active = true;
      this.onState(true);
    } catch { /* läuft schon */ }
  }
}
