import { AsyncLocalStorage } from 'node:async_hooks';

export type WorkspaceConfig = {
  github: { owner: string; repo: string; branch: string; token: string };
  revalidate: { contentUrl?: string; tweetsUrl?: string; secret?: string };
  translation?: { baseUrl: string; apiKey: string; model?: string; thinking?: string; reasoningEffort?: string };
};

const storage = new AsyncLocalStorage<WorkspaceConfig>();

export function withWorkspace<T>(config: WorkspaceConfig, callback: () => T) {
  return storage.run(config, callback);
}

export function getWorkspace() {
  const config = storage.getStore();
  if (!config) throw new Error('Missing authenticated workspace configuration');
  return config;
}
