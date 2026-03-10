import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { TodoList } from "../components/TodoList";

type InboxViewProps = {
  todos: Todo[];
  projects: Project[];
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

export function InboxView({
  todos,
  projects,
  pendingIds,
  disappearingIds,
  onToggle,
  onDelete,
  onEdit,
  onCreateTodo,
  onReorder,
  editTodo,
  onCancelEdit,
}: InboxViewProps) {
  const inboxTodos = todos.filter((t) => !t.project_id);

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-6">Inbox</h2>
      <TodoList
        todos={inboxTodos.filter((t) => !t.done)}
        pendingIds={pendingIds}
        disappearingIds={disappearingIds}
        editTodo={editTodo}
        projects={projects}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onCreateTodo={onCreateTodo}
        onCancelEdit={onCancelEdit}
        onReorder={onReorder}
        emptyMessage="Inbox zero."
      />
      {inboxTodos.some((t) => t.done) && (
        <details className="mt-8">
          <summary className="text-[13px] text-text-tertiary cursor-pointer py-2 hover:text-text-secondary transition-colors duration-150">
            Completed ({inboxTodos.filter((t) => t.done).length})
          </summary>
          <div className="mt-2">
            <TodoList
              todos={inboxTodos.filter((t) => t.done)}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </div>
        </details>
      )}
    </div>
  );
}
