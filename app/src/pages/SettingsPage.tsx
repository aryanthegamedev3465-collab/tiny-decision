import React, { useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  HardDrive,
  Network,
  Bell,
  Save,
  CheckCircle,
} from "lucide-react";
import { useStore } from "@/store";

export function SettingsPage(): React.ReactElement {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [modelDir, setModelDir] = useState(settings.modelDirectory);
  const [port, setPort] = useState(settings.serverPort);
  const [hfToken, setHfToken] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateSettings({
      modelDirectory: modelDir,
      serverPort: port,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Application Settings</h1>
          <p className="text-xs text-gray-400">
            System configuration, hardware offloading, DPAPI credentials, and local networking
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#00e676] text-black font-bold text-xs rounded-lg hover:bg-[#00c853] transition-colors"
        >
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      <div className="p-6 max-w-4xl flex flex-col gap-6">
        {/* Storage & Hardware */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
            <HardDrive size={16} className="text-[#00e676]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Storage & Local Weights
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 font-medium">Model Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelDir}
                onChange={(e) => setModelDir(e.target.value)}
                className="flex-1 bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00e676]"
              />
              <button className="px-3 py-2 bg-[#222] hover:bg-[#282828] text-xs text-gray-300 rounded-lg border border-[#333]">
                Browse
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Windows junction links (mklink /J) will automatically mirror this into ~/.cache/huggingface.
            </p>
          </div>
        </div>

        {/* DPAPI Security & Credentials */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
            <Shield size={16} className="text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Windows DPAPI Credential Vault
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 font-medium">Hugging Face User Access Token</label>
            <input
              type="password"
              placeholder="hf_••••••••••••••••••••••••••••••••"
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00e676]"
            />
            <p className="text-[11px] text-gray-500">
              Encrypted on disk via Windows CryptProtectData (DPAPI). Never stored in plaintext.
            </p>
          </div>
        </div>

        {/* Local Server Config */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
            <Network size={16} className="text-[#ffd600]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Local HTTP Server Configuration
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 font-medium">Listening Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00e676]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 font-medium">Network Interface</label>
              <input
                type="text"
                disabled
                value="127.0.0.1 (Loopback Only)"
                className="bg-[#181818] border border-[#222] rounded-lg px-3 py-2 text-xs font-mono text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
