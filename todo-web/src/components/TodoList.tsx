import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowDownWideNarrow } from "lucide-react";
import type { Todo, Project, TodoCreateRequest } from "../types/api";
import { TodoItem } from "./TodoItem";

export type SortKey = "manual" | "date" | "deadline" | "priority" | "name" | "created";
export type SortDir = "asc" | "desc";

type TodoListProps = {
  todos: Todo[];
  pendingIds?: Set<number>;
  disappearingIds?: Set<number>;
  editTodo?: Todo | null;
  projects?: Project[];
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onCreateTodo?: (data: TodoCreateRequest) => void;
  onCancelEdit?: () => void;
  onReorder?: (ids: number[]) => void;
  emptyMessage?: string;
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "Manual" },
  { key: "date", label: "Date" },
  { key: "deadline", label: "Deadline" },
  { key: "priority", label: "Priority" },
  { key: "name", label: "Name" },
  { key: "created", label: "Created" },
];

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

function sortTodos(todos: Todo[], key: SortKey, dir: SortDir): Todo[] {
  if (key === "manual") return todos;

  const sorted = [...todos].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "date": {
        const aDate = a.date ?? "";
        const bDate = b.date ?? "";
        if (!aDate && !bDate) cmp = 0;
        else if (!aDate) cmp = 1;
        else if (!bDate) cmp = -1;
        else cmp = aDate.localeCompare(bDate);
        break;
      }
      case "deadline": {
        const aDeadline = a.deadline ?? "";
        const bDeadline = b.deadline ?? "";
        if (!aDeadline && !bDeadline) cmp = 0;
        else if (!aDeadline) cmp = 1;
        else if (!bDeadline) cmp = -1;
        else cmp = aDeadline.localeCompare(bDeadline);
        break;
      }
      case "priority":
        cmp = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        break;
      case "name":
        cmp = a.task_name.localeCompare(b.task_name);
        break;
      case "created":
        cmp = a.created_at.localeCompare(b.created_at);
        break;
    }
    return dir === "desc" ? -cmp : cmp;
  });

  return sorted;
}

