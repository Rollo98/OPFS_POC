/**
 * Interface defining the standard operations for our File System
 */
interface IFileSystem {
  init(): Promise<FileSystemDirectoryHandle>;
  list(): Promise<FileSystemFileHandle[]>;
  create(fileName: string, content: string): Promise<FileSystemFileHandle>;
  read(fileHandle: FileSystemFileHandle): Promise<string>;
  update(fileHandle: FileSystemFileHandle, content: string): Promise<void>;
  delete(fileName: string): Promise<void>;
}

/**
 * OPFS Implementation of the FileSystem interface
 */
export const OPFSFileSystem: IFileSystem = {
  async init(): Promise<FileSystemDirectoryHandle> {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("OPFS is not supported in this browser.");
    }
    if (navigator.storage.persist) {
      await navigator.storage.persist();
    }
    return await navigator.storage.getDirectory();
  },

  async list(): Promise<FileSystemFileHandle[]> {
    const root = await navigator.storage.getDirectory();
    const entries: FileSystemFileHandle[] = [];
    // @ts-ignore - values() is async iterable in modern browsers
    for await (const entry of root.values()) {
      if (entry.kind === "file" && !entry.name.startsWith(".")) {
        entries.push(entry as FileSystemFileHandle);
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(
    fileName: string,
    content: string,
  ): Promise<FileSystemFileHandle> {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return fileHandle;
  },

  async read(fileHandle: FileSystemFileHandle): Promise<string> {
    const file = await fileHandle.getFile();
    return await file.text();
  },

  async update(
    fileHandle: FileSystemFileHandle,
    content: string,
  ): Promise<void> {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  },

  async delete(fileName: string): Promise<void> {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(fileName);
  },
};
