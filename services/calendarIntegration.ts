import { Appointment } from '../types';
import { format } from 'date-fns';

export const generateGoogleCalendarLink = (title: string, description: string, start: Date, end: Date) => {
  const startStr = format(start, "yyyyMMdd'T'HHmmss");
  const endStr = format(end, "yyyyMMdd'T'HHmmss");
  const details = encodeURIComponent(description || '');
  const summary = encodeURIComponent(title);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${startStr}/${endStr}&details=${details}`;
};

export const generateOutlookCalendarLink = (title: string, description: string, start: Date, end: Date) => {
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const details = encodeURIComponent(description || '');
  const summary = encodeURIComponent(title);

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${summary}&startdt=${startStr}&enddt=${endStr}&body=${details}`;
};

export const generateICSContent = (appointments: Appointment[]) => {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Chronos//Smart Calendar//EN\n";
  
  appointments.forEach(appt => {
    ics += "BEGIN:VEVENT\n";
    ics += `UID:${appt.id}\n`;
    ics += `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\n`;
    ics += `DTSTART:${format(appt.start, "yyyyMMdd'T'HHmmss")}\n`;
    ics += `DTEND:${format(appt.end, "yyyyMMdd'T'HHmmss")}\n`;
    ics += `SUMMARY:${appt.title}\n`;
    ics += `DESCRIPTION:${appt.description || ''}\n`;
    ics += "END:VEVENT\n";
  });
  
  ics += "END:VCALENDAR";
  return ics;
};

export const downloadICSFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};