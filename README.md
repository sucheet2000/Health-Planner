# Health Planner

A modern web application for generating automated healthcare care plans from patient records using AI, with intelligent duplicate detection and comprehensive version history tracking.

## Overview

Health Planner streamlines the care planning process by leveraging artificial intelligence to generate professional, structured care plans from patient clinical records. The system includes smart duplicate detection to prevent redundant entries and maintains detailed version history for compliance and audit purposes.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python + FastAPI
- **Database**: Firebase Firestore
- **AI Engine**: Claude 3.5 Haiku (Anthropic API)

## Key Features

### Order Management
- Create and manage care plan orders with complete patient information
- Extract patient data directly from PDF clinical records
- Real-time duplicate detection with validation warnings
- Detect MRN/name mismatches and provider NPI conflicts

### Version Control & History
- Automatic version history tracking for all updates
- Update existing records instead of creating duplicates
- Complete audit trail with timestamps
- Field-specific update capabilities

### AI-Powered Care Plans
- Claude AI integration for comprehensive plan generation
- Standardized output format including:
  - Problem list and drug therapy analysis
  - SMART goals with measurable outcomes
  - Detailed pharmacist interventions
  - Structured lab monitoring schedules
- Export care plans as PDF documents

### Data Management
- Export filtered order data to CSV and JSON formats
- Advanced filtering by date range and medication
- Statistics dashboard with comprehensive metrics
- Firestore indexes optimized for performance

## Prerequisites

- Node.js 18 or higher
- Python 3.8 or higher
- Anthropic API key (obtain from https://console.anthropic.com)
- Firebase project with Firestore enabled

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables in `backend/.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   PORT=8000
   HOST=0.0.0.0
   ```

5. Start the backend server:
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3001`

### Firebase Configuration

1. Deploy Firestore indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```

   Or create indexes manually in the Firebase Console:
   - Index 1: orders collection (patientFirstName, patientLastName, timestamp)
   - Index 2: orders collection (patientMRN, medicationName, timestamp)
   - Index 3: orders collection (medicationName, timestamp)

2. Configure Firestore collections:
   - `orders`: Patient orders with care plans and version history
   - `providers`: Provider information and statistics
   - `patients`: Patient master records and demographics

## Usage

### Creating a Care Plan Order

1. Start both backend and frontend servers
2. Open `http://localhost:3001` in your browser
3. Complete the order entry form with:
   - Patient information (first name, last name, 6-digit MRN)
   - Primary diagnosis (ICD-10 code)
   - Provider details (name, 10-digit NPI)
   - Medication name
   - Clinical records (text or PDF upload)
4. Click Generate Care Plan
5. Download the generated care plan as PDF

### Handling Duplicate Orders

When duplicate detection identifies a matching record:
1. Review the existing record details
2. Choose to cancel or update the existing record
3. Modify only the varying fields if updating
4. Submit to save version history and generate updated care plan

### Exporting Data

1. Navigate to the Export Data tab
2. Set optional filters (date range, medication)
3. Export to CSV or JSON format
4. View export statistics

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

### GET /
API information.

**Response:**
```json
{
  "message": "Health Planner API is running",
  "version": "1.0.0"
}
```

### POST /api/generate-careplan
Generate a care plan using Claude AI.

**Request Body:**
```json
{
  "formData": {
    "patientFirstName": "string",
    "patientLastName": "string",
    "patientMRN": "string (6 digits)",
    "primaryDiagnosis": "string (ICD-10)",
    "referringProvider": "string",
    "providerNPI": "string (10 digits)",
    "medicationName": "string",
    "additionalDiagnoses": ["string"],
    "medicationHistory": ["string"],
    "patientRecords": "string"
  }
}
```

**Response:**
```json
{
  "carePlan": "string (comprehensive care plan)"
}
```

## Database Schema

### Orders Collection
```javascript
{
  patientFirstName: "string",
  patientLastName: "string",
  patientMRN: "string",
  primaryDiagnosis: "string",
  additionalDiagnoses: ["string"],
  referringProvider: "string",
  providerNPI: "string",
  medicationName: "string",
  medicationHistory: ["string"],
  patientRecords: "string",
  carePlan: "string",
  timestamp: Timestamp,
  lastUpdated: Timestamp,
  history: [{
    timestamp: Timestamp,
    additionalDiagnoses: ["string"],
    medicationHistory: ["string"],
    patientRecords: "string",
    carePlan: "string"
  }]
}
```

### Patients Collection
```javascript
{
  mrn: "string",
  firstName: "string",
  lastName: "string",
  totalOrders: number,
  lastUpdated: Timestamp
}
```

### Providers Collection
```javascript
{
  name: "string",
  npi: "string",
  orderCount: number,
  firstOrderDate: Timestamp
}
```

## Testing

### Backend Tests
```bash
cd backend
python -m pytest test_api.py -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```
Output will be in `frontend/dist/`

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

For production, use a process manager like systemd, supervisor, or Docker.

## Environment Variables

**Backend (.env):**
- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `PORT`: Server port (default: 8000)
- `HOST`: Server host (default: 0.0.0.0)

## Security Considerations

- API keys are stored in environment variables (never committed to git)
- CORS configured for localhost development
- Before production deployment:
  - Configure Firebase security rules
  - Enable authentication
  - Use HTTPS only
  - Implement rate limiting

### Firestore Security Rules (Production Template)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow read, write: if request.auth != null;
    }
    match /providers/{providerId} {
      allow read, write: if request.auth != null;
    }
    match /patients/{patientId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

### Backend API Authentication Error
Check your Anthropic API key in `backend/.env`:
1. Generate a new key at https://console.anthropic.com/settings/keys
2. Update `ANTHROPIC_API_KEY` in `.env`
3. Restart the backend server

### Firestore Index Error
Click the URL in the error message to auto-create the index, or run:
```bash
firebase deploy --only firestore:indexes
```

### Port Already in Use
```bash
lsof -ti:3001 | xargs kill -9    # Frontend port
lsof -ti:8000 | xargs kill -9    # Backend port
```

## Contributing

Contributions are welcome. Please ensure all tests pass before submitting pull requests.

## License

Proprietary

## Support

For issues or questions, please open an issue in the project repository or contact the development team.
