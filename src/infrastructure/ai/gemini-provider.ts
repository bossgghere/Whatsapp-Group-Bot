import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { IAIProvider } from '../../domain/services/ai-provider.js';
import { GroupMessage } from '../../domain/models/message.js';
import { ParsedBotIntent } from '../../domain/models/bot-action.js';

export class GeminiAIProvider implements IAIProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private candidateModels: string[];

  constructor(apiKey: string, modelName?: string) {
    this.candidateModels = modelName
      ? [modelName, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash']
      : ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

    if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  private async executeWithFallback<T>(fn: (modelName: string) => Promise<T>): Promise<T> {
    let lastError: any;
    for (const model of this.candidateModels) {
      try {
        return await fn(model);
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiProvider] Model "${model}" failed (${err?.status || err?.message?.slice(0, 80)}). Trying fallback...`);
      }
    }
    throw lastError;
  }

  async parseIntent(
    prompt: string,
    contextMessages: GroupMessage[],
    quotedMessage?: GroupMessage | null
  ): Promise<ParsedBotIntent> {
    if (!this.genAI) {
      return this.fallbackRegexParser(prompt, quotedMessage);
    }

    try {
      return await this.executeWithFallback(async (modelName) => {
        const model = this.genAI!.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const now = new Date();
        const localTimeStr = now.toLocaleString('en-US', { timeZone: userTz });

        const formattedContext = contextMessages
          .map((m) => `[${new Date(m.timestamp).toLocaleTimeString('en-US', { timeZone: userTz })}] ${m.senderName}: ${m.text}`)
          .join('\n');

        const quotedContext = quotedMessage
          ? `Quoted/Referenced Message: [${new Date(quotedMessage.timestamp).toLocaleTimeString('en-US', { timeZone: userTz })}] ${quotedMessage.senderName}: "${quotedMessage.text}"`
          : 'None';

        const systemInstruction = `
You are the intelligent assistant for a WhatsApp group ("TechSync Bot").
Current Local Time: ${localTimeStr} (Timezone: ${userTz}, Current Epoch: ${now.getTime()}).

Analyze the user's prompt, recent chat history, and any quoted message.
Classify the intent into ONE of these types:
- "create_ticket": The user wants to create or track a ticket/task (e.g., "make that a ticket for Kiran, P1, due Friday").
- "close_ticket": The user wants to mark a ticket as done or closed (e.g., "close OPS-14" or "OPS-14 is done").
- "list_tickets": The user wants to see open tickets or tasks.
- "create_reminder": The user wants a reminder (e.g., "remind me at 7 pm that I have a meeting at 7:30 pm today", "remind @Ravi in 2 hours").
- "summary": The user wants a catch-up or summary of recent conversation.
- "qa": The user is asking a question (e.g. today's date, what someone said, how are you, general help).

CRITICAL FOR REMINDERS:
When user says "remind me at 7 pm that ...", calculate the EXACT targetTimeMs (Unix milliseconds timestamp) for that specific time today in ${userTz}.
Also extract the reminder prompt text and target user.

CRITICAL FOR QA:
Provide a clear, friendly, helpful directAnswer in natural language with WhatsApp formatting (*bold*).
If asked about today's date or time, answer accurately using Current Local Time: ${localTimeStr}.

Return JSON strictly matching this schema:
{
  "type": "create_ticket" | "close_ticket" | "list_tickets" | "create_reminder" | "summary" | "qa",
  "confidence": number between 0 and 1,
  "explanation": "brief reasoning",
  "ticketData": {
    "title": "task title",
    "assignee": "assignee name e.g. Kiran",
    "priority": "P1" | "P2" | "P3",
    "dueDate": "e.g. Fri 3 Oct or Friday"
  },
  "closeTicketData": {
    "ticketId": "e.g. OPS-14"
  },
  "reminderData": {
    "targetTimeMs": number (Unix timestamp in ms),
    "prompt": "what the reminder is about",
    "targetUser": "user to remind"
  },
  "directAnswer": "direct answer if type is qa or summary"
}
`;

        const userContent = `
Current Local Time: ${localTimeStr}
Recent Chat History:
${formattedContext || 'No recent messages'}

${quotedContext}

User Message / Instruction:
"${prompt}"
`;

        const result = await model.generateContent([
          { text: systemInstruction },
          { text: userContent },
        ]);

        const responseText = result.response.text();
        const parsed = JSON.parse(responseText) as ParsedBotIntent;
        return parsed;
      });
    } catch (err) {
      console.error('[GeminiProvider] All models failed, using fallback:', err);
      return this.fallbackRegexParser(prompt, quotedMessage);
    }
  }

  async answerQuery(question: string, contextMessages: GroupMessage[]): Promise<string> {
    if (!this.genAI) {
      return `[Bot Demo Mode] Received question: "${question}".`;
    }

    try {
      return await this.executeWithFallback(async (modelName) => {
        const model = this.genAI!.getGenerativeModel({ model: modelName });
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const formattedContext = contextMessages
          .map((m) => `[${new Date(m.timestamp).toLocaleTimeString('en-US', { timeZone: userTz })}] ${m.senderName}: ${m.text}`)
          .join('\n');

        const prompt = `
You are the WhatsApp group memory bot. Answer the user's question accurately using facts from chat history or general knowledge.
Current Date/Time: ${new Date().toLocaleString('en-US', { timeZone: userTz })}.
Keep answers concise, clear, and formatted nicely with WhatsApp markdown (*bold*, _italic_).

Chat History:
${formattedContext}

Question:
"${question}"
`;
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      });
    } catch (err) {
      console.error('[GeminiProvider] answerQuery error across all models:', err);
      return `I received your question: "${question}".`;
    }
  }

  async summarizeHistory(contextMessages: GroupMessage[]): Promise<string> {
    if (!this.genAI) {
      return `*Group Catch-up Summary:*\nRecent ${contextMessages.length} messages received.`;
    }

    try {
      return await this.executeWithFallback(async (modelName) => {
        const model = this.genAI!.getGenerativeModel({ model: modelName });
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const formattedContext = contextMessages
          .map((m) => `[${new Date(m.timestamp).toLocaleTimeString('en-US', { timeZone: userTz })}] ${m.senderName}: ${m.text}`)
          .join('\n');

        const prompt = `
Summarize the key updates, decisions, and action items from this WhatsApp group chat.
Format nicely with WhatsApp bold bullets:
- *Key Decisions:*
- *Open Tasks:*
- *Important Updates:*

Chat History:
${formattedContext}
`;
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      });
    } catch (err) {
      console.error('[GeminiProvider] summarizeHistory error:', err);
      return 'Unable to generate chat summary at this moment.';
    }
  }

  async analyzeMedia(mediaBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
    if (!this.genAI) {
      return `[Demo Mode] Media received (${mimeType}, ${mediaBuffer.length} bytes).`;
    }

    try {
      return await this.executeWithFallback(async (modelName) => {
        const model = this.genAI!.getGenerativeModel({ model: modelName });
        const part: Part = {
          inlineData: {
            data: mediaBuffer.toString('base64'),
            mimeType,
          },
        };

        const result = await model.generateContent([
          part,
          `Analyze or transcribe this attachment. If audio, transcribe it and translate or summarize if asked. If document/image, extract key details.
Instruction: ${prompt || 'Summarize the contents concisely.'}`,
        ]);

        return result.response.text().trim();
      });
    } catch (err) {
      console.error('[GeminiProvider] analyzeMedia error:', err);
      return 'Could not process the media file.';
    }
  }

  private fallbackRegexParser(prompt: string, quotedMessage?: GroupMessage | null): ParsedBotIntent {
    const lower = prompt.toLowerCase();

    // Check for close ticket: "close OPS-14", "OPS-14 done"
    const closeMatch = prompt.match(/(?:close|done|resolve|finish)\s+(OPS-\d+)/i) ||
      prompt.match(/(OPS-\d+)\s+(?:is\s+)?(?:done|closed|resolved)/i);
    if (closeMatch) {
      return {
        type: 'close_ticket',
        confidence: 0.9,
        closeTicketData: { ticketId: closeMatch[1].toUpperCase() },
      };
    }

    // Check for list tickets
    if (lower.includes('tickets') || lower.includes('tasks') || lower.includes('open tickets')) {
      return {
        type: 'list_tickets',
        confidence: 0.85,
      };
    }

    // Check for create ticket: "make that a ticket for Kiran, P1, due Friday"
    if (lower.includes('ticket') || lower.includes('task')) {
      const assigneeMatch = prompt.match(/for\s+([A-Za-z0-9_@]+)/i);
      const priorityMatch = prompt.match(/\b(P[1-3])\b/i);
      const dueMatch = prompt.match(/due\s+([A-Za-z0-9\s]+)/i);

      const title = quotedMessage ? quotedMessage.text : prompt;
      return {
        type: 'create_ticket',
        confidence: 0.85,
        ticketData: {
          title: title.slice(0, 100),
          assignee: assigneeMatch ? assigneeMatch[1].replace('@', '') : 'Unassigned',
          priority: (priorityMatch ? priorityMatch[1].toUpperCase() : 'P2') as 'P1' | 'P2' | 'P3',
          dueDate: dueMatch ? dueMatch[1].trim() : undefined,
        },
      };
    }

    // Check for summary: "catch up", "summarize"
    if (lower.includes('summarize') || lower.includes('summary') || lower.includes('catch up')) {
      return {
        type: 'summary',
        confidence: 0.9,
      };
    }

    // Check for reminder: "remind me in 10 minutes", "remind @Kiran"
    if (lower.includes('remind')) {
      const userMatch = prompt.match(/remind\s+@?([A-Za-z0-9_]+)/i);
      return {
        type: 'create_reminder',
        confidence: 0.85,
        reminderData: {
          targetTimeMs: Date.now() + 60 * 1000,
          prompt: prompt,
          targetUser: userMatch ? userMatch[1] : undefined,
        },
      };
    }

    // Date/time direct query
    if (lower.includes('date') || lower.includes("today's date")) {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const today = new Date().toLocaleDateString('en-US', {
        timeZone: userTz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return {
        type: 'qa',
        confidence: 0.9,
        directAnswer: `Today is *${today}*.`,
      };
    }

    // Default to Q&A
    return {
      type: 'qa',
      confidence: 0.7,
      directAnswer: `I'm doing great! How can I assist you with your group today?`,
    };
  }
}
