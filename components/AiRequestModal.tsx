
import React, { useState, useRef, useEffect } from 'react';
import { Appointment } from '../types';
import { X, Send, Bot, User, Paperclip, Loader2, Sparkles } from 'lucide-react';
import { askAppointmentQuestion } from '../services/geminiService';

interface AiRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export const AiRequestModal: React.FC<AiRequestModalProps> = ({
  isOpen,
  onClose,
  appointment
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset or initialize when opened
      if (messages.length === 0) {
        setMessages([
          {
            id: 'init',
            role: 'ai',
            content: `Hi! I'm ready to help you with **${appointment?.title}**. Ask me anything about the schedule, strategy, or attached files.`,
            timestamp: new Date()
          }
        ]);
      }
    }
  }, [isOpen, appointment]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !appointment) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsTyping(true);

    const response = await askAppointmentQuestion(
      userMsg.content,
      appointment.title,
      appointment.description,
      appointment.attachments
    );

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'ai',
      content: response || "Sorry, I couldn't process that request.",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[600px] border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
               <h2 className="font-bold text-slate-800 dark:text-white">AI Request</h2>
               <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{appointment.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center shrink-0
                ${msg.role === 'ai' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}
              `}>
                {msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none'
                }
              `}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {/* Simple renderer for bolding, standard markdown usually requires a library */}
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="mb-1 last:mb-0">
                        {line.split(/(\*\*.*?\*\*)/).map((part, j) => 
                           part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
                        )}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                 <Bot className="w-4 h-4" />
               </div>
               <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-100 dark:border-slate-700">
                 <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2">
          {appointment.attachments && appointment.attachments.length > 0 && (
             <div className="flex items-center justify-center px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500" title="Files attached">
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">{appointment.attachments.length}</span>
             </div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a specific question..."
            className="flex-1 bg-slate-100 dark:bg-slate-900 border-0 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!query.trim() || isTyping}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
