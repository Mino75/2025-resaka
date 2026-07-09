import * as webllm from "./web-llm.js";
import { injectBaseStyles } from "./styles.js";
import { CONTEXTS, buildSystemPrompt } from "./context.js";

/* ===================== Styles ===================== */
injectBaseStyles();

/* ===================== STATE ===================== */
const STATE = {
  temperature: 0.2,
  top_p: 0.9,
  useHistory: false,
  maxPromptChars: 2000,
};

const STORAGE_KEYS = {
  selectedModelId: "resaka_selected_model_id",
  loadedModelId: "resaka_loaded_model_id",
  selectedContext: "resaka_selected_context",
};

let engine = null;
let modelLoaded = false;
let loadedModelId = localStorage.getItem(STORAGE_KEYS.loadedModelId) || null;
let selectedContext = localStorage.getItem(STORAGE_KEYS.selectedContext) || "general";
let loadingStartTime = 0;
let loadingInterval = null;
let wakeLock = null;
let isGenerating = false;
let isLoadingModel = false;
let lastAssistantAnswer = "";

/* ===================== DOM ===================== */
const modelSelect = document.getElementById("model-select");
const contextSelect = document.getElementById("context-select");
const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const downloadBtn = document.getElementById("download-model");

let deleteModelBtn = document.getElementById("delete-model");

if (!deleteModelBtn) {
  deleteModelBtn = document.createElement("button");
  deleteModelBtn.id = "delete-model";
  deleteModelBtn.textContent = "Delete model";
  downloadBtn.after(deleteModelBtn);
}

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

/* ===================== Voice + Keyboard ===================== */
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

const voiceBtn = document.createElement("button");
voiceBtn.textContent = "🎙️";
voiceBtn.title = "Speak prompt";

const readBtn = document.createElement("button");
readBtn.textContent = "🔊";
readBtn.title = "Read last answer";

const actionRow = document.createElement("div");
actionRow.className = "action-row";

sendBtn.parentNode.insertBefore(actionRow, sendBtn);
actionRow.append(voiceBtn, sendBtn, readBtn);

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    let text = "";

    for (const result of event.results) {
      text += result[0].transcript;
    }

    userInput.value = text;
    updateSendState();
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
  };

  voiceBtn.onclick = () => recognition.start();
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Speech recognition not supported";
}

function readText(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  speechSynthesis.speak(utterance);
}

readBtn.onclick = () => {
  if (lastAssistantAnswer.trim()) {
    readText(lastAssistantAnswer);
  }
};

userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();

    if (!sendBtn.disabled) {
      sendMessage();
    }
  }
});

/* ===================== UI Helpers ===================== */
function setStatus(text, visible = true) {
  statusEl.textContent = text;
  statusEl.style.display = visible ? "inline" : "none";
}

function updateSendState() {
  const tooLong = userInput.value.length > STATE.maxPromptChars;
  const selectedModelId = modelSelect.value;

  sendBtn.disabled =
    !engine ||
    !modelLoaded ||
    !selectedContext ||
    tooLong ||
    isGenerating ||
    isLoadingModel ||
    selectedModelId !== loadedModelId;

  downloadBtn.disabled = !engine || isGenerating || isLoadingModel;

  deleteModelBtn.disabled =
    !modelSelect.value || isGenerating || isLoadingModel;
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

  setStatus(finalLabel, true);
  loadingEl.textContent = "";

  setTimeout(() => {
    statusEl.style.display = "none";
    loadingEl.style.display = "none";
  }, 700);
}

async function requestScreenWakeLock() {
  if (!("wakeLock" in navigator)) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {}
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

  if (CONTEXTS[selectedContext]) {
    contextSelect.value = selectedContext;
  } else {
    contextSelect.value = "general";
    selectedContext = "general";
  }
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
  const savedSelectedModelId =
    localStorage.getItem(STORAGE_KEYS.selectedModelId) || modelSelect.value;

  modelSelect.innerHTML = "";

  for (const m of webllm.prebuiltAppConfig.model_list) {
    const cached = await isModelDownloaded(m.model_id);
    const opt = document.createElement("option");
    opt.value = m.model_id;
    opt.textContent = `${cached ? "✅" : "❌"} ${m.model_id}`;
    modelSelect.appendChild(opt);
  }

  if (savedSelectedModelId) {
    const exists = [...modelSelect.options].some(
      (opt) => opt.value === savedSelectedModelId,
    );

    if (exists) {
      modelSelect.value = savedSelectedModelId;
    }
  }
}

