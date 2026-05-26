# CEO Dashboard

A full-stack business intelligence dashboard for monitoring company metrics, forecasting revenue, and detecting anomalies across multiple companies.

## 🚀 Live Demo
**View and interact with the live dashboard here:** [https://ceo-dashboard-ui.onrender.com](https://ceo-dashboard-ui.onrender.com)

## Tech Stack

- **Backend** — Python, Flask, SQLite
- **Frontend** — Vanilla JS, HTML/CSS, Chart.js
- **ML** — scikit-learn (Linear Regression for forecasting, Isolation Forest for anomaly detection)

## Project Structure

```
├── app.py               # Flask REST API
├── models.py            # ML models (forecast + anomaly detection)
├── data_generator.py    # Seed script to populate SQLite DB
├── index_dashboard.html # Frontend entry point
├── style.css            # Styles + dark/light theme
└── script.js            # Frontend logic and chart rendering
```

## Setup

**1. Install dependencies**
```bash
pip install flask flask-cors scikit-learn pandas numpy
```

**2. Generate the database**
```bash
python data_generator.py
```
This creates `dashboard.db` with 7 companies and 2 years of monthly metrics.

**3. Start the backend**
```bash
python app.py
```
Runs on `http://localhost:5000`

**4. Serve the frontend**

Open `index_dashboard.html` via Live Server (VS Code) or any static server on port `5500`.

> CORS is configured for `http://localhost:5500` and `http://127.0.0.1:5500`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/companies` | List all companies |
| GET | `/companies/<id>` | Single company details |
| GET | `/companies/<id>/metrics` | Monthly revenue, expenditure, profit, headcount |
| GET | `/companies/<id>/departments` | Department-level headcount over time |
| GET | `/companies/<id>/forecast` | 6-month revenue forecast |
| GET | `/companies/<id>/anomalies` | Anomalous months detected |
| GET | `/alerts` | Anomalies across all companies |
| GET | `/reports` | Summary report for all companies |

## Features

- **Overview** — revenue, profit, and employee trends per company
- **Forecast** — next 6 months of predicted revenue using linear regression
- **Alerts** — anomalous months flagged via Isolation Forest (10% contamination rate)
- **Reports** — aggregate stats: total revenue, profit margin, best month, avg headcount
- **Themes** — dark and light mode toggle

## Companies in Dataset

TechNova, GreenLeaf, UrbanBuild, MediCore, SwiftLogix, BrightEdu, FinEdge

Each company has 24 months of synthetic data with realistic growth curves and random variance.

## Notes

- The SQLite DB file (`dashboard.db`) is not committed — run `data_generator.py` to recreate it
- ML predictions are recalculated on every request; no caching
- Frontend expects the API at `http://localhost:5000`
