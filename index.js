const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
let mongoose = null;
try {
  mongoose = require("mongoose");
} catch(e) {}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "state.json");
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.text({ type: ["text/*", "application/javascript", "*/*"], limit: "5mb" }));

const DEFAULT_SAVED_SITES = [
  { name: "Built-in 3D Dice Roller", url: "dice", openInSafari: false },
  { name: "Stopwatch", url: "https://stopwatchappclip.vercel.app/", openInSafari: false },
  { name: "Calculator", url: "https://smartcalc-zeta.vercel.app/", openInSafari: false },
  { name: "iControl", url: "https://icontrol-magic.onrender.com/", openInSafari: true },
  { name: "SSW Target", url: "https://ssw.im/276", openInSafari: true }
];

const DEFAULT_SW_MODES = {
  mode: "seq",
  singleTarget: 18,
  targets: [18, 23, 27, 41, 56, 9],
  scrambleLotto: true,
  triggerOn: "both",
  autoDisarm: true
};

const DEFAULT_CALC_MODES = {
  mode: 2,
  fixed: "6417118",
  offset: 30,
  chunk: 1,
  hold: 0.15,
  autoOpOnLock: false,
  hintStyle: "bright"
};

const DEFAULT_INTEGRATIONS = {
  enabled: true,
  autoPoll: true,
  apiUrl: "",
  targetField: "data",
  serpApiKey: "",
  tavilyApiKey: "",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash",
  prompt: "You are an expert mentalism pricing assistant. Given the input item, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). If web search information is provided, use it critically to identify the single unit retail price. Round to a clean whole number without cents or currency symbols. Return ONLY the integer with no words, markdown, or punctuation.",
  lastInput: "",
  lastOutput: "",
  lastPrice: 0,
  lastUpdatedAt: 0,
  lastLogs: []
};

const DEFAULT_STATE = {
  savedSites: DEFAULT_SAVED_SITES,
  sitesUpdatedAt: 0,
  calc: {
    ...DEFAULT_CALC_MODES,
    redirectUrl: "https://icontrol-magic.onrender.com/",
    redirectOpenSafari: true,
    clockSiteUrl: "https://stopwatchappclip.vercel.app/",
    clockOpenSafari: false,
    acRedirectUrl: "dice",
    acOpenSafari: false,
    updatedAt: 0
  },
  acaat: {
    ...DEFAULT_SW_MODES,
    leftRedirectUrl: "https://ssw.im/276",
    leftOpenSafari: true,
    rightRedirectUrl: "https://icontrol-magic.onrender.com/",
    rightOpenSafari: true,
    customSiteUrl: "https://icontrol-magic.onrender.com/",
    openInSafari: true,
    icontrolUrl: "https://smartcalc-zeta.vercel.app/",
    icontrolOpenSafari: false,
    updatedAt: 0
  },
  integrations: DEFAULT_INTEGRATIONS,
  peeks: [],
  emergence: []
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

let StateModel = null;
if (mongoose) {
  const StateSchema = new mongoose.Schema({
    key: { type: String, default: "global_state", unique: true },
    savedSites: { type: Array, default: [] },
    sitesUpdatedAt: { type: Number, default: 0 },
    calc: {
      mode: Number,
      fixed: String,
      hold: Number,
      chunk: Number,
      offset: Number,
      autoOpOnLock: Boolean,
      hintStyle: String,
      redirectUrl: String,
      redirectOpenSafari: Boolean,
      clockSiteUrl: String,
      clockOpenSafari: Boolean,
      acRedirectUrl: String,
      acOpenSafari: Boolean,
      updatedAt: Number
    },
    acaat: {
      mode: String,
      singleTarget: Number,
      targets: Array,
      scrambleLotto: Boolean,
      leftRedirectUrl: String,
      leftOpenSafari: Boolean,
      rightRedirectUrl: String,
      rightOpenSafari: Boolean,
      customSiteUrl: String,
      openInSafari: Boolean,
      icontrolUrl: String,
      icontrolOpenSafari: Boolean,
      triggerOn: String,
      autoDisarm: Boolean,
      updatedAt: Number
    },
    peeks: { type: Array, default: [] },
    emergence: { type: Array, default: [] }
  }, { timestamps: true, strict: false, minimize: false });
  try {
    StateModel = mongoose.model("State", StateSchema);
  } catch(e) {
    StateModel = mongoose.models.State;
  }
}

let isMongoConnected = false;
async function initMongo() {
  if (!mongoose || !MONGODB_URI) {
    console.log("No MONGODB_URI provided. Running with local/file persistence fallback.");
    return;
  }
  try {
    if (mongoose.connection) {
      mongoose.connection.on("disconnected", () => {
        isMongoConnected = false;
        console.warn("MongoDB disconnected.");
      });
      mongoose.connection.on("reconnected", () => {
        isMongoConnected = true;
        console.log("MongoDB reconnected!");
      });
      mongoose.connection.on("error", err => {
        isMongoConnected = false;
        console.error("MongoDB error:", err.message);
      });
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000
    });
    isMongoConnected = true;
    console.log("MongoDB connected successfully!");

    const doc = await StateModel.findOne({ key: "global_state" }).lean();
    if (doc) {
      if (Array.isArray(doc.savedSites) && doc.savedSites.length) state.savedSites = doc.savedSites;
      if (typeof doc.sitesUpdatedAt === "number") state.sitesUpdatedAt = doc.sitesUpdatedAt;
      if (doc.calc && typeof doc.calc === "object") {
        state.calc = { ...DEFAULT_STATE.calc, ...doc.calc };
      }
      if (doc.acaat && typeof doc.acaat === "object") {
        state.acaat = { ...DEFAULT_STATE.acaat, ...doc.acaat };
      }
      if (doc.integrations && typeof doc.integrations === "object") {
        state.integrations = { ...DEFAULT_INTEGRATIONS, ...doc.integrations };
        if (!state.integrations.geminiModel || state.integrations.geminiModel.includes("1.5") || state.integrations.geminiModel.includes("2.0")) {
          state.integrations.geminiModel = "gemini-3.5-flash";
        }
      }
      if (Array.isArray(doc.peeks)) state.peeks = doc.peeks.slice(0, 20);
      if (Array.isArray(doc.emergence)) state.emergence = doc.emergence.slice(0, 3);
      console.log("Loaded persistent state from MongoDB! Calc mode:", state.calc.mode, "fixed:", state.calc.fixed);
    } else {
      await StateModel.create({ key: "global_state", ...state });
      console.log("Seeded default state into MongoDB!");
    }
  } catch(err) {
    isMongoConnected = false;
    console.error("MongoDB connection failed:", err.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (raw && typeof raw === "object") {
        if (Array.isArray(raw.savedSites) && raw.savedSites.length) {
          state.savedSites = raw.savedSites;
        }
        if (typeof raw.sitesUpdatedAt === "number") state.sitesUpdatedAt = raw.sitesUpdatedAt;
        if (raw.calc) Object.assign(state.calc, raw.calc);
        if (raw.acaat) Object.assign(state.acaat, raw.acaat);
        if (raw.integrations) {
          Object.assign(state.integrations, raw.integrations);
          if (!state.integrations.geminiModel || state.integrations.geminiModel.includes("1.5") || state.integrations.geminiModel.includes("2.0")) {
            state.integrations.geminiModel = "gemini-3.5-flash";
          }
        }
        if (Array.isArray(raw.peeks)) state.peeks = raw.peeks.slice(0, 20);
        if (Array.isArray(raw.emergence)) state.emergence = raw.emergence.slice(0, 3);
      }
    }
  } catch (e) {}
}

