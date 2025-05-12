import OpenAI from "openai";
import { Client } from "@shared/schema";

// Inicializar a API do OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// O modelo mais atual do OpenAI
const MODEL = "gpt-4o"; // O modelo atual mais avançado disponível em maio de 2025

// Interface para o pedido de geração de chamada
interface GenerateCallRequest {
  client: Client;
  purpose: "schedule" | "confirm" | "remind" | "reschedule" | "cancel";
  appointmentDate?: string;
  appointmentType?: string;
  customInstructions?: string;
  useCustomInstructions?: boolean;
}

// Interface para as configurações de chamada
interface CallSettings {
  voiceType: "female1" | "female2" | "male1" | "male2";
  maxAttempts: number;
  responseTimeout: number;
  maxCallDuration: number;
  speechRate: number;
}

// Interface para a transcrição de chamada
interface CallTranscription {
  segments: {
    speaker: "system" | "user";
    text: string;
    start: number;
    end: number;
  }[];
  summary: string;
  duration: number;
}

// Interface para a análise de chamada
interface CallAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  nextSteps: string[];
  keyPoints: string[];
  clientIntent: string;
  appointmentStatus?: "confirmed" | "cancelled" | "rescheduled" | "pending";
}

// Gerar script para chamada com base no propósito
export async function generateCallScript(req: GenerateCallRequest): Promise<string> {
  if (req.useCustomInstructions && req.customInstructions) {
    return req.customInstructions;
  }

  const systemPrompt = `Você é um assistente de IA especializado em criar scripts para chamadas telefônicas
com clientes de profissionais autônomos. Crie um script natural e conversacional que
siga as melhores práticas para chamadas telefônicas. O script deve ser respeitoso,
conciso e focado no objetivo da chamada.`;

  let userPrompt = `Gere um script para uma chamada telefônica ${getPurposeDescription(req.purpose)} para um cliente.
Nome do cliente: ${req.client.name}
Telefone: ${req.client.phone}
`;

  if (req.appointmentDate) {
    userPrompt += `Data do agendamento: ${req.appointmentDate}\n`;
  }

  if (req.appointmentType) {
    userPrompt += `Tipo de agendamento: ${req.appointmentType}\n`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "Não foi possível gerar um script.";
  } catch (error) {
    console.error("Erro ao gerar script:", error);
    return "Erro ao gerar script de chamada.";
  }
}

// Analisar uma transcrição de chamada para extrair insights
export async function analyzeCallTranscription(transcription: CallTranscription): Promise<CallAnalysis> {
  const fullTranscript = transcription.segments
    .map(s => `${s.speaker === 'system' ? 'Assistente' : 'Cliente'}: ${s.text}`)
    .join("\n");

  const systemPrompt = `Você é um analista especializado em avaliar conversas telefônicas entre assistentes
virtuais e clientes. Analise a seguinte transcrição de uma chamada e extraia insights
valiosos que podem ajudar a melhorar o relacionamento com o cliente e futuras interações.`;

  const userPrompt = `Analise esta conversa telefônica entre um assistente virtual e um cliente:

${fullTranscript}

Forneça:
1. Sentimento geral do cliente (positivo, neutro ou negativo)
2. Próximos passos recomendados
3. Pontos-chave discutidos
4. Intenção principal do cliente
5. Status do agendamento (se aplicável)`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
    const analysis = JSON.parse(content);

    // Garantir que o formato da análise está correto
    return {
      sentiment: analysis.sentiment || "neutral",
      nextSteps: analysis.next_steps || [],
      keyPoints: analysis.key_points || [],
      clientIntent: analysis.client_intent || "",
      appointmentStatus: analysis.appointment_status,
    };
  } catch (error) {
    console.error("Erro ao analisar transcrição:", error);
    return {
      sentiment: "neutral",
      nextSteps: ["Contatar o cliente para esclarecer dúvidas"],
      keyPoints: ["Ocorreu um erro na análise da chamada"],
      clientIntent: "Indeterminado",
    };
  }
}