export function TodoList({
  todos,
  pendingIds,
  disappearingIds,
  editTodo,
  projects,
  onToggle,
  onDelete,
  onEdit,
  onCreateTodo,
  onCancelEdit,
  onReorder,
  emptyMessage = "No tasks",
}: TodoListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showSortPopup, setShowSortPopup] = useState(false);

  // Drag state: which item is being dragged, and where the insertion line should appear
  const dragItemId = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  // dropIndex = the array index where the dragged item would be inserted
  // e.g. 0 = before first item, todos.length = after last item
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isTouching = useRef(false);

  const isManual = sortKey === "manual";
  const sortedTodos = sortTodos(todos, sortKey, sortDir);

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    dragItemId.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  }, []);

  // Determine insertion index based on cursor Y position relative to item midpoints
  const handleDragOver = useCallback((e: React.DragEvent, itemIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = e.clientY < midY ? itemIndex : itemIndex + 1;

    setDropIndex(insertAt);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const sourceId = dragItemId.current;
      if (sourceId === null || dropIndex === null) {
        resetDrag();
        return;
      }

      const ids = sortedTodos.map((t) => t.id);
      const sourceIdx = ids.indexOf(sourceId);
      if (sourceIdx === -1) {
        resetDrag();
        return;
      }

      // Remove source from its current position
      ids.splice(sourceIdx, 1);

      // Adjust target index: if the source was before the target, the target shifts down by 1
      let targetIdx = dropIndex;
      if (sourceIdx < dropIndex) {
        targetIdx -= 1;
      }

      ids.splice(targetIdx, 0, sourceId);

      onReorder?.(ids);
      resetDrag();
    },
    [sortedTodos, dropIndex, onReorder],
  );

  function resetDrag() {
    setDraggingId(null);
    setDropIndex(null);
    dragItemId.current = null;
  }

  const handleDragEnd = useCallback(() => {
    resetDrag();
  }, []);

  // Touch-based drag for mobile
  const handleTouchStart = useCallback((id: number, y: number) => {
    if (!isManual || !onReorder) return;
    dragItemId.current = id;
    setDraggingId(id);
    touchStartY.current = y;
    isTouching.current = true;
  }, [isManual, onReorder]);

  const handleTouchMove = useCallback((clientY: number) => {
    if (!isTouching.current || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-todo-index]");
    let insertAt: number | null = null;
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const idx = Number(el.getAttribute("data-todo-index"));
      if (clientY >= rect.top && clientY < midY) {
        insertAt = idx;
      } else if (clientY >= midY && clientY <= rect.bottom) {
        insertAt = idx + 1;
      }
    });
    if (insertAt !== null) {
      setDropIndex(insertAt);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isTouching.current) return;
    isTouching.current = false;

    const sourceId = dragItemId.current;
    if (sourceId === null || dropIndex === null) {
      resetDrag();
      return;
    }

    const ids = sortedTodos.map((t) => t.id);
    const sourceIdx = ids.indexOf(sourceId);
    if (sourceIdx === -1) {
      resetDrag();
      return;
    }

    ids.splice(sourceIdx, 1);
    let targetIdx = dropIndex;
    if (sourceIdx < dropIndex) {
      targetIdx -= 1;
    }
    ids.splice(targetIdx, 0, sourceId);
    onReorder?.(ids);
    resetDrag();
  }, [sortedTodos, dropIndex, onReorder]);

  // Global touch move/end listeners
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!isTouching.current) return;
      e.preventDefault();
      handleTouchMove(e.touches[0].clientY);
    }
    function onTouchEnd() {
      handleTouchEnd();
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  if (todos.length === 0) {
    return (
      <div className="py-12 text-center text-text-tertiary text-[14px]">
        {emptyMessage}
      </div>
    );
  }

  // The insertion line element
  const insertionLine = (
    <div className="relative h-0">
      <div className="absolute left-0 right-0 h-[2px] bg-accent rounded-full" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-accent" />
    </div>
  );

  // Check if the drop line should appear at a given gap index,
  // but NOT adjacent to the dragged item's current position (no-op move).
  function showLineAt(gapIndex: number): boolean {
    if (dropIndex !== gapIndex || draggingId === null) return false;
    const sourceIdx = sortedTodos.findIndex((t) => t.id === draggingId);
    // Don't show the line right above or below the dragged item (no change)
    if (gapIndex === sourceIdx || gapIndex === sourceIdx + 1) return false;
    return true;
  }

  return (
    <div>
      {/* Sort button */}
      <div className="flex justify-end mb-2 relative">
        <button
          onClick={() => setShowSortPopup(!showSortPopup)}
          className={`flex items-center gap-1 text-[12px] px-2 py-1 rounded transition-colors duration-150 ${
            sortKey !== "manual"
              ? "text-accent bg-accent/10"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
          title="Sort"
        >
          <ArrowDownWideNarrow size={14} />
          {sortKey !== "manual" && (
            <span>{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</span>
          )}
        </button>

        {/* Sort popup */}
        {showSortPopup && (
          <div className="absolute top-8 right-0 z-30 bg-bg border border-border rounded-lg shadow-lg py-2 w-48 animate-fade-in">
            <div className="px-3 py-1.5 text-[11px] text-text-tertiary uppercase tracking-wider">
              Sort by
            </div>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setSortKey(opt.key);
                  setShowSortPopup(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors duration-100 ${
                  sortKey === opt.key ? "text-accent font-medium" : "text-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {sortKey !== "manual" && (
              <>
                <div className="border-t border-border my-1" />
                <div className="px-3 py-1.5 text-[11px] text-text-tertiary uppercase tracking-wider">
                  Direction
                </div>
                <button
                  onClick={() => {
                    setSortDir("asc");
                    setShowSortPopup(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors duration-100 ${
                    sortDir === "asc" ? "text-accent font-medium" : "text-text"
                  }`}
                >
                  Ascending
                </button>
                <button
                  onClick={() => {
                    setSortDir("desc");
                    setShowSortPopup(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors duration-100 ${
                    sortDir === "desc" ? "text-accent font-medium" : "text-text"
                  }`}
                >
                  Descending
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Todo items with insertion indicators */}
      <div
        ref={listRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDropIndex(null)}
      >
        {sortedTodos.map((todo, i) => (
          <div key={todo.id} data-todo-index={i}>
            {/* Insertion line before this item */}
            {showLineAt(i) && insertionLine}

            <TodoItem
              todo={todo}
              index={i}
              pendingComplete={pendingIds?.has(todo.id) ?? false}
              disappearing={disappearingIds?.has(todo.id) ?? false}
              isEditing={editTodo?.id === todo.id}
              projects={projects}
              draggable={isManual && !!onReorder}
              isDragging={draggingId === todo.id}
              onDragStart={(e) => handleDragStart(e, todo.id)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              onTouchDragStart={(y) => handleTouchStart(todo.id, y)}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
              onSave={onCreateTodo}
              onCancelEdit={onCancelEdit}
            />

            {/* Insertion line after the last item */}
            {i === sortedTodos.length - 1 && showLineAt(i + 1) && insertionLine}
          </div>
        ))}
      </div>
    </div>
  );
}
