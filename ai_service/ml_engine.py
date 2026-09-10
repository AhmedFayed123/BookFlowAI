import os
import logging
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from schemas import NoShowPredictionRequest, NoShowPredictionResponse, RiskLevel

logger = logging.getLogger("BookFlowAI.MLEngine")

MODEL_FILE = "no_show_model_v2.joblib"
MODEL_VERSION = "2.0.0"

def _extract_features(req: NoShowPredictionRequest) -> np.ndarray:
    """استخراج المصفوفة الحسابية (10 Features) من الـ Schema"""
    days_since_no_show = req.days_since_last_no_show if req.days_since_last_no_show is not None else 999
    no_show_ratio = req.past_no_shows_count / (req.total_past_bookings + 1)
    
    features = [
        req.total_past_bookings,
        req.past_no_shows_count,
        req.past_cancellations_count,
        req.lead_time_days,
        req.booking_hour,
        req.booking_day_of_week,
        1 if req.is_weekend else 0,
        1 if req.is_holiday else 0,
        days_since_no_show,
        no_show_ratio
    ]
    return np.array(features).reshape(1, -1)

def _train_and_save_baseline_model():
    """إنشاء نموذج افتراضي متقدم عند بداية التشغيل لأول مرة"""
    logger.info("توليد نموذج ML افتراضي مبدئي (RandomForestClassifier)...")
    np.random.seed(42)
    # 1000 عينة تدريبية افتراضية بـ 10 ميزات
    X_train = np.random.randint(0, 30, size=(1000, 10))
    # معادلة محاكاة بسيطة لتحديد النتيجة للتدريب المبدئي
    y_train = ((X_train[:, 1] / (X_train[:, 0] + 1) > 0.3) | (X_train[:, 3] > 10)).astype(int)

    model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump(model, MODEL_FILE)
    logger.info(f"تم حفظ النموذج بنجاح في: {MODEL_FILE}")
    return model

def load_or_train_model():
    if os.path.exists(MODEL_FILE):
        try:
            return joblib.load(MODEL_FILE)
        except Exception as e:
            logger.error(f"تعذر تحميل ملف النموذج ({e})، سيتم إعادة البناء...")
    return _train_and_save_baseline_model()

model = load_or_train_model()

def predict_no_show(req: NoShowPredictionRequest) -> NoShowPredictionResponse:
    """إجراء التوقع الفعلي مع آلية Fallback عند أي خطأ غير متوقع"""
    try:
        X = _extract_features(req)
        probability = float(model.predict_proba(X)[0][1])
        probability = round(max(0.0, min(1.0, probability)), 2)

        # تحديد مستوى الخطورة بناءً على الـ Enum
        if probability >= 0.6:
            risk = RiskLevel.HIGH
        elif probability >= 0.3:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.LOW

        return NoShowPredictionResponse(
            probability=probability,
            risk_level=risk,
            model_version=MODEL_VERSION,
            is_fallback=False
        )
    except Exception as e:
        logger.error(f"خطأ غير متوقع في محرك الـ ML: {e}")
        # الرد الاحتياطي الآمن (Fallback)
        return NoShowPredictionResponse(
            probability=0.20,
            risk_level=RiskLevel.LOW,
            model_version=MODEL_VERSION,
            is_fallback=True
        )