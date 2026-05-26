import sqlite3
from flask import Flask, jsonify, request
from flask_cors import CORS
from models import predict_next_6_months, detect_anomalies

app = Flask(__name__)
DB_PATH = "dashboard.db"
CORS(app)

def db_helper(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    rows = cur.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/")
def welocme():
    return "Hi"

@app.get("/companies")
def get_companies():
    return jsonify(db_helper("SELECT * FROM companies"))

@app.get("/companies/<int:id>")
def get_company(id):
    return jsonify(db_helper("SELECT * FROM companies WHERE id=?", (id,)))

@app.get("/companies/<int:id>/metrics")
def get_metrics(id):
    return jsonify(db_helper(
        "SELECT year,month,revenue,expenditure,profit,employee_count FROM metrics WHERE company_id=? ORDER BY year,month", (id,)))

@app.get("/companies/<int:id>/departments")
def get_departments(id):
    return jsonify(db_helper(
        "SELECT year,month,department,headcount FROM department_headcount WHERE company_id=? ORDER BY year,month", (id,)))

@app.get("/companies/<int:id>/forecast")
def get_forecast(id):
    company = db_helper("SELECT * FROM companies WHERE id=?", (id,))
    if not company:
        return jsonify({"error": "Not found"}), 404
    predictions = predict_next_6_months(id)
    for p in predictions:
        p["year"]  = int(p["year"])
        p["month"] = int(p["month"])
        p["predicted_revenue"] = float(p["predicted_revenue"]) # numpy na int64 and float64 json serializable nathi so py ma karvu pade
    history = db_helper(
        "SELECT year,month,revenue,profit FROM metrics WHERE company_id=? ORDER BY year,month", (id,))
    return jsonify({
        "company": company[0],
        "history": history,
        "forecast": predictions
    })

@app.get("/companies/<int:id>/anomalies")
def get_anomalies(id):
    company = db_helper("SELECT * FROM companies WHERE id=?", (id,))
    if not company:
        return jsonify({"error": "Not found"}), 404
    anomalies = detect_anomalies(id)
    return jsonify({
        "company": company[0],
        "anomalies": anomalies
    })

@app.get("/alerts")
def get_all_alerts():
    companies = db_helper("SELECT * FROM companies")
    all_alerts = []
    for c in companies:
        anomalies = detect_anomalies(c["id"])
        for a in anomalies:
            a["company_name"] = c["name"]
            a["company_id"]   = c["id"]
            a["industry"]     = c["industry"]
        all_alerts.extend(anomalies)
    return jsonify(all_alerts)

@app.get("/reports")
def get_reports():
    companies = db_helper("SELECT * FROM companies")
    summary = []
    for c in companies:
        rows = db_helper(
            "SELECT year,month,revenue,expenditure,profit,employee_count FROM metrics WHERE company_id=? ORDER BY year,month", (c["id"],))
        if not rows:
            continue
        last  = rows[-1]
        total_rev  = sum(r["revenue"] for r in rows)
        total_prof = sum(r["profit"]  for r in rows)
        avg_emp    = sum(r["employee_count"] for r in rows) // len(rows)
        best = max(rows, key=lambda r: r["revenue"])
        summary.append({
            "company_id":      c["id"],
            "company_name":    c["name"],
            "industry":        c["industry"],
            "latest_revenue":  last["revenue"],
            "latest_profit":   last["profit"],
            "latest_employees":last["employee_count"],
            "total_revenue":   total_rev,
            "total_profit":    total_prof,
            "avg_employees":   avg_emp,
            "best_month":      f"{best['year']}-{str(best['month']).zfill(2)}",
            "best_revenue":    best["revenue"],
            "months_tracked":  len(rows),
            "profit_margin":   round(last["profit"] / last["revenue"] * 100, 1) if last["revenue"] else 0,
        })
    return jsonify(summary)

if __name__ == "__main__":
    app.run(debug=True)
