import datetime
import random
import sqlite3

COMPANIES = [
    ("TechNova", "Technology"),
    ("GreenLeaf", "Agriculture"),
    ("UrbanBuild", "Construction"),
    ("MediCore", "Healthcare"),
    ("SwiftLogix", "Logistics"),
    ("BrightEdu", "Education"),
    ("FinEdge", "Finance"),
]

DEPARTMENTS = ["Engineering", "Sales", "HR", "Marketing", "Operations"]

DB_PATH = "dashboard.db"


def create_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS companies (
            id  INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            industry TEXT,
            base_rev REAL,
            base_emp INTEGER
        );

        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            year INTEGER,
            month INTEGER,
            revenue REAL,
            expenditure REAL,
            profit REAL,
            employee_count INTEGER,
            FOREIGN KEY(company_id) REFERENCES companies(id),
            UNIQUE(company_id, year, month)
        );

        CREATE TABLE IF NOT EXISTS department_headcount (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            year INTEGER,
            month INTEGER,
            department TEXT,
            headcount INTEGER,
            FOREIGN KEY(company_id) REFERENCES companies(id),
            UNIQUE(company_id, year, month, department)
        );
    """)
    conn.commit()


def generate_data(conn, years_back=2):
    current_yr = datetime.datetime.now().year
    years = [current_yr - i for i in range(years_back, 0, -1)]

    for name, industry in COMPANIES:
        random.seed(name) 
        base_rev = random.uniform(500_000, 5_000_000)
        base_emp = random.randint(50, 500)
        conn.execute(
            "INSERT OR IGNORE INTO companies (name, industry, base_rev, base_emp) VALUES (?, ?, ?, ?)",
            (name, industry, round(base_rev, 2), base_emp),
        )
    conn.commit()

    rows = conn.execute("SELECT id, name, base_rev, base_emp FROM companies").fetchall()
    company_data = {name: {"id": cid, "base_rev": rev, "base_emp": emp} for cid, name, rev, emp in rows}

    for name, _ in COMPANIES:
        cid  = company_data[name]["id"]
        base_rev = company_data[name]["base_rev"]
        base_emp = company_data[name]["base_emp"]

        for year in years:

            random.seed(f"{name}{year}")
            growth = random.uniform(0.005, 0.025)

            for month in range(1, 13):
                t = (year - years[0]) * 12 + month

                revenue = base_rev * (1 + growth) ** t + random.uniform(-50_000, 50_000)
                expenditure = revenue * random.uniform(0.70, 0.92)
                profit = revenue - expenditure
                emp_count = int(base_emp * (1 + growth * 0.5) ** t + random.randint(-5, 10))

                conn.execute(
                    """INSERT OR IGNORE INTO metrics
                       (company_id, year, month, revenue, expenditure, profit, employee_count)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (cid, year, month, round(revenue, 2), round(expenditure, 2), round(profit, 2), emp_count),
                )

                shares = sorted([random.random() for _ in range(len(DEPARTMENTS) - 1)] + [0, 1])
                for i, dept in enumerate(DEPARTMENTS):
                    hc = max(1, int((shares[i + 1] - shares[i]) * emp_count))
                    conn.execute(
                        """INSERT OR IGNORE INTO department_headcount
                           (company_id, year, month, department, headcount)
                           VALUES (?, ?, ?, ?, ?)""",
                        (cid, year, month, dept, hc),
                    )

    conn.commit()
    print(f"Data generated successfully for years: {years}")
    print(f"Companies: {len(COMPANIES)} | Months per company: {len(years) * 12}")


if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    generate_data(conn, years_back=2)
    conn.close()