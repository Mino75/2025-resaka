export function injectBaseStyles() {
  const style = document.createElement("style");
  style.textContent = `
html, body {
  margin: 0;
  background: #0e0e11;
  color: #e6e6eb;
  font-family: Arial, sans-serif;
  font-size: 1.1rem;
}

select, textarea, button {
  background: #1a1a1f;
  color: #e6e6eb;
  border: 1px solid #333;
  font-size: 1.1rem;
}

.chat-container {
  height: 100vh;
  overflow-y: auto;
  padding: 12px;
  padding-bottom: 320px; /* deliberately large */
  box-sizing: border-box;
}

.message {
  max-width: 90%;
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
  width: 100%;
  min-height: 120px;
  font-size: 1.1rem;
  padding: 10px;
}

button {
  font-size: 1.1rem;
  padding: 12px 18px;
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

button {
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



