import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { TodoList } from "../components/TodoList";

type TodayViewProps = {
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

export function TodayView({
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
}: TodayViewProps) {
  const todayTodos = todos.filter(
    (t) =>
      !t.done &&
      ((t.date && (isToday(t.date) || isOverdue(t.date))) ||
        (t.deadline && (isToday(t.deadline) || isOverdue(t.deadline)))),
  );

  const overdue = todayTodos.filter(
    (t) =>
      (t.date && isOverdue(t.date) && !isToday(t.date)) ||
      (t.deadline && isOverdue(t.deadline) && !isToday(t.deadline)),
  );

  const today = todayTodos.filter((t) => !overdue.includes(t));

  const editProps = {
    editTodo,
    projects,
    onCreateTodo,
    onReorder,
    onCancelEdit,
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-6">Today</h2>
      {overdue.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[12px] text-danger uppercase tracking-wider mb-3 font-medium">
            Overdue
          </h3>
          <TodoList
            todos={overdue}
            pendingIds={pendingIds}
            disappearingIds={disappearingIds}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            {...editProps}
          />
        </div>
      )}
      <TodoList
        todos={today}
        pendingIds={pendingIds}
        disappearingIds={disappearingIds}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        emptyMessage="Nothing scheduled for today."
        {...editProps}
      />
    </div>
  );
}
