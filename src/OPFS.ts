// ── Types ─────────────────────────────────────────────────────────────────────

type OPFSRequest =
  | { correlationId: string; type: "init" }
  | { correlationId: string; type: "list" }
  | { correlationId: string; type: "create"; fileName: string; content: string }
  | { correlationId: string; type: "read"; fileName: string }
  | { correlationId: string; type: "update"; fileName: string; content: string }
  | { correlationId: string; type: "delete"; fileName: string };

interface SuccessResponse<T> {
  correlationId: string;
  ok: true;
  data: T;
}

interface ErrorResponse {
  correlationId: string;
  ok: false;
  error: string;
}

type OPFSResponse<T> = SuccessResponse<T> | ErrorResponse;

// ── Worker Singleton ──────────────────────────────────────────────────────────

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./opfs.worker.ts", import.meta.url));
    worker.onerror = (event) => {
      console.error("[OPFS Worker] Uncaught error:", event.message);
      worker = null; // allow recreation on next call
    };
    attachResponseListener(worker);
  }
  return worker;
}

// ── Pending Promise Registry ──────────────────────────────────────────────────

type PendingResolvers = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
};

const pending = new Map<string, PendingResolvers>();

function attachResponseListener(w: Worker): void {
  w.onmessage = (event: MessageEvent<OPFSResponse<any>>) => {
    const { correlationId, ok } = event.data;
    const resolvers = pending.get(correlationId);
    if (!resolvers) return;
    pending.delete(correlationId);
    if (ok) {
      resolvers.resolve((event.data as SuccessResponse<any>).data);
    } else {
      resolvers.reject(new Error((event.data as ErrorResponse).error));
    }
  };
}

// ── Send Helper ───────────────────────────────────────────────────────────────

function send<T>(request: OPFSRequest): Promise<T> {
  const w = getWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(request.correlationId, { resolve, reject });
    w.postMessage(request);
  });
}

// ── Public Interface ──────────────────────────────────────────────────────────

interface IFileSystem {
  init(): Promise<void>;
  list(): Promise<string[]>;
  create(fileName: string, content: string): Promise<string>;
  read(fileName: string): Promise<string>;
  update(fileName: string, content: string): Promise<void>;
  delete(fileName: string): Promise<void>;
}

export const OPFSFileSystem: IFileSystem = {
  init() {
    return send<void>({ correlationId: crypto.randomUUID(), type: "init" });
  },

  list() {
    return send<string[]>({ correlationId: crypto.randomUUID(), type: "list" });
  },

  create(fileName, content) {
    return send<string>({
      correlationId: crypto.randomUUID(),
      type: "create",
      fileName,
      content,
    });
  },

  read(fileName) {
    return send<string>({
      correlationId: crypto.randomUUID(),
      type: "read",
      fileName,
    });
  },

  update(fileName, content) {
    return send<void>({
      correlationId: crypto.randomUUID(),
      type: "update",
      fileName,
      content,
    });
  },

  delete(fileName) {
    return send<void>({
      correlationId: crypto.randomUUID(),
      type: "delete",
      fileName,
    });
  },
};
