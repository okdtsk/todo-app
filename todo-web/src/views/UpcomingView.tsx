import { useState } from "react";
import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { toLocalDateKey } from "../utils/date";
import { TodoList } from "../components/TodoList";
import { MonthCalendar } from "../components/MonthCalendar";

type UpcomingViewProps = {
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

type DateGroup = {
  label: string;
  sortKey: string;
  todos: Todo[];
};

function groupByDate(todos: Todo[]): DateGroup[] {
  const groups = new Map<string, Todo[]>();

  for (const todo of todos) {
    const dateStr = todo.date ?? todo.deadline;
    if (!dateStr) continue;

    const key = toLocalDateKey(dateStr);
    const existing = groups.get(key) ?? [];
    existing.push(todo);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, todos]) => {
      const d = new Date(key + "T00:00:00");
      return {
        label: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        sortKey: key,
        todos,
      };
    });
}

export function UpcomingView({
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
}: UpcomingViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const upcoming = todos.filter(
    (t) => !t.done && (t.date || t.deadline),
  );

  const filteredTodos = selectedDate
    ? upcoming.filter((t) => {
        const dateStr = t.date ?? t.deadline;
        if (!dateStr) return false;
        return toLocalDateKey(dateStr) === selectedDate;
      })
    : upcoming;

  const groups = groupByDate(filteredTodos);

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-6">Upcoming</h2>
      <MonthCalendar
        todos={upcoming}
        selectedDate={selectedDate}
        onSelectDate={(date) =>
          setSelectedDate(date === selectedDate ? null : date)
        }
      />
      <div className="mt-6">
        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="text-[12px] text-accent hover:text-accent-hover mb-4 transition-colors duration-150"
          >
            Show all dates
          </button>
        )}
        {groups.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary text-[14px]">
            {selectedDate ? "No tasks on this date." : "No upcoming tasks."}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.sortKey} className="mb-8">
              <h3 className="text-[12px] text-text-secondary uppercase tracking-wider mb-3 font-medium">
                {group.label}
              </h3>
              <TodoList
                todos={group.todos}
                pendingIds={pendingIds}
                disappearingIds={disappearingIds}
                editTodo={editTodo}
                projects={projects}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                onCreateTodo={onCreateTodo}
                onReorder={onReorder}
                onCancelEdit={onCancelEdit}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
