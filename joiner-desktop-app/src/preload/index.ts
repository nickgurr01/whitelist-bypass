import { contextBridge, ipcRenderer } from 'electron';
import { IPC, JoinerSettings, PresetsFile } from '../constants';

contextBridge.exposeInMainWorld('bridge', {
  start: (settings: JoinerSettings) => ipcRenderer.invoke(IPC.START, settings),
  stop: () => ipcRenderer.invoke(IPC.STOP),
  loadPresets: () => ipcRenderer.invoke(IPC.PRESETS_LOAD),
  savePresets: (data: PresetsFile) => ipcRenderer.invoke(IPC.PRESETS_SAVE, data),
  onLog(cb: (text: string) => void) {
    ipcRenderer.on(IPC.LOG, (_e, text) => cb(text));
  },
  onStatus(cb: (status: string) => void) {
    ipcRenderer.on(IPC.STATUS, (_e, status) => cb(status));
  },
  onRunning(cb: (running: boolean) => void) {
    ipcRenderer.on(IPC.RUNNING, (_e, v) => cb(v));
  },
});
