import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const OPEN_WEBHOOK_URL = "https://hook.eu1.make.com/urdv6soafdq8im88v5pa87j0jp0gjhvx";
const TARGET_WEBHOOK = "https://hook.eu1.make.com/1ukn154fochpe0xprtqj2be2stujtjed";
const DELIVERY_OPEN_WEBHOOK_URL = "https://hook.eu1.make.com/szndn2sqfmg0jpc53cisxb156sr47ssw";
const DELIVERY_PREFILL_PREFIX = "delivery-prefill:";
const DEFAULT_COMPANY_NAME = "קבוצת א.א.רם איירנט";

/* ====================== פאד חתימה (canvas מקורי, ללא ספרייה) ====================== */

function useSignaturePad() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasSigRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const prev = hasSigRef.current ? canvas.toDataURL() : null;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1e293b";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };
    resize();

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e) => {
      drawingRef.current = true;
      hasSigRef.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!drawingRef.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => { drawingRef.current = false; };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    window.addEventListener("resize", resize);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigRef.current = false;
  };
  const getDataUrl = () => (hasSigRef.current ? canvasRef.current.toDataURL("image/png") : "");

  return { canvasRef, clear, getDataUrl };
}

/* ====================== תבנית ה‑PDF (HTML קשיח ברוחב A4 מדויק) ====================== */

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function buildPdfTemplate(d) {
  const actionsHtml =
    d.actions && d.actions.length > 0
      ? d.actions
          .map(
            (a) =>
              `<div style="background:#fff;border:1px solid #e2e8f0;padding:8px 12px;border-radius:6px;font-size:14px;line-height:1.4;"><strong>${esc(a.name)}:</strong> ${esc(a.description)}</div>`
          )
          .join("")
      : '<div style="background:#fff;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;font-size:13px;color:#94a3b8;">לא צוינו פעולות.</div>';

  return `
  <div dir="rtl" style="width:794px;padding:40px;background:#ffffff;font-family:'Heebo',system-ui,-apple-system,sans-serif;color:#1e293b;box-sizing:border-box;">
    <div style="background:#0f172a;color:#fff;padding:25px;border-radius:12px;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">${esc(d.company_name || DEFAULT_COMPANY_NAME)}</h1>
        <p style="margin:0;color:#94a3b8;font-size:14px;font-weight:500;">טכנולוגיות אוויר דחוס בע"מ - טופס דיווח מקוון</p>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="background:#1e293b;padding:8px 14px;border-radius:8px;text-align:right;min-width:90px;">
          <div style="color:#94a3b8;font-size:11px;font-weight:bold;margin-bottom:2px;">דו"ח מס'</div>
          <div style="font-size:16px;font-weight:800;color:#fff;">${esc(d.report_number)}</div>
        </div>
        <div style="background:#1e293b;padding:8px 14px;border-radius:8px;text-align:right;min-width:110px;">
          <div style="color:#94a3b8;font-size:11px;font-weight:bold;margin-bottom:2px;">סוג טיפול</div>
          <div style="font-size:16px;font-weight:800;color:#fff;">${esc(d.treatment_type)}</div>
        </div>
      </div>
    </div>

    <h2 style="font-size:16px;font-weight:800;color:#2563eb;border-bottom:2px solid #f1f5f9;padding-bottom:6px;margin:0 0 12px 0;">פרטי הלקוח</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:25px;">
      <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><strong style="color:#475569;display:block;margin-bottom:3px;">שם הלקוח:</strong>${esc(d.client_name)}</div>
      <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><strong style="color:#475569;display:block;margin-bottom:3px;">מס' מזהה לקוח:</strong>${esc(d.client_id)}</div>
      <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><strong style="color:#475569;display:block;margin-bottom:3px;">כתובת:</strong>${esc(d.address)}</div>
      <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><strong style="color:#475569;display:block;margin-bottom:3px;">טלפון:</strong>${esc(d.phone)}</div>
      <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;grid-column:span 2;"><strong style="color:#475569;display:block;margin-bottom:3px;">מאשר הדו"ח:</strong>${esc(d.approver)}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:25px;">
      <div>
        <h2 style="font-size:16px;font-weight:800;color:#2563eb;border-bottom:2px solid #f1f5f9;padding-bottom:6px;margin:0 0 12px 0;">פרטי מסנן קו</h2>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
          <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><strong>יצרן:</strong> ${esc(d.manufacturer)}</div>
          <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><strong>דגם:</strong> ${esc(d.model)}</div>
          <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><strong>מספר סידורי:</strong> ${esc(d.serial_number)}</div>
        </div>
      </div>
      <div>
        <h2 style="font-size:16px;font-weight:800;color:#2563eb;border-bottom:2px solid #f1f5f9;padding-bottom:6px;margin:0 0 12px 0;">נתוני מכונה וחדר</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;font-size:13px;">
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>לחץ עבודה:</strong> ${esc(d.work_pressure)}</div>
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>דליפות אויר:</strong> ${esc(d.air_leaks)}</div>
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>טמפ' עבודה:</strong> ${esc(d.work_temp)}</div>
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>נקיון חדר:</strong> ${esc(d.room_cleanliness)}</div>
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>טמפ' בחדר:</strong> ${esc(d.room_temp)}</div>
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;"><strong>בדיקת מייבש:</strong> ${esc(d.dryer_check)}</div>
        </div>
      </div>
    </div>

    <h2 style="font-size:16px;font-weight:800;color:#2563eb;border-bottom:2px solid #f1f5f9;padding-bottom:6px;margin:0 0 12px 0;">פרטי הקריאה והטיפול</h2>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px;margin-bottom:25px;">
      <div>
        <span style="display:block;font-size:12px;font-weight:bold;color:#64748b;margin-bottom:4px;">מהות הקריאה:</span>
        <div style="background:#fff;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;font-size:14px;white-space:pre-wrap;line-height:1.5;">${esc(d.call_nature)}</div>
      </div>
      <div>
        <span style="display:block;font-size:12px;font-weight:bold;color:#64748b;margin-bottom:4px;">פעולות שבוצעו:</span>
        <div style="display:flex;flex-direction:column;gap:6px;">${actionsHtml}</div>
      </div>
      <div>
        <span style="display:block;font-size:12px;font-weight:bold;color:#64748b;margin-bottom:4px;">הערות והמלצות:</span>
        <div style="background:#fff;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;font-size:14px;white-space:pre-wrap;line-height:1.5;">${esc(d.notes)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;display:flex;flex-direction:column;justify-content:space-between;font-size:13px;">
        <h3 style="margin:0 0 10px 0;font-size:14px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">פרטי המבצע</h3>
        <div style="padding:4px 0;"><strong>השירות ניתן ע"י:</strong> ${esc(d.technician)}</div>
        <div style="padding:4px 0;"><strong>תאריך:</strong> ${esc(d.form_date)}</div>
        <div style="padding:4px 0;"><strong>שעה:</strong> ${esc(d.form_time)}</div>
      </div>
      <div style="border:2px dashed #cbd5e1;background:#f8fafc;border-radius:12px;padding:14px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:110px;">
        <h3 style="margin:0 0 auto 0;font-size:12px;font-weight:bold;color:#64748b;width:100%;text-align:right;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">חתימת הלקוח</h3>
        <div style="margin-top:auto;margin-bottom:auto;width:100%;display:flex;justify-content:center;align-items:center;">
          ${d.signature_base64 ? `<img src="${d.signature_base64}" style="max-height:75px;max-width:90%;object-fit:contain;">` : '<span style="color:#94a3b8;font-size:13px;font-weight:500;padding:15px 0;">ללא חתימה</span>'}
        </div>
      </div>
    </div>
  </div>`;
}

