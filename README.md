# 🤖 TechSync WhatsApp Group AI Bot

A clean-architecture, production-grade AI assistant for WhatsApp groups with persistent group memory, ticket/task tracking, scheduled reminders, and meeting catch-up summaries — designed for **near $0 development and hosting costs**.

---

## 🏛️ Clean Architecture

The codebase strictly follows **Clean Architecture / Hexagonal Architecture** principles:

```
src/
├── config/                  # Validated environment configuration
│   └── env.ts
├── domain/                  # Pure TypeScript business logic (Zero external dependencies)
│   ├── models/              # Entities: GroupMessage, Ticket, Reminder, BotIntent
│   ├── repositories/        # Repository Interfaces: IMessageRepo, ITicketRepo, IReminderRepo
│   └── services/            # Service Interfaces: IAIProvider, ISchedulerService, IWhatsAppGateway
├── infrastructure/          # External technology adapters
│   ├── database/            # SQLite client (better-sqlite3) & concrete repositories
│   ├── ai/                  # Google Gemini 2.5 Flash provider & offline fallback regex parser
│   ├── scheduler/           # Precision timer scheduler with persistent recovery
│   └── whatsapp/            # Baileys WhatsApp Web gateway & Mock gateway
├── application/             # Application Use Cases & Pipeline
│   ├── use-cases/           # RecordMessage, ManageTickets, ManageReminders
│   └── orchestrator.ts      # Ingestion, deduplication, context assembly, intent dispatch
├── presentation/            # Ingress & User Interfaces
│   ├── cli-simulator.ts     # Interactive terminal group simulator (No phone required!)
│   └── whatsapp-listener.ts # Baileys event listener bridge
└── index.ts                 # Application bootstrap & graceful shutdown
```

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configure Environment (Optional for Testing)
Copy the environment template:
```bash
cp .env.example .env
```
Inside `.env`, you can add your free **Google AI Studio Key** (`GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com)).
*(Note: If no API key is provided, the bot runs in **Offline Regex Mode** for local testing without breaking!)*

---

## 🧪 Testing

### Run Automated Unit & Integration Tests:
```bash
npm test
```
All 20 unit and integration tests run in ~100ms covering repositories, intent extraction, scheduling, and orchestrator pipelines.

### Try the Interactive CLI Group Simulator:
You can test the entire bot in your terminal without needing any phone or WhatsApp connection:
```bash
npm run sim
```

**Try typing in the simulator:**
1. `Client wants the demo moved`
2. `/switch Priya`
3. `Which day? Deck is half done`
4. `/switch Kiran`
5. `/quote @TechSync Bot make that a ticket for Kiran, P1, due Friday`
6. `@TechSync Bot list tickets`
7. `@TechSync Bot what did we decide?`
8. `@TechSync Bot catch up and summarize`

---

## 📱 Running Live on WhatsApp

When you are ready to link a real WhatsApp number:

```bash
npm start
```

1. A **QR code** will appear in your terminal.
2. On your phone (ideally a secondary SIM or test number), open **WhatsApp ➔ Settings ➔ Linked Devices ➔ Link a Device**.
3. Scan the QR code.
4. Add that number to any WhatsApp group.
5. In the group, tag `@TechSync Bot` (or whatever you configured `BOT_TRIGGER_KEYWORD` to be) to trigger actions!

---

## 💡 Killer Features Implemented

1. **Persistent Group Memory & Q&A:**
   * Every message is recorded into SQLite.
   * Tag `@TechSync Bot what did we decide about the vendor?` to retrieve past decisions with senders and timestamps.

2. **Task & Ticket Tracking:**
   * Turn any message into a tracked ticket:
     `@TechSync Bot make that a ticket for Kiran, P1, due Friday`
   * List open tickets: `@TechSync Bot list tickets`
   * Mark tickets as done: `@TechSync Bot close OPS-1`

3. **Scheduled Reminders:**
   * `@TechSync Bot remind @Kiran to send invoice tomorrow 9am`
   * Stored in SQLite and fires automatically into the group chat even across bot restarts.

4. **Catch-up Summaries:**
   * `@TechSync Bot catch up and summarize`
   * Generates formatted bullet points of recent group decisions and action items.

5. **Audio & Document Parsing (Multimodal):**
   * Uses Gemini Flash to transcribe audio voice notes and analyze PDF documents when replied to with `@TechSync Bot`.
