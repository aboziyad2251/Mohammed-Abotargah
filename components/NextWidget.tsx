import React from 'react';
import { Appointment } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface NextWidgetProps {
  appointments: Appointment[];
}

export const NextWidget: React.FC<NextWidgetProps> = ({ appointments }) => {
  const now = new Date();
  
  // Find next appointment
  const nextAppt = appointments
    .filter(a => a.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  if (!nextAppt) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center text-center h-48">
        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-full mb-3">
          <Calendar className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-slate-500 dark:text-slate-400 font-medium">No upcoming appointments</h3>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Enjoy your free time!</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="inline-block py-1 px-2 rounded bg-white/20 text-xs font-semibold mb-2 backdrop-blur-sm border border-white/10">
              UP NEXT
            </span>
            <h2 className="text-2xl font-bold leading-tight">{nextAppt.title}</h2>
          </div>
          <div className="text-right">
             <CountdownTimer targetDate={nextAppt.start} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/10">
            <Calendar className="w-5 h-5 text-indigo-200" />
            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wider">Date</p>
              <p className="font-semibold">{format(nextAppt.start, 'EEEE, MMMM do, yyyy')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/10">
            <Clock className="w-5 h-5 text-indigo-200" />
            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wider">Time</p>
              <p className="font-semibold">
                {format(nextAppt.start, 'h:mm a')} - {format(nextAppt.end, 'h:mm a')}
              </p>
            </div>
          </div>
        </div>
        
        {nextAppt.description && (
          <div className="mt-4 text-indigo-100 text-sm bg-black/10 p-3 rounded-lg border border-white/5">
            {nextAppt.description}
          </div>
        )}
      </div>
    </div>
  );
};
