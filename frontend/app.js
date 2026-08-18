import { RetellWebClient } from "retell-client-js-sdk";

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const voicePanel = $(".voice-panel");
const callButton = $(".listen-btn");
const muteButton = $(".mute-btn");
const status = $("#voiceStatus");
const transcript = $("#voiceTranscript");
const client = new RetellWebClient();
let callActive = false;
let connecting = false;
let muted = false;

function setCallUI(state, message) {
  voicePanel.dataset.callState = state;
  status.textContent = message;
  connecting = state === "connecting";
  callButton.disabled = connecting;
  callButton.innerHTML = callActive ? "<span>■</span> End conversation" : connecting ? "<span>●</span> Connecting…" : "<span>●</span> Start conversation";
  muteButton.hidden = !callActive;
}

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/permission|microphone|notallowed/i.test(message)) return "Microphone access was blocked. Allow it and try again.";
  return message || "The call could not start. Please try again.";
}

async function startCall() {
  if (connecting || callActive) return;
  setCallUI("connecting", "CONNECTING TO AVERY");
  transcript.replaceChildren();
  try {
    const response = await fetch("/api/retell/web-call", { method: "POST", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.accessToken) throw new Error(payload.error || "Unable to create a secure call.");
    await client.startCall({ accessToken: payload.accessToken });
  } catch (error) {
    callActive = false;
    setCallUI("error", friendlyError(error));
  }
}

client.on("call_started", () => { callActive = true; setCallUI("live", "CALL LIVE · YOU CAN SPEAK"); });
client.on("call_ready", () => setCallUI("live", "AVERY IS LISTENING"));
client.on("agent_start_talking", () => setCallUI("speaking", "AVERY IS SPEAKING"));
client.on("agent_stop_talking", () => setCallUI("live", "AVERY IS LISTENING"));
client.on("update", (update) => {
  const items = Array.isArray(update?.transcript) ? update.transcript : [];
  transcript.replaceChildren(...items.map((item) => {
    const row = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = item.role === "agent" ? "AVERY · " : "YOU · ";
    row.append(label, document.createTextNode(item.content || ""));
    return row;
  }));
  transcript.scrollTop = transcript.scrollHeight;
});
client.on("call_ended", () => { callActive = false; muted = false; muteButton.textContent = "Mute"; setCallUI("ended", "CALL ENDED · START AGAIN ANYTIME"); });
client.on("error", (error) => { callActive = false; setCallUI("error", friendlyError(error)); client.stopCall(); });

$$('.voice-trigger').forEach((button) => button.addEventListener('click', () => { voicePanel.classList.add('open'); voicePanel.setAttribute('aria-hidden', 'false'); }));
$('.close-panel').addEventListener('click', () => { voicePanel.classList.remove('open'); voicePanel.setAttribute('aria-hidden', 'true'); });
callButton.addEventListener('click', () => callActive ? client.stopCall() : startCall());
muteButton.addEventListener('click', () => { muted = !muted; muted ? client.mute() : client.unmute(); muteButton.textContent = muted ? "Unmute" : "Mute"; status.textContent = muted ? "MICROPHONE MUTED" : "AVERY IS LISTENING"; });

const modal = $('#loginModal');
$$('[data-open-login]').forEach((button) => button.addEventListener('click', () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }));
$$('[data-close-login]').forEach((button) => button.addEventListener('click', () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }));
$('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); modal.classList.remove('open'); $('#dashboard').classList.add('open'); $('#dashboard').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; });
$('.logout').addEventListener('click', () => { $('#dashboard').classList.remove('open'); $('#dashboard').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; });
$$('.filters button').forEach((button) => button.addEventListener('click', () => { $$('.filters button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); const filter = button.dataset.filter; $$('.car-card').forEach((card) => card.style.display = filter === 'all' || card.classList.contains(filter) ? 'block' : 'none'); }));
window.addEventListener('mousemove', (event) => { $('.cursor-glow').style.left = `${event.clientX}px`; $('.cursor-glow').style.top = `${event.clientY}px`; });
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') { voicePanel.classList.remove('open'); modal.classList.remove('open'); } });
