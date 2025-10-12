# ENIGMA Phase 1 Setup Guide

Complete setup instructions for running the ENIGMA Phase 1 frontend and backend.

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- OpenAI API key
- Git

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Download spaCy Model

```bash
python -m spacy download en_core_web_sm
```

### 5. Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-key-here

# Model Configuration
WORKER_MODEL=gpt-5
JUDGE_MODEL=gpt-5-mini

# NOTE: GPT-5 series doesn't support these - kept for compatibility
TEMPERATURE=0.1
MAX_TOKENS=4096

# Pipeline Configuration
MAX_RETRY_ATTEMPTS=3

# Directories
DATA_DIR=./data
PROMPT_DIR=./prompts
LOG_DIR=./logs

# Email Configuration (Optional)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_FROM=noreply@enigma.edu
EMAIL_PASSWORD=your-email-password
```

### 6. Initialize System

```bash
python src/main.py init
```

This will:
- Create necessary directories
- Initialize CSV files
- Verify configuration

### 7. Start Backend API Server

```bash
# From backend directory
python api.py
```

The API will be available at: `http://localhost:8000`

**API Documentation:** `http://localhost:8000/docs`

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Start Development Server

```bash
npm run dev
```

The frontend will be available at: `http://localhost:3000`

## Using the System

### For Applicants

1. **Visit the Landing Page:** `http://localhost:3000`
2. **Submit Application:** Click "Apply Now" and fill out the form
3. **Save Your Application ID:** You'll receive an ID like `APP_XXXXXXXX`
4. **Check Status:** Go to "Check Status" and enter your Application ID
5. **View Results:** Once completed, you'll see detailed scores and explanations
6. **Verify Hash:** Use the Verification Portal to verify decision integrity

### For Operators

**Process Applications via CLI:**

```bash
# Process all applications in a JSON file
python src/main.py run --input applications.json

# Process a single application
python src/main.py process --application-id APP_XXXXXXXX

# Check system status
python src/main.py status

# Verify hash chain integrity
python src/main.py verify

# Export results to CSV
python src/main.py export --output results.csv
```

**Using the API:**

The FastAPI server exposes REST endpoints that the frontend uses:

- `POST /applications` - Submit application
- `GET /applications/{id}` - Get status
- `GET /results/{anonymized_id}` - Get results
- `POST /verify` - Verify hash
- `GET /verify/chain` - Verify entire chain
- `GET /dashboard/stats` - Get statistics

## Directory Structure

```
ENIGMA/
├── backend/
│   ├── src/
│   │   ├── config/          # Settings
│   │   ├── models/          # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   ├── orchestration/   # LangGraph pipeline
│   │   ├── utils/           # CSV and logging utilities
│   │   └── main.py          # CLI entry point
│   ├── api.py               # FastAPI REST server
│   ├── data/                # CSV storage
│   ├── prompts/             # LLM prompts
│   ├── logs/                # Application logs
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   │   ├── page.tsx     # Landing page
│   │   │   ├── apply/       # Application form
│   │   │   ├── status/      # Status/results viewer
│   │   │   ├── verify/      # Verification portal
│   │   │   └── dashboard/   # Public dashboard
│   │   ├── components/      # Reusable UI components
│   │   └── lib/
│   │       └── api.ts       # API client
│   └── package.json         # Node dependencies
│
├── PLAN.md                  # System specification
└── SETUP.md                 # This file
```

## Testing the System

### 1. Create a Test Application

Create `test_application.json`:

```json
{
  "name": "Test Applicant",
  "email": "test@example.com",
  "phone": "+1234567890",
  "address": "123 Test St, Test City, TS 12345",
  "gpa": 3.8,
  "test_scores": {
    "SAT": 1450,
    "ACT": 32
  },
  "essay": "This is a test essay about my academic interests and goals. I am passionate about computer science and want to pursue research in artificial intelligence. My coursework has prepared me well for university-level studies, and I have demonstrated this through various projects and competitions.",
  "achievements": "1st Place in State Science Fair 2023, National Merit Scholar, President of Robotics Club, 200+ volunteer hours at local coding bootcamp for underserved youth"
}
```

### 2. Process via CLI

```bash
cd backend
python src/main.py run --input test_application.json
```

### 3. Or Submit via Frontend

1. Go to `http://localhost:3000/apply`
2. Fill out the form
3. Submit and note the Application ID
4. Check status at `http://localhost:3000/status`

## Common Issues

### Backend Issues

**Import Errors:**
```bash
# Make sure you're in the backend directory and venv is activated
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**spaCy Model Missing:**
```bash
python -m spacy download en_core_web_sm
```

**API Key Error:**
- Check that `OPENAI_API_KEY` is set in `.env`
- Verify the key is valid

**Port 8000 Already in Use:**
```bash
# Kill the process using port 8000 or change the port in api.py
# Then restart: python api.py
```

### Frontend Issues

**Module Not Found:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**API Connection Failed:**
- Ensure backend is running on `http://localhost:8000`
- Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
- Verify CORS settings in `backend/api.py`

**Port 3000 Already in Use:**
```bash
# Next.js will prompt to use port 3001 automatically
# Or manually specify: npm run dev -- -p 3001
```

## Production Deployment

### Backend

**Option 1: Docker**

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Option 2: Cloud Functions**

Deploy to AWS Lambda, GCP Cloud Functions, or Azure Functions using serverless frameworks.

### Frontend

**Deploy to Vercel:**

```bash
cd frontend
vercel deploy
```

**Deploy to Netlify:**

```bash
cd frontend
npm run build
netlify deploy --prod --dir=.next
```

**Environment Variables:**

Don't forget to set `NEXT_PUBLIC_API_URL` to your production backend URL.

## Security Considerations

1. **API Keys:** Never commit `.env` files. Use secrets management in production.
2. **CORS:** Restrict `allow_origins` in `api.py` to your frontend domain.
3. **Rate Limiting:** Implement rate limiting on `/applications` endpoint.
4. **Identity Mapping:** Encrypt `identity_mapping.csv` at rest.
5. **HTTPS:** Always use HTTPS in production.
6. **Input Validation:** Pydantic schemas provide validation, but review for edge cases.

## Next Steps

1. ✅ Test the system end-to-end with sample applications
2. ✅ Review and tune prompts in `backend/prompts/`
3. ✅ Monitor logs in `backend/logs/enigma.log`
4. ✅ Review CSV data files in `backend/data/`
5. ⬜ Implement Phase 2 (Live interviews with bias monitoring)
6. ⬜ Add automated backup/restore
7. ⬜ Implement monitoring and alerting
8. ⬜ Migration from CSV to PostgreSQL for production scale

## Support

For issues:
1. Check logs in `backend/logs/enigma.log`
2. Review API documentation at `http://localhost:8000/docs`
3. Verify CSV files in `backend/data/`
4. Consult `ARCHITECTURE.md` and `PLAN.md`

## License

Proprietary - ENIGMA Project
