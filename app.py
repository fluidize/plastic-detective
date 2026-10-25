import sys
import threading
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, render_template, request

from src.api.endpoints import Geoapify
from src.config import CONFIG, SECRETS
from src.store import add as add_litter
from src.store import all as all_litter
from src.store import delete as delete_litter
from src.store import update as update_litter
from src.analyze import analyze, build_usage

app = Flask(
    __name__,
    template_folder="frontend",
    static_folder="frontend",
    static_url_path="/assets",
)
jobs = {}
geoapify = Geoapify(SECRETS["geoapify_api_key"])


def run_scan(job_id, barcode, usage_data):
    try:
        jobs[job_id]["result"] = analyze(barcode, usage_data)
        jobs[job_id]["status"] = "done"
    except Exception as e:
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["status"] = "error"


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/config")
def config():
    return CONFIG


@app.post("/api/scan")
def scan():
    data = request.get_json(silent=True) or request.form
    job_id = uuid.uuid4().hex
    jobs[job_id] = {"status": "pending", "result": None, "error": None}
    threading.Thread(
        target=run_scan, args=(job_id, data["barcode"], dict(data)), daemon=True
    ).start()
    return {"job_id": job_id}


@app.post("/api/usage")
def usage():
    data = request.get_json(silent=True) or request.form
    return build_usage(dict(data))


@app.get("/api/scan/<job_id>")
def scan_status(job_id):
    return jobs.get(job_id, {"status": "unknown"})


@app.get("/api/recycling")
def recycling():
    return geoapify.get_nearest_recycling_locations(
        float(request.args["lat"]), float(request.args["lon"])
    )


@app.post("/api/litter")
def litter_add():
    data = request.get_json(silent=True) or request.form
    return add_litter(dict(data))


@app.get("/api/litter")
def litter_list():
    return all_litter()


@app.put("/api/litter/<int:index>")
def litter_update(index):
    data = request.get_json(silent=True) or request.form
    return update_litter(index, dict(data))


@app.delete("/api/litter/<int:index>")
def litter_delete(index):
    delete_litter(index)
    return {"ok": True}


if __name__ == "__main__":
    app.run(debug=True)
