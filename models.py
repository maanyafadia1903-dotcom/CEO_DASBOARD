import sqlite3
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
import numpy as np

DB_PATH = "dashboard.db"

def _get_revenue_series(company_id : int) -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT year, month, revenue,profit,employee_count FROM metrics WHERE company_id = ? ORDER BY year, month", conn, params=(company_id,))
    conn.close()
    df["t"] = range(len(df)) # in linear regression we have to pass numbers so we are creating a new column t which is 0,1,2,3... for each month so 14th month for month 1 of year 2
    return df

def predict_next_6_months(company_id : int):
    df = _get_revenue_series(company_id)
    arr = df[["t"]].values # gives 2d numpy array of the pd data frame if 1 sq bracket then 1D array 2D for rows and cols
    rev = df["revenue"].values
    model = LinearRegression()
    model.fit(arr, rev)
    last_t = df["t"].max()
    last_yr = df["year"].max()
    last_month = df["month"].max()
    results = []
    for i in range(1,7):
        t = last_t + i
        m = (last_month + i - 1)%12 + 1
        y = (last_yr + (last_month + i - 1)//12)
        r = model.predict([[t]])[0]
        results.append({"year": y, "month": m, "predicted_revenue": round(r, 2)})
    return results

def detect_anomalies(company_id : int): # anomalies means something that doesnt follow the pattern
    df = _get_revenue_series(company_id)
    features = df[["revenue", "profit", "employee_count"]].values # in 2D format as it will check all 3 cols if to decide if the month is anomalous
    model = IsolationForest(contamination=0.1) # 10% of the data is expected to be anomalous
    labels = model.fit_predict(features) # -1 for anomaly and 1 for normal
    anomalies = df[labels == -1]
    return anomalies[["year", "month", "revenue", "profit", "employee_count"]].to_dict(orient="records")
    