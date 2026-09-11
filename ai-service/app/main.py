import os
import re
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


app = FastAPI(title="R-CPI AI Intelligence Service", version="0.1.0")
SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")


class Evidence(BaseModel):
    fileName: str
    mimeType: str
    sizeBytes: int = Field(ge=0)


class ReportRequest(BaseModel):
    reportId: int
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    category: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    district: str
    evidence: list[Evidence] = []


CATEGORY_KEYWORDS = {
    "DRAINAGE": ("drain", "flood", "water flowing", "sewer"),
    "ROAD": ("road", "pothole", "street", "bridge"),
    "WASTE": ("garbage", "waste", "rubbish", "trash", "dump"),
    "WATER": ("water supply", "pipe", "tap", "well"),
    "ELECTRICITY": ("electric", "power", "transformer", "outage"),
    "STREET_LIGHTING": ("street light", "lamp", "lighting"),
    "PUBLIC_HEALTH": ("clinic", "disease", "rats", "health"),
    "TRAFFIC": ("traffic", "congestion", "signal"),
    "PUBLIC_SAFETY": ("danger", "unsafe", "crime", "security"),
}


def classify(text: str, submitted_category: str) -> tuple[str, float, list[str]]:
    normalized = text.lower()
    scores = {
        category: sum(normalized.count(keyword) for keyword in keywords)
        for category, keywords in CATEGORY_KEYWORDS.items()
    }
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    if not ranked or ranked[0][1] == 0:
        return submitted_category.upper(), 0.52, []
    primary, score = ranked[0]
    confidence = min(0.96, 0.62 + score * 0.08)
    related = [category for category, category_score in ranked[1:3] if category_score > 0]
    return primary, confidence, related


def severity(text: str, category: str) -> tuple[str, float, float]:
    normalized = text.lower()
    critical_terms = ("death", "injury", "school", "hospital", "homes", "danger", "heavy flooding")
    high_terms = ("blocked", "urgent", "large", "many people", "unsafe", "overflow")
    score = 0.28
    score += sum(0.12 for term in critical_terms if term in normalized)
    score += sum(0.07 for term in high_terms if term in normalized)
    if category in {"DRAINAGE", "PUBLIC_SAFETY", "PUBLIC_HEALTH"}:
        score += 0.08
    score = min(score, 0.98)
    level = "CRITICAL" if score >= 0.75 else "HIGH" if score >= 0.50 else "MEDIUM" if score >= 0.25 else "LOW"
    return level, score, min(0.93, 0.62 + score * 0.3)


@app.get("/health")
def health():
    return {"status": "ok", "service": "rcpi-ai"}


@app.post("/ai/analyze/report")
def analyze_report(request: ReportRequest, x_ai_service_token: Optional[str] = Header(default=None)):
    if SERVICE_TOKEN and x_ai_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI service credentials")

    text = f"{request.title} {request.description}"
    category, category_confidence, secondary = classify(text, request.category)
    severity_level, severity_score, severity_confidence = severity(text, category)
    spam_score = 0.04 if len(re.findall(r"\b\w+\b", request.description)) > 4 else 0.18
    recommendations = []
    if category == "DRAINAGE":
        recommendations.append({"priority": "HIGH" if severity_level in {"HIGH", "CRITICAL"} else "MEDIUM", "department": "Infrastructure / Public Works", "recommendation": "Inspect the drainage infrastructure and monitor the affected area."})
    elif category == "WASTE":
        recommendations.append({"priority": "HIGH", "department": "Waste Management", "recommendation": "Assess accumulated waste and arrange an authorised collection response."})
    else:
        recommendations.append({"priority": "MEDIUM", "department": None, "recommendation": "Review the evidence and route the report to the responsible department."})

    return {
        "language": "rw" if any(term in text.lower() for term in ("amazi", "umuhanda", "imyanda")) else "en",
        "overallConfidence": category_confidence,
        "classification": {"category": category, "confidence": category_confidence, "secondaryCategories": secondary},
        "severity": {"level": severity_level, "score": severity_score, "confidence": severity_confidence},
        "duplicate": {"possible": False, "similarity": 0.0, "matchedReportId": None},
        "spamRisk": {"level": "LOW_RISK" if spam_score < 0.25 else "MEDIUM_RISK", "score": spam_score},
        "risk": {"level": severity_level, "confidence": severity_confidence},
        "trend": {"direction": "UNKNOWN"},
        "explanation": f"The description matched {category.lower()} indicators. The severity score considers reported danger, affected context and problem type.",
        "imageAnalysis": {"detectedObjects": [], "quality": "NOT_ANALYZED", "usable": False},
        "recommendations": recommendations,
    }