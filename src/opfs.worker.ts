/// <reference lib="webworker" />
/// <reference path="./opfs-sync.d.ts" />
export {};

/* eslint-disable no-restricted-globals */

// ── Message Protocol ──────────────────────────────────────────────────────────

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

// ── OPFS Operations ───────────────────────────────────────────────────────────

async function opfsInit(): Promise<void> {
  if (!navigator.storage?.getDirectory) {
    throw new Error("OPFS is not supported in this browser.");
  }
  if (navigator.storage.persist) {
    await navigator.storage.persist();
  }
  await navigator.storage.getDirectory();
}

async function opfsList(): Promise<string[]> {
  const root = await navigator.storage.getDirectory();
  const names: string[] = [];
  // @ts-ignore - values() is async iterable in modern browsers
  for await (const entry of root.values()) {
    if (entry.kind === "file" && !entry.name.startsWith(".")) {
      names.push(entry.name);
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

async function opfsCreate(fileName: string, content: string): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileName, { create: true });
  const syncHandle = await fileHandle.createSyncAccessHandle();
  try {
    const encoded = new TextEncoder().encode(content);
    syncHandle.truncate(0);
    syncHandle.write(encoded, { at: 0 });
    syncHandle.flush();
  } finally {
    syncHandle.close();
  }
  return fileName;
}

async function opfsRead(fileName: string): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileName, { create: false });
  const file = await fileHandle.getFile();
  return await file.text();
}

async function opfsUpdate(fileName: string, content: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileName, { create: false });
  const syncHandle = await fileHandle.createSyncAccessHandle();
  try {
    const encoded = new TextEncoder().encode(content);
    syncHandle.truncate(0);
    syncHandle.write(encoded, { at: 0 });
    syncHandle.flush();
  } finally {
    syncHandle.close();
  }
}

async function opfsDelete(fileName: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(fileName);
}

// ── Message Dispatcher ────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<OPFSRequest>) => {
  const { correlationId, type } = event.data;

  const reply = <T>(data: T) =>
    self.postMessage({ correlationId, ok: true, data } as SuccessResponse<T>);

  const replyError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ correlationId, ok: false, error: message } as ErrorResponse);
  };

  try {
    switch (type) {
      case "init":
        await opfsInit();
        reply<void>(undefined);
        break;

      case "list":
        reply<string[]>(await opfsList());
        break;

      case "create": {
        const { fileName, content } = event.data as Extract<OPFSRequest, { type: "create" }>;
        reply<string>(await opfsCreate(fileName, content));
        break;
      }

      case "read": {
        const { fileName } = event.data as Extract<OPFSRequest, { type: "read" }>;
        reply<string>(await opfsRead(fileName));
        break;
      }

      case "update": {
        const { fileName, content } = event.data as Extract<OPFSRequest, { type: "update" }>;
        await opfsUpdate(fileName, content);
        reply<void>(undefined);
        break;
      }

      case "delete": {
        const { fileName } = event.data as Extract<OPFSRequest, { type: "delete" }>;
        await opfsDelete(fileName);
        reply<void>(undefined);
        break;
      }

      default:
        replyError(`Unknown message type: ${(event.data as any).type}`);
    }
  } catch (err) {
    replyError(err);
  }
};
