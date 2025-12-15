import * as webllm from "https://esm.run/@mlc-ai/web-llm";
import { injectBaseStyles } from "./styles.js";
import {
  CONTEXTS,
  buildSystemPrompt,
} from "./context.js";


/* ===================== Styles ===================== */
injectBaseStyles();

/* ===================== SHARED CONVERSATION CONTEXT ===================== */
const SHARED_CONVERSATION_CONTEXT = `
Rules:
- If the user request is outside the selected context, reply exactly:
  "Refused: out of context."
- Always include a certainty level at the end of the answer:
  Certainty: high | medium | low
- If unsure, prefer refusing rather than inventing.
`;

/* ===================== CONTEXTS ===================== */

 
/* ===================== STATE (ALL PARAMETERS) ===================== */
const STATE = {
  temperature: 0.2,
  top_p: 0.9,
  useHistory: false, // reserved for later
  maxPromptChars: 2000, // STANDARD SAFE LIMIT
};

let engine = null;
let modelLoaded = false;
let selectedContext = "encyclopedia";
let loadingStartTime = 0;
let loadingInterval = null;
let wakeLock = null;

/* ===================== DOM ===================== */
const modelSelect = document.getElementById("model-select");
const contextSelect = document.getElementById("context-select");
const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const downloadBtn = document.getElementById("download-model");

/* Prompt length indicator */
const lengthWarning = document.createElement("span");
lengthWarning.className = "length-warning";
userInput.after(lengthWarning);

/* Loading indicator */
const loadingEl = document.createElement("span");
loadingEl.className = "loading";
loadingEl.style.display = "none";
sendBtn.after(loadingEl);

/* ===================== UI Helpers ===================== */
function updateSendState() {
  const tooLong = userInput.value.length > STATE.maxPromptChars;
  sendBtn.disabled =
    !engine || !modelLoaded || !selectedContext || tooLong;
}



function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  chatBox.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

function addSeparator(text) {
  const div = document.createElement("div");
  div.className = "separator";
  div.textContent = text;
  chatBox.appendChild(div);
}

function startLoadingTimer(label = "Loading") {
  loadingStartTime = performance.now();
  loadingEl.style.display = "inline";
  loadingEl.textContent = `${label}… 0.0s`;

  loadingInterval = setInterval(() => {
    const elapsed = (performance.now() - loadingStartTime) / 1000;
    loadingEl.textContent = `${label}… ${elapsed.toFixed(1)}s`;
  }, 100);
}

function stopLoadingTimer(finalLabel = "Done") {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  loadingEl.textContent = finalLabel;
  setTimeout(() => {
    loadingEl.style.display = "none";
  }, 300);
}

async function requestScreenWakeLock() {
  if (!("wakeLock" in navigator)) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // Permission denied or unsupported – fail silently
  }
}

async function releaseScreenWakeLock() {
  try {
    await wakeLock?.release();
  } catch {}
  wakeLock = null;
}


/* ===================== Context UI ===================== */
function populateContexts() {
  contextSelect.innerHTML = "";

  Object.entries(CONTEXTS).forEach(([key, ctx]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = ctx.label;
    contextSelect.appendChild(opt);
  });

  contextSelect.value = "general";
  selectedContext = "general";
}
/* ===================== Models ===================== */
async function isModelDownloaded(modelId) {
  try {
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

async function populateModels() {
  modelSelect.innerHTML = "";
  for (const m of webllm.prebuiltAppConfig.model_list) {
    const cached = await isModelDownloaded(m.model_id);
    const opt = document.createElement("option");
    opt.value = m.model_id;
    opt.textContent = `${cached ? "✅" : "❌"} ${m.model_id}`;
    modelSelect.appendChild(opt);
  }
}

/* ===================== Engine ===================== */
async function initEngine() {
  engine = new webllm.MLCEngine();
}

async function loadModel() {
  modelLoaded = false;
  updateSendState();

  await requestScreenWakeLock();
  startLoadingTimer("Loading model");

  try {
    await engine.reload(modelSelect.value, {
      temperature: STATE.temperature,
      top_p: STATE.top_p,
    });

    modelLoaded = true;
    await populateModels();
    stopLoadingTimer("Model ready");
  } catch (err) {
    stopLoadingTimer("Load failed");
    console.error("Model load error:", err);
  } finally {
    await releaseScreenWakeLock();
    updateSendState();
  }
}

/* ===================== Prompt Length Guard ===================== */
userInput.addEventListener("input", () => {
  const len = userInput.value.length;
  if (len > STATE.maxPromptChars) {
    lengthWarning.textContent = `Text too long (${len} / ${STATE.maxPromptChars} characters)`;
  } else {
    lengthWarning.textContent = "";
  }
  updateSendState();
});

/* ===================== Chat ===================== */
async function sendMessage() {
  if (!engine || !modelLoaded) return;

  const prompt = userInput.value.trim();
  if (!prompt) return;

  addSeparator("— New conversation  —");
  addMessage("user", prompt);
  userInput.value = "";
  lengthWarning.textContent = "";

  startLoadingTimer("Generating");
  sendBtn.disabled = true;

  try {
    const start = performance.now();

    const completion = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(selectedContext),

        },
        { role: "user", content: prompt },
      ],
    });

    const end = performance.now();
    const text = completion.choices[0].message.content;
    const usage = completion.usage;

    addMessage(
      "assistant",
      `${text}

[model=${modelSelect.value}, latency=${(end - start).toFixed(
        0,
      )}ms, prompt_tokens=${usage.prompt_tokens}, completion_tokens=${usage.completion_tokens}]`,
    );
  } catch (err) {
    const msg =
      String(err).includes("token") || String(err).includes("context")
        ? "⚠️ Error: prompt too large for this model."
        : "⚠️ Error or refusal.";
    addMessage("assistant", msg);
  } finally {
    stopLoadingTimer();
    updateSendState();
  }
}

/* ===================== Init ===================== */

async function autoLoadCachedModel() {
  const models = webllm.prebuiltAppConfig.model_list;

  for (const m of models) {
    try {
      const cached = await webllm.hasModelInCache(m.model_id);
      if (cached) {
        modelSelect.value = m.model_id;
        await loadModel(); // your existing load function
        return;
      }
    } catch {}
  }

  // No cached model → keep Send disabled
  updateSendState();
}



(async function bootstrap() {
  populateContexts();
  await populateModels();
  await initEngine();
  await autoLoadCachedModel();
  updateSendState();

  downloadBtn.onclick = loadModel;

  contextSelect.onchange = (e) => {
    selectedContext = e.target.value;
    addSeparator(
      `— Context changed to: ${selectedContext.toUpperCase()} —`,
    );
    updateSendState();
  };

  sendBtn.onclick = sendMessage;
})();

