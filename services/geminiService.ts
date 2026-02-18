
import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

export const parseNaturalLanguageAppointment = async (
  input: string,
  currentDate: Date
): Promise<{ title: string; description: string; location: string; coordinates?: { lat: number; lng: number }; start: Date; end: Date; color: string; urgency: 'low' | 'medium' | 'high'; status: 'pending' } | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Enable Google Search and Google Maps for grounding
    const tools = [
      { googleSearch: {} },
      { googleMaps: {} } 
    ];

    const prompt = `
      Current Date/Time: ${currentDate.toISOString()}
      User Input: "${input}"
      
      You are a smart calendar assistant.
      
      Task:
      1. Analyze the user's input.
      2. If the user asks about a real-world event (e.g., "When is the next Real Madrid game?", "Concert at Wembley"), use Google Search/Maps to find the exact Date, Time, and Location.
      3. **CRITICAL**: If a specific location is identified (e.g., "Starbucks on 5th Ave", "Eiffel Tower", "Santiago Bernabéu"), YOU MUST extract the precise Latitude and Longitude using the googleMaps tool.
      4. If duration is unknown, assume 1 hour.
      
      Output:
      Return a SINGLE valid JSON object. Do not include markdown formatting. Return ONLY the raw JSON string.
      
      JSON Structure:
      {
        "title": "Concise title of the event",
        "description": "Brief details. Include source if searched.",
        "location": "Name/Address of the location.",
        "coordinates": { "lat": 12.34, "lng": 56.78 } (OR null if no location found),
        "startIso": "ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
        "endIso": "ISO 8601 format",
        "color": "One of: blue, green, red, yellow, purple, pink, indigo, gray.",
        "urgency": "low, medium, or high"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: tools,
      },
    });

    let text = response.text;
    if (!text) return null;

    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Robust extraction
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    const data = JSON.parse(text);
    
    return {
      title: data.title,
      description: data.description || "",
      location: data.location || "",
      coordinates: data.coordinates || undefined,
      start: new Date(data.startIso),
      end: new Date(data.endIso),
      color: data.color ? `bg-${data.color}-500` : 'bg-blue-500',
      urgency: (data.urgency as 'low' | 'medium' | 'high') || 'medium',
      status: 'pending'
    };
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return null;
  }
};

export const generateStrategy = async (
  title: string,
  description: string,
  daysLeft: number,
  start: Date,
  attachments?: Attachment[]
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const urgencyContext = daysLeft < 10 
      ? "URGENCY: HIGH/CRITICAL. The event is imminent. The user needs a RAPID, ACCELERATED execution plan." 
      : "URGENCY: MODERATE/LOW. Provide a steady, well-paced preparation plan.";

    const scheduleInstruction = daysLeft < 3 
      ? "Provide a strictly structured HOUR-BY-HOUR schedule for the remaining time. Be extremely specific." 
      : "Provide a strictly structured DAY-BY-DAY schedule breakdown for the final lead-up. Be specific about what to achieve each day.";

    let textPrompt = `
      Event: "${title}"
      Description: "${description}"
      Due Date: ${start.toDateString()}
      Days Remaining: ${daysLeft.toFixed(1)} days
      ${urgencyContext}
      
      You are a world-class time management coach and academic tutor.
      ${attachments && attachments.length > 0 ? "I have attached lecture notes/files related to this event. Please analyze them (if readable) and incorporate their specific topics into the plan." : ""}

      OUTPUT FORMAT INSTRUCTIONS (Strict Markdown):
      1. **EXECUTIVE SUMMARY**: One bold sentence overview.
      2. **IMMEDIATE ACTIONS**: 3-5 Bullet points of what to do RIGHT NOW.
      3. **DETAILED SCHEDULE**: 
         ${scheduleInstruction} 
         (Format as: **Day 1 (Date):** ... or **09:00 AM - 11:00 AM:** ...)
      4. **KEY RESOURCES/TOPICS**: Based on attached content (if any) or general knowledge.
      
      Do not use conversational filler. Be strict, direct, and helpful. Use bolding for emphasis.
    `;

    const parts: any[] = [];
    
    // Process attachments to add them to the prompt
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        // Handle PDF and Images as inline data (Multimodal)
        if (att.type === 'application/pdf' || att.type.startsWith('image/')) {
          const base64Data = att.content.split(',')[1];
          if (base64Data) {
            parts.push({
              inlineData: {
                mimeType: att.type,
                data: base64Data
              }
            });
          }
        } 
        // Handle Text files by decoding them and appending to the text prompt
        else if (att.type === 'text/plain' || att.type.includes('markdown')) {
          try {
            const base64Data = att.content.split(',')[1];
            const decodedText = atob(base64Data);
            textPrompt += `\n\n--- Attached Content (${att.name}) ---\n${decodedText}\n--- End Content ---\n`;
          } catch (e) {
            console.error("Error decoding text attachment:", e);
          }
        }
      }
    }

    // Add the collected text prompt as the last part
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts }],
    });

    return response.text || null;
  } catch (error) {
    console.error("Gemini strategy generation error:", error);
    return null;
  }
};

export const askAppointmentQuestion = async (
  question: string,
  title: string,
  description: string,
  attachments?: Attachment[]
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let textPrompt = `
      You are an intelligent assistant helping the user with a specific event/task.
      
      Context:
      Event Title: "${title}"
      Description: "${description}"
      User Question: "${question}"
      
      Instructions:
      1. Answer the user's question directly based on the event details and any attached documents (if provided).
      2. If attachments are present, use their content to provide specific answers (e.g., "Based on the attached lecture notes...").
      3. Keep the answer concise and helpful. Use Markdown for formatting.
    `;

    const parts: any[] = [];

    // Process attachments similarly to generateStrategy
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'application/pdf' || att.type.startsWith('image/')) {
          const base64Data = att.content.split(',')[1];
          if (base64Data) {
            parts.push({
              inlineData: {
                mimeType: att.type,
                data: base64Data
              }
            });
          }
        } else if (att.type === 'text/plain' || att.type.includes('markdown')) {
          try {
            const base64Data = att.content.split(',')[1];
            const decodedText = atob(base64Data);
            textPrompt += `\n\n--- Attached Content (${att.name}) ---\n${decodedText}\n--- End Content ---\n`;
          } catch (e) {
            console.error("Error decoding text attachment:", e);
          }
        }
      }
    }

    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts }],
    });

    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini Q&A error:", error);
    return "Error communicating with AI service.";
  }
};
