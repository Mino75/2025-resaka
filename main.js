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

/* Status indicator */
const statusEl = document.createElement("span");
statusEl.className = "status";
statusEl.style.display = "none";
sendBtn.after(statusEl);

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

function startLoadingTimer() {
  loadingStartTime = performance.now();
  loadingEl.style.display = "inline";
  loadingEl.textContent = "0.0s elapsed";

  loadingInterval = setInterval(() => {
    const elapsed = (performance.now() - loadingStartTime) / 1000;
    loadingEl.textContent = `${elapsed.toFixed(1)}s elapsed`;
  }, 100);
}

function stopLoadingTimer(finalLabel = "Done") {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }

  statusEl.textContent = finalLabel;
  loadingEl.textContent = "";

  setTimeout(() => {
    statusEl.style.display = "none";
    loadingEl.style.display = "none";
  }, 400);
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

function addCopyButton(messageDiv) {
  const copyBtn = document.createElement("span");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "📋";
  copyBtn.title = "Copy to clipboard";

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(messageDiv.textContent);
      copyBtn.textContent = "✅";
      setTimeout(() => (copyBtn.textContent = "📋"), 800);
    } catch {
      copyBtn.textContent = "❌";
      setTimeout(() => (copyBtn.textContent = "📋"), 800);
    }
  };

  messageDiv.appendChild(copyBtn);
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

    engine.setInitProgressCallback((report) => {
    statusEl.style.display = "inline";
    statusEl.textContent = report.text;
  });
  
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

  // Create assistant message container
  const assistantDiv = document.createElement("div");
  assistantDiv.className = "message assistant";

  // Streamed text (updated incrementally)
  const textSpan = document.createElement("span");
  assistantDiv.appendChild(textSpan);

  // Metadata (filled once at the end)
  const metaDiv = document.createElement("div");
  metaDiv.className = "message-meta";
  metaDiv.style.display = "none";
  assistantDiv.appendChild(metaDiv);

  // Copy button (exists from start, shown at end)
  const copyBtn = document.createElement("span");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "📋";
  copyBtn.title = "Copy to clipboard";
  copyBtn.style.display = "none";

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(textSpan.textContent);
      copyBtn.textContent = "✅";
      setTimeout(() => (copyBtn.textContent = "📋"), 800);
    } catch {
      copyBtn.textContent = "❌";
      setTimeout(() => (copyBtn.textContent = "📋"), 800);
    }
  };

  assistantDiv.appendChild(copyBtn);
  chatBox.appendChild(assistantDiv);
  assistantDiv.scrollIntoView({ behavior: "smooth", block: "end" });

  startLoadingTimer("Generating");
  sendBtn.disabled = true;

  try {
    let accumulatedText = "";
    let usage = null;
    const start = performance.now();

    const completion = await engine.chat.completions.create({
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(selectedContext),
        },
        { role: "user", content: prompt },
      ],
    });

    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        accumulatedText += delta;
        textSpan.textContent = accumulatedText;
        assistantDiv.scrollIntoView({ behavior: "smooth", block: "end" });
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    const end = performance.now();

    if (usage) {
      metaDiv.textContent =
        `[model=${modelSelect.value}, latency=${(end - start).toFixed(0)}ms, ` +
        `prompt_tokens=${usage.prompt_tokens}, completion_tokens=${usage.completion_tokens}]`;
      metaDiv.style.display = "block";
    }
  } catch (err) {
    textSpan.textContent =
      String(err).includes("token") || String(err).includes("context")
        ? "⚠️ Error: prompt too large for this model."
        : "⚠️ Error or refusal.";
  } finally {
    stopLoadingTimer();
    updateSendState();

    if (textSpan.textContent.trim()) {
      copyBtn.style.display = "inline";
    }
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
  // await autoLoadCachedModel(); multiple loads breaks WebGPU - wait  for improvement of the WEBLLM
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