async function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {}
  if (isMongoConnected && StateModel) {
    try {
      await StateModel.findOneAndUpdate(
        { key: "global_state" },
        {
          $set: {
            savedSites: state.savedSites,
            sitesUpdatedAt: state.sitesUpdatedAt,
            calc: state.calc,
            acaat: state.acaat,
            integrations: state.integrations,
            peeks: state.peeks,
            emergence: state.emergence
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch(err) {
      console.error("Error saving state to MongoDB:", err.message);
    }
  }
}
loadState();
initMongo();

function updateSavedSites(list) {
  if (!Array.isArray(list)) return;
  const cleaned = list
    .filter(x => x && typeof x.url === "string" && x.url.trim())
    .map(x => ({
      name: String(x.name || x.url).trim(),
      url: String(x.url).trim(),
      openInSafari: !!x.openInSafari
    }));
  state.savedSites = cleaned;
}

/* ---------------- Saved Sites Endpoint (/api/sites) ---------------- */
app.get("/api/sites", (req, res) => {
  const ts = state.sitesUpdatedAt || Math.max(state.calc.updatedAt || 0, state.acaat.updatedAt || 0);
  res.json({ savedSites: state.savedSites, updatedAt: ts });
});

app.post("/api/sites", (req, res) => {
  const b = req.body || {};
  if (Array.isArray(b.savedSites)) {
    updateSavedSites(b.savedSites);
    const ts = Number(b.updatedAt) || Date.now();
    state.sitesUpdatedAt = ts;
    state.calc.updatedAt = ts;
    state.acaat.updatedAt = ts;
    saveState();
  }
  res.json({ ok: true, savedSites: state.savedSites, updatedAt: state.sitesUpdatedAt });
});

/* ---------------- Calculator Endpoints (/api/config) ---------------- */
app.get("/api/config", (req, res) => {
  res.json({ ...state.calc, savedSites: state.savedSites });
});

app.post("/api/config", async (req, res) => {
  const b = req.body || {};
  if ([0, 1, 2, 3].includes(Number(b.mode))) state.calc.mode = Number(b.mode);
  if (b.fixed !== undefined && b.fixed !== null) state.calc.fixed = String(b.fixed).replace(/[^\d.-]/g, "");
  if (!isNaN(Number(b.hold))) state.calc.hold = Math.max(0.15, Math.min(3, Number(b.hold)));
  if ([0, 1, 2, 3, 4].includes(Number(b.chunk))) state.calc.chunk = Number(b.chunk);
  if (!isNaN(Number(b.offset))) state.calc.offset = Math.floor(Number(b.offset));
  if (typeof b.autoOpOnLock === "boolean") state.calc.autoOpOnLock = b.autoOpOnLock;
  if (["both", "dot", "bright"].includes(b.hintStyle)) state.calc.hintStyle = b.hintStyle;
  if (typeof b.redirectUrl === "string") state.calc.redirectUrl = b.redirectUrl.trim();
  if (typeof b.redirectOpenSafari === "boolean") state.calc.redirectOpenSafari = b.redirectOpenSafari;
  if (typeof b.clockSiteUrl === "string") state.calc.clockSiteUrl = b.clockSiteUrl.trim();
  if (typeof b.clockOpenSafari === "boolean") state.calc.clockOpenSafari = b.clockOpenSafari;
  if (typeof b.acRedirectUrl === "string") state.calc.acRedirectUrl = b.acRedirectUrl.trim();
  if (typeof b.acOpenSafari === "boolean") state.calc.acOpenSafari = b.acOpenSafari;
  if (typeof b.activeRoom === "string" && b.activeRoom.trim()) state.calc.activeRoom = b.activeRoom.trim().toUpperCase();
  if (Array.isArray(b.savedSites)) updateSavedSites(b.savedSites);
  state.calc.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, config: { ...state.calc, savedSites: state.savedSites } });
});

/* ---------------- Stopwatch Endpoints (/api/acaat & /api/acaat/peek) ---------------- */
app.get("/api/acaat", (req, res) => {
  res.json({
    ...state.acaat,
    savedSites: state.savedSites,
    peeks: state.peeks,
    emergence: state.emergence
  });
});

app.post("/api/acaat", async (req, res) => {
  const b = req.body || {};
  if (["seq", "single", "open17", "off"].includes(b.mode)) state.acaat.mode = b.mode;
  if (b.singleTarget !== undefined && !isNaN(Number(b.singleTarget))) {
    state.acaat.singleTarget = Math.max(0, Math.min(99, Math.floor(Number(b.singleTarget))));
  }
  if (Array.isArray(b.targets)) {
    state.acaat.targets = [0, 1, 2, 3, 4, 5].map(i => {
      const v = b.targets[i];
      return v === null || v === "" || v === undefined || isNaN(Number(v))
        ? null
        : Math.max(0, Math.min(99, Math.floor(Number(v))));
    });
  }
  if (typeof b.scrambleLotto === "boolean") state.acaat.scrambleLotto = b.scrambleLotto;
  if (typeof b.leftRedirectUrl === "string" && b.leftRedirectUrl.trim()) {
    state.acaat.leftRedirectUrl = b.leftRedirectUrl.trim();
  }
  if (typeof b.leftOpenSafari === "boolean") state.acaat.leftOpenSafari = b.leftOpenSafari;
  if (typeof b.rightRedirectUrl === "string") {
    state.acaat.rightRedirectUrl = b.rightRedirectUrl.trim();
    state.acaat.customSiteUrl = state.acaat.rightRedirectUrl;
  } else if (typeof b.customSiteUrl === "string") {
    state.acaat.customSiteUrl = b.customSiteUrl.trim();
    state.acaat.rightRedirectUrl = state.acaat.customSiteUrl;
  }
  if (typeof b.rightOpenSafari === "boolean") {
    state.acaat.rightOpenSafari = b.rightOpenSafari;
    state.acaat.openInSafari = b.rightOpenSafari;
  } else if (typeof b.openInSafari === "boolean") {
    state.acaat.openInSafari = b.openInSafari;
    state.acaat.rightOpenSafari = b.openInSafari;
  }
  if (typeof b.icontrolUrl === "string" && b.icontrolUrl.trim()) {
    state.acaat.icontrolUrl = b.icontrolUrl.trim();
  }
  if (typeof b.icontrolOpenSafari === "boolean") {
    state.acaat.icontrolOpenSafari = b.icontrolOpenSafari;
  }
  if (["both", "stop", "lap"].includes(b.triggerOn)) state.acaat.triggerOn = b.triggerOn;
  if (typeof b.autoDisarm === "boolean") state.acaat.autoDisarm = b.autoDisarm;
  if (Array.isArray(b.savedSites)) updateSavedSites(b.savedSites);
  state.acaat.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: { ...state.acaat, savedSites: state.savedSites } });
});

app.post("/api/acaat/peek", (req, res) => {
  const b = req.body || {};
  const shownFmt = String(b.shownFormatted || b.realFormatted || "00:00.00").replace(/\s*\(.*$/, "");
  const largeInt = Number(b.largeInt) || parseInt(shownFmt.replace(/[^0-9]/g, ""), 10) || 0;
  const entry = {
    type: String(b.type || "STOP"),
    shownFormatted: shownFmt,
    largeInt,
    sec: Number(b.sec ?? b.realSec) || 0,
    cs: Number(b.cs ?? b.realCs) || 0,
    at: b.at || new Date().toLocaleTimeString()
  };
  if (entry.type.startsWith("RESET")) {
    const rawSlots = String(b.emergenceSlots || b.realFormatted || shownFmt);
    const parts = rawSlots.split("—").map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      state.emergence = parts.map(fmt => {
        const cleanFmt = fmt.replace(/\s*\(.*$/, "").trim();
        return {
          formatted: cleanFmt,
          largeInt: parseInt(cleanFmt.replace(/[^0-9]/g, ""), 10) || 0
        };
      });
    }
  }
  state.peeks.unshift(entry);
  if (state.peeks.length > 20) state.peeks.pop();
  saveState();
  res.json({ ok: true });
});

app.get("/healthz", (req, res) => res.json({ status: "ok", now: Date.now() }));
app.get("/ping", (req, res) => res.send("pong"));

app.post("/api/acaat/reset-mode", async (req, res) => {
  Object.assign(state.acaat, DEFAULT_SW_MODES);
  state.acaat.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: { ...state.acaat, savedSites: state.savedSites } });
});

app.post("/api/config/reset-mode", async (req, res) => {
  Object.assign(state.calc, DEFAULT_CALC_MODES);
  state.calc.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, config: { ...state.calc, savedSites: state.savedSites } });
});

app.post("/api/reset-all-modes", async (req, res) => {
  Object.assign(state.acaat, DEFAULT_SW_MODES);
  Object.assign(state.calc, DEFAULT_CALC_MODES);
  const now = Date.now();
  state.acaat.updatedAt = now;
  state.calc.updatedAt = now;
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: state.acaat, calc: state.calc, savedSites: state.savedSites });
});

app.post("/api/reset-all-defaults", async (req, res) => {
  state.calc = JSON.parse(JSON.stringify(DEFAULT_STATE.calc));
  state.acaat = JSON.parse(JSON.stringify(DEFAULT_STATE.acaat));
  state.savedSites = JSON.parse(JSON.stringify(DEFAULT_SAVED_SITES));
  const now = Date.now();
  state.calc.updatedAt = now;
  state.acaat.updatedAt = now;
  state.sitesUpdatedAt = now;
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, message: "Reset to Robert's exact defaults!", acaat: state.acaat, calc: state.calc, savedSites: state.savedSites });
});

app.post("/api/acaat/clear-peeks", (req, res) => {
  state.peeks = [];
  state.emergence = [];
  saveState();
  res.json({ ok: true });
});

/* ---------------- API & AI Pricing Integrations (/api/webhook, /api/inject, etc.) ---------------- */

function extractField(obj, fieldPath) {
  if (!obj || typeof obj !== "object") return null;
  const pathParts = (fieldPath || "data").trim().split(".");
  let cur = obj;
  for (const part of pathParts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[part];
  }
  return cur;
}