function rememberSelectedModel() {
  if (modelSelect.value) {
    localStorage.setItem(STORAGE_KEYS.selectedModelId, modelSelect.value);
  }
}

function markModelLoaded(modelId) {
  modelLoaded = true;
  loadedModelId = modelId;
  localStorage.setItem(STORAGE_KEYS.loadedModelId, modelId);
}

function markModelUnloaded() {
  modelLoaded = false;
  loadedModelId = null;
  localStorage.removeItem(STORAGE_KEYS.loadedModelId);
}

/* ===================== Engine ===================== */
async function initEngine() {
  engine = new webllm.MLCEngine();

  engine.setInitProgressCallback((report) => {
    setStatus(report.text, true);
  });
}

async function loadModel() {
  if (isGenerating || isLoadingModel) return;

  const selectedModelId = modelSelect.value;
  if (!selectedModelId) return;

  isLoadingModel = true;
  modelLoaded = false;
  rememberSelectedModel();
  updateSendState();

  await requestScreenWakeLock();
  startLoadingTimer();

  try {
    await engine.reload(selectedModelId, {
      temperature: STATE.temperature,
      top_p: STATE.top_p,
    });

    markModelLoaded(selectedModelId);

    await populateModels();
    modelSelect.value = selectedModelId;

    stopLoadingTimer("Model ready");
  } catch (err) {
    markModelUnloaded();
    stopLoadingTimer("Load failed");
    console.error("Model load error:", err);
  } finally {
    isLoadingModel = false;
    await releaseScreenWakeLock();
    updateSendState();
  }
}

async function checkCurrentModelState() {
  const selectedModelId = modelSelect.value;
  const savedLoadedModelId = localStorage.getItem(STORAGE_KEYS.loadedModelId);

  rememberSelectedModel();

  if (!engine || !selectedModelId || selectedModelId !== savedLoadedModelId) {
    modelLoaded = false;
    updateSendState();
    return;
  }

  try {
    setStatus("Checking model state…", true);

    await engine.chat.completions.create({
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    });

    markModelLoaded(selectedModelId);
    setStatus("Model ready", true);
  } catch {
    modelLoaded = false;
    loadedModelId = savedLoadedModelId;
    setStatus("Model needs reload", true);
  } finally {
    updateSendState();

    setTimeout(() => {
      statusEl.style.display = "none";
    }, 700);
  }
}

async function deleteSelectedModel() {
  if (isGenerating || isLoadingModel) return 0;

  const modelId = modelSelect.value;
  if (!modelId) return 0;

  if (modelId === loadedModelId) {
    markModelUnloaded();

    try {
      await engine?.unload?.();
    } catch {}
  }

  let deletedCount = 0;

  if ("caches" in window) {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      for (const request of requests) {
        if (request.url.includes(modelId)) {
          await cache.delete(request);
          deletedCount++;
        }
      }
    }
  }

  await populateModels();
  modelSelect.value = modelId;
  updateSendState();

  return deletedCount;
}

/* ===================== Prompt Length Guard ===================== */
userInput.addEventListener("input", () => {
  const len = userInput.value.length;

  if (len > STATE.maxPromptChars) {
    lengthWarning.textContent =
      `Text too long (${len} / ${STATE.maxPromptChars} characters)`;
  } else {
    lengthWarning.textContent = "";
  }

  updateSendState();
});

