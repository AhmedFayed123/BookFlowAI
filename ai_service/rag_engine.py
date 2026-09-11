import os
import asyncio
import logging
import chromadb
import google.generativeai as genai
from schemas import (
    ChatRequest, ChatResponse,
    IngestBusinessDataRequest
)

logger = logging.getLogger("BookFlowAI.RAGEngine")

RAG_QUERY_TIMEOUT_SECONDS = 5
GEMINI_TIMEOUT_SECONDS = 15

# تهيئة ChromaDB للتخزين الدائم
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="business_knowledge_v2")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("تم تفعيل Gemini API بنجاح.")
else:
    logger.warning("لم يتم العثور على GEMINI_API_KEY. سيتم الاعتماد على الردود الاحتياطية (Fallback).")

def ingest_business_data_to_vector_db(req: IngestBusinessDataRequest) -> int:
    """تحويل وتخزين بيانات خدمات وسياسات المنشأة داخل ChromaDB"""
    documents = []
    ids = []
    metadatas = []

    # 1. إدخال السياسات
    if req.policies:
        documents.append(
            f"Business: {req.business_name or 'Service business'}; "
            f"Industry: {req.business_category or 'General services'}; Policies: {req.policies}"
        )
        ids.append(f"b_{req.business_id}_policy")
        metadatas.append({"business_id": req.business_id, "type": "policy"})

    # 2. إدخال الخدمات
    for idx, s in enumerate(req.services):
        desc = f"; Description: {s.description}" if s.description else ""
        dur = f"; Duration: {s.duration_minutes} minutes" if s.duration_minutes else ""
        category = s.category or req.business_category or "General services"
        doc_text = f"Service: {s.name}; Category: {category}; Price: {s.price}{dur}{desc}"
        
        documents.append(doc_text)
        ids.append(f"b_{req.business_id}_service_{idx}")
        metadatas.append({"business_id": req.business_id, "type": "service"})

    if documents:
        collection.upsert(
            documents=documents,
            ids=ids,
            metadatas=metadatas
        )
    return len(documents)

async def generate_chat_response(req: ChatRequest) -> ChatResponse:
    """استرجاع المعلومات من Vector DB واستدعاء Gemini لتوليد رد ذكي"""
    source_used = False
    context_text = ""

    try:
        # 1. البحث الدلالي داخل Vector DB مع الفلترة بـ business_id
        retrieved_docs = []
        if collection.count() > 0:
            results = await asyncio.wait_for(
                asyncio.to_thread(
                    collection.query,
                    query_texts=[req.message],
                    n_results=3,
                    where={"business_id": req.business_id},
                ),
                timeout=RAG_QUERY_TIMEOUT_SECONDS,
            )
            retrieved_docs = results.get("documents", [[]])[0]

        if retrieved_docs:
            context_text = "\n".join(retrieved_docs)
            source_used = True
        else:
            context_text = "لا توجد تفاصيل خاصة مسجلة في قاعدة معرفة المنشأة لهذا السؤال."

        # 2. تحضير سجل السياق (Conversation History)
        history_text = ""
        if req.conversation_history:
            history_lines = [f"{msg.role.value}: {msg.content}" for msg in req.conversation_history[-4:]]
            history_text = "\n".join(history_lines)

        # 3. صياغة الـ System Prompt
        system_prompt = f"""
أنت مساعد ذكي ولطيف لخدمة عملاء المنشأة التجاريّة رقم ({req.business_id}).
أجب على سؤال العميل بأسلوب مهذب ومختصر باللغة العربية بناءً على "المعلومات المتاحة" فقط.
إذا لم تكن المعلومة متوفرة في السياق، أجب بلباقة وبدون اختلاق أي تفاصيل (No Hallucination).

المعلومات المتاحة (Context):
{context_text}

سجل المحادثة السابق:
{history_text}

سؤال العميل الحاضر:
{req.message}

الرد:
"""

        # 4. الاستدعاء الحقيقي للـ Gemini API
        if GEMINI_API_KEY:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = await asyncio.wait_for(
                model.generate_content_async(
                    system_prompt,
                    request_options={"timeout": GEMINI_TIMEOUT_SECONDS},
                ),
                timeout=GEMINI_TIMEOUT_SECONDS,
            )
            reply = response.text.strip()
            return ChatResponse(
                reply=reply,
                session_id=req.session_id,
                source_used=source_used,
                is_fallback=False
            )

    except Exception as e:
        logger.error(f"خطأ أثناء توليد رد الـ AI: {e}")

    # Fallback Response
    normalized_message = req.message.casefold()
    booking_question = any(keyword in normalized_message for keyword in (
        "book", "booking", "appointment", "reserve",
        "احجز", "حجز", "موعد", "ميعاد",
    ))

    if booking_question:
        fallback_reply = (
            "To book an appointment: choose a service from the home page, select an available provider and time, "
            "then review and confirm your booking. You can manage it later from My Bookings."
            if req.message.isascii() else
            "للحجز: اختر الخدمة من الصفحة الرئيسية، ثم اختر مقدم الخدمة والموعد المتاح، وبعدها راجع البيانات وأكد الحجز. "
            "يمكنك متابعة الحجز أو تعديله لاحقًا من صفحة حجوزاتي."
        )
    elif source_used:
        fallback_reply = f"المعلومات المتاحة ذات الصلة بسؤالك:\n{context_text}"
    else:
        fallback_reply = (
            "I can help with available services, booking steps, appointments, staff availability, and cancellation questions."
            if req.message.isascii() else
            "يمكنني مساعدتك في الخدمات المتاحة، خطوات الحجز، المواعيد، توفر مقدمي الخدمة، وسياسة الإلغاء."
        )

    return ChatResponse(
        reply=fallback_reply,
        session_id=req.session_id,
        source_used=source_used,
        is_fallback=True
    )
