import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, X } from "lucide-react";
import { TodoForm } from "./components/TodoForm";
import { AiInputBar } from "./components/AiInputBar";
import { todayKey } from "./utils/date";
import type { Todo, Project, TodoCreateRequest } from "./types/api";
import {
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  reorderTodos,
  fetchProjects,
  createProject,
  updateProject,
  fetchLabels,
} from "./api";
import { Sidebar } from "./components/Sidebar";
import type { ViewType } from "./components/Sidebar";
import { InboxView } from "./views/InboxView";
import { TodayView } from "./views/TodayView";
import { UpcomingView } from "./views/UpcomingView";
import { ProjectView } from "./views/ProjectView";
import { LabelsView } from "./views/LabelsView";
import { ActivityView } from "./views/ActivityView";
import { SettingsPanel } from "./components/SettingsPanel";

type PendingCompletion = {
  todoId: number;
  taskName: string;
};

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>({ kind: "today" });
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [pendingCompletions, setPendingCompletions] = useState<PendingCompletion[]>([]);
  const [disappearingIds, setDisappearingIds] = useState<Set<number>>(new Set());
  const pendingRef = useRef(pendingCompletions);
  pendingRef.current = pendingCompletions;
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [todosData, projectsData, labelsData] = await Promise.all([
        fetchTodos(),
        fetchProjects(),
        fetchLabels(),
      ]);
      setTodos(todosData);
      setProjects(projectsData);
      setLabels(labelsData);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear pending completions on view change
  useEffect(() => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setPendingCompletions([]);
    setDisappearingIds(new Set());
  }, [currentView]);

  function commitAllPending() {
    const toCommit = pendingRef.current;
    if (toCommit.length === 0) return;

    // Start disappearing animation for all pending items
    setDisappearingIds(new Set(toCommit.map((pc) => pc.todoId)));

    // Wait for animation to finish, then commit all
    setTimeout(async () => {
      setPendingCompletions([]);
      setDisappearingIds(new Set());
      completionTimerRef.current = null;
      try {
        await Promise.all(toCommit.map((pc) => updateTodo(pc.todoId, { done: true })));
        await loadData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update todo";
        setError(msg);
      }
    }, 400);
  }

  function scheduleCommit() {
    // Reset the shared timer to 3s from now
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }
    completionTimerRef.current = setTimeout(() => commitAllPending(), 3000);
  }

  function handleToggle(id: number, done: boolean) {
    // If undoing a pending completion (clicking checkbox again)
    const existing = pendingCompletions.find((pc) => pc.todoId === id);
    if (existing) {
      const remaining = pendingCompletions.filter((pc) => pc.todoId !== id);
      setPendingCompletions(remaining);
      // If no more pending items, cancel the timer
      if (remaining.length === 0 && completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      return;
    }

    // Completing a task: add to pending and reset the shared timer
    if (done) {
      const todo = todos.find((t) => t.id === id);
      setPendingCompletions((prev) => [
        ...prev,
        { todoId: id, taskName: todo?.task_name ?? "Task" },
      ]);
      scheduleCommit();
      return;
    }

    // Uncompleting a done task (from completed section)
    (async () => {
      try {
        await updateTodo(id, { done: false });
        await loadData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update todo";
        setError(msg);
      }
    })();
  }

  function handleUndoAll() {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setPendingCompletions([]);
  }

  function handleUndoOne(todoId: number) {
    const remaining = pendingCompletions.filter((p) => p.todoId !== todoId);
    setPendingCompletions(remaining);
    if (remaining.length === 0 && completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }

  async function handleCreateTodo(data: TodoCreateRequest) {
    try {
      if (editTodo) {
        await updateTodo(editTodo.id, data);
        setEditTodo(null);
      } else {
        await createTodo(data);
      }
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save todo";
      setError(msg);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteTodo(id);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete todo";
      setError(msg);
    }
  }

  async function handleReorder(ids: number[]) {
    // Optimistically reorder local state
    const reordered = ids
      .map((id) => todos.find((t) => t.id === id))
      .filter((t): t is Todo => t !== undefined);
    const rest = todos.filter((t) => !ids.includes(t.id));
    setTodos([...reordered, ...rest]);

    try {
      await reorderTodos(ids);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reorder todos";
      setError(msg);
      await loadData();
    }
  }

  async function handleCreateProject(name: string, color: string) {
    try {
      await createProject({ name, color });
      await loadData();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create project";
      setError(msg);
    }
  }

  async function handleArchiveProject(id: number) {
    try {
      await updateProject(id, { archived: true });
      setCurrentView({ kind: "inbox" });
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to archive project";
      setError(msg);
    }
  }

  // Redirect to inbox if current project was deleted or archived
  useEffect(() => {
    if (currentView.kind === "project" && !projects.find((p) => p.id === currentView.projectId)) {
      setCurrentView({ kind: "inbox" });
    }
  }, [projects, currentView]);

  const pendingIds = new Set(pendingCompletions.map((pc) => pc.todoId));

  // Compute form defaults based on current view
  const formDefaultDate = currentView.kind === "today" ? todayKey() : undefined;
  const formDefaultProjectId = currentView.kind === "project" ? currentView.projectId : undefined;

  function renderView() {
    const commonProps = {
      todos,
      projects,
      pendingIds,
      disappearingIds,
      onToggle: handleToggle,
      onDelete: handleDelete,
      onEdit: setEditTodo,
      onCreateTodo: handleCreateTodo,
      onReorder: handleReorder,
      editTodo,
      onCancelEdit: () => setEditTodo(null),
    };

    switch (currentView.kind) {
      case "inbox":
        return <InboxView {...commonProps} />;
      case "today":
        return <TodayView {...commonProps} />;
      case "upcoming":
        return <UpcomingView {...commonProps} />;
      case "activity":
        return <ActivityView todos={todos} projects={projects} />;
      case "project":
        return (
          <ProjectView projectId={currentView.projectId} onArchiveProject={handleArchiveProject} {...commonProps} />
        );
      case "label":
        return (
          <LabelsView
            labels={labels}
            activeLabel={currentView.label}
            {...commonProps}
          />
        );
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        currentView={currentView}
        projects={projects}
        labels={labels}
        todos={todos}
        onNavigate={setCurrentView}
        onCreateProject={handleCreateProject}
        onOpenSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center px-6 py-5">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-text-tertiary hover:text-text mr-4"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-text-secondary tracking-wide">tdtd</span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="max-w-[640px] mx-auto px-8 mt-6">
            <p className="text-danger text-sm">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-3 text-text-tertiary hover:text-text"
              >
                <X size={14} />
              </button>
            </p>
          </div>
        )}

        {/* Content */}
        <div className="max-w-[640px] mx-auto px-8 py-10 flex flex-col min-h-[calc(100vh-60px)] md:min-h-screen">
          <div className="flex-1">
            {renderView()}
          </div>
          <div className="sticky bottom-0 bg-bg pb-4 pt-2">
            <TodoForm
              projects={projects}
              defaultDate={formDefaultDate}
              defaultProjectId={formDefaultProjectId}
              onSubmit={handleCreateTodo}
            />
            <AiInputBar onActionsDone={loadData} />
          </div>
        </div>

        {/* Undo bar */}
        {pendingCompletions.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 animate-slide-up z-50">
            <div className="bg-text text-bg rounded-lg shadow-lg px-5 py-3 flex items-center gap-4 text-[13px]">
              <span>
                {pendingCompletions.length === 1
                  ? `"${pendingCompletions[0].taskName}" completed`
                  : `${pendingCompletions.length} tasks completed`}
              </span>
              {pendingCompletions.length === 1 ? (
                <button
                  onClick={() => handleUndoOne(pendingCompletions[0].todoId)}
                  className="font-medium text-accent hover:text-accent-hover transition-colors duration-150"
                >
                  Undo
                </button>
              ) : (
                <button
                  onClick={handleUndoAll}
                  className="font-medium text-accent hover:text-accent-hover transition-colors duration-150"
                >
                  Undo all
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settings panel */}
      {settingsOpen && (
        <SettingsPanel
          projects={projects}
          labels={labels}
          onClose={() => setSettingsOpen(false)}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}

export default App;