/* ===================== Chat ===================== */
async function sendMessage() {
  if (isGenerating) return;
  if (!engine || !modelLoaded) return;
  if (modelSelect.value !== loadedModelId) return;

  const prompt = userInput.value.trim();
  if (!prompt) return;

  isGenerating = true;
  sendBtn.disabled = true;

  addSeparator("— New conversation —");
  addMessage("user", prompt);
  userInput.value = "";
  lengthWarning.textContent = "";

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "message assistant";

  const textSpan = document.createElement("span");
  assistantDiv.appendChild(textSpan);

  const metaDiv = document.createElement("div");
  metaDiv.className = "message-meta";
  metaDiv.style.display = "none";
  assistantDiv.appendChild(metaDiv);

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
  assistantDiv.scrollIntoView({ behavior: "auto", block: "start" });

  startLoadingTimer();

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
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta?.content;

      if (delta) {
        accumulatedText += delta;
        textSpan.textContent = accumulatedText;
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    lastAssistantAnswer = accumulatedText;

    const end = performance.now();

    if (usage) {
      metaDiv.textContent =
        `[model=${loadedModelId}, latency=${(end - start).toFixed(0)}ms, ` +
        `prompt_tokens=${usage.prompt_tokens}, completion_tokens=${usage.completion_tokens}]`;
      metaDiv.style.display = "block";
    }
  } catch (err) {
    console.error("Generation error:", err);

    const message = err?.stack || err?.message || String(err);

    textSpan.textContent =
      /token|context/i.test(message)
        ? "⚠️ Error: prompt too large for this model.\n\n" + message.slice(0, 800)
        : "⚠️ Generation failed:\n\n" + message.slice(0, 1200);
  } finally {
    isGenerating = false;
    stopLoadingTimer();
    updateSendState();

    if (textSpan.textContent.trim()) {
      copyBtn.style.display = "inline";
    }
  }
}

/* ===================== External Callable Functions ===================== */
/**
 * Functions callable by another iframe through window.postMessage.
 *
 * Message format:
 * {
 *   type: "resaka-action",
 *   requestId?: string,
 *   action: string,
 *   payload?: object
 * }
 *
 * Response format:
 * {
 *   type: "resaka-action-result",
 *   requestId: string | null,
 *   action: string,
 *   result: object
 * }
 */
const EXTERNAL_FUNCTIONS = {
  /**
   * Return the callable function list.
   *
   * Parameters:
   *   none
   *
   * Returns:
   *   functions: array of function metadata.
   */
  async describe() {
    return {
      ok: true,
      functions: [
        {
          name: "describe",
          description: "Return callable function metadata.",
          parameters: {},
        },
        {
          name: "fillPrompt",
          description: "Fill the user prompt input without sending it.",
          parameters: {
            text: "string. Text to place in the prompt input.",
          },
        },
        {
          name: "send",
          description: "Send the current prompt. Requires a loaded model and non-empty prompt.",
          parameters: {},
        },
        {
          name: "selectModel",
          description: "Select a model by exact model id. Does not load it.",
          parameters: {
            modelId: "string. Exact WebLLM model id.",
          },
        },
        {
          name: "loadModel",
          description: "Load the currently selected model. Downloads it if not cached.",
          parameters: {},
        },
        {
          name: "deleteModel",
          description: "Delete cached files for the currently selected model.",
          parameters: {},
        },
        {
          name: "selectContext",
          description: "Select a context by exact context id.",
          parameters: {
            contextId: "string. Exact context id from CONTEXTS.",
          },
        },
        {
          name: "listModels",
          description: "Return available model ids and cache/load state.",
          parameters: {},
        },
        {
          name: "listContexts",
          description: "Return available context ids.",
          parameters: {},
        },
      ],
    };
  },

  /**
   * Fill the prompt field.
   *
   * Parameters:
   *   text (string): prompt text.
   */
  async fillPrompt({ text = "" } = {}) {
    userInput.value = String(text);
    userInput.dispatchEvent(new Event("input"));
    updateSendState();

    return { ok: true, text: userInput.value };
  },

  /**
   * Send the current prompt.
   *
   * Parameters:
   *   none
   */
  async send() {
    if (sendBtn.disabled) {
      return { ok: false, error: "send_disabled" };
    }

    await sendMessage();
    return { ok: true };
  },

  /**
   * Select a model.
   *
   * Parameters:
   *   modelId (string): exact WebLLM model identifier.
   */
  async selectModel({ modelId = "" } = {}) {
    const id = String(modelId);
    const exists = [...modelSelect.options].some((opt) => opt.value === id);

    if (!exists) {
      return { ok: false, error: "model_not_found", modelId: id };
    }

    modelSelect.value = id;
    rememberSelectedModel();
    modelLoaded = id === loadedModelId;
    updateSendState();

    return {
      ok: true,
      modelId: id,
      loaded: modelLoaded,
    };
  },

  /**
   * Load the currently selected model.
   *
   * Parameters:
   *   none
   */
  async loadModel() {
    await loadModel();

    return {
      ok: modelLoaded,
      modelId: loadedModelId,
      loaded: modelLoaded,
    };
  },

  /**
   * Delete the currently selected model from browser cache.
   *
   * Parameters:
   *   none
   */
  async deleteModel() {
    const deletedCount = await deleteSelectedModel();

    return {
      ok: true,
      modelId: modelSelect.value,
      deletedCount,
    };
  },

  /**
   * Select assistant context.
   *
   * Parameters:
   *   contextId (string): exact context key from CONTEXTS.
   */
  async selectContext({ contextId = "" } = {}) {
    const id = String(contextId);
    const exists = [...contextSelect.options].some((opt) => opt.value === id);

    if (!exists) {
      return { ok: false, error: "context_not_found", contextId: id };
    }

    contextSelect.value = id;
    selectedContext = id;
    localStorage.setItem(STORAGE_KEYS.selectedContext, id);
    updateSendState();

    return {
      ok: true,
      contextId: id,
    };
  },

  /**
   * List available models.
   *
   * Parameters:
   *   none
   */
  async listModels() {
    const models = [];

    for (const opt of modelSelect.options) {
      models.push({
        modelId: opt.value,
        label: opt.textContent,
        selected: opt.value === modelSelect.value,
        loaded: opt.value === loadedModelId && modelLoaded,
        cached: await isModelDownloaded(opt.value),
      });
    }

    return { ok: true, models };
  },

  /**
   * List available contexts.
   *
   * Parameters:
   *   none
   */
  async listContexts() {
    return {
      ok: true,
      contexts: Object.entries(CONTEXTS).map(([id, ctx]) => ({
        contextId: id,
        label: ctx.label,
        selected: id === selectedContext,
      })),
    };
  },
};

