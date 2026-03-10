import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Todo } from "../types/api";
import { toLocalDateKey, todayKey } from "../utils/date";

type MonthCalendarProps = {
  todos: Todo[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { date: string; day: number; currentMonth: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    days.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      currentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      currentMonth: true,
    });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      days.push({
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        currentMonth: false,
      });
    }
  }

  return days;
}

function todoCountByDate(todos: Todo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    const dateStr = todo.date ?? todo.deadline;
    if (!dateStr) continue;
    const key = toLocalDateKey(dateStr);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthCalendar({ todos, selectedDate, onSelectDate }: MonthCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const days = getCalendarDays(year, month);
  const counts = todoCountByDate(todos);
  const todayStr = todayKey();
  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="text-text-secondary hover:text-text text-[13px] px-2 py-1 transition-colors duration-150"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-medium text-text">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="text-text-secondary hover:text-text text-[13px] px-2 py-1 transition-colors duration-150"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-[11px] text-text-tertiary text-center py-1 font-medium uppercase tracking-wider"
          >
            {wd}
          </div>
        ))}

        {days.map((d) => {
          const count = counts.get(d.date) ?? 0;
          const isToday = d.date === todayStr;
          const isSelected = d.date === selectedDate;

          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDate(d.date)}
              className={`
                relative flex flex-col items-center justify-center
                py-2 text-[13px] transition-colors duration-150
                ${d.currentMonth ? "text-text" : "text-text-tertiary"}
                ${isSelected ? "bg-accent text-white rounded" : "hover:bg-bg-hover rounded"}
                ${isToday && !isSelected ? "font-bold" : ""}
              `}
            >
              <span>{d.day}</span>
              {count > 0 && (
                <span
                  className={`
                    mt-0.5 w-1.5 h-1.5 rounded-full
                    ${isSelected ? "bg-white/70" : "bg-accent"}
                  `}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