// יצירת PDF מתבנית ה‑HTML באמצעות html2canvas + jsPDF (עברית מושלמת, ריבוי עמודים אוטומטי)
async function generatePdfBase64(data) {
  await (document.fonts ? document.fonts.ready : Promise.resolve());

  const wrapper = document.createElement("div");
  wrapper.setAttribute("dir", "ltr"); // מונע חיתוך בצד שמאל
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "794px";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-9999";
  wrapper.style.backgroundColor = "#ffffff";
  wrapper.innerHTML = buildPdfTemplate(data);
  document.body.appendChild(wrapper);

  const SCALE = 2;
  try {
    const target = wrapper.firstElementChild;
    const canvas = await html2canvas(target, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
    });

    // עמוד יחיד בגודל התוכן המדויק — מונע עמוד ריק/חיתוך, ביחס קרוב ל‑A4
    const wPx = canvas.width / SCALE;
    const hPx = canvas.height / SCALE;
    const pdf = new jsPDF({
      unit: "px",
      format: [wPx, hPx],
      orientation: wPx > hPx ? "landscape" : "portrait",
    });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, wPx, hPx);

    return pdf.output("datauristring").split(",")[1];
  } finally {
    document.body.removeChild(wrapper);
  }
}

/* ====================== הטופס ====================== */

