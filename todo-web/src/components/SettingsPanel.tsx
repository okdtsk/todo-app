import { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Trash2, Eye, EyeOff, Archive, ArchiveRestore } from "lucide-react";
import type { Project, AppSettings } from "../types/api";
import { THEMES, applyTheme, getActiveThemeName } from "../theme";
import { CustomSelect } from "./CustomSelect";
import {
  fetchSettings,
  updateSettings,
  updateProject,
  deleteProject,
  fetchArchivedProjects,
  reorderProjects,
  renameLabel,
} from "../api";

type SettingsPanelProps = {
  projects: Project[];
  labels: string[];
  onClose: () => void;
  onDataChanged: () => void;
};

type Tab = "projects" | "labels" | "ai" | "theme";

const PROJECT_COLORS = [
  { value: "#007AFF", name: "Blue" },
  { value: "#34C759", name: "Green" },
  { value: "#FF9500", name: "Orange" },
  { value: "#FF3B30", name: "Red" },
  { value: "#AF52DE", name: "Purple" },
  { value: "#FF2D55", name: "Pink" },
  { value: "#5AC8FA", name: "Cyan" },
  { value: "#FFCC00", name: "Yellow" },
  { value: "#8E8E93", name: "Gray" },
  { value: "#30B0C7", name: "Teal" },
];

