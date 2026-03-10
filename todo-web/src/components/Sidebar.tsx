import { useState } from "react";
import { Sun, CalendarDays, Inbox, Activity, Plus, Tag, Settings } from "lucide-react";
import type { Project, Todo } from "../types/api";

export type ViewType =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "activity" }
  | { kind: "project"; projectId: number }
  | { kind: "label"; label: string };

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

type SidebarProps = {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  projects: Project[];
  labels: string[];
  todos: Todo[];
  onCreateProject: (name: string, color: string) => void;
  onOpenSettings: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function viewKey(view: ViewType): string {
  switch (view.kind) {
    case "inbox":
    case "today":
    case "upcoming":
      return view.kind;
    case "project":
      return `project-${view.projectId}`;
    case "label":
      return `label-${view.label}`;
  }
}

function isActive(current: ViewType, target: ViewType): boolean {
  return viewKey(current) === viewKey(target);
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isFutureDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today && !isToday(dateStr);
}

export function Sidebar({
  currentView,
  onNavigate,
  projects,
  labels,
  todos,
  onCreateProject,
  onOpenSettings,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const [newProject, setNewProject] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#007AFF");
  const [showProjectInput, setShowProjectInput] = useState(false);

  // Compute counts
  const overdueCount = todos.filter(
    (t) =>
      !t.done &&
      ((t.date && isOverdue(t.date) && !isToday(t.date)) ||
        (t.deadline && isOverdue(t.deadline) && !isToday(t.deadline))),
  ).length;

  const todayCount = todos.filter(
    (t) =>
      !t.done &&
      ((t.date && (isToday(t.date) || isOverdue(t.date))) ||
        (t.deadline && (isToday(t.deadline) || isOverdue(t.deadline)))),
  ).length;

  const upcomingCount = todos.filter(
    (t) =>
      !t.done &&
      ((t.date && isFutureDate(t.date)) ||
        (t.deadline && isFutureDate(t.deadline))),
  ).length;

  const inboxOverdueCount = todos.filter(
    (t) =>
      !t.done &&
      !t.project_id &&
      ((t.date && isOverdue(t.date) && !isToday(t.date)) ||
        (t.deadline && isOverdue(t.deadline) && !isToday(t.deadline))),
  ).length;

  const inboxCount = todos.filter((t) => !t.done && !t.project_id).length;

  function projectActiveCount(projectId: number): number {
    return todos.filter((t) => !t.done && t.project_id === projectId).length;
  }

  function projectOverdueCount(projectId: number): number {
    return todos.filter(
      (t) =>
        !t.done &&
        t.project_id === projectId &&
        ((t.date && isOverdue(t.date) && !isToday(t.date)) ||
          (t.deadline && isOverdue(t.deadline) && !isToday(t.deadline))),
    ).length;
  }

  function labelOverdueCount(label: string): number {
    return todos.filter(
      (t) =>
        !t.done &&
        t.labels.includes(label) &&
        ((t.date && isOverdue(t.date) && !isToday(t.date)) ||
          (t.deadline && isOverdue(t.deadline) && !isToday(t.deadline))),
    ).length;
  }

  function handleNewProject(e: React.FormEvent) {
    e.preventDefault();
    if (newProject.trim()) {
      onCreateProject(newProject.trim(), newProjectColor);
      setNewProject("");
      setNewProjectColor("#007AFF");
      setShowProjectInput(false);
    }
  }

  function handleNav(view: ViewType) {
    onNavigate(view);
    onMobileClose();
  }

  const navItem = (label: string, view: ViewType, count?: number, icon?: React.ReactNode, overdueN?: number) => (
    <button
      key={viewKey(view)}
      onClick={() => handleNav(view)}
      className={`w-full text-left px-3 py-2 text-[14px] rounded-lg flex items-center justify-between transition-colors duration-150 ${
        isActive(currentView, view)
          ? "text-text font-medium bg-bg-hover"
          : "text-text-secondary hover:text-text hover:bg-bg-hover"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {overdueN !== undefined && overdueN > 0 && (
          <span className="text-[11px] text-white bg-danger rounded-full px-1.5 min-w-[18px] text-center font-medium">
            {overdueN}
          </span>
        )}
        {count !== undefined && count > 0 && (
          <span className="text-[12px] text-text-secondary">{count}</span>
        )}
      </span>
    </button>
  );

  const projectItem = (p: Project) => {
    const count = projectActiveCount(p.id);
    const overdueN = projectOverdueCount(p.id);
    const active = isActive(currentView, { kind: "project", projectId: p.id });

    return (
      <button
        key={p.id}
        onClick={() => handleNav({ kind: "project", projectId: p.id })}
        className={`w-full text-left px-3 py-2 text-[14px] rounded-lg flex items-center justify-between transition-colors duration-150 ${
          active
            ? "text-text font-medium bg-bg-hover"
            : "text-text-secondary hover:text-text hover:bg-bg-hover"
        }`}
      >
        <span className="flex items-center gap-2">
          {p.color && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
          )}
          {p.name}
        </span>
        <span className="flex items-center gap-1.5">
          {overdueN > 0 && (
            <span className="text-[11px] text-white bg-danger rounded-full px-1.5 min-w-[18px] text-center font-medium">
              {overdueN}
            </span>
          )}
          {count > 0 && (
            <span className="text-[12px] text-text-secondary">{count}</span>
          )}
        </span>
      </button>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-8 pb-5">
          <h1 className="text-sm font-semibold text-text-secondary tracking-wide">tdtd</h1>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {navItem("Today", { kind: "today" }, todayCount, <Sun size={16} />, overdueCount)}
          {navItem("Upcoming", { kind: "upcoming" }, upcomingCount, <CalendarDays size={16} />, overdueCount)}
          {navItem("Inbox", { kind: "inbox" }, inboxCount, <Inbox size={16} />, inboxOverdueCount)}
        </nav>

        <div className="mt-10 px-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-widest text-text-tertiary font-semibold">
              Projects
            </span>
            <button
              onClick={() => setShowProjectInput(!showProjectInput)}
              className="text-text-tertiary hover:text-text-secondary text-base leading-none transition-colors duration-150"
              title="New project"
            >
              <Plus size={14} />
            </button>
          </div>
          {showProjectInput && (
            <form onSubmit={handleNewProject} className="mb-3 px-3 flex flex-col gap-2">
              <input
                type="text"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full bg-transparent text-[14px] text-text placeholder:text-text-tertiary outline-none py-2 border-b border-border"
                onBlur={() => {
                  if (!newProject.trim()) setShowProjectInput(false);
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewProjectColor(c.value)}
                    className={`w-5 h-5 rounded-full transition-all duration-150 ${
                      newProjectColor === c.value ? "ring-2 ring-offset-1 ring-offset-bg-secondary ring-accent scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </form>
          )}
          <nav className="flex flex-col gap-0.5 -mx-3">
            {projects.map((p) => projectItem(p))}
          </nav>
        </div>

        {labels.length > 0 && (
          <div className="mt-10 px-6 pb-8">
            <span className="text-[11px] uppercase tracking-widest text-text-tertiary font-semibold block mb-3">
              Labels
            </span>
            <nav className="flex flex-col gap-0.5 -mx-3">
              {labels.map((l) => navItem(l, { kind: "label", label: l }, undefined, <Tag size={16} />, labelOverdueCount(l)))}
            </nav>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border flex flex-col gap-0.5">
        {navItem("Activity", { kind: "activity" }, undefined, <Activity size={16} />)}
        <button
          onClick={onOpenSettings}
          className="w-full text-left px-3 py-2 text-[14px] rounded-lg flex items-center gap-2 text-text-secondary hover:text-text hover:bg-bg-hover transition-colors duration-150"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 h-screen sticky top-0 flex-col overflow-y-auto bg-bg-secondary border-r border-border">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/10"
            onClick={onMobileClose}
          />
          <aside className="relative w-72 bg-bg-secondary h-full overflow-y-auto flex flex-col shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
