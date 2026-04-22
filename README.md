<div align="center">

# 🛡️ AI-Powered Threat Detection & Intelligence System

### Real-Time Audio Surveillance Intelligence for National Security

[![Demo Video](https://img.shields.io/badge/▶%20Watch%20Demo-Google%20Drive-red?style=for-the-badge&logo=google-drive)](https://drive.google.com/file/d/15wfODSVjZ6B8_3-etgLTyf-_O86hSpAv/view?usp=sharing)
[![GitHub](https://img.shields.io/badge/GitHub-Threat_detection_system-black?style=for-the-badge&logo=github)](https://github.com/satvik-sharma-05/Threat_detection_system)

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi)
![Groq](https://img.shields.io/badge/Groq-Whisper%20%2B%20Llama%203.3-orange?style=flat-square)
![License](https://img.shields.io/badge/License-Defense%20Use-red?style=flat-square)

</div>

---

## 👥 Team

| Name | Contact |
|------|---------|
| **Satvik Sharma** | 📞 9877215112 · [GitHub @satvik-sharma-05](https://github.com/satvik-sharma-05) |
| **Ritvik Sharma** | 📞 9056487674 |

---

## 📹 Demo

https://github.com/satvik-sharma-05/Threat_detection_system/raw/main/images/attack_prediction.mp4

> Can't play? Watch on [Google Drive](https://drive.google.com/file/d/15wfODSVjZ6B8_3-etgLTyf-_O86hSpAv/view?usp=sharing)

---

## 📌 Project Overview

This project is an end-to-end AI-driven threat detection system capable of processing intercepted audio communications from multiple sources — military, police, and civilian channels — to automatically identify, analyze, and connect criminal and terrorist activities in real time.

The system leverages **Groq Whisper** for multi-language transcription and **Llama 3.3 70B** for deep threat analysis, entity extraction, and semantic cross-conversation intelligence linking — enabling agencies like RAW to process thousands of audio intercepts and surface threat patterns automatically.

---

## 🖥️ Screenshots

<table>
<tr>
<td><img src="images/dashboard.png" alt="Dashboard"/><br/><sub><b>Intelligence Dashboard</b></sub></td>
<td><img src="images/upload.png" alt="Upload"/><br/><sub><b>Audio Upload & Analysis</b></sub></td>
</tr>
<tr>
<td><img src="images/analysis_1.png" alt="Analysis"/><br/><sub><b>Full Threat Analysis</b></sub></td>
<td><img src="images/analysis__2.png" alt="Analysis 2"/><br/><sub><b>Entity Extraction</b></sub></td>
</tr>
<tr>
<td><img src="images/analysis_3.png" alt="Analysis 3"/><br/><sub><b>Code Word Detection</b></sub></td>
<td><img src="images/analysis_4.png" alt="Analysis 4"/><br/><sub><b>Threat Assessment</b></sub></td>
</tr>
<tr>
<td><img src="images/alert_1.png" alt="Alerts"/><br/><sub><b>Threat Alerts</b></sub></td>
<td><img src="images/alert_2.png" alt="Alert Detail"/><br/><sub><b>Alert Detail View</b></sub></td>
</tr>
<tr>
<td><img src="images/knowlegraph.png" alt="Knowledge Graph"/><br/><sub><b>Knowledge Graph</b></sub></td>
<td><img src="images/entity.png" alt="Entities"/><br/><sub><b>Entity Explorer</b></sub></td>
</tr>
<tr>
<td><img src="images/conversations.png" alt="Conversations"/><br/><sub><b>Conversation History</b></sub></td>
<td><img src="images/alert_3.png" alt="Alert 3"/><br/><sub><b>Connected Conversations</b></sub></td>
</tr>
</table>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND  (React 18)                      │
│                                                                  │
│  Dashboard │ Upload │ Analysis History │ Entities │ Alerts       │
│  Knowledge Graph (Force-Directed) │ Batch Upload                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST API (HTTP/JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                      BACKEND  (FastAPI)                          │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────┐  │
│  │  Audio Pipeline  │   │  Analysis Engine  │   │  Connector  │  │
│  │                  │   │                  │   │             │  │
│  │ Whisper (Groq)   │   │ Llama 3.3 70B    │   │  Semantic   │  │
│  │ Multi-language   │──▶│ Entity Extract   │──▶│  Connect    │  │
│  │ Auto-translate   │   │ Threat Score     │   │  the Dots   │  │
│  │ 15+ languages    │   │ Code Word Decode │   │  LLM-based  │  │
│  └─────────────────┘   └──────────────────┘   └─────────────┘  │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────┐  │
│  │  SQLite + ORM   │   │  ChromaDB Vector │   │ Rate Limiter│  │
│  │  Conversations  │   │  Semantic Search │   │ Smart Models│  │
│  │  Persons/Locs   │   │  Embeddings      │   │ Token Track │  │
│  └─────────────────┘   └──────────────────┘   └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Methodology

### Step 1 — Audio Ingestion
The system accepts audio files (WAV, MP3, M4A, FLAC, OGG) via drag-and-drop upload or batch upload (up to 1000 files). A duplicate prevention mechanism checks filenames before processing to ensure each file is analyzed exactly once.

### Step 2 — Multi-Language Transcription
Audio is sent to **Groq Whisper Large V3** using `verbose_json` response format, which returns both the transcript and the detected language code. The system supports 15+ languages including Hindi (`hi`), Urdu (`ur`), Pashto (`ps`), Arabic (`ar`), Bengali (`bn`), Punjabi (`pa`), Tamil (`ta`), and more.

### Step 3 — Automatic Translation
If the detected language is non-English, a second LLM call translates the transcript to English using a strict system prompt: *"You are a professional translator. Output ONLY the English translation."* Both the original and translated transcripts are stored and displayed side-by-side. The English version is used for all downstream analysis to maximize accuracy.

### Step 4 — Deep Threat Analysis
The English transcript is analyzed by **Llama 3.3 70B** with a structured extraction prompt. The LLM returns a JSON object containing:
- `threat_score` (0–100)
- `crime_types` (terrorism, drugs, weapons, human trafficking, money laundering, cyber, fraud, corruption, extortion, gambling, smuggling)
- `persons` — all names mentioned including nicknames
- `locations` — cities, streets, buildings, landmarks
- `organizations` — gangs, companies, groups
- `weapons`, `vehicles`, `money`, `dates_times`
- `harm_prediction` — what harm might occur
- `reasoning` — why this is a threat

### Step 5 — Semantic Feature Extraction
A second, cheaper LLM pass (**Llama 3.1 8B**) extracts semantic features for connection detection:
- **Code words** with their likely meanings inferred from context (no hardcoded dictionary)
- **Main theme** and **intent** of the conversation
- **Urgency level** (low/medium/high/critical)
- **Temporal markers** ("tomorrow", "next week")
- **Action items** — specific actions mentioned
- **Semantic tags** — keywords capturing the essence

### Step 6 — Entity Normalization & Storage
All extracted entities are normalized to consistent object shapes before storage. Persons are stored in the `persons` table with threat scores and mention counts. Locations are stored with threat levels and event counts. All raw analysis data is stored as JSON in the `extracted_entities` field of the conversation record.

### Step 7 — "Connect the Dots" Engine
Every new conversation is compared against all existing conversations using 6 detection methods:

| Method | Points | Description |
|--------|--------|-------------|
| LLM Semantic Similarity | 0–50 | LLM compares themes, code words, intent across conversations |
| Same Persons | 35 | Exact person match across conversations |
| Person Alias Detection | 30 | LLM detects Muhammad = Mohd = Md |
| Same Crime Type | 20 | Both conversations about same crime |
| Same Locations | 20 | Both mention same place |
| Same Weapons | 25 | Both mention same weapon type |

A connection is created when total strength ≥ 20 points. The LLM semantic comparison is the most powerful method — it understands that *"Diwali gifts via Nepal"* and *"festival package arrived"* are the same weapons shipment, even with completely different words.

### Step 8 — Threat Scoring & Alert Generation
Final threat score is calculated as:
```
final_score = (base_llm_score × 0.4) + (connections × 15, max 35) + 25
```
If `final_score ≥ 75`, an alert is automatically created with:
- Severity: **Critical** (≥90) / **High** (≥75)
- Evidence snippets that triggered the alert
- Connected conversations and persons
- Recommended action (Immediate Escalation / Review within 24h / Monitor / Routine)

### Step 9 — Knowledge Graph Construction
All entities and connections are represented as a force-directed graph using `react-force-graph-2d`. Node types: Person (blue), Location (green), Conversation (amber), Crime (red), Weapon (dark red), Organization (purple), Code Word (cyan). Semantic connections are highlighted in orange with thickness proportional to strength. Nodes can be dragged and pinned (Neo4j-style).

---

## 📊 Results

### Processing Pipeline Performance
| Stage | Model | Avg Time |
|-------|-------|----------|
| Transcription | Whisper Large V3 | ~3–8s per file |
| Translation (if needed) | Llama 3.1 8B | ~2–4s |
| Threat Analysis | Llama 3.3 70B | ~4–8s |
| Semantic Extraction | Llama 3.1 8B | ~2–4s |
| Connection Detection | Llama 3.1 8B | ~2–4s per existing conv |

### Detection Capabilities
| Capability | Result |
|-----------|--------|
| Languages supported | 15+ (auto-detected) |
| Crime types detected | 11 categories, 48 specific patterns |
| Entity types extracted | 8 (persons, locations, orgs, weapons, vehicles, money, dates, code words) |
| Connection methods | 6 (semantic + structural) |
| Duplicate prevention | 100% — filename-based deduplication |
| Threat score accuracy | LLM-calibrated 0–100 scale |

### Key Demonstration Results
- **Urdu audio** → correctly transcribed, translated to English, threat entities extracted in English
- **Code word detection** — "Diwali gifts" correctly identified as weapons shipment from context
- **Cross-conversation linking** — conversations about the same operation connected even with different vocabulary
- **Alias detection** — different spellings of the same name correctly unified
- **Zero false duplicates** — uploading the same file twice creates exactly one conversation

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Free Groq API key → [console.groq.com](https://console.groq.com)

### 1. Clone

```bash
git clone https://github.com/satvik-sharma-05/Threat_detection_system.git
cd Threat_detection_system
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

```env
GROQ_API_KEY=your_key_here
GROQ_WHISPER_MODEL=whisper-large-v3
GROQ_CRITICAL_MODEL=llama-3.3-70b-versatile
GROQ_CHEAP_MODEL=llama-3.1-8b-instant
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000
# → http://localhost:8000/docs  (API docs)
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm start
# → http://localhost:3000
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload & analyze single audio file |
| `POST` | `/upload?language=ur` | Upload with explicit language hint |
| `POST` | `/upload/batch` | Batch upload up to 1000 files |
| `GET` | `/conversations` | All analyzed conversations |
| `GET` | `/conversations/{id}` | Single conversation with full analysis |
| `DELETE` | `/conversations/{id}` | Delete conversation |
| `GET` | `/alerts` | All threat alerts |
| `GET` | `/alerts/export?format=csv` | Export alerts as CSV |
| `GET` | `/alerts/export?format=json` | Export alerts as JSON |
| `GET` | `/entities` | All detected entities (persons + locations) |
| `GET` | `/connections` | All discovered connections |
| `GET` | `/dashboard/stats` | Full system statistics |
| `GET` | `/rate-limit/status` | API usage, models, remaining capacity |

---

## 🌐 Supported Languages

| Language | Code | Language | Code | Language | Code |
|----------|------|----------|------|----------|------|
| English | `en` | Hindi | `hi` | Urdu | `ur` |
| Arabic | `ar` | Bengali | `bn` | Pashto | `ps` |
| Punjabi | `pa` | Tamil | `ta` | Telugu | `te` |
| Marathi | `mr` | Gujarati | `gu` | Farsi | `fa` |
| Chinese | `zh` | Russian | `ru` | French | `fr` |

> All others auto-detected by Whisper

---

## 🎯 Threat Taxonomy (48 Patterns, 8 Categories)

| Category | Specific Threats |
|----------|-----------------|
| 💣 Terrorism & Extremism | Bomb making, suicide bombing, mass casualty planning, recruitment, radicalization, financing, propaganda, infrastructure attacks |
| 🔫 Weapons Trafficking | Illegal arms trade, firearms smuggling, explosives, ammunition chains, weapons caches, cross-border movement |
| 💊 Drug Operations | Manufacturing/labs, distribution networks, smuggling routes, money laundering, cartel coordination, synthetics |
| 🔒 Kidnapping & Extortion | Ransom, hostage negotiation, child abduction, extortion, human trafficking, forced labor |
| 💻 Cybercrime | Ransomware, data breaches, phishing campaigns, infrastructure hacking, financial fraud, identity theft |
| 💰 Financial Crime | Money laundering, hawala transfers, crypto fraud, bank fraud, corruption/bribery, tax evasion |
| 🕵️ Organized Crime | Gang coordination, contract killing, protection rackets, robbery planning, carjacking, contraband |
| 🏛️ Political Violence | Assassination planning, coup coordination, election interference, incitement to riot, sabotage |

---

## 🧠 Smart Model Strategy

| Task | Model | Tokens/Call | Reason |
|------|-------|-------------|--------|
| Transcription | `whisper-large-v3` | ~500 | Best audio accuracy |
| Threat Analysis | `llama-3.3-70b-versatile` | ~1500 | Critical — needs accuracy |
| Translation | `llama-3.1-8b-instant` | ~800 | Fast, sufficient quality |
| Semantic Extraction | `llama-3.1-8b-instant` | ~1000 | Non-critical, fast |
| Connection Comparison | `llama-3.1-8b-instant` | ~800 | Non-critical, fast |

**Daily capacity**: ~40 files/day on Groq free tier (95,000 token limit)

---

## 🗄️ Database Schema

```sql
conversations         -- transcript, translation, language, threat_score, crime_type,
                      -- extracted_entities (JSON), decoded_terms, audio_file_path

persons               -- name, aliases, threat_score, crime_type, total_mentions,
                      -- first_seen, last_seen

locations             -- name, coordinates, threat_level, event_count

relationships         -- person_a_id, person_b_id, connection_type, strength, evidence

conversation_connections -- conversation_a_id, conversation_b_id, strength, evidence (JSON)

alerts                -- severity, score, crime_type, evidence (JSON), status,
                      -- conversation_id, created_at
```

---

## 📦 Tech Stack

**Backend**
- FastAPI + Uvicorn (async REST API)
- SQLite + SQLAlchemy ORM
- ChromaDB (vector embeddings for semantic search)
- Sentence Transformers (`all-MiniLM-L6-v2`)
- Groq SDK (Whisper + Llama)
- aiofiles (async file handling)

**Frontend**
- React 18 + React Router v6
- Tailwind CSS
- `react-force-graph-2d` (knowledge graph)
- Recharts (dashboard charts)
- React Query (data fetching + caching)
- React Dropzone (drag-and-drop upload)
- Axios

---

## 📬 Contact

| | |
|---|---|
| **Satvik Sharma** | 📞 9877215112 · [github.com/satvik-sharma-05](https://github.com/satvik-sharma-05) |
| **Ritvik Sharma** | 📞 9056487674 |
| **Repository** | [github.com/satvik-sharma-05/Threat_detection_system](https://github.com/satvik-sharma-05/Threat_detection_system) |
| **Demo Video** | [Google Drive](https://drive.google.com/file/d/15wfODSVjZ6B8_3-etgLTyf-_O86hSpAv/view?usp=sharing) |

---

<div align="center">

Built for **RAW (Research and Analysis Wing)** — India's external intelligence agency

*Automatically surface threats. Connect the dots. Protect the nation.*

</div>
