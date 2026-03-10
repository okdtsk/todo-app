import { useState, useEffect, useRef } from "react";
import { Check, Trash2, CalendarClock, Target, GripVertical } from "lucide-react";
import type { Todo, Priority, Project, TodoCreateRequest } from "../types/api";
import { CustomSelect } from "./CustomSelect";

type TodoItemProps = {
  todo: Todo;
  index: number;
  pendingComplete: boolean;
  disappearing: boolean;
  isEditing: boolean;
  projects?: Project[];
  draggable?: boolean;
  isDragging?: boolean;
  isReordering?: boolean;
  dragOffsetY?: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onTouchDragStart?: (y: number) => void;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onSave?: (data: TodoCreateRequest) => void;
  onCancelEdit?: () => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-done",
  none: "",
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "none", label: "Priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function TodoItem({
  todo,
  index,
  pendingComplete,
  disappearing,
  isEditing,
  projects,
  draggable,
  isDragging,
  isReordering,
  dragOffsetY = 0,
  onDragStart,
  onDragOver,
  onDragEnd,
  onTouchDragStart,
  onToggle,
  onDelete,
  onEdit,
  onSave,
  onCancelEdit,
}: TodoItemProps) {
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";
  const nameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => void>(() => {});

  // Edit state
  const [taskName, setTaskName] = useState(todo.task_name);
  const [description, setDescription] = useState(todo.description ?? "");
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [date, setDate] = useState(todo.date ? todo.date.slice(0, 10) : "");
  const [deadline, setDeadline] = useState(todo.deadline ? todo.deadline.slice(0, 10) : "");
  const [labelsInput, setLabelsInput] = useState(todo.labels.join(", "));
  const [projectId, setProjectId] = useState(todo.project_id ? String(todo.project_id) : "");

  // Sync edit state when editing starts
  useEffect(() => {
    if (isEditing) {
      setTaskName(todo.task_name);
      setDescription(todo.description ?? "");
      setPriority(todo.priority);
      setDate(todo.date ? todo.date.slice(0, 10) : "");
      setDeadline(todo.deadline ? todo.deadline.slice(0, 10) : "");
      setLabelsInput(todo.labels.join(", "));
      setProjectId(todo.project_id ? String(todo.project_id) : "");
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [isEditing, todo]);

  // Keep saveRef current so the click-outside handler always has latest state
  saveRef.current = () => {
    if (!onSave) return;
    const name = taskName.trim();
    if (!name) {
      onCancelEdit?.();
      return;
    }

    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const data: TodoCreateRequest = {
      task_name: name,
      priority,
    };

    if (description.trim()) data.description = description.trim();
    if (date) data.date = new Date(date + "T00:00:00").toISOString();
    if (deadline) data.deadline = new Date(deadline + "T00:00:00").toISOString();
    if (labels.length > 0) data.labels = labels;
    if (projectId) data.project_id = Number(projectId);

    onSave(data);
  };

  // Attach non-passive touchstart on grip handle so preventDefault() works
  useEffect(() => {
    const grip = gripRef.current;
    if (!grip || !onTouchDragStart) return;

    function handleGripTouch(e: TouchEvent) {
      e.stopPropagation();
      e.preventDefault();
      onTouchDragStart!(e.touches[0].clientY);
    }

    grip.addEventListener("touchstart", handleGripTouch, { passive: false });
    return () => grip.removeEventListener("touchstart", handleGripTouch);
  }, [onTouchDragStart]);

  // Click outside to save
  useEffect(() => {
    if (!isEditing) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        saveRef.current();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveRef.current();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onCancelEdit?.();
    }
  }

  const fieldClass =
    "bg-bg-secondary text-[12px] text-text py-1.5 px-2 rounded outline-none focus:ring-1 focus:ring-accent/30 transition-all duration-150";

  return (
    <div
      ref={containerRef}
      draggable={("ontouchstart" in window) ? undefined : (draggable && !isEditing)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`
        ${disappearing ? "animate-slide-out" : `animate-fade-in ${staggerClass}`}
        group flex items-start gap-3 py-3
        ${isEditing ? "bg-bg-hover/30" : "hover:bg-bg-hover/50"} rounded-lg -mx-2 px-2
        ${pendingComplete && !disappearing ? "opacity-40" : ""}
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging
          ? "max-md:scale-[1.02] max-md:shadow-lg max-md:shadow-black/10 max-md:bg-bg max-md:rounded-xl max-md:z-20 max-md:relative md:opacity-30"
          : "transition-all duration-200"}
        ${isReordering && !isDragging ? "max-md:opacity-50" : ""}
      `}
      style={isDragging && dragOffsetY ? { transform: `translateY(${dragOffsetY}px) scale(1.02)` } : undefined}
    >
      {/* Drag handle */}
      {draggable && !isEditing && (
        <div
          ref={gripRef}
          className="mt-1.5 max-md:mt-0 flex-shrink-0 text-text-tertiary opacity-0 group-hover:opacity-100 md:transition-opacity md:duration-150 max-md:opacity-100 touch-none max-md:py-3 max-md:px-2 max-md:-my-3 max-md:-ml-2 max-md:flex max-md:items-center"
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Priority dot */}
      <div className="w-1.5 mt-2.5 flex-shrink-0">
        {(isEditing ? priority : todo.priority) !== "none" && (
          <span
            className={`block w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[isEditing ? priority : todo.priority]}`}
          />
        )}
      </div>

      {/* Checkbox */}
      <button
        onClick={() => !isEditing && onToggle(todo.id, !todo.done)}
        disabled={isEditing}
        className={`
          mt-0.5 w-5 h-5 rounded-full border-[1.5px] flex-shrink-0
          flex items-center justify-center
          transition-all duration-200
          ${todo.done || pendingComplete
            ? "bg-accent border-accent"
            : "border-done hover:border-accent"
          }
          ${isEditing ? "opacity-30 cursor-default" : ""}
        `}
        aria-label={pendingComplete ? "Undo complete" : todo.done ? "Mark incomplete" : "Mark complete"}
      >
        {(todo.done || pendingComplete) && (
          <Check size={10} className="text-white" strokeWidth={2.5} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            {/* Task name — same font/size/position as display mode */}
            <input
              ref={nameInputRef}
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full text-[14px] text-text bg-transparent outline-none"
              placeholder="Task name"
            />

            {/* Edit fields — expand below the task name */}
            <div className="mt-2 flex flex-col gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className={`w-full ${fieldClass}`}
              />
              <div className="flex gap-2 flex-wrap">
                <CustomSelect
                  value={priority}
                  onChange={(v) => setPriority(v as Priority)}
                  options={PRIORITY_OPTIONS}
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldClass}
                  title="Date"
                />
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={fieldClass}
                  title="Deadline"
                />
                {projects && projects.length > 0 && (
                  <CustomSelect
                    value={projectId}
                    onChange={setProjectId}
                    options={[
                      { value: "", label: "No project" },
                      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
                    ]}
                  />
                )}
              </div>
              <input
                type="text"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                placeholder="Labels (comma-separated)"
                className={`w-full ${fieldClass}`}
              />
              <div className="pt-1">
                <span className="text-[11px] text-text-tertiary">
                  Click outside to save · Esc to cancel
                </span>
              </div>
            </div>
          </form>
        ) : (
          <button
            onClick={() => onEdit(todo)}
            className="w-full text-left cursor-pointer"
          >
            <span
              className={`
                text-[14px]
                ${todo.done || pendingComplete ? "animate-strike text-text-tertiary" : "text-text"}
              `}
            >
              {todo.task_name}
            </span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {todo.date && (
                <span
                  className={`text-[12px] flex items-center gap-1 ${
                    isOverdue(todo.date) && !todo.done
                      ? "text-danger"
                      : "text-text-secondary"
                  }`}
                >
                  <CalendarClock size={12} />
                  {formatDate(todo.date)}
                </span>
              )}
              {todo.deadline && (
                <span
                  className={`text-[12px] flex items-center gap-1 ${
                    isOverdue(todo.deadline) && !todo.done
                      ? "text-danger"
                      : "text-text-secondary"
                  }`}
                >
                  <Target size={12} />
                  {formatDate(todo.deadline)}
                </span>
              )}
              {todo.labels.map((label) => (
                <span
                  key={label}
                  className="text-[11px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded"
                >
                  {label}
                </span>
              ))}
              {todo.project_id && projects && (() => {
                const proj = projects.find((p) => p.id === todo.project_id);
                return proj ? (
                  <span className="text-[11px] text-text-secondary flex items-center gap-1 ml-auto">
                    {proj.color && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                    )}
                    {proj.name}
                  </span>
                ) : null;
              })()}
            </div>
          </button>
        )}
      </div>

      {/* Delete — hidden during edit */}
      {!pendingComplete && !isEditing && (
        <button
          onClick={() => onDelete(todo.id)}
          className="
            opacity-0 group-hover:opacity-100
            text-text-tertiary hover:text-danger
            transition-opacity duration-200
            text-base mt-0.5
          "
          aria-label="Delete todo"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
