import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { TodoList } from "../components/TodoList";

type LabelsViewProps = {
  todos: Todo[];
  projects: Project[];
  labels: string[];
  activeLabel?: string;
  pendingIds: Set<number>;
  disappearingIds: Set<number>;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onCreateTodo: (data: TodoCreateRequest) => void;
  onReorder: (ids: number[]) => void;
  editTodo: Todo | null;
  onCancelEdit: () => void;
};

export function LabelsView({
  todos,
  projects,
  labels,
  activeLabel,
  pendingIds,
  disappearingIds,
  onToggle,
  onDelete,
  onEdit,
  onCreateTodo,
  onReorder,
  editTodo,
  onCancelEdit,
}: LabelsViewProps) {
  const editProps = {
    editTodo,
    projects,
    onCreateTodo,
    onReorder,
    onCancelEdit,
  };

  if (activeLabel) {
    const filtered = todos.filter(
      (t) => !t.done && t.labels.includes(activeLabel),
    );
    return (
      <div>
        <h2 className="text-lg font-semibold text-text mb-6">
          {activeLabel}
        </h2>
        <TodoList
          todos={filtered}
          pendingIds={pendingIds}
          disappearingIds={disappearingIds}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          emptyMessage={`No tasks labeled "${activeLabel}".`}
          {...editProps}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-6">Labels</h2>
      {labels.length === 0 ? (
        <div className="py-12 text-center text-text-tertiary text-[14px]">
          No labels yet.
        </div>
      ) : (
        labels.map((label) => {
          const labelTodos = todos.filter(
            (t) => !t.done && t.labels.includes(label),
          );
          if (labelTodos.length === 0) return null;
          return (
            <div key={label} className="mb-8">
              <h3 className="text-[12px] text-text-secondary uppercase tracking-wider mb-3 font-medium">
                {label} ({labelTodos.length})
              </h3>
              <TodoList
                todos={labelTodos}
                pendingIds={pendingIds}
                disappearingIds={disappearingIds}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                {...editProps}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
