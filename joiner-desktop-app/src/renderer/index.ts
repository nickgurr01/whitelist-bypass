type JoinerPlatform = 'wbstream' | 'telemost' | 'vk' | 'dion' | 'bitrix';

function detectPlatform(url: string): JoinerPlatform | null {
  const u = url.toLowerCase();
  if (!u) return null;
  if (u.includes('wbstream://') || u.includes('stream.wb.ru')) return 'wbstream';
  if (u.includes('telemost.yandex')) return 'telemost';
  if (u.includes('dion://') || u.includes('dion.vc')) return 'dion';
  if (u.includes('bitrix24') && u.includes('/video/')) return 'bitrix';
  return 'vk';
}

function platformLabel(p: JoinerPlatform | null): string {
  switch (p) {
    case 'wbstream': return 'WB Stream';
    case 'telemost': return 'Telemost';
    case 'vk': return 'VK';
    case 'dion': return 'DION';
    case 'bitrix': return 'Bitrix';
    default: return '-';
  }
}

interface Bridge {
  start(settings: any): Promise<{ ok: boolean; error?: string }>;
  stop(): Promise<{ ok: boolean }>;
  loadPresets(): Promise<{ path: string; exists: boolean; error?: string; activePreset: string; presets: Preset[] }>;
  savePresets(data: { activePreset: string; presets: Preset[] }): Promise<{ ok: boolean; error?: string }>;
  onLog(cb: (text: string) => void): void;
  onStatus(cb: (status: string) => void): void;
  onRunning(cb: (running: boolean) => void): void;
}
declare const bridge: Bridge;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const select = (id: string) => document.getElementById(id) as HTMLSelectElement;

const logEl = $('log') as HTMLPreElement;
const statusEl = $('status');
const startBtn = $('start') as HTMLButtonElement;
const stopBtn = $('stop') as HTMLButtonElement;
const downloadLogsBtn = $('downloadLogs') as HTMLImageElement;
const platformHint = $('platformHint');
const linkInput = input('link');

stopBtn.disabled = true;

