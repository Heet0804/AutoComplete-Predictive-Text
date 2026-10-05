const input = document.getElementById("q");
const box = document.getElementById("suggestions");
const M = window.MODEL;
const GU = /[^\u0A80-\u0AFF]/g;
const uniTotal = Object.values(M.unigram).reduce((s, v) => s + v, 0);
let items = [], active = -1, orig = "";
const STOP = 0.5;    // if the model is >=50% sure the sentence ends here, suggest only "."
const MAXLEN = 18;   // captions in the data are ~8.5 words (95% are <= 13): force an end after this

// Stupid backoff: trigram (1.0) -> bigram (0.4) -> unigram (0.16)
function suggest(text) {
  text = text.normalize("NFC");
  const [, base, rawTok] = text.match(/^([\s\S]*?)(\S*)$/);
  const prefix = rawTok.replace(GU, "");
  if (rawTok && !prefix) return [];   // user is typing non-Gujarati (e.g. English): show nothing
  // sentence just finished (or nothing typed yet): stay quiet until the user starts the next word
  if (/[.?!।]$/.test(rawTok) || (!prefix && !base.split(/[.?!।]/).pop().trim())) return [];
  // context = words after the last sentence end; unknown/half-typed words are skipped
  const words = base.split(/[.?!।]/).pop().split(/\s+/)
    .map(w => w.replace(GU, "")).filter(w => w && M.unigram[w]);
  const ctx = ["<s>", ...words];
  const a = ctx[ctx.length - 1], b = ctx[ctx.length - 2];
  const found = new Map();

  // repetition control: remember pairs / triples / whole sentences already typed,
  // so the dropdown does not push the user into repeating the same text
  const seenBi = new Set(), seenTri = new Set(), seenSent = new Set();
  const segs = base.split(/[.?!।]/);
  segs.forEach((seg, k) => {
    const t = seg.split(/\s+/).map(x => x.replace(GU, "")).filter(x => x && M.unigram[x]);
    if (k < segs.length - 1 && t.length) seenSent.add(t.join(" "));   // finished sentences
    for (let i = 1; i < t.length; i++) seenBi.add(t[i - 1] + " " + t[i]);
    for (let i = 2; i < t.length; i++) seenTri.add(t[i - 2] + " " + t[i - 1] + " " + t[i]);
  });
  const cur = words.join(" ");
  const rep = w => w === "</s>" ? (seenSent.has(cur) ? 0.05 : 1)      // don't end with an already-used sentence
                 : seenTri.has(b + " " + a + " " + w) ? 0.05
                 : seenBi.has(a + " " + w) ? 0.25 : 1;

  const add = (dict, total, weight, tag) => {
    if (!dict) return;
    for (const [w, c] of Object.entries(dict)) {
      if (w.startsWith(prefix) && w !== prefix && !found.has(w))
        found.set(w, { word: w, score: weight * c / total * rep(w), tag });
    }
  };
  const sum = d => (d ? Object.values(d).reduce((s, v) => s + v, 0) : 1);

  if (b) { const d = M.trigram[b + " " + a]; add(d, sum(d), 1.0, "trigram"); }
  const d2 = M.bigram[a]; add(d2, sum(d2), 0.4, "bigram");
  if (prefix || found.size === 0) add(M.unigram, uniTotal, 0.16, "unigram");

  // Stop rule: sentence looks finished (or too long) -> offer only the full stop
  if (!prefix) {
    const end = found.get("</s>");
    const endShare = end ? end.score / (end.tag === "trigram" ? 1.0 : 0.4) : 0;
    if (endShare >= STOP || words.length >= MAXLEN)
      found.clear(), found.set("</s>", { word: "</s>", score: 1, tag: "end" });
  }

  return [...found.values()]
    .sort((x, y) => y.score - x.score)
    .slice(0, 6)
    .map(s => {
      const end = s.word === "</s>";               // model thinks the sentence is finished
      const word = end ? "." : s.word;
      return { ...s, word, typed: base + prefix, rest: end ? "." : word.slice(prefix.length), base };
    });
}

function render() {
  orig = input.value;
  items = suggest(input.value);
  active = -1;
  box.innerHTML = "";
  items.forEach((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = '<span class="txt"></span><span class="tag"></span>';
    const txt = li.firstChild;
    // show only the last 4 words of what was typed, so long text never floods the dropdown
    const m = s.typed.match(/(?:\S+\s+){0,3}\S*$/);
    txt.append(document.createTextNode((m.index > 0 ? "… " : "") + m[0]));
    const bold = document.createElement("b");
    bold.textContent = s.rest;
    txt.append(bold);
    li.lastChild.textContent = s.tag;
    li.addEventListener("mousedown", e => { e.preventDefault(); accept(i); });
    box.append(li);
  });
  box.hidden = items.length === 0;
}

// full text if this suggestion is chosen (a full stop attaches to the last word)
const full = s => (s.word === "." ? s.base.trimEnd() + "." : s.base + s.word);

function accept(i) {
  const s = items[i];
  input.value = full(s) + " ";
  render();
}

// Google-style: arrows move through suggestions and put each one in the box
function highlight(n) {
  const rows = [...box.children];
  rows.forEach(r => r.classList.remove("on"));
  active = n >= rows.length ? -1 : n < -1 ? rows.length - 1 : n;
  if (active >= 0) rows[active].classList.add("on");
  input.value = active >= 0 ? full(items[active]) : orig;
}

input.addEventListener("input", render);
input.addEventListener("focus", render);
input.addEventListener("blur", () => (box.hidden = true));
input.addEventListener("keydown", e => {
  if (box.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
  else if ((e.key === "Tab" || e.key === "Enter") && items.length) {
    e.preventDefault(); accept(active < 0 ? 0 : active);
  } else if (e.key === "Escape") { input.value = orig; box.hidden = true; }
});