const EMPTY = {
  company_name: DEFAULT_COMPANY_NAME,
  report_number: "",
  treatment_type: "טיפול שוטף",
  client_name: "",
  client_id: "",
  address: "",
  phone: "",
  approver: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  work_pressure: "",
  air_leaks: "לא",
  work_temp: "",
  room_cleanliness: "תקין",
  room_temp: "תקין",
  dryer_check: "תקין",
  call_nature: "",
  notes: "",
  technician: "",
  form_date: "",
  form_time: "",
};

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all";
const inputWhiteCls =
  "w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all";
const labelCls = "block text-sm font-bold text-slate-700 mb-1.5";

export default function TreatmentReportForm() {
  const [form, setForm] = useState(EMPTY);
  const [actions, setActions] = useState([{ name: "", description: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const { canvasRef, clear, getDataUrl } = useSignaturePad();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildDeliveryFormUrl = (serviceCallNumber, hasPrefill = false) => {
    const params = new URLSearchParams(window.location.search);
    const nextUrl = new URL(window.location.href);
    const company = params.get("company");

    nextUrl.search = "";
    nextUrl.hash = "";
    nextUrl.searchParams.set("form", "delivery");
    nextUrl.searchParams.set("service_call", serviceCallNumber || params.get("recordid") || "");
    if (company) nextUrl.searchParams.set("company", company);
    if (hasPrefill) nextUrl.searchParams.set("prefill", "1");

    return nextUrl.toString();
  };

  const prepareDeliveryFormData = async (serviceCallNumber) => {
    if (!serviceCallNumber) return false;

    const params = new URLSearchParams(window.location.search);
    const company = params.get("company") || "airnet";

    try {
      const response = await fetch(DELIVERY_OPEN_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: "delivery_certificate_open",
          source: "treatment_report_submit",
          service_call_number: serviceCallNumber,
          company,
        }),
      });

      const text = await response.text();
      if (!response.ok || !text) return false;

      const data = JSON.parse(text);
      sessionStorage.setItem(
        `${DELIVERY_PREFILL_PREFIX}${serviceCallNumber}`,
        JSON.stringify({ data, saved_at: new Date().toISOString() })
      );
      return true;
    } catch (err) {
      console.warn("לא הצלחנו להכין את נתוני תעודת המשלוח:", err);
      return false;
    }
  };

  // שליפת נתונים ראשונית מהוובהוק
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recordid = params.get("recordid") || "";
    const tenantid = params.get("tenantid") || params.get("tanantid") || "";

    if (!recordid && !tenantid) return;

    fetch(OPEN_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordid,
        tenantid,
        tanantid: tenantid,
      }),
    })
      .then((res) => res.text())
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setForm((f) => {
            const next = { ...f };
            [
              "company_name", "report_number", "treatment_type", "client_name", "client_id",
              "address", "phone", "approver", "manufacturer", "model",
              "serial_number", "call_nature",
            ].forEach((k) => {
              if (data[k] !== undefined && data[k] !== null && data[k] !== "") next[k] = data[k];
            });
            return next;
          });
        } catch {
          console.warn("התשובה מהוובהוק אינה JSON תקין:", text);
        }
      })
      .catch((err) => console.error("שגיאה בשליחת/קבלת הוובהוק:", err));
  }, []);

  const updateAction = (i, key) => (e) =>
    setActions((arr) => arr.map((a, idx) => (idx === i ? { ...a, [key]: e.target.value } : a)));
  const addAction = () => setActions((arr) => [...arr, { name: "", description: "" }]);
  const removeAction = (i) => setActions((arr) => arr.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const withDefaults = Object.fromEntries(
        Object.entries(form).map(([k, val]) => [k, val === "" ? "---" : val])
      );
      const payload = {
        ...withDefaults,
        signature_base64: getDataUrl(),
        actions: actions
          .filter((a) => a.name || a.description)
          .map((a) => ({ name: a.name || "---", description: a.description || "---" })),
      };

      payload.pdf_base64 = await generatePdfBase64(payload);

      const response = await fetch(TARGET_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const serviceCallNumber = payload.report_number || new URLSearchParams(window.location.search).get("recordid") || "";
        const hasDeliveryPrefill = await prepareDeliveryFormData(serviceCallNumber);
        alert('הדו"ח והמסמך נשלחו בהצלחה! כעת נפתח טופס תעודת משלוח.');
        window.location.assign(buildDeliveryFormUrl(serviceCallNumber, hasDeliveryPrefill));
      } else {
        alert('שגיאה בשליחת הדו"ח. אנא נסה שוב.');
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("אירעה שגיאה בתהליך עיבוד הטופס.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="bg-slate-100 text-slate-800 antialiased py-10 px-4 md:px-0 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* כותרת */}
        <div className="bg-slate-900 text-white rounded-t-2xl p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-3xl font-black mb-1">{form.company_name}</h1>
              <p className="text-slate-400 font-medium">טכנולוגיות אוויר דחוס בע"מ - טופס דיווח מקוון</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex flex-col flex-1 md:w-32">
                <label className="text-xs text-slate-400 font-bold mb-1">דו"ח מס'</label>
                <input value={form.report_number} onChange={set("report_number")} placeholder="לדוג': 29455"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-500 font-bold" />
              </div>
              <div className="flex flex-col flex-1 md:w-40">
                <label className="text-xs text-slate-400 font-bold mb-1">סוג טיפול</label>
                <input value={form.treatment_type} onChange={set("treatment_type")}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-b-2xl shadow-xl border border-slate-200 p-8 space-y-10">
          {/* פרטי הלקוח */}
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">פרטי הלקוח</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className={labelCls}>שם הלקוח <span className="text-red-500">*</span></label>
                <input required value={form.client_name} onChange={set("client_name")} placeholder="הזן שם לקוח" className={inputCls} />
              </div>
              <div><label className={labelCls}>מס' מזהה לקוח</label><input value={form.client_id} onChange={set("client_id")} placeholder="מספר לקוח" className={inputCls} /></div>
              <div><label className={labelCls}>כתובת</label><input value={form.address} onChange={set("address")} placeholder="עיר, רחוב..." className={inputCls} /></div>
              <div><label className={labelCls}>טלפון</label><input type="tel" value={form.phone} onChange={set("phone")} placeholder="מספר טלפון" className={inputCls} /></div>
              <div><label className={labelCls}>מאשר הדו"ח</label><input value={form.approver} onChange={set("approver")} placeholder="שם המאשר" className={inputCls} /></div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* מסנן קו */}
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">פרטי מסנן קו</h2>
              <div className="space-y-4">
                <div><label className={labelCls}>יצרן</label><input value={form.manufacturer} onChange={set("manufacturer")} placeholder="לדוג': Ultrafilter" className={inputCls} /></div>
                <div><label className={labelCls}>דגם</label><input value={form.model} onChange={set("model")} placeholder="לדוג': MF 20/30" className={inputCls} /></div>
                <div><label className={labelCls}>מספר סידורי</label><input value={form.serial_number} onChange={set("serial_number")} className={inputCls} /></div>
              </div>
            </section>

            {/* נתוני מכונה וחדר */}
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">נתוני מכונה וחדר</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>לחץ עבודה</label><input value={form.work_pressure} onChange={set("work_pressure")} className={inputCls} /></div>
                <div><label className={labelCls}>דליפות אויר</label>
                  <select value={form.air_leaks} onChange={set("air_leaks")} className={inputCls + " appearance-none"}><option>לא</option><option>כן</option></select>
                </div>
                <div><label className={labelCls}>טמפ' עבודה</label><input value={form.work_temp} onChange={set("work_temp")} placeholder="°C" className={inputCls} /></div>
                <div><label className={labelCls}>נקיון חדר</label>
                  <select value={form.room_cleanliness} onChange={set("room_cleanliness")} className={inputCls + " appearance-none"}><option>תקין</option><option>לא תקין</option></select>
                </div>
                <div><label className={labelCls}>טמפ' בחדר</label>
                  <select value={form.room_temp} onChange={set("room_temp")} className={inputCls + " appearance-none"}><option>תקין</option><option>לא תקין</option></select>
                </div>
                <div><label className={labelCls}>בדיקת מייבש</label>
                  <select value={form.dryer_check} onChange={set("dryer_check")} className={inputCls + " appearance-none"}><option>תקין</option><option>לא תקין</option></select>
                </div>
              </div>
            </section>
          </div>

          {/* קריאה וטיפול */}
          <section className="bg-blue-50/50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6">פרטי הקריאה והטיפול</h2>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">מהות הקריאה</label>
              <textarea rows={2} value={form.call_nature} onChange={set("call_nature")} placeholder="לדוגמה: החלפת אלמנט..."
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all resize-y" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">פעולות שבוצעו</label>
              <div className="space-y-3 mb-4">
                {actions.map((a, i) => (
                  <div key={i} className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <input value={a.name} onChange={updateAction(i, "name")} placeholder="שם הפעולה"
                      className="w-full md:w-1/3 bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/40 outline-none transition-all font-medium" />
                    <input value={a.description} onChange={updateAction(i, "description")} placeholder="תיאור מורחב"
                      className="w-full md:flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/40 outline-none transition-all" />
                    <button type="button" onClick={() => removeAction(i)} title="מחק שורה"
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addAction}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-white border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 px-5 py-2.5 rounded-lg transition-all w-full md:w-auto justify-center">
                + הוסף פעולה נוספת
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">הערות והמלצות</label>
              <textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="הערות להמשך הטיפול, המלצות ללקוח..."
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all resize-y" />
            </div>
          </section>

          {/* מבצע + חתימה */}
          <section className="border-t border-slate-200 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-2">פרטי המבצע</h3>
                <div><label className={labelCls}>השירות ניתן על ידי:</label><input value={form.technician} onChange={set("technician")} placeholder="שם הטכנאי" className={inputWhiteCls} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>תאריך</label><input type="date" value={form.form_date} onChange={set("form_date")} className={inputWhiteCls} /></div>
                  <div><label className={labelCls}>שעה</label><input type="time" value={form.form_time} onChange={set("form_time")} className={inputWhiteCls} /></div>
                </div>
              </div>

              <div className="flex flex-col justify-between bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4">חתימת הלקוח</h3>
                <canvas ref={canvasRef}
                  className="flex-1 w-full bg-white border-2 border-dashed border-slate-300 rounded-lg cursor-crosshair touch-none min-h-[120px] hover:border-blue-400 transition-colors" />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-400 font-medium">חתום באמצעות העכבר או האצבע</span>
                  <button type="button" onClick={clear} className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors">נקה חתימה</button>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-4">
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              {submitting ? "מעבד ומייצר מסמך..." : 'שמור ושלח דו"ח'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