downloadLogsBtn.addEventListener('click', () => {
  const blob = new Blob([logEl.textContent || ''], { type: 'text/plain' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'joiner-logs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

function refreshPlatformHint() {
  const p = detectPlatform(linkInput.value.trim());
  platformHint.textContent = `Detected platform: ${platformLabel(p)}`;
  platformHint.dataset.detected = p ?? '';
}
linkInput.addEventListener('input', refreshPlatformHint);
refreshPlatformHint();

const MAX_LOG_CHARS = 400000;
const LOG_TRIM_KEEP_CHARS = 200000;

function trimLogText(text: string): string {
  if (text.length <= MAX_LOG_CHARS) return text;
  const cut = text.length - LOG_TRIM_KEEP_CHARS;
  const newline = text.indexOf('\n', cut);
  return text.slice(newline === -1 ? cut : newline + 1);
}

function appendLog(text: string) {
  logEl.textContent = trimLogText((logEl.textContent || '') + text);
  logEl.scrollTop = logEl.scrollHeight;
}

bridge.onLog((text) => appendLog(text));
bridge.onStatus((s) => {
  statusEl.textContent = s;
  statusEl.dataset.state = s;
});
bridge.onRunning((running) => {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
});

startBtn.addEventListener('click', async () => {
  appendLog('\n[ui] starting joiner...\n');
  const link = linkInput.value.trim();
  if (!link) {
    appendLog('[ui] link is required\n');
    return;
  }
  const platform = detectPlatform(link);
  if (!platform) {
    appendLog('[ui] link does not look like a WB Stream or Telemost call\n');
    return;
  }
  const settings = {
    platform,
    link,
    displayName: input('displayName').value.trim() || 'Joiner',
    socksPort: parseInt(input('socksPort').value, 10) || 1080,
    socksUser: input('socksUser').value,
    socksPass: input('socksPass').value,
    tunnelMode: select('tunnelMode').value,
    vp8Fps: parseInt(input('vp8Fps').value, 10) || 24,
    vp8Batch: parseInt(input('vp8Batch').value, 10) || 30,
    resources: select('resources').value,
    dns: input('dns').value.trim() || '1.1.1.1,8.8.8.8',
    noTun: input('noTun').checked,
    dualTrack: input('dualTrack').checked,
    reliable: input('reliable').checked,
  };
  const r = await bridge.start(settings);
  if (!r.ok) appendLog(`[ui] start failed: ${r.error}\n`);
});

stopBtn.addEventListener('click', async () => {
  appendLog('\n[ui] stopping joiner...\n');
  await bridge.stop();
});

// Presets: named snapshots of the whole form, kept by the main process
// in presets.json next to the executable. Values are stored per element
// id so presets saved by older builds still load after fields are added
// or removed.
type PresetValues = Record<string, string | boolean>;

interface Preset {
  id: string;
  name: string;
  values: PresetValues;
}

const PRESET_FIELDS = [
  'link', 'displayName', 'socksPort', 'dns', 'socksUser', 'socksPass',
  'tunnelMode', 'resources', 'vp8Fps', 'vp8Batch',
  'noTun', 'dualTrack', 'reliable',
];

const presetSelect = select('preset');
const presetNameInput = input('presetName');
const presetSaveBtn = $('presetSave') as HTMLButtonElement;
const presetDeleteBtn = $('presetDelete') as HTMLButtonElement;
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;

let presets: Preset[] = [];

async function persistPresets(): Promise<boolean> {
  const r = await bridge.savePresets({ activePreset: presetSelect.value, presets });
  if (!r.ok) appendLog(`[ui] could not write presets file: ${r.error}\n`);
  return r.ok;
}

function readFormValues(): PresetValues {
  const values: PresetValues = {};
  for (const id of PRESET_FIELDS) {
    const el = field(id);
    values[id] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
  }
  return values;
}

function applyFormValues(values: PresetValues) {
  for (const id of PRESET_FIELDS) {
    const el = field(id);
    const value = values[id];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (typeof value === 'boolean') el.checked = value;
    } else if (typeof value === 'string') {
      // Skip select values whose option no longer exists.
      if (el instanceof HTMLSelectElement && !Array.from(el.options).some((o) => o.value === value)) continue;
      el.value = value;
    }
  }
  refreshPlatformHint();
}

function renderPresets(activeId: string) {
  presetSelect.replaceChildren(
    new Option('New preset', ''),
    ...presets.map((p) => new Option(p.name, p.id)),
  );
  presetSelect.value = presets.some((p) => p.id === activeId) ? activeId : '';
  presetDeleteBtn.disabled = !presetSelect.value;
}

function applySelectedPreset() {
  const preset = presets.find((p) => p.id === presetSelect.value);
  presetNameInput.value = preset?.name ?? '';
  presetDeleteBtn.disabled = !preset;
  if (preset) applyFormValues(preset.values);
}

presetSelect.addEventListener('change', () => {
  applySelectedPreset();
  persistPresets();
});

presetSaveBtn.addEventListener('click', async () => {
  const detected = detectPlatform(linkInput.value.trim());
  const name = presetNameInput.value.trim()
    || (detected ? platformLabel(detected) : `Preset ${presets.length + 1}`);
  let preset = presets.find((p) => p.id === presetSelect.value);
  if (preset) {
    preset.name = name;
    preset.values = readFormValues();
  } else {
    preset = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      values: readFormValues(),
    };
    presets.push(preset);
  }
  presetNameInput.value = name;
  renderPresets(preset.id);
  if (await persistPresets()) appendLog(`[ui] saved preset "${name}"\n`);
});

presetDeleteBtn.addEventListener('click', async () => {
  const preset = presets.find((p) => p.id === presetSelect.value);
  if (!preset || !confirm(`Delete preset "${preset.name}"?`)) return;
  presets = presets.filter((p) => p !== preset);
  presetNameInput.value = '';
  renderPresets('');
  if (await persistPresets()) appendLog(`[ui] deleted preset "${preset.name}"\n`);
});

// Load presets and restore the one that was active when the app was
// last closed. Nothing is written until the user changes something.
bridge.loadPresets().then((loaded) => {
  appendLog(`[ui] presets file: ${loaded.path}\n`);
  if (loaded.error) {
    appendLog(`[ui] presets file is not valid JSON (${loaded.error}); saving a preset will overwrite it\n`);
  }
  presets = loaded.presets;
  renderPresets(loaded.activePreset);
  applySelectedPreset();
});
