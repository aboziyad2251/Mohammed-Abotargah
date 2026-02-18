import React, { useState } from 'react';
import { Appointment } from '../types';
import { X, Zap, Calendar, AlertTriangle, Clock, Sparkles, Paperclip } from 'lucide-react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { generateStrategy } from '../services/geminiService';

interface SmartPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSaveStrategy: (id: string, strategy: string) => void;
}

// Helper to parse simple inline markdown (**bold**)
const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="text-slate-900 dark:text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export const SmartPlanDrawer: React.FC<SmartPlanDrawerProps> = ({
  isOpen,
  onClose,
  appointment,
  onSaveStrategy
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState<string | null>(null);

  if (!isOpen || !appointment) return null;

  const now = new Date();
  const daysLeft = differenceInDays(appointment.start, now);
  const hoursLeft = differenceInHours(appointment.start, now);
  
  // Urgency Logic
  const isUrgent = daysLeft < 10;
  const isCritical = daysLeft < 3;
  
  let urgencyColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  let urgencyLabel = 'On Track';
  let urgencyIcon = <Clock className="w-5 h-5" />;

  if (isCritical) {
    urgencyColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    urgencyLabel = 'Critical Urgency';
    urgencyIcon = <AlertTriangle className="w-5 h-5" />;
  } else if (isUrgent) {
    urgencyColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    urgencyLabel = 'High Urgency (< 10 Days)';
    urgencyIcon = <Zap className="w-5 h-5" />;
  }

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    const result = await generateStrategy(
      appointment.title,
      appointment.description,
      daysLeft + (hoursLeft % 24) / 24, // Exact fractional days
      appointment.start,
      appointment.attachments // Pass attachments for analysis
    );
    
    if (result) {
      setGeneratedStrategy(result);
      onSaveStrategy(appointment.id, result);
    }
    setIsLoading(false);
  };

  const currentStrategy = generatedStrategy || appointment.aiStrategy;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Smart Planner</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          
          {/* Event Context Card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
             <div className="flex justify-between items-start">
               <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{appointment.title}</h3>
               <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${urgencyColor}`}>
                 {urgencyIcon} {urgencyLabel}
               </span>
             </div>
             <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>{appointment.start.toDateString()}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>{daysLeft} days remaining</span>
             </div>
             {appointment.description && (
               <p className="text-sm text-slate-600 dark:text-slate-300 italic border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                 "{appointment.description}"
               </p>
             )}
             {appointment.attachments && appointment.attachments.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                   <Paperclip className="w-3 h-3" />
                   <span>{appointment.attachments.length} file(s) attached for AI analysis</span>
                </div>
             )}
          </div>

          {/* Action Area */}
          <div className="space-y-4">
             {isUrgent ? (
               <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-lg text-sm text-orange-800 dark:text-orange-200">
                 <strong>Heads up:</strong> This event is coming up fast. We recommend generating a rapid execution plan to stay on track.
               </div>
             ) : (
               <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                 You have plenty of time. Let's create a steady schedule to avoid last-minute stress.
               </div>
             )}

             <button
               onClick={handleGeneratePlan}
               disabled={isLoading}
               className={`w-full py-3 px-4 rounded-xl font-bold shadow-lg transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2
                 ${isLoading 
                   ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                   : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30'
                 }
               `}
             >
               {isLoading ? (
                 <>
                   <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                   Analyzing Time & Files...
                 </>
               ) : (
                 <>
                   <Zap className="w-5 h-5 fill-current" />
                   {currentStrategy ? 'Regenerate Strategy' : 'Generate Smart Plan'}
                 </>
               )}
             </button>
          </div>

          {/* Strategy Output */}
          {currentStrategy && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                 {/* Enhanced Markdown Renderer */}
                 {currentStrategy.split('\n').map((line, i) => {
                   const trimmed = line.trim();
                   if (!trimmed) return <div key={i} className="h-2" />;

                   // 1. Major Section Headers (e.g. "1. **EXECUTIVE SUMMARY**:")
                   // Matches digits followed by bold text
                   if (trimmed.match(/^\d+\.\s\*\*.*\*\*[:]?/)) {
                      return (
                        <div key={i} className="mt-6 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                          <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            {trimmed.replace(/^\d+\.\s/, '').replace(/\*\*/g, '').replace(':', '')}
                          </h3>
                        </div>
                      );
                   }

                   // 2. Schedule Blocks (Start with **Bold Key**:)
                   // This captures "Day 1:" or "09:00 AM - 10:00 AM:"
                   const boldPrefixMatch = trimmed.match(/^(\*\*.*?\*\*:?)(.*)/);
                   if (boldPrefixMatch) {
                       const [_, prefix, content] = boldPrefixMatch;
                       const cleanPrefix = prefix.replace(/\*\*/g, '').replace(':', '');
                       const cleanContent = content.trim();

                       return (
                         <div key={i} className="mb-3 pl-3 border-l-2 border-indigo-400 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-lg p-2.5">
                            <div className="text-sm font-bold text-slate-800 dark:text-white mb-0.5">
                              {cleanPrefix}
                            </div>
                            {cleanContent && (
                              <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                {renderInlineMarkdown(cleanContent)}
                              </div>
                            )}
                         </div>
                       );
                   }

                   // 3. List Items
                   if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                     return (
                       <div key={i} className="flex gap-2.5 ml-1 mb-2 text-sm text-slate-700 dark:text-slate-300">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                          <div className="leading-relaxed">{renderInlineMarkdown(trimmed.replace(/^[-*]\s/, ''))}</div>
                       </div>
                     );
                   }
                   
                   // 4. Numbered Lists (Sub-lists)
                   if (trimmed.match(/^\d+\./)) {
                      return (
                        <div key={i} className="flex gap-2 ml-2 mb-2 text-sm text-slate-700 dark:text-slate-300">
                           <span className="font-bold text-indigo-600 dark:text-indigo-400 min-w-[1.5rem]">{trimmed.split('.')[0]}.</span>
                           <span className="flex-1 leading-relaxed">{renderInlineMarkdown(trimmed.replace(/^\d+\.\s*/, ''))}</span>
                        </div>
                      );
                   }

                   // 5. Standard Text
                   return (
                     <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                       {renderInlineMarkdown(trimmed)}
                     </p>
                   );
                 })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};