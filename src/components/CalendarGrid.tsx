import React from 'react';
import { Assignment, Test } from '../types';
import { cn, formatDate } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface CalendarGridProps {
  assignments: Assignment[];
  tests?: Test[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
}

export default function CalendarGrid({ assignments, tests = [], onSelectDate, selectedDate }: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = assignments.filter(a => a.dueDate.startsWith(dateStr));
    const dayTests = tests.filter(t => t.date.startsWith(dateStr));
    return { assignments: dayAssignments, tests: dayTests };
  };

  const subjects = Array.from(new Set(assignments.map(a => a.subject)));
  const getSubjectColor = (subject: string) => {
    const colors = [
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-sky-100 text-sky-700 border-sky-200',
    ];
    const index = subjects.indexOf(subject);
    return colors[index % colors.length];
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-50">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h3>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Study Schedule</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b border-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Body */}
      <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
        {calendarDays.map((day, idx) => {
          const { assignments: dayAssignments, tests: dayTests } = getEventsForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={day.toString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "p-2 border-r border-b border-gray-50 flex flex-col gap-1 transition-all cursor-pointer hover:bg-indigo-50/30 group",
                !isCurrentMonth && "bg-gray-50/50",
                isSelected && "ring-2 ring-inset ring-indigo-500 z-10 bg-indigo-50/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-colors",
                  isToday ? "bg-indigo-600 text-white" : isSelected ? "text-indigo-600" : isCurrentMonth ? "text-gray-700" : "text-gray-300",
                  "group-hover:bg-indigo-100 group-hover:text-indigo-700"
                )}>
                  {format(day, 'd')}
                </span>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-hide">
                {dayAssignments.map(a => (
                  <div 
                    key={a.id} 
                    className={cn(
                      "text-[10px] p-1.5 rounded-lg border leading-tight truncate font-bold",
                      getSubjectColor(a.subject)
                    )}
                    title={a.title}
                  >
                    {a.title}
                  </div>
                ))}
                {dayTests.map(t => (
                  <div 
                    key={t.id} 
                    className="text-[10px] p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 leading-tight truncate font-bold"
                    title={t.title}
                  >
                    📝 {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
