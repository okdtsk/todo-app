import { Archive } from "lucide-react";
import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { TodoList } from "../components/TodoList";

type ProjectViewProps = {
  projectId: number;
  todos: Todo[];
  projects: Project[];
  pendingIds: Set<number>;
  disappearingIds: Set<number>;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onCreateTodo: (data: TodoCreateRequest) => void;
  onReorder: (ids: number[]) => void;
  onArchiveProject: (id: number) => void;
  editTodo: Todo | null;
  onCancelEdit: () => void;
};

export function ProjectView({
  projectId,
  todos,
  projects,
  pendingIds,
  disappearingIds,
  onToggle,
  onDelete,
  onEdit,
  onCreateTodo,
  onReorder,
  onArchiveProject,
  editTodo,
  onCancelEdit,
}: ProjectViewProps) {
  const project = projects.find((p) => p.id === projectId);
  const projectTodos = todos.filter((t) => t.project_id === projectId);

  if (!project) {
    return (
      <div className="py-12 text-center text-text-tertiary text-[14px]">
        Project not found.
      </div>
    );
  }

  const editProps = {
    editTodo,
    projects,
    onCreateTodo,
    onCancelEdit,
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        {project.color && (
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
        )}
        <h2 className="text-lg font-semibold text-text">
          {project.name}
        </h2>
        <button
          onClick={() => onArchiveProject(project.id)}
          className="ml-auto text-text-tertiary hover:text-text-secondary transition-colors duration-150"
          title="Archive project"
        >
          <Archive size={16} />
        </button>
      </div>
      <TodoList
        todos={projectTodos.filter((t) => !t.done)}
        pendingIds={pendingIds}
        disappearingIds={disappearingIds}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onReorder={onReorder}
        emptyMessage="No tasks in this project."
        {...editProps}
      />
      {projectTodos.some((t) => t.done) && (
        <details className="mt-8">
          <summary className="text-[13px] text-text-tertiary cursor-pointer py-2 hover:text-text-secondary transition-colors duration-150">
            Completed ({projectTodos.filter((t) => t.done).length})
          </summary>
          <div className="mt-2">
            <TodoList
              todos={projectTodos.filter((t) => t.done)}
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