function resolvePayloadInput(body, query, targetField) {
  if (Array.isArray(body) && body.length > 0) {
    body = body[0];
  }
  if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") body = parsed;
      else return body.trim();
    } catch(_) {
      return body.trim();
    }
  }

  let val = extractField(body, targetField);
  if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();

  val = extractField(query, targetField);
  if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();

  const fallbacks = ["data", "peek", "query", "text", "item", "input", "q", "value", "search", "term", "name", "content"];
  for (const f of fallbacks) {
    if (body && typeof body === "object" && body[f] !== undefined && String(body[f]).trim()) {
      return String(body[f]).trim();
    }
    if (query && typeof query === "object" && query[f] !== undefined && String(query[f]).trim()) {
      return String(query[f]).trim();
    }
  }

  if (body && typeof body === "object") {
    for (const k of Object.keys(body)) {
      const v = body[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  if (query && typeof query === "object") {
    for (const k of Object.keys(query)) {
      const v = query[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  if (typeof body === "string" && body.trim()) return body.trim();
  return null;
}

async function processAiPricing(rawInput) {
  if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
    throw new Error("No input query or item text provided");
  }

  const query = rawInput.trim();
  if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };
  const cfg = state.integrations;
  let searchContext = "";
  let searchSource = "none";
  let finalNumber = null;
  let aiSource = "none";

  // Check if input is directly a price/number (e.g. "$450", "450", "1200", "$1,500.00")
  const directMatch = query.match(/^\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.00)?$/);
  if (directMatch) {
    finalNumber = parseInt(directMatch[1].replace(/,/g, ""), 10);
    aiSource = "direct_number";
  }

  // 1. Tavily Search (AI Web Search Engine)
  if (finalNumber === null && cfg.tavilyApiKey && cfg.tavilyApiKey.trim()) {
    try {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: cfg.tavilyApiKey.trim(),
          query: `retail price of single ${query} in USD`,
          search_depth: "basic",
          include_answer: true,
          max_results: 3
        })
      });
      if (tavilyRes.ok) {
        const tavilyData = await tavilyRes.json();
        const snippets = (tavilyData.results || []).map(r => r.content).join("\n");
        const answer = tavilyData.answer ? `Direct Search Answer: ${tavilyData.answer}\n` : "";
        searchContext = `${answer}Web Search Results:\n${snippets}`.slice(0, 3000);
        searchSource = "tavily";
      }
    } catch(err) {
      console.warn("Tavily search error:", err.message);
    }
  }

  // 2. SerpAPI Search (Google Shopping / Search fallback)
  if (!searchContext && cfg.serpApiKey && cfg.serpApiKey.trim()) {
    try {
      const serpUrl = `https://serpapi.com/search.json?q=retail+price+of+single+${encodeURIComponent(query)}+in+USD&api_key=${encodeURIComponent(cfg.serpApiKey.trim())}`;
      const serpRes = await fetch(serpUrl);
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const answerBox = serpData.answer_box ? JSON.stringify(serpData.answer_box) : "";
        const shopping = (serpData.shopping_results || []).slice(0, 3).map(s => `${s.title}: ${s.price}`).join("; ");
        const organic = (serpData.organic_results || []).slice(0, 3).map(o => o.snippet).join("\n");
        searchContext = `Google Shopping: ${shopping}\nAnswer: ${answerBox}\nOrganic:\n${organic}`.slice(0, 3000);
        searchSource = "serpapi";
      }
    } catch(err) {
      console.warn("SerpAPI search error:", err.message);
    }
  }

  if (finalNumber === null && searchSource !== "none") aiSource = searchSource;

  // 3. Gemini API LLM Reasoning
  if (finalNumber === null && cfg.geminiApiKey && cfg.geminiApiKey.trim()) {
    const candidateModels = [
      cfg.geminiModel,
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest"
    ].filter(Boolean);
    const uniqueModels = [...new Set(candidateModels)];

    for (const model of uniqueModels) {
      if (finalNumber !== null) break;
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.geminiApiKey.trim())}`;
        const systemPrompt = cfg.prompt || DEFAULT_INTEGRATIONS.prompt;
        const userMessage = searchContext
          ? `Item/Query: "${query}"\n\nLive Search Information:\n${searchContext}\n\nBased on this information and your knowledge, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). Round to a clean whole number without cents. Return ONLY the integer digits with no words or punctuation.`
          : `Item/Query: "${query}"\n\nDetermine the realistic, typical retail price in USD for ONE single unit of this item (do NOT price a bulk multi-pack, case, or carton). Round to a clean whole number without cents. Return ONLY the integer digits with no words or punctuation.`;

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 60
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidate = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const digits = candidate.replace(/[^\d]/g, "");
          if (digits) {
            finalNumber = parseInt(digits, 10);
            aiSource = searchSource !== "none" ? `${searchSource}+gemini(${model})` : `gemini(${model})`;
            break;
          }
        } else {
          const errText = await geminiRes.text();
          console.warn(`Gemini (${model}) error:`, errText);
        }
      } catch(err) {
        console.warn(`Gemini (${model}) exception:`, err.message);
      }
    }
  }

  // 4. Fallback Regex Extraction ONLY as an emergency if Gemini was unavailable
  if (finalNumber === null && searchContext) {
    const singleMatch = searchContext.match(/(?:single\s+(?:deck|pack|unit|item)|each|\/deck|per\s+(?:deck|pack|unit))\s*(?:is|at|for|:)?\s*\$\s*(\d{1,3}(?:,\d{3})*|\d+)/i)
      || searchContext.match(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?\s*(?:each|per\s+(?:deck|unit|item))/i);
    if (singleMatch) {
      finalNumber = parseInt(singleMatch[1].replace(/,/g, ""), 10);
      aiSource = `${searchSource}_single_regex`;
    }
  }

  // 5. Fallback to clean integer from input if input was a number
  if (finalNumber === null) {
    const numInput = parseInt(query.replace(/[^\d]/g, ""), 10);
    if (!isNaN(numInput) && numInput > 0) {
      finalNumber = numInput;
      aiSource = "raw_digits";
    }
  }

  if (finalNumber === null || isNaN(finalNumber)) {
    if (!cfg.geminiApiKey && !cfg.tavilyApiKey && !cfg.serpApiKey) {
      throw new Error(`Please paste your Gemini API Key in the AI section below so SmartCalc can price "${query}"`);
    }
    throw new Error(`Could not determine a numeric price for: "${query}"`);
  }

  // Auto-set SmartCalc fixed force number!
  state.calc.fixed = String(finalNumber);
  state.calc.mode = 1;
  state.calc.updatedAt = Date.now();

  state.integrations.lastInput = query;
  state.integrations.lastOutput = String(finalNumber);
  state.integrations.lastPrice = finalNumber;
  state.integrations.lastUpdatedAt = Date.now();

  const logEntry = {
    ts: Date.now(),
    input: query,
    price: finalNumber,
    source: aiSource
  };
  state.integrations.lastLogs = [logEntry, ...(state.integrations.lastLogs || [])].slice(0, 10);

  await saveState();

  return {
    success: true,
    input: query,
    price: finalNumber,
    source: aiSource,
    searchSnippet: searchContext.slice(0, 300)
  };
}

// Inbound webhook routes (supports POST and GET)
app.all(["/api/webhook", "/api/inject"], async (req, res) => {
  try {
    const input = resolvePayloadInput(req.body, req.query, state.integrations?.targetField);
    if (!input) {
      return res.status(400).json({
        ok: false,
        error: `No text found in field '${state.integrations?.targetField || "data"}' or fallback fields`,
        receivedBody: req.body,
        receivedQuery: req.query
      });
    }

    const result = await processAiPricing(input);
    res.json({
      ok: true,
      input,
      forceNumber: result.price,
      source: result.source,
      calc: state.calc
    });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Outbound API poller endpoint
app.post("/api/integrations/poll", async (req, res) => {
  try {
    if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };

    const body = req.body || {};
    let reqUrl = (body.apiUrl || req.query?.apiUrl || "").trim();
    let reqField = (body.targetField || req.query?.targetField || "").trim();

    // If client supplied new url or field in payload, update and persist state
    if (reqUrl) {
      state.integrations.apiUrl = reqUrl;
      if (reqField) state.integrations.targetField = reqField;
      await saveState();
    }

    const cfg = state.integrations;
    let url = reqUrl || cfg.apiUrl?.trim();
    const field = reqField || cfg.targetField || "data";

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "No external API URL configured. Please paste your Inject API URL in the box above."
      });
    }

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const extRes = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });

    if (!extRes.ok) {
      throw new Error(`External Inject API returned HTTP ${extRes.status} (${extRes.statusText})`);
    }

    let parsedData;
    const rawText = await extRes.text();
    try {
      parsedData = JSON.parse(rawText);
    } catch(_) {
      parsedData = rawText;
    }

    const input = resolvePayloadInput(parsedData, null, field);
    if (!input) {
      throw new Error(`Could not find field '${field}' or any text in Inject API response. Received: ${rawText.slice(0, 150)}`);
    }

    const result = await processAiPricing(String(input));
    res.json({
      ok: true,
      input,
      forceNumber: result.price,
      source: result.source,
      calc: state.calc
    });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Integrations config endpoints
app.get("/api/integrations/config", (req, res) => {
  res.json({ ok: true, integrations: state.integrations || DEFAULT_INTEGRATIONS });
});

app.post("/api/integrations/config", async (req, res) => {
  const b = req.body || {};
  if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };

  if (typeof b.apiUrl === "string") state.integrations.apiUrl = b.apiUrl.trim();
  if (typeof b.autoPoll === "boolean") state.integrations.autoPoll = b.autoPoll;
  if (typeof b.targetField === "string" && b.targetField.trim()) state.integrations.targetField = b.targetField.trim();
  if (typeof b.serpApiKey === "string") state.integrations.serpApiKey = b.serpApiKey.trim();
  if (typeof b.tavilyApiKey === "string") state.integrations.tavilyApiKey = b.tavilyApiKey.trim();
  if (typeof b.geminiApiKey === "string") state.integrations.geminiApiKey = b.geminiApiKey.trim();
  if (typeof b.geminiModel === "string" && b.geminiModel.trim()) state.integrations.geminiModel = b.geminiModel.trim();
  if (typeof b.prompt === "string" && b.prompt.trim()) state.integrations.prompt = b.prompt.trim();

  await saveState();
  res.json({ ok: true, integrations: state.integrations });
});

// Test AI pipeline
app.post("/api/integrations/test", async (req, res) => {
  try {
    const input = (req.body?.testInput || "").trim();
    if (!input) return res.status(400).json({ ok: false, error: "Please enter a test item or query" });
    const result = await processAiPricing(input);
    res.json({ ok: true, result });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Background Inject API Poller (checks user's Inject API for new spectator peeks)
let lastPolledInput = "";
let isPollingActive = false;

async function checkInjectApi() {
  if (isPollingActive) return;
  const cfg = state.integrations;
  if (!cfg || !cfg.apiUrl || !cfg.apiUrl.trim()) return;

  isPollingActive = true;
  try {
    let url = cfg.apiUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    if (!res.ok) {
      isPollingActive = false;
      return;
    }

    let textOrJson;
    const rawText = await res.text();
    try {
      textOrJson = JSON.parse(rawText);
    } catch(_) {
      textOrJson = rawText;
    }

    const field = cfg.targetField || "data";
    const input = resolvePayloadInput(textOrJson, null, field);
    if (input && input !== lastPolledInput && input !== cfg.lastInput) {
      console.log(`[Inject Poller] Received new item from Inject API: "${input}"`);
      lastPolledInput = input;
      const result = await processAiPricing(input);
      console.log(`[Inject Poller] Forced price on SmartCalc: ${result.price} (via ${result.source})`);
    }
  } catch(err) {
    // quiet ignore for intermittent network glitches
  } finally {
    isPollingActive = false;
  }
}

setInterval(checkInjectApi, 2000);

/* ---------------- Unified Mobile Control Dashboard (/) ---------------- */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Magic Remote</title>
<style>
  :root{--bg:#000;--card:#1c1c1e;--fill:#2c2c2e;--orange:#ff9f0a;--green:#30d158;--gray:#8e8e93;--red:#ff453a;}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{margin:0;padding:16px 14px 70px;background:var(--bg);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;}
  .wrap{max-width:480px;margin:0 auto;}
  .tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--card);padding:4px;border-radius:12px;margin-bottom:16px;}
  .tbtn{border:0;background:none;color:var(--gray);font-size:15px;font-weight:600;padding:10px;border-radius:9px;cursor:pointer;}
  .tbtn.on{background:var(--orange);color:#000;}
  .pane{display:none;} .pane.on{display:block;}
  .sec{font-size:12px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em;margin:18px 4px 7px;}
  .card{background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px;}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
  .row:last-child{margin-bottom:0;}
  .subbox{background:#141416;border:1px solid #2c2c2e;border-radius:11px;padding:11px;margin-bottom:10px;}
  .subbox:last-child{margin-bottom:0;}
  .subhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:600;color:#ff9f0a;}
  label{font-size:14px;color:#e5e5ea;}
  input,select{background:var(--fill);color:#fff;border:0;border-radius:8px;padding:9px 11px;font-size:15px;outline:none;}
  input[type="text"],input[type="url"]{width:100%;margin-top:6px;}
  .grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:8px;}
  .grid6 input{width:100%;text-align:center;padding:9px 0;font-weight:600;}
  .mode-pills{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;}
  .mpill{border:1px solid #3a3a3c;border-radius:9px;background:var(--fill);color:#e5e5ea;font-size:12px;font-weight:600;padding:9px 4px;cursor:pointer;text-align:center;}
  .mpill.sel{background:var(--orange);color:#000;border-color:var(--orange);}
  .btn{width:100%;border:0;border-radius:12px;background:var(--orange);color:#000;font-size:17px;font-weight:700;padding:14px;cursor:pointer;margin-top:8px;}
  .btn:active{opacity:.8;}
  .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;}
  .chip{border:0;border-radius:7px;background:var(--fill);color:#d1d1d6;font-size:12px;font-weight:600;padding:5px 9px;cursor:pointer;}
  .chip.dice{background:rgba(255,159,10,0.2);color:var(--orange);}
  .peek-hero{display:flex;align-items:center;justify-content:space-between;background:#111c14;border:1px solid #1e4628;border-radius:12px;padding:12px 14px;margin-bottom:10px;}
  .peek-big{font-size:26px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums;}
  .peek-meta{font-size:13px;color:#a1a1a6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
  .peek-list{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d1d1d6;max-height:150px;overflow-y:auto;white-space:pre-wrap;}
  .site-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #2c2c2e;}
  .site-row:last-child{border-bottom:0;}
  .site-meta{flex:1;min-width:0;}
  .site-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .site-sub{font-size:11px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .del-btn{background:rgba(255,69,58,0.2);color:var(--red);border:0;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:700;cursor:pointer;}
  .toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--green);color:#000;font-weight:700;padding:10px 20px;border-radius:999px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:99;}
  .toast.on{opacity:1;}
</style>
</head>
<body>
<div class="wrap">
  <div style="text-align:center;margin-bottom:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
    <button type="button" id="resetAllModesBtn" style="background:rgba(255,159,10,0.15);color:#ff9f0a;border:1px solid rgba(255,159,10,0.4);border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">↺ Reset Modes</button>
    <button type="button" id="resetAllDefaultsBtn" style="background:rgba(48,209,88,0.15);color:#30d158;border:1px solid rgba(48,209,88,0.4);border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">⚡ Reset Everything to Robert's Defaults</button>
  </div>
  <div class="tabs" style="grid-template-columns: repeat(3, 1fr);">
    <button class="tbtn on" id="tabSw" type="button">⏱ Stopwatch</button>
    <button class="tbtn" id="tabCalc" type="button">🧮 Calculator</button>
    <button class="tbtn" id="tabAi" type="button">🤖 AI &amp; Webhooks</button>
  </div>

  <!-- STOPWATCH PANE -->
  <div class="pane on" id="paneSw">
    <div class="sec">Live Spectator Peek (Auto-Updates)</div>
    <div class="card">
      <div class="peek-hero" style="margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#8e8e93;text-transform:uppercase;">3-Person Reset Sum (Emergence)</div>
          <div class="peek-big" id="emSum">—</div>
          <div class="peek-meta" id="emSlots" style="margin-top:2px;">No Reset times locked yet</div>
        </div>
        <button type="button" id="pushSumToCalcBtn" style="background:var(--orange);color:#000;border:0;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Force on Calc</button>
      </div>
      <div class="peek-hero">
        <div>
          <div style="font-size:11px;color:#8e8e93;text-transform:uppercase;">What Spectator Sees On Screen</div>
          <div class="peek-big" id="liveShown" style="font-size:22px;color:#fff;">—</div>
        </div>
        <div style="text-align:right;">
          <div class="peek-meta" id="liveInt">Number: —</div>
          <div class="peek-meta" id="liveBreakdown">Sec: — | Dec: —</div>
        </div>
      </div>
      <div class="peek-list" id="peekLog">Waiting for spectator stops...</div>
      <button type="button" id="clearPeeksBtn" style="margin-top:8px;background:#2c2c2e;color:#8e8e93;border:0;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Clear Peek History</button>
    </div>

    <div class="sec">Stopwatch Force Controls (Tap Mode to Switch Live)</div>
    <div class="card">
      <button type="button" id="resetSwModeBtn" style="width:100%;background:#2c2c2e;color:#ff9f0a;border:1px solid #ff9f0a;border-radius:10px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px;">↺ Reset Stopwatch Modes to Default (Keeps Redirects)</button>
      <div class="mode-pills" id="swModePills">
        <button type="button" class="mpill sel" data-mode="seq">Lotto 6-Seq</button>
        <button type="button" class="mpill" data-mode="single">Single .XX</button>
        <button type="button" class="mpill" data-mode="open17">Sum = 17</button>
        <button type="button" class="mpill" data-mode="off">Off (Fair)</button>
      </div>
      <div class="row">
        <label>Force Mode</label>
        <select id="swMode">
          <option value="seq" selected>Lotto / 6-Number Sequence</option>
          <option value="single">Single Decimal (.00–.99)</option>
          <option value="open17">Digits Add Up to 17</option>
          <option value="off">Off (100% Fair)</option>
        </select>
      </div>
      <div class="row">
        <label>Single Decimal (.00–.99)</label>
        <input id="swSingle" type="number" min="0" max="99" value="18" style="width:80px;text-align:center;">
      </div>
      <div>
        <div class="row" style="margin-bottom:4px;">
          <label>Lotto 6-Stop Sequence (00–99)</label>
          <button type="button" id="swShuffleBtn" class="chip" style="color:var(--orange);border:1px solid var(--orange);">🔀 Scramble Boxes</button>
        </div>
        <div class="grid6">
          <input type="number" min="0" max="99" class="sw-slot" data-i="0" value="18">
          <input type="number" min="0" max="99" class="sw-slot" data-i="1" value="23">
          <input type="number" min="0" max="99" class="sw-slot" data-i="2" value="27">
          <input type="number" min="0" max="99" class="sw-slot" data-i="3" value="41">
          <input type="number" min="0" max="99" class="sw-slot" data-i="4" value="56">
          <input type="number" min="0" max="99" class="sw-slot" data-i="5" value="9">
        </div>
      </div>
      <div class="row" style="margin-top:12px;">
        <label>Scramble Lotto Order Automatically</label>
        <input id="swScramble" type="checkbox" checked style="width:22px;height:22px;accent-color:var(--orange);">
      </div>
      <div class="row">
        <label>Trigger Force On</label>
        <select id="swTrigger">
          <option value="both" selected>Stop & Lap</option>
          <option value="stop">Stop Only</option>
          <option value="lap">Lap Only</option>
        </select>
      </div>
      <div class="row">
        <label>Auto-Disarm After Force</label>
        <input id="swDisarm" type="checkbox" checked style="width:22px;height:22px;accent-color:var(--orange);">
      </div>
    </div>

    <div class="sec">Stopwatch Redirects (Use "dice" or Any URL)</div>
    <div class="card">
      <div class="subbox">
        <div class="subhead"><span>1. Left Under Lap / Reset (2x/3x Tap)</span></div>
        <input id="swLeftUrl" type="text" value="https://ssw.im/276" placeholder="dice or https://...">
        <div class="chip-row" data-target="swLeftUrl" data-safari="swLeftSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab (unchecked = App Clip)</label>
          <input id="swLeftSafari" type="checkbox" checked style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>

      <div class="subbox">
        <div class="subhead"><span>2. Right Under Start (2x/3x Tap)</span></div>
        <input id="swRightUrl" type="text" value="https://icontrol-magic.onrender.com/" placeholder="https://your-calculator-url.com or dice">
        <div class="chip-row" data-target="swRightUrl" data-safari="swRightSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab (unchecked = App Clip)</label>
          <input id="swRightSafari" type="checkbox" checked style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>

      <div class="subbox">
        <div class="subhead"><span>3. Top-Right Corner Hold (Calculator)</span></div>
        <input id="swIcontrolUrl" type="text" value="https://smartcalc-zeta.vercel.app/" placeholder="https://smartcalc-zeta.vercel.app/">
        <div class="chip-row" data-target="swIcontrolUrl" data-safari="swIcontrolSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab (unchecked = App Clip)</label>
          <input id="swIcontrolSafari" type="checkbox" style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>
    </div>
    <button class="btn" id="saveSwBtn" type="button">Push Live to Stopwatch</button>
  </div>

  <!-- CALCULATOR PANE -->
  <div class="pane" id="paneCalc">
    <div class="sec">Calculator Force Settings (Tap Mode to Switch Live)</div>
    <div class="card">
      <button type="button" id="resetCalcModeBtn" style="width:100%;background:#2c2c2e;color:#ff9f0a;border:1px solid #ff9f0a;border-radius:10px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px;">↺ Reset Calculator Modes to Default (Keeps Redirects)</button>
      <div class="mode-pills" id="cModePills">
        <button type="button" class="mpill" data-mode="0">Off</button>
        <button type="button" class="mpill" data-mode="1">Fixed</button>
        <button type="button" class="mpill sel" data-mode="2">Time +Offset</button>
        <button type="button" class="mpill" data-mode="3">Time Live</button>
      </div>
      <div class="row">
        <label>Force Mode</label>
        <select id="cMode">
          <option value="0">Off</option>
          <option value="1">Fixed Number</option>
          <option value="2" selected>Date + Time (Offset)</option>
          <option value="3">Date + Time (Live)</option>
        </select>
      </div>
      <div class="row">
        <label>Fixed Force Number</label>
        <input id="cFixed" type="text" value="6417118" style="width:140px;text-align:right;">
      </div>
      <div class="row">
        <label>Time Offset (Seconds)</label>
        <input id="cOffset" type="number" value="30" style="width:90px;text-align:center;">
      </div>
      <div class="row">
        <label>Digits Per Press</label>
        <select id="cChunk">
          <option value="1" selected>1 Digit</option>
          <option value="2">2 Digits</option>
          <option value="3">3 Digits</option>
          <option value="4">4 Digits</option>
          <option value="0">All at Once</option>
        </select>
      </div>
      <div class="row">
        <label>Hold Duration (s)</label>
        <input id="cHold" type="number" step="0.05" min="0.15" max="2.0" value="0.15" style="width:90px;text-align:center;">
      </div>
      <div class="row">
        <label>Auto-type + or − on Lock (Hold .)</label>
        <input id="cAutoOp" type="checkbox" style="width:22px;height:22px;accent-color:var(--orange);">
      </div>
      <div class="row">
        <label>Hint Digit Style</label>
        <select id="cHintStyle">
          <option value="both">Bolded Edge + Small Dot</option>
          <option value="dot">Small Dot Only</option>
          <option value="bright" selected>Bolded Edge Only</option>
        </select>
      </div>
    </div>

    <div class="sec">Calculator Redirects (Use "dice" or Any URL)</div>
    <div class="card">
      <div class="subbox">
        <div class="subhead"><span>1. Double-Tap Main Numbers / Display Area</span></div>
        <input id="cClockUrl" type="text" value="https://stopwatchappclip.vercel.app/" placeholder="https://your-clock-site.com or dice">
        <div class="chip-row" data-target="cClockUrl" data-safari="cClockSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab (unchecked = App Clip)</label>
          <input id="cClockSafari" type="checkbox" style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>

      <div class="subbox">
        <div class="subhead"><span>2. Top-Left Clock Button Tap (iControl)</span></div>
        <input id="cRedirect" type="text" value="https://icontrol-magic.onrender.com/" placeholder="https://icontrol-magic.onrender.com/">
        <div class="chip-row" data-target="cRedirect" data-safari="cRedirectSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab</label>
          <input id="cRedirectSafari" type="checkbox" checked style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>

      <div class="subbox">
        <div class="subhead"><span>3. Double-Tap AC When Cleared</span></div>
        <input id="cAcUrl" type="text" value="dice" placeholder="dice or https://...">
        <div class="chip-row" data-target="cAcUrl" data-safari="cAcSafari"></div>
        <div class="row" style="margin-top:8px;">
          <label>Open in New Safari Tab (unchecked = App Clip)</label>
          <input id="cAcSafari" type="checkbox" style="width:20px;height:20px;accent-color:var(--orange);">
        </div>
      </div>
    </div>
    <button class="btn" id="saveCalcBtn" type="button">Push Live to Calculator</button>
  </div>

  <!-- AI & INJECT INTEGRATIONS PANE -->
  <div class="pane" id="paneAi">
    <div class="sec">Inject API &rarr; AI Price Pipeline</div>
    <div class="card">
      <div style="font-size:13px;color:#a1a1a6;margin-bottom:14px;line-height:1.45;">
        SmartCalc checks your <b>Inject API</b> continuously in the background. As soon as a spectator performs a search in Inject, SmartCalc grabs the item, prompts AI to determine the realistic price in USD, and arms the calculator automatically!
      </div>

      <div class="subbox" style="border:1.5px solid var(--orange);">
        <div class="subhead" style="color:var(--orange);display:flex;justify-content:space-between;align-items:center;">
          <span>Your Inject API URL</span>
          <button type="button" id="pollApiNowBtn" style="background:var(--orange);color:#000;border:0;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;">⚡ Check Inject API Now</button>
        </div>
        <input type="url" id="aiApiUrl" placeholder="https://... (Paste your Inject API endpoint here)" style="font-family:ui-monospace,monospace;font-size:13px;color:#30d158;background:#000;padding:9px;">
        <div style="font-size:11px;color:#8e8e93;margin-top:6px;">SmartCalc checks this URL every 2 seconds automatically in the background.</div>
      </div>

      <div class="subbox" style="margin-top:10px;">
        <div class="subhead">Data Field in Inject JSON</div>
        <input type="text" id="aiTargetField" placeholder="data (e.g. data, text, query, peek)" value="data">
        <div style="font-size:11px;color:#8e8e93;margin-top:4px;">JSON key containing the spectator's search (defaults to <code>data</code> in Inject, with auto-detection for <code>query</code>, <code>search</code>, <code>text</code>, or raw text).</div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 12px;background:#111c14;border:1px solid #1e4628;border-radius:9px;">
        <span style="font-size:16px;">🟢</span>
        <div style="font-size:12px;color:#30d158;font-weight:600;">
          Continuous Background Checking Active (Every 2s)
        </div>
      </div>

      <button type="button" class="btn" id="saveInjectConfigBtn" style="margin-top:12px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;">💾 Save Inject API Settings</button>
    </div>

    <div class="sec">Live Peeks Caught From Inject &rarr; AI Force Log</div>
    <div class="card">
      <div style="font-size:12px;color:#8e8e93;margin-bottom:8px;">Live feed of spectator peeks grabbed from your Inject API:</div>
      <div id="aiLogList" style="background:var(--fill);border-radius:8px;padding:10px;font-family:ui-monospace,monospace;font-size:11px;color:#a1a1a6;max-height:140px;overflow-y:auto;white-space:pre-wrap;line-height:1.5;">No peeks grabbed yet. Paste your Inject API URL above to start!</div>
    </div>

    <div class="sec">AI &amp; Search API Keys</div>
    <div class="card">
      <div class="subbox">
        <div class="subhead">Google Gemini API Key (Required for AI Reasoning)</div>
        <input type="password" id="aiGeminiKey" placeholder="AIzaSy...">
        <div class="row" style="margin-top:8px;">
          <label style="font-size:13px;">Gemini Model</label>
          <select id="aiGeminiModel" style="font-size:13px;">
            <option value="gemini-3.5-flash" selected>gemini-3.5-flash (Fast &amp; Accurate)</option>
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra-fast)</option>
            <option value="gemini-3.8-flash">gemini-3.8-flash (Latest Flash)</option>
            <option value="gemini-flash-latest">gemini-flash-latest</option>
          </select>
        </div>
      </div>

      <div class="subbox">
        <div class="subhead">Tavily Search API Key (Live Web Market Search)</div>
        <input type="password" id="aiTavilyKey" placeholder="tvly-...">
        <div style="font-size:11px;color:#8e8e93;margin-top:4px;">Searches real-time web for current retail prices, vintage auction history, and live values.</div>
      </div>

      <div class="subbox">
        <div class="subhead">SerpAPI Key (Optional Google Shopping / Search)</div>
        <input type="password" id="aiSerpKey" placeholder="SerpAPI Key...">
        <div style="font-size:11px;color:#8e8e93;margin-top:4px;">Optional fallback for real-time Google Shopping and Google Search snippets.</div>
      </div>
    </div>

    <div class="sec">AI Price Estimation Prompt</div>
    <div class="card">
      <div style="font-size:12px;color:#8e8e93;margin-bottom:8px;">Custom instruction given to Gemini when determining the final numeric price:</div>
      <textarea id="aiPrompt" rows="4" style="width:100%;background:var(--fill);color:#fff;border:0;border-radius:8px;padding:9px 11px;font-size:13.5px;outline:none;font-family:-apple-system,sans-serif;line-height:1.4;box-sizing:border-box;resize:vertical;"></textarea>
      <button type="button" id="resetPromptBtn" style="margin-top:8px;background:#2c2c2e;color:#8e8e93;border:0;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">↺ Reset to Default Prompt</button>
    </div>

    <button class="btn" id="saveAiConfigBtn" type="button" style="margin-bottom:12px;">Save API &amp; AI Integration Keys</button>

    <div class="sec">Live Test Runner &amp; Pipeline Verifier</div>
    <div class="card">
      <div style="font-size:12px;color:#8e8e93;margin-bottom:8px;">Test the full pipeline. Generates the price and arms SmartCalc live:</div>
      <input type="text" id="aiTestInput" placeholder="e.g. 1968 Gibson Les Paul Custom or Rolex Submariner" value="1968 Gibson Les Paul Custom">
      <button type="button" class="btn" id="runAiTestBtn" style="margin-top:10px;background:#30d158;color:#000;">⚡ Test AI Pipeline &amp; Force Price</button>

      <div id="aiTestResultBox" style="display:none;margin-top:12px;background:#111c14;border:1px solid #1e4628;border-radius:12px;padding:12px;">
        <div style="font-size:11px;color:#8e8e93;text-transform:uppercase;">Resulting Forced Price on SmartCalc</div>
        <div id="aiResultPrice" style="font-size:28px;font-weight:700;color:#30d158;margin:4px 0;">—</div>
        <div id="aiResultMeta" style="font-size:12px;color:#a1a1a6;font-family:ui-monospace,monospace;"></div>
      </div>
    </div>
  </div>

  <!-- SHARED SAVED WEBSITES MANAGER -->
  <div class="sec">Saved Websites Library (Shared Across Stopwatch & Calculator)</div>
  <div class="card">
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px;">
      <input id="newSiteName" type="text" placeholder="Name (e.g. Calculator)" style="margin:0;">
      <input id="newSiteUrl" type="text" placeholder="https://... or dice" style="margin:0;">
    </div>
    <div class="row" style="margin-top:10px;">
      <label>Default to New Safari Tab when picked</label>
      <input id="newSiteSafari" type="checkbox" style="width:20px;height:20px;accent-color:var(--orange);">
    </div>
    <button type="button" id="addSiteBtn" style="width:100%;margin-top:8px;background:#2c2c2e;color:var(--orange);border:1px solid var(--orange);border-radius:9px;padding:9px;font-weight:700;cursor:pointer;">+ Save Website to Library</button>
    <div id="savedSitesContainer" style="margin-top:12px;"></div>
  </div>
</div>

<div class="toast" id="toast">Saved & Pushed Live!</div>

<script>
const p2 = n => String(Math.floor(Math.max(0, n))).padStart(2, "0");
let savedSites = [];
let latestEmSum = 0;

function flashToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg || "Saved & Pushed Live!";
  t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 1800);
}

function syncSwPills(){
  const cur = document.getElementById("swMode").value;
  document.querySelectorAll("#swModePills .mpill").forEach(b => {
    b.classList.toggle("sel", b.dataset.mode === cur);
  });
}

function syncCalcPills(){
  const cur = String(document.getElementById("cMode").value);
  document.querySelectorAll("#cModePills .mpill").forEach(b => {
    b.classList.toggle("sel", b.dataset.mode === cur);
  });
}

function switchTab(t){
  ["Sw", "Calc", "Ai"].forEach(k => {
    const btn = document.getElementById("tab" + k);
    const pane = document.getElementById("pane" + k);
    if (btn) btn.classList.toggle("on", k === t);
    if (pane) pane.classList.toggle("on", k === t);
  });
}
document.getElementById("tabSw").onclick = () => switchTab("Sw");
document.getElementById("tabCalc").onclick = () => switchTab("Calc");
document.getElementById("tabAi").onclick = () => switchTab("Ai");

function renderSavedSitesUI(){
  document.querySelectorAll(".chip-row").forEach(row => {
    const targetId = row.dataset.target;
    const safariId = row.dataset.safari;
    let html = \`<button type="button" class="chip dice" data-url="dice" data-saf="0">🎲 Dice Roller</button>\`;
    savedSites.forEach(s => {
      if (s.url.toLowerCase() === "dice") return;
      const safeName = (s.name || s.url).replace(/</g, "&lt;");
      const safeUrl = s.url.replace(/"/g, "&quot;");
      html += \`<button type="button" class="chip" data-url="\${safeUrl}" data-saf="\${s.openInSafari ? 1 : 0}">\${safeName}</button>\`;
    });
    row.innerHTML = html;
    row.querySelectorAll(".chip").forEach(btn => {
      btn.onclick = () => {
        document.getElementById(targetId).value = btn.dataset.url;
        if (safariId && document.getElementById(safariId)){
          if (btn.dataset.url === "dice") document.getElementById(safariId).checked = false;
          else if (btn.dataset.saf === "1") document.getElementById(safariId).checked = true;
        }
        if (targetId.startsWith("sw")) pushSwNow("Redirect Updated Live!");
        else pushCalcNow("Redirect Updated Live!");
      };
    });
  });

  const box = document.getElementById("savedSitesContainer");
  if (!savedSites.length){
    box.innerHTML = \`<div style="color:#8e8e93;font-size:13px;">No saved websites yet.</div>\`;
    return;
  }
  box.innerHTML = savedSites.map((s, idx) => \`
    <div class="site-row">
      <div class="site-meta">
        <div class="site-title">\${(s.name || s.url).replace(/</g, "&lt;")}</div>
        <div class="site-sub">\${s.url.replace(/</g, "&lt;")}</div>
      </div>
      <button type="button" class="chip mode-tog-btn" data-idx="\${idx}" style="color:#ff9f0a;">\${s.openInSafari ? "Safari Tab" : "App Clip"}</button>
      <button type="button" class="del-btn" data-idx="\${idx}">Delete</button>
    </div>
  \`).join("");
  box.querySelectorAll(".mode-tog-btn").forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      if (savedSites[idx]){
        savedSites[idx].openInSafari = !savedSites[idx].openInSafari;
        await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedSites })
        });
        renderSavedSitesUI();
        flashToast(savedSites[idx].openInSafari ? "Set to Safari Tab" : "Set to App Clip");
      }
    };
  });
  box.querySelectorAll(".del-btn").forEach(btn => {
    btn.onclick = async () => {
      savedSites.splice(Number(btn.dataset.idx), 1);
      await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedSites })
      });
      renderSavedSitesUI();
      flashToast("Removed from Library");
    };
  });
}

document.getElementById("addSiteBtn").onclick = async () => {
  const urlIn = document.getElementById("newSiteUrl");
  const nameIn = document.getElementById("newSiteName");
  const safIn = document.getElementById("newSiteSafari");
  let rawUrl = urlIn.value.trim();
  if (!rawUrl) return;
  if (rawUrl.toLowerCase() !== "dice" && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)){
    rawUrl = "https://" + rawUrl;
  }
  const label = nameIn.value.trim() || rawUrl;
  const existing = savedSites.findIndex(s => s.url === rawUrl);
  if (existing >= 0){
    savedSites[existing] = { name: label, url: rawUrl, openInSafari: safIn.checked };
  } else {
    savedSites.push({ name: label, url: rawUrl, openInSafari: safIn.checked });
  }
  urlIn.value = "";
  nameIn.value = "";
  await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedSites })
  });
  renderSavedSitesUI();
  flashToast("Website Saved!");
};

let swLoaded = false;
async function loadSw(onlyPeeks){
  try {
    const r = await fetch("/api/acaat", { cache: "no-store" });
    const d = await r.json();
    if (!onlyPeeks && !swLoaded){
      swLoaded = true;
      if (Array.isArray(d.savedSites)) savedSites = d.savedSites;
      document.getElementById("swMode").value = d.mode || "seq";
      syncSwPills();
      document.getElementById("swSingle").value = p2(d.singleTarget ?? 18);
      document.querySelectorAll(".sw-slot").forEach(inp => {
        const v = (d.targets || [])[Number(inp.dataset.i)];
        inp.value = (v !== null && v !== undefined) ? p2(v) : "";
      });
      document.getElementById("swScramble").checked = !!d.scrambleLotto;
      document.getElementById("swTrigger").value = d.triggerOn || "both";
      document.getElementById("swDisarm").checked = !!d.autoDisarm;
      document.getElementById("swLeftUrl").value = d.leftRedirectUrl || "dice";
      document.getElementById("swLeftSafari").checked = !!d.leftOpenSafari;
      document.getElementById("swRightUrl").value = d.rightRedirectUrl || d.customSiteUrl || "";
      document.getElementById("swRightSafari").checked = !!(d.rightOpenSafari ?? d.openInSafari);
      document.getElementById("swIcontrolUrl").value = d.icontrolUrl || "https://icontrol-magic.onrender.com/";
      document.getElementById("swIcontrolSafari").checked = (d.icontrolOpenSafari !== false);
      renderSavedSitesUI();
    }
    const em = d.emergence || [];
    if (em.length){
      const sum = em.reduce((acc, it) => acc + (Number(it.largeInt) || 0), 0);
      latestEmSum = sum;
      document.getElementById("emSum").textContent = String(sum);
      document.getElementById("emSlots").textContent = em.map((it, idx) => \`#\${idx+1}: \${it.formatted} (\${it.largeInt})\`).join("  •  ");
    } else {
      latestEmSum = 0;
      document.getElementById("emSum").textContent = "—";
      document.getElementById("emSlots").textContent = "No Reset times locked yet";
    }
    const peeks = d.peeks || [];
    if (peeks.length){
      const latest = peeks[0];
      document.getElementById("liveShown").textContent = latest.shownFormatted;
      document.getElementById("liveInt").textContent = \`Number: \${latest.largeInt ?? ""}\`;
      document.getElementById("liveBreakdown").textContent = \`Sec: \${latest.sec ?? 0} | Dec: .\${p2(latest.cs ?? 0)}\`;
      document.getElementById("peekLog").textContent = peeks.map(
        p => \`[\${p.at}] \${p.type}: \${p.shownFormatted} (\${p.largeInt ?? ""})\`
      ).join("\\n");
    } else {
      document.getElementById("liveShown").textContent = "—";
      document.getElementById("liveInt").textContent = "Number: —";
      document.getElementById("liveBreakdown").textContent = "Sec: — | Dec: —";
      document.getElementById("peekLog").textContent = "Waiting for spectator stops...";
    }
  } catch(e){}
}

async function loadCalc(){
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    const d = await r.json();
    if (Array.isArray(d.savedSites)) savedSites = d.savedSites;
    document.getElementById("cMode").value = String(d.mode ?? 2);
    syncCalcPills();
    document.getElementById("cFixed").value = d.fixed || "";
    document.getElementById("cOffset").value = d.offset ?? 60;
    document.getElementById("cChunk").value = String(d.chunk ?? 1);
    document.getElementById("cHold").value = d.hold ?? 0.5;
    document.getElementById("cAutoOp").checked = !!d.autoOpOnLock;
    document.getElementById("cHintStyle").value = d.hintStyle || "both";
    document.getElementById("cClockUrl").value = d.clockSiteUrl || "";
    document.getElementById("cClockSafari").checked = !!d.clockOpenSafari;
    document.getElementById("cRedirect").value = d.redirectUrl || "https://icontrol-magic.onrender.com/";
    document.getElementById("cRedirectSafari").checked = (d.redirectOpenSafari !== false);
    document.getElementById("cAcUrl").value = d.acRedirectUrl || "dice";
    document.getElementById("cAcSafari").checked = !!d.acOpenSafari;
    renderSavedSitesUI();
  } catch(e){}
}

loadSw(false);
loadCalc();
setInterval(() => loadSw(true), 1500);

async function pushSwNow(toastText){
  const targets = [];
  document.querySelectorAll(".sw-slot").forEach(inp => {
    const raw = inp.value.trim();
    targets[Number(inp.dataset.i)] = raw === "" ? null : Number(raw);
  });
  const body = {
    mode: document.getElementById("swMode").value,
    singleTarget: Number(document.getElementById("swSingle").value || 0),
    targets,
    scrambleLotto: document.getElementById("swScramble").checked,
    triggerOn: document.getElementById("swTrigger").value,
    autoDisarm: document.getElementById("swDisarm").checked,
    leftRedirectUrl: document.getElementById("swLeftUrl").value.trim() || "dice",
    leftOpenSafari: document.getElementById("swLeftSafari").checked,
    rightRedirectUrl: document.getElementById("swRightUrl").value.trim(),
    rightOpenSafari: document.getElementById("swRightSafari").checked,
    icontrolUrl: document.getElementById("swIcontrolUrl").value.trim() || "https://icontrol-magic.onrender.com/",
    icontrolOpenSafari: document.getElementById("swIcontrolSafari").checked,
    savedSites
  };
  await fetch("/api/acaat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast(toastText || "Stopwatch Updated Live!");
}

async function pushCalcNow(toastText){
  const body = {
    mode: Number(document.getElementById("cMode").value),
    fixed: document.getElementById("cFixed").value,
    offset: Number(document.getElementById("cOffset").value),
    chunk: Number(document.getElementById("cChunk").value),
    hold: Number(document.getElementById("cHold").value),
    autoOpOnLock: document.getElementById("cAutoOp").checked,
    hintStyle: document.getElementById("cHintStyle").value,
    clockSiteUrl: document.getElementById("cClockUrl").value.trim(),
    clockOpenSafari: document.getElementById("cClockSafari").checked,
    redirectUrl: document.getElementById("cRedirect").value.trim(),
    redirectOpenSafari: document.getElementById("cRedirectSafari").checked,
    acRedirectUrl: document.getElementById("cAcUrl").value.trim() || "dice",
    acOpenSafari: document.getElementById("cAcSafari").checked,
    savedSites
  };
  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast(toastText || "Calculator Updated Live!");
}

document.querySelectorAll("#swModePills .mpill").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("swMode").value = btn.dataset.mode;
    syncSwPills();
    pushSwNow("Stopwatch Mode: " + btn.textContent);
  };
});
document.getElementById("swMode").onchange = () => {
  syncSwPills();
  pushSwNow("Stopwatch Mode Updated!");
};
document.getElementById("swShuffleBtn").onclick = () => {
  const inputs = Array.from(document.querySelectorAll(".sw-slot"));
  const vals = inputs.map(inp => inp.value.trim()).filter(v => v !== "");
  for (let i = vals.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  inputs.forEach((inp, idx) => {
    inp.value = vals[idx] !== undefined ? p2(Number(vals[idx])) : "";
  });
  pushSwNow("Lotto Numbers Scrambled Live!");
};
["swLeftSafari","swRightSafari","swIcontrolSafari","swScramble","swDisarm","swTrigger","swLeftUrl","swRightUrl","swIcontrolUrl"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.onchange = () => pushSwNow("Stopwatch Setting Saved Live!");
});

document.querySelectorAll("#cModePills .mpill").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("cMode").value = btn.dataset.mode;
    syncCalcPills();
    pushCalcNow("Calculator Mode: " + btn.textContent);
  };
});
document.getElementById("cMode").onchange = () => {
  syncCalcPills();
  pushCalcNow("Calculator Mode Updated!");
};
["cAutoOp","cHintStyle","cChunk","cClockSafari","cRedirectSafari","cAcSafari","cClockUrl","cRedirect","cAcUrl"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.onchange = () => pushCalcNow("Calculator Setting Saved Live!");
});

document.getElementById("pushSumToCalcBtn").onclick = async () => {
  if (!latestEmSum){
    flashToast("No Reset Sum Yet!");
    return;
  }
  document.getElementById("cMode").value = "1";
  document.getElementById("cFixed").value = String(latestEmSum);
  syncCalcPills();
  await pushCalcNow("Calc Fixed Set to " + latestEmSum + "!");
};

document.getElementById("saveSwBtn").onclick = () => pushSwNow("Stopwatch Updated Live!");

document.getElementById("clearPeeksBtn").onclick = async () => {
  await fetch("/api/acaat/clear-peeks", { method: "POST" });
  loadSw(true);
};

document.getElementById("saveCalcBtn").onclick = () => pushCalcNow("Calculator Updated Live!");

document.getElementById("resetSwModeBtn").onclick = async () => {
  swLoaded = false;
  await fetch("/api/acaat/reset-mode", { method: "POST" });
  await loadSw(false);
  flashToast("Stopwatch Modes Reset (Redirects Kept)!");
};

document.getElementById("resetCalcModeBtn").onclick = async () => {
  await fetch("/api/config/reset-mode", { method: "POST" });
  await loadCalc();
  flashToast("Calculator Modes Reset (Redirects Kept)!");
};

document.getElementById("resetAllModesBtn").onclick = async () => {
  swLoaded = false;
  await fetch("/api/reset-all-modes", { method: "POST" });
  await loadSw(false);
  await loadCalc();
  flashToast("All Modes Reset (Redirects Kept)!");
};

document.getElementById("resetAllDefaultsBtn").onclick = async () => {
  if (!confirm("Reset ALL settings for Calculator and Stopwatch to Robert's exact defaults?")) return;
  swLoaded = false;
  await fetch("/api/reset-all-defaults", { method: "POST" });
  await loadSw(false);
  await loadCalc();
  flashToast("Everything Reset to Robert's Exact Defaults!");
};

const DEFAULT_AI_PROMPT = "You are an expert mentalism pricing assistant. Given the input item, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). If web search information is provided, use it critically to identify the single unit retail price. Round to a clean whole number without cents or currency symbols. Return ONLY the integer with no words, markdown, or punctuation.";

async function loadIntegrationsConfig(){
  try {
    const r = await fetch("/api/integrations/config", { cache: "no-store" });
    const d = await r.json();
    if (d && d.integrations){
      const it = d.integrations;
      document.getElementById("aiApiUrl").value = it.apiUrl || "";
      const ap = document.getElementById("aiAutoPoll");
      if (ap) ap.checked = (it.autoPoll !== false);
      document.getElementById("aiTargetField").value = it.targetField || "data";
      document.getElementById("aiGeminiKey").value = it.geminiApiKey || "";
      document.getElementById("aiGeminiModel").value = it.geminiModel || "gemini-1.5-flash";
      document.getElementById("aiTavilyKey").value = it.tavilyApiKey || "";
      document.getElementById("aiSerpKey").value = it.serpApiKey || "";
      document.getElementById("aiPrompt").value = it.prompt || DEFAULT_AI_PROMPT;

      renderAiLogs(it.lastLogs);
    }
  } catch(e){}
}

function renderAiLogs(logs){
  const el = document.getElementById("aiLogList");
  if (!logs || !logs.length){
    el.textContent = "No peeks grabbed yet. Paste your Inject API URL above to start!";
    return;
  }
  el.textContent = logs.map(l => {
    const time = new Date(l.ts).toLocaleTimeString();
    return "[" + time + '] "' + (l.input || "") + '" -> FORCED: $' + (l.price || 0) + ' (' + (l.source || "") + ')';
  }).join(String.fromCharCode(10));
}

async function saveInjectConfigHelper(){
  const apiUrl = (document.getElementById("aiApiUrl").value || "").trim();
  const targetField = (document.getElementById("aiTargetField").value || "").trim() || "data";
  try {
    const res = await fetch("/api/integrations/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiUrl, targetField, autoPoll: true })
    });
    const d = await res.json();
    return d.ok;
  } catch(e) {
    return false;
  }
}

document.getElementById("aiApiUrl").onblur = () => {
  if (document.getElementById("aiApiUrl").value.trim()) saveInjectConfigHelper();
};
document.getElementById("aiTargetField").onblur = () => {
  saveInjectConfigHelper();
};

document.getElementById("saveInjectConfigBtn").onclick = async () => {
  const ok = await saveInjectConfigHelper();
  if (ok) {
    flashToast("Inject API Settings Saved & Active!");
    loadIntegrationsConfig();
  } else {
    flashToast("Error saving settings");
  }
};

document.getElementById("pollApiNowBtn").onclick = async () => {
  const btn = document.getElementById("pollApiNowBtn");
  const apiUrl = (document.getElementById("aiApiUrl").value || "").trim();
  const targetField = (document.getElementById("aiTargetField").value || "").trim() || "data";

  if (!apiUrl) {
    flashToast("Please paste your Inject API URL first!");
    document.getElementById("aiApiUrl").focus();
    return;
  }

  btn.textContent = "Checking...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/integrations/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiUrl, targetField })
    });
    const data = await res.json();
    if (data.ok) {
      flashToast('Inject Peek: "' + (data.input || "") + '" -> Forced: $' + Number(data.forceNumber).toLocaleString());
      loadCalc();
      loadIntegrationsConfig();
    } else {
      alert("Inject API Error: " + (data.error || "Failed to fetch from Inject API"));
    }
  } catch(err) {
    alert("Connection Error: " + err.message);
  } finally {
    btn.textContent = "⚡ Check Inject API Now";
    btn.disabled = false;
  }
};

document.getElementById("resetPromptBtn").onclick = () => {
  document.getElementById("aiPrompt").value = DEFAULT_AI_PROMPT;
  flashToast("Prompt Reset to Default!");
};

document.getElementById("saveAiConfigBtn").onclick = async () => {
  const body = {
    apiUrl: document.getElementById("aiApiUrl").value.trim(),
    autoPoll: true,
    targetField: document.getElementById("aiTargetField").value.trim() || "data",
    geminiApiKey: document.getElementById("aiGeminiKey").value.trim(),
    geminiModel: document.getElementById("aiGeminiModel").value,
    tavilyApiKey: document.getElementById("aiTavilyKey").value.trim(),
    serpApiKey: document.getElementById("aiSerpKey").value.trim(),
    prompt: document.getElementById("aiPrompt").value.trim() || DEFAULT_AI_PROMPT
  };
  try {
    const res = await fetch("/api/integrations/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      flashToast("Inject API & AI Keys Saved!");
    } else {
      flashToast("Error saving config");
    }
  } catch(e){
    flashToast("Save failed");
  }
};

document.getElementById("runAiTestBtn").onclick = async () => {
  const input = document.getElementById("aiTestInput").value.trim();
  if (!input) {
    flashToast("Enter an item to test!");
    return;
  }
  const btn = document.getElementById("runAiTestBtn");
  btn.textContent = "⏳ Researching & Pricing...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testInput: input })
    });
    const data = await res.json();
    if (data.ok && data.result) {
      const r = data.result;
      document.getElementById("aiTestResultBox").style.display = "block";
      document.getElementById("aiResultPrice").textContent = "$" + Number(r.price).toLocaleString();
      document.getElementById("aiResultMeta").textContent = "Forced on Calc: " + r.price + " | Source: " + r.source;
      flashToast("SmartCalc Armed with $" + Number(r.price).toLocaleString() + "!");
      loadCalc();
      loadIntegrationsConfig();
    } else {
      alert("AI Pipeline Error: " + (data.error || "Unknown error"));
    }
  } catch(err) {
    alert("Connection error: " + err.message);
  } finally {
    btn.textContent = "⚡ Test AI Pipeline & Force Price";
    btn.disabled = false;
  }
};

loadIntegrationsConfig();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("Magic Remote Backend running on port " + PORT);
});