export function SettingsPanel({
  projects,
  labels,
  onClose,
  onDataChanged,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>("projects");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [localProjects, setLocalProjects] = useState(projects);
  const [localLabels, setLocalLabels] = useState(labels);
  const [aiKey, setAiKey] = useState("");
  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiBaseURL, setAiBaseURL] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTheme, setActiveTheme] = useState(getActiveThemeName);

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    setLocalLabels(labels);
  }, [labels]);

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setAiProvider(s.ai_provider || "gemini");
      setAiModel(s.ai_model || "gemini-2.5-flash");
      setAiBaseURL(s.ai_base_url || "");
    });
    fetchArchivedProjects().then(setArchivedProjects);
  }, []);

  // --- Project handlers ---

  async function handleProjectNameChange(id: number, name: string) {
    setLocalProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p)),
    );
  }

  async function handleProjectNameSave(id: number) {
    const project = localProjects.find((p) => p.id === id);
    if (!project || !project.name.trim()) return;
    await updateProject(id, { name: project.name.trim() });
    setEditingProjectId(null);
    onDataChanged();
  }

  async function handleProjectColorChange(id: number, color: string) {
    setLocalProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color } : p)),
    );
    await updateProject(id, { color });
    onDataChanged();
  }

  async function handleProjectDelete(id: number) {
    await deleteProject(id);
    setDeleteConfirmId(null);
    onDataChanged();
  }

  async function handleProjectArchive(id: number) {
    await updateProject(id, { archived: true });
    setLocalProjects((prev) => prev.filter((p) => p.id !== id));
    const archived = await fetchArchivedProjects();
    setArchivedProjects(archived);
    onDataChanged();
  }

  async function handleProjectUnarchive(id: number) {
    await updateProject(id, { archived: false });
    setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
    onDataChanged();
  }

  async function moveProject(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= localProjects.length) return;
    const reordered = [...localProjects];
    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];
    setLocalProjects(reordered);
    await reorderProjects(reordered.map((p) => p.id));
    onDataChanged();
  }

  // --- Label handlers ---

  async function handleLabelRename(oldName: string, newName: string) {
    if (!newName.trim() || newName.trim() === oldName) {
      setEditingLabel(null);
      return;
    }
    await renameLabel(oldName, newName.trim());
    setEditingLabel(null);
    onDataChanged();
  }

  async function moveLabel(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= localLabels.length) return;
    const reordered = [...localLabels];
    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];
    setLocalLabels(reordered);
    await updateSettings({ label_order: reordered });
    onDataChanged();
  }

  // --- AI handlers ---

  async function handleSaveAI() {
    setSaving(true);
    try {
      const data: Partial<AppSettings> = {
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_base_url: aiBaseURL,
      };
      if (aiKey) {
        data.ai_api_key = aiKey;
      }
      const updated = await updateSettings(data);
      setSettings(updated);
      setAiKey("");
      onDataChanged();
    } finally {
      setSaving(false);
    }
  }

  const MODEL_PLACEHOLDERS: Record<string, string> = {
    gemini: "e.g. gemini-2.5-flash",
    openai: "e.g. gpt-4o",
    anthropic: "e.g. claude-sonnet-4-20250514",
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-[13px] font-medium transition-colors duration-150 border-b-2 ${
      tab === t
        ? "text-text border-accent"
        : "text-text-tertiary border-transparent hover:text-text-secondary"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-bg rounded-xl shadow-2xl border border-border w-[520px] h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-text">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setTab("projects")}
            className={tabClass("projects")}
          >
            Projects
          </button>
          <button
            onClick={() => setTab("labels")}
            className={tabClass("labels")}
          >
            Labels
          </button>
          <button onClick={() => setTab("ai")} className={tabClass("ai")}>
            AI
          </button>
          <button
            onClick={() => setTab("theme")}
            className={tabClass("theme")}
          >
            Theme
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "projects" && (
            <div className="flex flex-col gap-2">
              {localProjects.length === 0 && (
                <p className="text-[13px] text-text-tertiary py-4 text-center">
                  No projects yet.
                </p>
              )}
              {localProjects.map((project, index) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 py-2 group"
                >
                  {/* Color picker */}
                  <div className="relative">
                    <button
                      className="w-5 h-5 rounded-full flex-shrink-0 ring-1 ring-border"
                      style={{ backgroundColor: project.color || "#8E8E93" }}
                      onClick={() =>
                        setEditingProjectId(
                          editingProjectId === project.id ? null : project.id,
                        )
                      }
                      title="Change color"
                    />
                    {editingProjectId === project.id && (
                      <div className="absolute top-7 left-0 z-10 bg-bg border border-border rounded-lg shadow-lg p-2 flex flex-wrap gap-1.5 w-[140px]">
                        {PROJECT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              handleProjectColorChange(project.id, c.value);
                              setEditingProjectId(null);
                            }}
                            className={`w-5 h-5 rounded-full transition-all duration-150 ${
                              project.color === c.value
                                ? "ring-2 ring-offset-1 ring-offset-bg ring-accent scale-110"
                                : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <input
                    type="text"
                    value={project.name}
                    onChange={(e) =>
                      handleProjectNameChange(project.id, e.target.value)
                    }
                    onBlur={() => handleProjectNameSave(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleProjectNameSave(project.id);
                    }}
                    className="flex-1 text-[13px] text-text bg-transparent outline-none border-b border-transparent focus:border-border py-1"
                  />

                  {/* Order buttons */}
                  <button
                    onClick={() => moveProject(index, -1)}
                    disabled={index === 0}
                    className="text-text-tertiary hover:text-text disabled:opacity-20 transition-colors duration-150"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveProject(index, 1)}
                    disabled={index === localProjects.length - 1}
                    className="text-text-tertiary hover:text-text disabled:opacity-20 transition-colors duration-150"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* Archive */}
                  <button
                    onClick={() => handleProjectArchive(project.id)}
                    className="text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                    title="Archive"
                  >
                    <Archive size={13} />
                  </button>

                  {/* Delete */}
                  {deleteConfirmId === project.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleProjectDelete(project.id)}
                        className="text-[11px] px-2 py-0.5 bg-danger text-white rounded"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[11px] text-text-tertiary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="text-text-tertiary hover:text-danger transition-colors duration-150"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {/* Archived projects */}
              {archivedProjects.length > 0 && (
                <details className="mt-4">
                  <summary className="text-[12px] text-text-tertiary cursor-pointer py-2 hover:text-text-secondary transition-colors duration-150">
                    Archived ({archivedProjects.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {archivedProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-2 py-2 opacity-60"
                      >
                        <span
                          className="w-5 h-5 rounded-full flex-shrink-0 ring-1 ring-border"
                          style={{ backgroundColor: project.color || "#8E8E93" }}
                        />
                        <span className="flex-1 text-[13px] text-text">
                          {project.name}
                        </span>
                        <button
                          onClick={() => handleProjectUnarchive(project.id)}
                          className="text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                          title="Unarchive"
                        >
                          <ArchiveRestore size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {tab === "labels" && (
            <div className="flex flex-col gap-2">
              {localLabels.length === 0 && (
                <p className="text-[13px] text-text-tertiary py-4 text-center">
                  No labels yet. Add labels to tasks to see them here.
                </p>
              )}
              {localLabels.map((label, index) => (
                <div key={label} className="flex items-center gap-2 py-2">
                  {editingLabel === label ? (
                    <input
                      type="text"
                      defaultValue={label}
                      autoFocus
                      onBlur={(e) =>
                        handleLabelRename(label, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleLabelRename(
                            label,
                            (e.target as HTMLInputElement).value,
                          );
                        }
                        if (e.key === "Escape") setEditingLabel(null);
                      }}
                      className="flex-1 text-[13px] text-text bg-transparent outline-none border-b border-border py-1"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingLabel(label)}
                      className="flex-1 text-left text-[13px] text-text py-1 hover:text-accent transition-colors duration-150"
                    >
                      {label}
                    </button>
                  )}

                  <button
                    onClick={() => moveLabel(index, -1)}
                    disabled={index === 0}
                    className="text-text-tertiary hover:text-text disabled:opacity-20 transition-colors duration-150"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveLabel(index, 1)}
                    disabled={index === localLabels.length - 1}
                    className="text-text-tertiary hover:text-text disabled:opacity-20 transition-colors duration-150"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "theme" && (
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    applyTheme(theme);
                    setActiveTheme(theme.name);
                  }}
                  className={`rounded-lg border-2 p-3 transition-all duration-150 text-left ${
                    activeTheme === theme.name
                      ? "border-accent"
                      : "border-border hover:border-text-tertiary"
                  }`}
                >
                  {/* Theme preview */}
                  <div
                    className="rounded-md overflow-hidden mb-2 h-16 flex"
                    style={{ backgroundColor: theme.colors["--color-bg"] }}
                  >
                    <div
                      className="w-1/4 h-full"
                      style={{ backgroundColor: theme.colors["--color-bg-secondary"] }}
                    />
                    <div className="flex-1 p-2 flex flex-col gap-1">
                      <div
                        className="h-2 w-3/4 rounded"
                        style={{ backgroundColor: theme.colors["--color-text"] }}
                      />
                      <div
                        className="h-2 w-1/2 rounded"
                        style={{ backgroundColor: theme.colors["--color-text-secondary"] }}
                      />
                      <div
                        className="h-2 w-6 rounded mt-auto"
                        style={{ backgroundColor: theme.colors["--color-accent"] }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-[13px] font-medium ${
                      activeTheme === theme.name ? "text-accent" : "text-text"
                    }`}
                  >
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "ai" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] text-text-secondary block mb-1">
                  Provider
                </label>
                <CustomSelect
                  value={aiProvider}
                  onChange={setAiProvider}
                  options={[
                    { value: "gemini", label: "Gemini" },
                    { value: "openai", label: "OpenAI" },
                    { value: "anthropic", label: "Anthropic (Claude)" },
                  ]}
                />
              </div>

              <div>
                <label className="text-[12px] text-text-secondary block mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder={MODEL_PLACEHOLDERS[aiProvider] ?? "Model ID"}
                  className="w-full text-[13px] text-text bg-bg-secondary rounded px-3 py-2 outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>

              {aiProvider === "openai" && (
                <div>
                  <label className="text-[12px] text-text-secondary block mb-1">
                    Base URL
                    <span className="text-text-tertiary ml-1">(optional, for compatible APIs)</span>
                  </label>
                  <input
                    type="url"
                    value={aiBaseURL}
                    onChange={(e) => setAiBaseURL(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full text-[13px] text-text bg-bg-secondary rounded px-3 py-2 outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </div>
              )}

              <div>
                <label className="text-[12px] text-text-secondary block mb-1">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder={
                      settings?.ai_key_set
                        ? settings.ai_api_key
                        : "Enter API key"
                    }
                    className="flex-1 text-[13px] text-text bg-bg-secondary rounded px-3 py-2 outline-none focus:ring-1 focus:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {settings?.ai_key_set && (
                  <p className="text-[11px] text-text-tertiary mt-1">
                    Key is configured. Enter a new key to replace it.
                  </p>
                )}
              </div>

              <button
                onClick={handleSaveAI}
                disabled={saving}
                className="self-start text-[13px] px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded transition-colors duration-150 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
