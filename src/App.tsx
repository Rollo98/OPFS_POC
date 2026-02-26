import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Save,
  FileQuestion,
  Dices,
  ShieldCheck,
  HardDrive,
  Terminal,
  Eraser,
} from "lucide-react";
import { OPFSFileSystem } from "./OPFS";

const WORDS: string[] = [
  "apple",
  "nebula",
  "velocity",
  "ocean",
  "zenith",
  "crystal",
  "horizon",
  "whisper",
  "echo",
  "midnight",
  "glimmer",
  "safari",
  "ios",
  "storage",
  "performance",
  "interface",
  "coding",
  "logic",
  "creative",
  "swift",
  "reactive",
  "filesystem",
  "browser",
  "private",
  "origin",
];

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "error";
}

export const App: React.FC = () => {
  // Application State
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isCompatible, setIsCompatible] = useState<boolean>(true);
  const [files, setFiles] = useState<FileSystemFileHandle[]>([]);
  const [currentFile, setCurrentFile] = useState<FileSystemFileHandle | null>(
    null,
  );
  const [content, setContent] = useState<string>("");
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Logger State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Helper: Generate Random Word String
  const generateRandomContent = useCallback((): string => {
    return Array.from(
      { length: 40 },
      () => WORDS[Math.floor(Math.random() * WORDS.length)],
    ).join(" ");
  }, []);

  // Helper: Add System Log
  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLogs((previousLogs) =>
        [
          { id: Math.random(), timestamp, message, type },
          ...previousLogs,
        ].slice(0, 50),
      );
    },
    [],
  );

  // Helper: Show Toast
  const showToast = useCallback(
    (message: string, type: ToastNotification["type"] = "success") => {
      const id = Math.random().toString(36).substring(2, 9);
      setNotifications((previousNotifications) => [
        ...previousNotifications,
        { id, message, type },
      ]);
      setTimeout(() => {
        setNotifications((previousNotifications) =>
          previousNotifications.filter(
            (notification) => notification.id !== id,
          ),
        );
      }, 3000);
    },
    [],
  );

  /**
   * INITIALIZATION
   */
  const initFileSystem = async () => {
    setLoading(true);
    addLog("Initializing OPFS context...", "info");
    try {
      await OPFSFileSystem.init();
      setIsInitialized(true);
      await refreshFileList();
      showToast("Storage Initialized Successfully");
      addLog("File system root accessed successfully", "success");
    } catch (error: any) {
      console.error("Initialization error:", error);
      showToast("Permission denied or FS error", "error");
      addLog(`Initialization Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * CRUD: Read (List)
   */
  const refreshFileList = useCallback(async () => {
    try {
      const entries = await OPFSFileSystem.list();
      setFiles(entries);
      addLog(`Directory synced: ${entries.length} files found`, "info");
    } catch (error: any) {
      showToast("Sync failed", "error");
      addLog(`Sync Error: ${error.message}`, "error");
    }
  }, [showToast, addLog]);

  /**
   * CRUD: Create
   */
  const createNewFile = async () => {
    setLoading(true);
    const randomName = `note_${Math.random().toString(36).substring(2, 7)}.txt`;
    const initialRandomContent = generateRandomContent();

    try {
      const fileHandle = await OPFSFileSystem.create(
        randomName,
        initialRandomContent,
      );
      showToast(`Created ${randomName}`);
      addLog(
        `Action: Created file "${randomName}" with random content`,
        "success",
      );

      await refreshFileList();
      await loadFile(fileHandle);
    } catch (error: any) {
      showToast("Create failed: " + error.message, "error");
      addLog(`Create Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * CRUD: Read (Single File)
   */
  const loadFile = async (fileHandle: FileSystemFileHandle) => {
    try {
      const text = await OPFSFileSystem.read(fileHandle);
      const fileData = await fileHandle.getFile();

      setCurrentFile(fileHandle);
      setContent(text);
      setLastModified(new Date(fileData.lastModified));
      addLog(`Action: Read file "${fileHandle.name}"`, "info");
    } catch (error: any) {
      showToast("Load error", "error");
      addLog(`Read Error for "${fileHandle.name}": ${error.message}`, "error");
    }
  };

  /**
   * CRUD: Update
   */
  const saveFile = async () => {
    if (!currentFile) return;
    try {
      await OPFSFileSystem.update(currentFile, content);

      const fileData = await currentFile.getFile();
      setLastModified(new Date(fileData.lastModified));
      showToast("File saved");
      addLog(`Action: Updated content for "${currentFile.name}"`, "success");
    } catch (error: any) {
      showToast("Save failed", "error");
      addLog(
        `Update Error for "${currentFile.name}": ${error.message}`,
        "error",
      );
    }
  };

  /**
   * EDIT FUNCTIONALITY: Randomize (Local update only)
   */
  const randomizeCurrentFile = async () => {
    if (!currentFile) return;
    try {
      const randomText = generateRandomContent();
      setContent(randomText);
      showToast("Randomized (unsaved)");
      addLog(
        `Action: Randomized content in editor for "${currentFile.name}" (Click Save to persist)`,
        "warning",
      );
    } catch (error: any) {
      showToast("Randomize failed", "error");
      addLog(`Randomize Error: ${error.message}`, "error");
    }
  };

  /**
   * CRUD: Delete
   */
  const deleteFile = async () => {
    if (!currentFile) return;
    const fileName = currentFile.name;
    try {
      await OPFSFileSystem.delete(fileName);

      setCurrentFile(null);
      setContent("");
      setLastModified(null);
      showToast(`Deleted ${fileName}`);
      addLog(`Action: Deleted file "${fileName}"`, "warning");

      setTimeout(refreshFileList, 100);
    } catch (error: any) {
      showToast("Delete failed", "error");
      addLog(`Delete Error for "${fileName}": ${error.message}`, "error");
    }
  };

  // Compatibility Check
  useEffect(() => {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      setIsCompatible(false);
    }
  }, []);

  if (!isCompatible) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 bg-white rounded-3xl shadow-xl border border-red-100">
          <X size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            Unsupported Browser
          </h1>
          <p className="text-slate-600 mt-2">
            OPFS is required. Please use Safari 15.2+, Chrome, or Edge.
          </p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <HardDrive size={40} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
            OPFS Manager
          </h1>
          <p className="text-slate-500 mb-8">
            Access private high-speed storage on your device. Click below to
            authorize.
          </p>
          <button
            onClick={initFileSystem}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 active:scale-95"
          >
            {loading ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <ShieldCheck size={20} />
            )}
            Initialize Storage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-12">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {/* Navbar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border border-emerald-200">
                OPFS Active
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              File Explorer
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={createNewFile}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-2xl font-bold transition-all shadow-md flex items-center gap-2 active:scale-95"
            >
              {loading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Plus size={20} />
              )}
              Create New
            </button>
            <button
              onClick={refreshFileList}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 p-2.5 rounded-2xl transition-all active:rotate-180 duration-500"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Sidebar */}
          <div className="md:col-span-4 lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col max-h-[600px]">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-400 text-xs uppercase tracking-widest">
                Filesystem Root
              </h2>
              <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-md">
                {files.length} ITEMS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar min-h-[300px]">
              {files.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-12 h-12 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileQuestion size={24} />
                  </div>
                  <p className="text-slate-400 text-sm italic">
                    Empty directory
                  </p>
                </div>
              ) : (
                files.map((fileHandle) => (
                  <button
                    key={fileHandle.name}
                    onClick={() => loadFile(fileHandle)}
                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 group ${
                      currentFile?.name === fileHandle.name
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                        : "hover:bg-slate-50 text-slate-600 border border-transparent hover:border-slate-100"
                    }`}
                  >
                    <FileText
                      size={18}
                      className={
                        currentFile?.name === fileHandle.name
                          ? "text-indigo-200"
                          : "text-slate-400 group-hover:text-indigo-500"
                      }
                    />
                    <span className="text-sm font-bold truncate">
                      {fileHandle.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Workspace */}
          <div className="md:col-span-8 lg:col-span-9 h-full">
            {!currentFile ? (
              <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center h-[600px] flex flex-col items-center justify-center shadow-inner">
                <div className="bg-white p-8 rounded-full shadow-sm mb-6 text-slate-200 border border-slate-100">
                  <FileQuestion size={56} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  No Document Selected
                </h3>
                <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                  Click "Create New" or select a file to begin.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 flex flex-col h-[600px] shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-lg leading-tight">
                        {currentFile.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                          Synced: {lastModified?.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={randomizeCurrentFile}
                      title="Randomize Content"
                      className="p-3 text-amber-500 hover:bg-amber-50 rounded-2xl transition-all border border-transparent hover:border-amber-100 flex items-center gap-2 font-bold text-sm"
                    >
                      <Dices size={20} />
                      <span className="hidden sm:inline">Randomize</span>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentFile(null);
                        addLog("Editor closed", "info");
                      }}
                      className="p-3 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  spellCheck="false"
                  className="flex-1 p-10 bg-transparent resize-none focus:outline-none text-slate-700 leading-relaxed font-mono text-base"
                  placeholder="Start writing here..."
                />

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <button
                    onClick={deleteFile}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100 px-6 py-3 rounded-2xl font-black transition-all flex items-center gap-3 active:scale-95"
                  >
                    <Trash2 size={20} />
                    Delete File
                  </button>

                  <button
                    onClick={saveFile}
                    className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-2xl font-black shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center gap-3"
                  >
                    <Save size={20} />
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Logger Section */}
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Terminal size={18} />
              </div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest">
                System Activity Log
              </h2>
            </div>
            <button
              onClick={() => {
                setLogs([]);
                addLog("Logs cleared", "info");
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-300 flex items-center gap-2 transition-colors group"
            >
              <Eraser
                size={14}
                className="group-hover:rotate-12 transition-transform"
              />
              Clear Console
            </button>
          </div>

          <div className="p-6 h-[250px] overflow-y-auto custom-scrollbar-dark font-mono text-xs space-y-2 bg-slate-950/50">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic py-4">
                No recent activity recorded...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300 border-b border-slate-900 pb-1.5 last:border-0"
                >
                  <span className="text-slate-600 flex-shrink-0">
                    [{log.timestamp}]
                  </span>
                  <span
                    className={`font-bold flex-shrink-0 w-20 ${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "warning"
                            ? "text-amber-400"
                            : "text-indigo-400"
                    }`}
                  >
                    {log.type.toUpperCase()}
                  </span>
                  <span className="text-slate-300 break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Notification Toast Layer */}
      <div className="fixed bottom-8 right-8 z-50 pointer-events-none space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border pointer-events-auto animate-in slide-in-from-right fade-in duration-500 ${
              notification.type === "success"
                ? "bg-slate-900 text-white border-slate-800"
                : "bg-red-500 text-white border-red-400"
            }`}
          >
            {notification.type === "success" ? (
              <ShieldCheck size={20} className="text-emerald-400" />
            ) : (
              <X size={20} />
            )}
            <span className="font-bold text-sm tracking-tight">
              {notification.message}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

        .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: #020617; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};
