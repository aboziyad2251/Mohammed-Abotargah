import React from 'react';
import { Appointment } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface NextWidgetProps {
  appointments: Appointment[];
}

export const NextWidget: React.FC<NextWidgetProps> = ({ appointments }) => {
  const now = new Date();
  
  // Find all upcoming appointments and sort them
  const upcoming = appointments
    .filter(a => a.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const nextAppt = upcoming[0];
  const queue = upcoming.slice(1); // The rest of the queue

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
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-5 text-white relative overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
      
      {/* Primary Next Appointment (Hero) */}
      <div className="relative z-10 shrink-0">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block py-1 px-2 rounded bg-white/20 text-[10px] font-bold tracking-wider backdrop-blur-sm border border-white/10 shadow-sm">
                UP NEXT
              </span>
              {nextAppt.urgency === 'high' && (
                <span className="inline-block py-1 px-2 rounded bg-red-500/80 text-[10px] font-bold tracking-wider shadow-sm border border-red-400/50">
                  URGENT
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-tight line-clamp-2">{nextAppt.title}</h2>
          </div>
          <div className="text-right pl-2">
             <CountdownTimer targetDate={nextAppt.start} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
            <Calendar className="w-4 h-4 text-indigo-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Date</p>
              <p className="font-semibold text-sm truncate">{format(nextAppt.start, 'EEEE, MMM do')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
            <Clock className="w-4 h-4 text-indigo-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Time</p>
              <p className="font-semibold text-sm truncate">
                {format(nextAppt.start, 'h:mm a')} - {format(nextAppt.end, 'h:mm a')}
              </p>
            </div>
          </div>
        </div>
        
        {nextAppt.description && (
          <div className="mt-3 text-indigo-50 text-xs bg-black/10 p-2 rounded-lg border border-white/5 line-clamp-2">
            {nextAppt.description}
          </div>
        )}
      </div>

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex-1 min-h-0 flex flex-col">
           <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-3 flex items-center gap-2">
             <span>Queue ({queue.length})</span>
             <span className="h-px flex-1 bg-white/10"></span>
           </h4>
           
           <div className="overflow-y-auto max-h-[240px] pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
             {queue.map((appt) => (
               <div key={appt.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors border border-transparent hover:border-white/5 group">
                 <div className={`w-1 h-8 rounded-full ${appt.color} bg-current opacity-80 shadow-sm relative`}>
                    {appt.urgency === 'high' && (
                       <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white/20 shadow-sm"></span>
                    )}
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="font-medium text-sm truncate text-indigo-50 group-hover:text-white transition-colors">{appt.title}</p>
                   <p className="text-xs text-indigo-300">
                     {format(appt.start, 'MMM d')} • {format(appt.start, 'h:mm a')}
                   </p>
                 </div>
                 <div className="text-right shrink-0">
                    <CountdownTimer 
                      targetDate={appt.start} 
                      compact 
                      className="text-xs font-medium text-indigo-200" 
                    />
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};