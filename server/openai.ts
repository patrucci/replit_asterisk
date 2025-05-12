import OpenAI from "openai";
import { Client } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-sample" });

// Generate message suggestions based on client context
export async function generateMessageSuggestions(
  client: Client,
  context: string
): Promise<string[]> {
  try {
    const prompt = `
      You are a professional and helpful assistant for a service provider using ProConnect CRM.
      Generate 3 short, professional message suggestions to send to a client via WhatsApp based on this context:
      
      Client Name: ${client.name}
      Client Area: ${client.area}
      Context: ${context}
      
      Please provide 3 concise professional message suggestions, each under 120 characters.
      Format the response as a JSON array of strings.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    return Array.isArray(result.suggestions) 
      ? result.suggestions 
      : ["Não foi possível gerar sugestões."];
  } catch (error) {
    console.error("Error generating message suggestions:", error);
    return [
      "Olá, como posso ajudar?",
      "Gostaria de agendar uma consulta?",
      "Estou à disposição para esclarecer qualquer dúvida."
    ];
  }
}

// Generate a summary of client interactions
export async function generateInteractionSummary(
  clientName: string,
  interactions: string
): Promise<string> {
  try {
    const prompt = `
      Summarize the following interactions with the client ${clientName}:
      
      ${interactions}
      
      Please provide a concise professional summary of these interactions highlighting key points and any action items.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content || "Não foi possível gerar um resumo.";
  } catch (error) {
    console.error("Error generating interaction summary:", error);
    return "Não foi possível gerar um resumo das interações.";
  }
}