// Gerar uma resposta contextual durante uma conversa
export async function generateResponse(
  conversation: { role: "system" | "user"; content: string }[],
  currentContext: any
): Promise<string> {
  const systemPrompt = `Você é um assistente virtual telefônico profissional chamado Sofia.
  
Sua tarefa é conversar com um cliente de forma natural e humanizada, mantendo a
conversa focada no objetivo estabelecido. Responda de forma concisa, em um estilo
conversacional adequado para chamadas telefônicas. Seja educado, profissional e
empático.

Contexto atual da chamada:
- Propósito: ${currentContext.purpose || 'não especificado'}
${currentContext.appointmentDate ? `- Data de agendamento: ${currentContext.appointmentDate}` : ''}
${currentContext.appointmentType ? `- Tipo de agendamento: ${currentContext.appointmentType}` : ''}
${currentContext.clientName ? `- Nome do cliente: ${currentContext.clientName}` : ''}

Lembre-se:
- Suas respostas devem ser curtas, naturais e conversacionais.
- Evite textos longos e formais que pareçam mensagens escritas.
- Mantenha um tom amigável mas profissional.
- Se o cliente desviar do assunto, gentilmente traga-o de volta ao objetivo principal.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversation.slice(-10) // Manter apenas as últimas 10 mensagens para contexto
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || "Desculpe, não entendi. Pode repetir?";
  } catch (error) {
    console.error("Erro ao gerar resposta:", error);
    return "Estou com dificuldades técnicas. Vou pedir para um atendente humano entrar em contato com você.";
  }
}

// Função auxiliar para obter descrição do propósito da chamada
function getPurposeDescription(purpose: string): string {
  switch (purpose) {
    case "schedule":
      return "para agendar uma consulta";
    case "confirm":
      return "para confirmar uma consulta agendada";
    case "remind":
      return "para lembrar sobre uma consulta agendada";
    case "reschedule":
      return "para reagendar uma consulta";
    case "cancel":
      return "para cancelar uma consulta";
    default:
      return "sobre um agendamento";
  }
}

// Função auxiliar para formatar o texto do script com valores dinâmicos
export function formatScriptWithValues(script: string, values: Record<string, string>): string {
  let formattedScript = script;
  
  for (const [key, value] of Object.entries(values)) {
    formattedScript = formattedScript.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  
  return formattedScript;
}

// Função auxiliar para formatar números de telefone para o formato Asterisk
export function formatPhoneForAsterisk(phone: string): string {
  // Remover todos os caracteres não numéricos
  const cleanNumber = phone.replace(/\D/g, '');
  
  // Se começar com zero ou com o código do país, ajustar conforme necessário
  // Esta é uma lógica simplificada que pode precisar de ajustes dependendo do país
  if (cleanNumber.startsWith('0')) {
    return cleanNumber.substring(1);
  } else if (cleanNumber.startsWith('55')) {
    return cleanNumber.substring(2);
  }
  
  return cleanNumber;
}

// Interface para interagir com o Asterisk (esta seria a implementação real em um ambiente de produção)
export interface AsteriskInterface {
  initiateCall(phoneNumber: string, callSettings: CallSettings): Promise<string>;
  endCall(callId: string): Promise<void>;
  playTTS(callId: string, text: string, voice?: string): Promise<void>;
  recordAudio(callId: string, maxDuration?: number): Promise<string>;
  waitForInput(callId: string, timeout?: number): Promise<string>;
}

// Implementação simulada (mock) da interface do Asterisk para ambiente de desenvolvimento
export class MockAsteriskInterface implements AsteriskInterface {
  async initiateCall(phoneNumber: string, callSettings: CallSettings): Promise<string> {
    console.log(`[MOCK] Iniciando chamada para ${phoneNumber} com configurações:`, callSettings);
    return `call-${Date.now()}`;
  }

  async endCall(callId: string): Promise<void> {
    console.log(`[MOCK] Encerrando chamada ${callId}`);
  }

  async playTTS(callId: string, text: string, voice?: string): Promise<void> {
    console.log(`[MOCK] Reproduzindo no ID de chamada ${callId} com voz ${voice || 'padrão'}: "${text}"`);
  }

  async recordAudio(callId: string, maxDuration?: number): Promise<string> {
    console.log(`[MOCK] Gravando áudio na chamada ${callId} por ${maxDuration || 10} segundos`);
    return `recording-${Date.now()}.wav`;
  }

  async waitForInput(callId: string, timeout?: number): Promise<string> {
    console.log(`[MOCK] Aguardando entrada na chamada ${callId} por ${timeout || 5} segundos`);
    return "Simulação de resposta do cliente";
  }
}

// Exportar a interface do Asterisk (usaria a implementação real em produção)
export const asteriskInterface = new MockAsteriskInterface();