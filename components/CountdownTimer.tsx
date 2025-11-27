import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

interface CountdownTimerProps {
  targetDate: Date;
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      if (targetDate <= now) {
        setTimeLeft(null);
        return;
      }

      const d = differenceInDays(targetDate, now);
      const h = differenceInHours(targetDate, now) % 24;
      const m = differenceInMinutes(targetDate, now) % 60;
      const s = differenceInSeconds(targetDate, now) % 60;

      setTimeLeft({ d, h, m, s });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
    return <span className="text-gray-400 italic text-sm">Started or Passed</span>;
  }

  const { d, h, m, s } = timeLeft;

  if (compact) {
    // Determine the most significant unit to show for compact view
    if (d > 0) return <span className="text-orange-600 font-medium">{d}d {h}h left</span>;
    if (h > 0) return <span className="text-orange-600 font-medium">{h}h {m}m left</span>;
    return <span className="text-red-600 font-bold">{m}m {s}s left</span>;
  }

  return (
    <div className="flex gap-2 text-center">
      <div className="flex flex-col bg-slate-100 dark:bg-slate-700 rounded p-1 min-w-[3rem]">
        <span className="font-bold text-lg text-slate-800 dark:text-white">{d}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Days</span>
      </div>
      <div className="flex flex-col bg-slate-100 dark:bg-slate-700 rounded p-1 min-w-[3rem]">
        <span className="font-bold text-lg text-slate-800 dark:text-white">{h}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Hrs</span>
      </div>
      <div className="flex flex-col bg-slate-100 dark:bg-slate-700 rounded p-1 min-w-[3rem]">
        <span className="font-bold text-lg text-slate-800 dark:text-white">{m}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Mins</span>
      </div>
      <div className="flex flex-col bg-slate-100 dark:bg-slate-700 rounded p-1 min-w-[3rem]">
        <span className="font-bold text-lg text-slate-800 dark:text-white">{s}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Secs</span>
      </div>
    </div>
  );
};
