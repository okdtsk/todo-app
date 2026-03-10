import { Check, Plus, Pencil, Calendar, Target, Tag, Flag } from "lucide-react";
import type { Todo, Project, Priority } from "../types/api";

type ActivityViewProps = {
  todos: Todo[];
  projects: Project[];
};

type ActivityItem = {
  todo: Todo;
  type: "created" | "completed" | "updated";
  timestamp: string;
};

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDay = Math.floor((today.getTime() - target.getTime()) / 86400000);

  if (diffDay === 0) return "Today";
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  none: "",
  low: "text-blue-400",
  medium: "text-amber-500",
  high: "text-red-500",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_CONFIG = {
  created: { icon: Plus, label: "Created", color: "text-accent" },
  completed: { icon: Check, label: "Completed", color: "text-green-500" },
  updated: { icon: Pencil, label: "Updated", color: "text-text-secondary" },
};

export function ActivityView({ todos, projects }: ActivityViewProps) {
  const activities: ActivityItem[] = [];

  for (const todo of todos) {
    if (todo.done && todo.updated_at !== todo.created_at) {
      activities.push({ todo, type: "completed", timestamp: todo.updated_at });
    }

    if (todo.updated_at !== todo.created_at && !todo.done) {
      activities.push({ todo, type: "updated", timestamp: todo.updated_at });
    }

    activities.push({ todo, type: "created", timestamp: todo.created_at });
  }

  activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const grouped = new Map<string, ActivityItem[]>();
  for (const item of activities) {
    const key = getDateKey(item.timestamp);
    const group = grouped.get(key);
    if (group) {
      group.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-6">Recent Activity</h2>
      {activities.length === 0 ? (
        <p className="text-[13px] text-text-tertiary py-8 text-center">
          No activity yet.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...grouped.entries()].map(([dateKey, items]) => (
            <div key={dateKey}>
              <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-3">
                {formatDateHeading(items[0].timestamp)}
              </h3>
              <div className="flex flex-col gap-1">
                {items.map((item, i) => {
                  const config = TYPE_CONFIG[item.type];
                  const Icon = config.icon;
                  const project = item.todo.project_id
                    ? projects.find((p) => p.id === item.todo.project_id)
                    : null;

                  return (
                    <div
                      key={`${item.todo.id}-${item.type}-${i}`}
                      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-bg-hover/50 transition-colors duration-150"
                    >
                      <span className={`flex-shrink-0 ${config.color}`}>
                        <Icon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[13px] truncate block ${
                            item.todo.done ? "text-text-tertiary line-through" : "text-text"
                          }`}
                        >
                          {item.todo.task_name}
                        </span>
                        {item.type === "updated" && (
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.todo.priority && item.todo.priority !== "none" && (
                              <span className={`flex items-center gap-0.5 text-[11px] ${PRIORITY_COLORS[item.todo.priority]}`}>
                                <Flag size={10} />
                                {item.todo.priority}
                              </span>
                            )}
                            {item.todo.date && (
                              <span className="flex items-center gap-0.5 text-[11px] text-text-tertiary">
                                <Calendar size={10} />
                                {formatDate(item.todo.date)}
                              </span>
                            )}
                            {item.todo.deadline && (
                              <span className="flex items-center gap-0.5 text-[11px] text-text-tertiary">
                                <Target size={10} />
                                {formatDate(item.todo.deadline)}
                              </span>
                            )}
                            {item.todo.labels && item.todo.labels.length > 0 && item.todo.labels.map((l) => (
                              <span key={l} className="flex items-center gap-0.5 text-[11px] text-text-tertiary">
                                <Tag size={10} />
                                {l}
                              </span>
                            ))}
                            {item.todo.description && (
                              <span className="text-[11px] text-text-tertiary truncate max-w-[200px]">
                                {item.todo.description}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {project && (
                        <span className="text-[11px] text-text-tertiary flex items-center gap-1 flex-shrink-0">
                          {project.color && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                          )}
                          {project.name}
                        </span>
                      )}
                      <span className="text-[11px] text-text-tertiary flex-shrink-0">
                        {formatRelative(item.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