window.addEventListener("message", async (event) => {
  const data = event.data || {};

  if (data.type !== "resaka-action") return;

  const action = data.action;
  const payload = data.payload || {};
  const fn = EXTERNAL_FUNCTIONS[action];

  let result;

  try {
    if (!fn) {
      result = { ok: false, error: "unknown_action", action };
    } else {
      result = await fn(payload);
    }
  } catch (err) {
    result = {
      ok: false,
      error: "action_failed",
      message: err?.message || String(err),
    };
  }

  event.source?.postMessage(
    {
      type: "resaka-action-result",
      requestId: data.requestId || null,
      action,
      result,
    },
    "*",
  );
});

/* ===================== Init ===================== */
async function restoreSelectionAndState() {
  const savedSelectedModelId =
    localStorage.getItem(STORAGE_KEYS.selectedModelId);

  if (savedSelectedModelId) {
    const exists = [...modelSelect.options].some(
      (opt) => opt.value === savedSelectedModelId,
    );

    if (exists) {
      modelSelect.value = savedSelectedModelId;
    }
  }

  await checkCurrentModelState();
}

window.addEventListener("pageshow", () => {
  checkCurrentModelState();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    checkCurrentModelState();
  }
});

(async function bootstrap() {
  populateContexts();
  await populateModels();
  await initEngine();
  await restoreSelectionAndState();

  downloadBtn.onclick = loadModel;

  deleteModelBtn.onclick = async () => {
    const deletedCount = await deleteSelectedModel();

    if (deletedCount > 0) {
      setStatus("Model deleted");
    } else {
      setStatus("Nothing deleted");
    }

    updateSendState();
  };

  modelSelect.onchange = () => {
    rememberSelectedModel();
    modelLoaded = modelSelect.value === loadedModelId;
    updateSendState();
  };

  contextSelect.onchange = (e) => {
    selectedContext = e.target.value;
    localStorage.setItem(STORAGE_KEYS.selectedContext, selectedContext);

    addSeparator(
      `— Context changed to: ${selectedContext.toUpperCase()} —`,
    );

    updateSendState();
  };

  sendBtn.onclick = sendMessage;

  updateSendState();
})();
