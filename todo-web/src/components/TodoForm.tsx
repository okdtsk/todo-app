import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import type { Priority, TodoCreateRequest, Project } from "../types/api";
import { CustomSelect } from "./CustomSelect";

type TodoFormProps = {
  projects: Project[];
  defaultDate?: string;
  defaultProjectId?: number;
  onSubmit: (data: TodoCreateRequest) => void;
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "none", label: "Priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-done",
  none: "",
};

export type TodoFormHandle = {
  focus: () => void;
};

export const TodoForm = forwardRef<TodoFormHandle, TodoFormProps>(function TodoForm({ projects, defaultDate, defaultProjectId, onSubmit }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  }));
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [date, setDate] = useState(defaultDate ?? "");
  const [deadline, setDeadline] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ? String(defaultProjectId) : "");
  const [expanded, setExpanded] = useState(false);

  function reset() {
    setTaskName("");
    setDescription("");
    setPriority("none");
    setDate(defaultDate ?? "");
    setDeadline("");
    setLabelsInput("");
    setProjectId(defaultProjectId ? String(defaultProjectId) : "");
    setExpanded(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskName.trim()) return;

    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const data: TodoCreateRequest = {
      task_name: taskName.trim(),
      priority,
    };

    if (description.trim()) data.description = description.trim();
    if (date) data.date = new Date(date + "T00:00:00").toISOString();
    if (deadline) data.deadline = new Date(deadline + "T00:00:00").toISOString();
    if (labels.length > 0) data.labels = labels;
    if (projectId) data.project_id = Number(projectId);

    onSubmit(data);
    reset();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      reset();
    }
  }

  const fieldClass =
    "bg-bg-secondary text-[12px] text-text py-1.5 px-2 rounded outline-none focus:ring-1 focus:ring-accent/30 transition-all duration-150";

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div
        className={`
          flex items-start gap-3 py-3 rounded-lg -mx-2 px-2
          ${expanded ? "bg-bg-hover/30" : ""}
        `}
      >
        {/* Priority dot — matches TodoItem */}
        <div className="w-1.5 mt-2.5 flex-shrink-0">
          {priority !== "none" && (
            <span
              className={`block w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[priority]}`}
            />
          )}
        </div>

        {/* Checkbox placeholder — matches TodoItem */}
        <div className="mt-0.5 w-5 h-5 rounded-full border-[1.5px] border-done flex-shrink-0 opacity-30" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Add a task..."
            className="w-full text-[14px] text-text bg-transparent outline-none placeholder:text-text-tertiary"
          />

          {expanded && (
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
                {projects.length > 0 && (
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
              <div className="flex items-center gap-2 pt-1">
                {taskName.trim() && (
                  <button
                    type="submit"
                    className="text-[12px] px-3 py-1 bg-accent hover:bg-accent-hover text-white font-medium rounded transition-colors duration-150"
                  >
                    Add
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="text-[12px] text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
});
