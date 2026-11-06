const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "config.json");

// Your default settings
let config = {
  mode: 2, // 0 = Off, 1 = Fixed, 2 = Date+Time (+offset), 3 = Date+Time (Live)
  fixed: 6417118,
  chunk: 1, // 1, 2, 3, 4, or 0 (All)
  hold: 0.5, // seconds
  offset: 60, // seconds (+1:00)
  redirectUrl: "https://icontrol-magic.onrender.com/"
};

// Load saved config if it exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    config = { ...config, ...saved };
  }
} catch (e) {
  console.log("Using default config");
}

function saveConfig() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2));
  } catch (e) {}
}

// 1. GET /api/config (The calculator calls this on load)
app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(config);
});

// 2. POST /api/config (Your remote control dashboard calls this to update settings)
app.post("/api/config", (req, res) => {
  const b = req.body || {};
  if ([0, 1, 2, 3].includes(Number(b.mode))) config.mode = Number(b.mode);
  if (Number.isFinite(Number(b.fixed))) config.fixed = Number(b.fixed);
  if ([0, 1, 2, 3, 4].includes(Number(b.chunk))) config.chunk = Number(b.chunk);
  if (Number.isFinite(Number(b.hold)) && Number(b.hold) >= 0.1) config.hold = Number(b.hold);
  if (Number.isFinite(Number(b.offset))) config.offset = Math.floor(Number(b.offset));
  if (typeof b.redirectUrl === "string" && b.redirectUrl.trim()) {
    config.redirectUrl = b.redirectUrl.trim();
  }
  saveConfig();
  res.json({ ok: true, config });
});

// 3. Built-in Remote Control Dashboard at "/"
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Calc Remote Control</title>
<style>
  :root{--bg:#1c1c1e;--card:#2c2c2e;--fill:#3a3a3c;--op:#ff9f0a;--sep:rgba(84,84,88,.55);--lbl:#8d8d93;}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{margin:0;padding:20px 16px 60px;background:var(--bg);color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;}
  h1{font-size:20px;text-align:center;margin:4px 0 20px;}
  .sec-h{font-size:13px;color:var(--lbl);text-transform:uppercase;letter-spacing:.05em;margin:20px 4px 8px;}
  .card{background:var(--card);border-radius:12px;overflow:hidden;}
  .row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:0 15px;font-size:17px;}
  .row+.row{border-top:.5px solid var(--sep);}
  .opt{cursor:pointer;}
  .opt .chk{color:var(--op);font-weight:700;opacity:0;}
  .opt.sel .chk{opacity:1;}
  input[type="text"],input[type="number"]{
    background:var(--fill);border:0;border-radius:8px;color:#fff;font-size:16px;
    padding:8px 12px;text-align:right;width:180px;outline:none;
  }
  .url-in{width:100%!important;text-align:left!important;margin:10px 0;}
  .seg{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;padding:12px 14px;}
  .seg button{height:36px;border:0;border-radius:8px;background:var(--fill);color:#fff;font-size:16px;cursor:pointer;}
  .seg button.sel{background:var(--op);color:#1c1c1e;font-weight:600;}
  .save-btn{
    width:100%;margin-top:24px;height:50px;border:0;border-radius:12px;
    background:var(--op);color:#000;font-size:17px;font-weight:600;cursor:pointer;
  }
  .save-btn:active{opacity:.8;}
  .toast{text-align:center;color:#30d158;font-size:15px;margin-top:12px;min-height:20px;}
</style>
</head>
<body>
  <h1>Calculator Remote</h1>

  <div class="sec-h">Force Target</div>
  <div class="card" id="modeList">
    <div class="row opt" data-mode="0"><span>Off</span><span class="chk">✓</span></div>
    <div class="row opt" data-mode="1"><span>Fixed number</span><span class="chk">✓</span></div>
    <div class="row opt" data-mode="2"><span>Date + time (with offset)</span><span class="chk">✓</span></div>
    <div class="row opt" data-mode="3"><span>Date + time (live)</span><span class="chk">✓</span></div>
    <div class="row"><span>Force number</span><input id="fixedIn" type="number" inputmode="numeric"></div>
    <div class="row"><span>Time offset (seconds)</span><input id="offsetIn" type="number" inputmode="numeric"></div>
  </div>

  <div class="sec-h">Digits Per Press</div>
  <div class="card seg" id="chunkSeg">
    <button type="button" data-chunk="1">1</button>
    <button type="button" data-chunk="2">2</button>
    <button type="button" data-chunk="3">3</button>
    <button type="button" data-chunk="4">4</button>
    <button type="button" data-chunk="0">All</button>
  </div>

  <div class="sec-h">Hold Duration</div>
  <div class="card">
    <div class="row"><span>Hold + and % for</span><span id="holdLbl">0.50s</span></div>
    <div class="row"><input id="holdIn" type="range" min="0.2" max="1.5" step="0.05" style="width:100%;accent-color:#ff9f0a"></div>
  </div>

  <div class="sec-h">Clock Button Redirect URL</div>
  <div class="card">
    <div class="row"><input class="url-in" id="urlIn" type="text"></div>
  </div>

  <button class="save-btn" id="saveBtn">Push Live to Calculator</button>
  <div class="toast" id="toast"></div>

<script>
let state = {};
const modeList = document.getElementById("modeList");
const chunkSeg = document.getElementById("chunkSeg");
const fixedIn = document.getElementById("fixedIn");
const offsetIn = document.getElementById("offsetIn");
const holdIn = document.getElementById("holdIn");
const holdLbl = document.getElementById("holdLbl");
const urlIn = document.getElementById("urlIn");
const toast = document.getElementById("toast");

function paint(){
  modeList.querySelectorAll(".opt").forEach(r => r.classList.toggle("sel", Number(r.dataset.mode) === state.mode));
  chunkSeg.querySelectorAll("button").forEach(b => b.classList.toggle("sel", Number(b.dataset.chunk) === state.chunk));
  fixedIn.value = state.fixed;
  offsetIn.value = state.offset;
  holdIn.value = state.hold;
  holdLbl.textContent = Number(state.hold).toFixed(2) + "s";
  urlIn.value = state.redirectUrl;
}

fetch("/api/config").then(r => r.json()).then(d => { state = d; paint(); });

modeList.addEventListener("click", e => {
  const r = e.target.closest(".opt");
  if (!r) return;
  state.mode = Number(r.dataset.mode);
  paint();
});
chunkSeg.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.chunk = Number(b.dataset.chunk);
  paint();
});
holdIn.addEventListener("input", () => {
  state.hold = parseFloat(holdIn.value);
  holdLbl.textContent = state.hold.toFixed(2) + "s";
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  state.fixed = Number(fixedIn.value) || 0;
  state.offset = Number(offsetIn.value) || 0;
  state.redirectUrl = urlIn.value.trim();
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (res.ok) {
    toast.textContent = "✓ Live config updated!";
    setTimeout(() => toast.textContent = "", 2500);
  }
});
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
