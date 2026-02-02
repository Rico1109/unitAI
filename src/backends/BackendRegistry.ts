import { IBackendExecutor } from "./types.js";
import { GeminiBackend } from "./GeminiBackend.js";
import { CursorBackend } from "./CursorBackend.js";
import { DroidBackend } from "./DroidBackend.js";
import { QwenBackend } from "./QwenBackend.js";
import { RovodevBackend } from "./RovodevBackend.js";

export class BackendRegistry {
  private backends = new Map<string, IBackendExecutor>();
  // Use singleton pattern or simple instance management
  private static instance: BackendRegistry;

  constructor() {
    this.registerDefaults();
  }

  public static getInstance(): BackendRegistry {
    if (!BackendRegistry.instance) {
      BackendRegistry.instance = new BackendRegistry();
    }
    return BackendRegistry.instance;
  }

  private registerDefaults() {
    this.register(new GeminiBackend());
    this.register(new CursorBackend());
    this.register(new DroidBackend());
    this.register(new QwenBackend());
    this.register(new RovodevBackend());
  }

  register(backend: IBackendExecutor) {
    this.backends.set(backend.name, backend);
  }

  getBackend(name: string): IBackendExecutor | undefined {
    return this.backends.get(name);
  }

  getAllBackends(): IBackendExecutor[] {
    return Array.from(this.backends.values());
  }
}
