import { GoogleGenAI, Type, Schema } from "@google/genai";

const parseAppointmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The concise title of the appointment" },
    description: { type: Type.STRING, description: "Additional details or notes" },
    startIso: { type: Type.STRING, description: "Start date and time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)" },
    endIso: { type: Type.STRING, description: "End date and time in ISO 8601 format" },
    color: { type: Type.STRING, description: "Suggested color category (blue, green, red, yellow, purple, pink, indigo, gray)" },
  },
  required: ["title", "startIso", "endIso"],
};

export const parseNaturalLanguageAppointment = async (
  input: string,
  currentDate: Date
): Promise<{ title: string; description?: string; start: Date; end: Date; color?: string } | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Provide context about "now" so relative dates like "tomorrow" work
    const prompt = `
      Current Date/Time: ${currentDate.toISOString()}
      User Input: "${input}"
      
      Extract the appointment details. If the duration is not specified, assume 1 hour.
      Map the color to one of: blue, green, red, yellow, purple, pink, indigo, gray.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: parseAppointmentSchema,
        systemInstruction: "You are a helpful calendar assistant. Accurately parse natural language into structured appointment data.",
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    
    return {
      title: data.title,
      description: data.description || "",
      start: new Date(data.startIso),
      end: new Date(data.endIso),
      color: data.color ? `bg-${data.color}-500` : 'bg-blue-500',
    };
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return null;
  }
};
