export const IPC = {
  START: 'joiner:start',
  STOP: 'joiner:stop',
  LOG: 'joiner:log',
  STATUS: 'joiner:status',
  RUNNING: 'joiner:running',
  PRESETS_LOAD: 'presets:load',
  PRESETS_SAVE: 'presets:save',
} as const;

export type JoinerPlatform = 'wbstream' | 'telemost' | 'vk' | 'dion' | 'bitrix';

export interface JoinerSettings {
  platform: JoinerPlatform;
  link: string;
  displayName: string;
  socksPort: number;
  socksUser: string;
  socksPass: string;
  tunnelMode: 'video' | 'dc';
  vp8Fps: number;
  vp8Batch: number;
  resources: 'moderate' | 'default' | 'unlimited';
  dns: string;
  noTun: boolean;
  dualTrack: boolean;
  reliable: boolean;
}

export interface JoinerPreset {
  id: string;
  name: string;
  values: Record<string, string | boolean>;
}

export interface PresetsFile {
  activePreset: string;
  presets: JoinerPreset[];
}

export interface PresetsLoadResult extends PresetsFile {
  path: string;
  exists: boolean;
  error?: string;
}
