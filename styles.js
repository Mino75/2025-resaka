export function injectBaseStyles() {
  const style = document.createElement("style");
  style.textContent = `
*,
*::before,
*::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  width: 100%;
  max-width: 100%;
  min-height: 100dvh;
  overflow-x: hidden;
  background: #0e0e11;
  color: #e6e6eb;
  font-family: Arial, sans-serif;
  font-size: 1.1rem;
}

header,
.controls,
.chat-container,
.input-bar {
  width: 100%;
  max-width: 100%;
}

header {
  padding: 12px;
}

h1 {
  margin: 0;
  font-size: 1.4rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
}

.controls select,
.controls button {
  flex: 1 1 140px;
  min-width: 0;
}

select,
textarea,
button {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background: #1a1a1f;
  color: #e6e6eb;
  border: 1px solid #333;
  font-size: 1.1rem;
}

.chat-container {
  height: 100dvh;
  overflow-y: auto;
  padding: 12px;
  padding-bottom: 190px;
}

.message {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  padding: 12px;
  margin: 10px 0;
  border-radius: 10px;
  white-space: pre-wrap;
}

.message.user {
  background: #2b6cb0;
}

.message.assistant {
  background: #1f2933;
}

.separator {
  text-align: center;
  opacity: 0.6;
  font-size: 1.1rem;
  margin: 14px 0;
  border-top: 1px solid #333;
  padding-top: 6px;
}

.input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 100vw;
  background: #0e0e11;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  font-size: 1.1rem;
  border-top: 1px solid #333;
}

#user-input {
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 48px;
  font-size: 1.1rem;
  line-height: 1.4;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #2a2a2a;
  color: #f0f0f0;
  outline: none;
}

textarea {
  min-height: 120px;
  padding: 10px;
}

button {
  padding: 12px 18px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
}

button:hover:not(:disabled) {
  background: #22222a;
  border-color: #555;
}

button:active:not(:disabled) {
  background: #2a2a33;
  transform: translateY(1px);
}

button:focus-visible {
  outline: 2px solid #4c9ffe;
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-row {
  display: flex;
  width: 100%;
  gap: 8px;
}

.action-row button {
  margin: 0;
  width: auto;
}

.action-row button:first-child,
.action-row button:last-child {
  flex: 0 0 56px;
}

.action-row button:nth-child(2) {
  flex: 1;
}

.length-warning {
  font-size: 1.1rem;
  color: #ff6b6b;
  margin-left: 4px;
}

.loading {
  font-size: 1.1rem;
  opacity: 0.7;
  margin-left: 8px;
}

.copy-btn {
  cursor: pointer;
  margin-left: 8px;
  opacity: 0.6;
  user-select: none;
  font-size: 1.1rem;
}

.copy-btn:hover {
  opacity: 1;
}

.copy-btn:active {
  transform: scale(0.95);
}
`;
  document.head.appendChild(style);
}
