import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const DELIVERY_OPEN_WEBHOOK_URL = "https://hook.eu1.make.com/szndn2sqfmg0jpc53cisxb156sr47ssw";
const DELIVERY_SUBMIT_WEBHOOK_URL = "https://hook.eu1.make.com/bptpucgrbjofxo3lkk2yv64vy327dxdv";

const COMPANY_CONFIG = {
  airnet: {
    code: "airnet",
    name: "קבוצת א.א.רם איירנט",
    subtitle: "תעודת משלוח דיגיטלית",
    accent: "#2563eb",
    phone: "",
    address: "",
  },
  aaram: {
    code: "aaram",
    name: "קבוצת א.א.רם",
    subtitle: "תעודת משלוח דיגיטלית",
    accent: "#0f766e",
    phone: "",
    address: "",
  },
};

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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
      ctx.strokeStyle = "#111827";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const down = (e) => {
      drawingRef.current = true;
      hasSigRef.current = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
    };

    const move = (e) => {
      if (!drawingRef.current) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const up = () => {
      drawingRef.current = false;
    };

    resize();
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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigRef.current = false;
  };

  const getDataUrl = () => (hasSigRef.current ? canvasRef.current.toDataURL("image/png") : "");

  return { canvasRef, clear, getDataUrl };
}

const emptyDelivery = {
  delivery_note_number: "",
  opened_at: "",
  delivery_date: "",
  delivery_time: "",
  service_call_number: "",
  order_id: "",
  customer_name: "",
  customer_address: "",
  customer_phone: "",
  company_name: "",
  recipient_name: "",
  delivery_agent: "",
  notes: "",
};

const createEmptyItem = () => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  sku: "",
  name: "",
  price: "",
  quantity: "",
});

const normalizeManualItem = (item) => ({
  id: item.id,
  sku: item.sku.trim(),
  name: item.name.trim(),
  price: item.price.trim(),
  quantity: item.quantity,
});

const getValue = (data, keys, fallback = "") => {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return fallback;
};

const getCurrentDateParts = () => {
  const now = new Date();
  return {
    opened_at: now.toISOString(),
    delivery_date: now.toLocaleDateString("he-IL"),
    delivery_time: now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
  };
};

function buildDeliveryPdfTemplate(data, items, company) {
  const rows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(item.sku)}</td>
          <td><strong>${esc(item.name)}</strong></td>
          <td>${esc(item.quantity)}</td>
          <td>${esc(item.price)}</td>
        </tr>`
    )
    .join("");

  return `
    <div dir="rtl" style="width:794px;background:#fff;color:#111827;font-family:'Heebo',Arial,sans-serif;padding:34px;box-sizing:border-box;">
      <div style="border-bottom:4px solid ${company.accent};padding-bottom:18px;margin-bottom:22px;display:flex;justify-content:space-between;gap:20px;align-items:center;">
        <div style="display:flex;gap:14px;align-items:center;">
          ${
            `<div style="width:62px;height:62px;border-radius:14px;background:${company.accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;">${esc(company.code === "airnet" ? "A" : "רם")}</div>`
          }
          <div>
            <h1 style="font-size:26px;margin:0 0 5px 0;font-weight:900;">${esc(data.company_name || company.name)}</h1>
            <div style="font-size:13px;color:#64748b;">תעודת משלוח דיגיטלית</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:28px;font-weight:900;color:${company.accent};">תעודת משלוח</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">מס׳ ${esc(data.delivery_note_number || data.service_call_number)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
          <h2 style="font-size:15px;margin:0 0 10px 0;color:#0f172a;">פרטי לקוח</h2>
          <div style="font-size:13px;line-height:1.75;">
            <div><strong>לכבוד:</strong> ${esc(data.customer_name)}</div>
            <div><strong>כתובת:</strong> ${esc(data.customer_address)}</div>
            <div><strong>טלפון:</strong> ${esc(data.customer_phone)}</div>
          </div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
          <h2 style="font-size:15px;margin:0 0 10px 0;color:#0f172a;">פרטי מסמך</h2>
          <div style="font-size:13px;line-height:1.75;">
            <div><strong>קריאת שירות:</strong> ${esc(data.service_call_number)}</div>
            <div><strong>מספר הזמנה:</strong> ${esc(data.order_id)}</div>
            <div><strong>תאריך:</strong> ${esc(data.delivery_date)}</div>
            <div><strong>שעה:</strong> ${esc(data.delivery_time)}</div>
          </div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
        <thead>
          <tr style="background:${company.accent};color:#fff;">
            <th>#</th>
            <th>מק״ט</th>
            <th>פרטים</th>
            <th>כמות</th>
            <th>מחיר</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">לא צוינו פריטים</td></tr>'}</tbody>
      </table>

      ${
        data.notes
          ? `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:18px;font-size:13px;"><strong>הערות:</strong><div style="white-space:pre-wrap;margin-top:4px;">${esc(data.notes)}</div></div>`
          : ""
      }

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;">
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;min-height:110px;">
          <div style="font-size:13px;margin-bottom:8px;"><strong>שם מקבל הסחורה:</strong> ${esc(data.recipient_name)}</div>
          <div style="font-size:13px;"><strong>נציג מוסר:</strong> ${esc(data.delivery_agent)}</div>
        </div>
        <div style="border:2px dashed #cbd5e1;border-radius:12px;padding:12px;min-height:110px;text-align:center;">
          <div style="font-size:12px;color:#64748b;text-align:right;margin-bottom:8px;font-weight:700;">חתימת המאשר</div>
          ${data.signature_base64 ? `<img src="${data.signature_base64}" style="max-height:76px;max-width:90%;object-fit:contain;">` : ""}
        </div>
      </div>
    </div>
    <style>
      th, td { border: 1px solid #e2e8f0; padding: 8px 9px; text-align: right; vertical-align: top; }
      tbody tr:nth-child(even) { background: #f8fafc; }
    </style>
  `;
}

async function generateDeliveryPdfBase64(data, items, company) {
  await (document.fonts ? document.fonts.ready : Promise.resolve());

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "794px";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-9999";
  wrapper.style.backgroundColor = "#fff";
  wrapper.innerHTML = buildDeliveryPdfTemplate(data, items, company);
  document.body.appendChild(wrapper);

  const scale = 2;
  try {
    const target = wrapper.firstElementChild;
    const canvas = await html2canvas(target, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
    });
    const wPx = canvas.width / scale;
    const hPx = canvas.height / scale;
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

export default function DeliveryCertificateForm() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const serviceCallNumber =
    params.get("service_call") ||
    params.get("service_call_number") ||
    params.get("report_number") ||
    "";
  const companyCode = params.get("company") === "aaram" ? "aaram" : "airnet";
  const company = COMPANY_CONFIG[companyCode];
  const currentDateParts = useMemo(getCurrentDateParts, []);

  const [form, setForm] = useState({
    ...emptyDelivery,
    service_call_number: serviceCallNumber,
    ...currentDateParts,
    company_name: company.name,
  });
  const [items, setItems] = useState([createEmptyItem()]);
  const [loading, setLoading] = useState(Boolean(serviceCallNumber));
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { canvasRef, clear, getDataUrl } = useSignaturePad();

  useEffect(() => {
    document.title = "תעודת משלוח דיגיטלית - א.א.רם";
  }, []);

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!serviceCallNumber) {
      setLoadError("חסר מספר קריאת שירות בקישור.");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError("");

    fetch(DELIVERY_OPEN_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_type: "delivery_certificate_open",
        service_call_number: serviceCallNumber,
        company: companyCode,
      }),
    })
      .then((res) => res.text())
      .then((text) => {
        if (!active) return;
        if (!text) return;
        const data = JSON.parse(text);

        setForm((current) => ({
          ...current,
          company_name: getValue(data, ["company_name", "company"], current.company_name),
          service_call_number: getValue(
            data,
            ["service_call_number", "service_call", "service_call_id", "report_number"],
            current.service_call_number
          ),
          delivery_date: getValue(data, ["delivery_date", "date", "opened_date"], current.delivery_date),
          delivery_time: getValue(data, ["delivery_time", "time", "opened_time"], current.delivery_time),
          delivery_note_number: getValue(
            data,
            ["delivery_note_number", "delivery_number", "delivery_id"],
            current.delivery_note_number
          ),
          order_id: getValue(data, ["order_id", "order_number"], current.order_id),
          customer_name: getValue(data, ["customer_name", "client_name", "recipient"], current.customer_name),
          customer_address: getValue(data, ["customer_address", "address"], current.customer_address),
          customer_phone: getValue(data, ["customer_phone", "phone"], current.customer_phone),
        }));
      })
      .catch((err) => {
        console.error("שגיאה בשליפת תעודת המשלוח:", err);
        if (active) setLoadError("לא הצלחנו למשוך את נתוני תעודת המשלוח.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyCode, serviceCallNumber]);

  const addItem = () => setItems((current) => [...current, createEmptyItem()]);

  const removeItem = (itemId) => {
    setItems((current) =>
      current.length === 1 ? [createEmptyItem()] : current.filter((item) => item.id !== itemId)
    );
  };

  const updateItem = (itemId, key, value) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, [key]: value } : item
      )
    );
  };

  const filledItems = () =>
    items
      .map(normalizeManualItem)
      .filter((item) => item.sku || item.name || item.price || item.quantity);

  const payloadData = () => ({
    ...form,
    form_type: "delivery_certificate_submit",
    company: companyCode,
    signature_base64: getDataUrl(),
    items: filledItems(),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const signatureBase64 = getDataUrl();
    if (!signatureBase64) {
      alert("נא להחתים את המאשר לפני שליחת הטופס.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...payloadData(),
        signature_base64: signatureBase64,
      };
      payload.pdf_base64 = await generateDeliveryPdfBase64(payload, payload.items, company);

      const response = await fetch(DELIVERY_SUBMIT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      alert(response.ok ? "תעודת המשלוח נשלחה בהצלחה!" : "שגיאה בשליחת תעודת המשלוח.");
    } catch (err) {
      console.error("Error submitting delivery certificate:", err);
      alert("אירעה שגיאה בהפקת או שליחת תעודת המשלוח.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-900 antialiased py-6 px-4 md:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-t-2xl bg-white border border-slate-200 border-b-0 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white"
                style={{ backgroundColor: company.accent }}
              >
                {companyCode === "airnet" ? "A" : "רם"}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">{form.company_name || company.name}</h1>
                <p className="font-medium text-slate-500">{company.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[26rem]">
              <div className="rounded-lg bg-slate-100 p-3">
                <div className="text-xs font-bold text-slate-500">קריאת שירות</div>
                <div className="font-black">{form.service_call_number || "---"}</div>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <div className="text-xs font-bold text-slate-500">תאריך</div>
                <div className="font-black">{form.delivery_date || "---"}</div>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <div className="text-xs font-bold text-slate-500">שעה</div>
                <div className="font-black">{form.delivery_time || "---"}</div>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="rounded-b-2xl bg-white border border-slate-200 p-6 md:p-8 shadow-xl space-y-8">
          {loadError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {loadError}
            </div>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
              <h2 className="text-xl font-bold">נתוני בסיס</h2>
              {loading && <span className="text-sm font-bold text-slate-400">טוען נתונים...</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnly label="מספר תעודת משלוח" value={form.delivery_note_number || "---"} />
              <ReadOnly label="מספר הזמנה" value={form.order_id || "---"} />
              <ReadOnly label="קריאת שירות" value={form.service_call_number || "---"} />
              <ReadOnly label="תאריך" value={form.delivery_date || "---"} />
              <ReadOnly label="שעה" value={form.delivery_time || "---"} />
              <ReadOnly label="לכבוד" value={form.customer_name || "---"} />
              <ReadOnly label="כתובת הלקוח" value={form.customer_address || "---"} wide />
              <ReadOnly label="טלפון" value={form.customer_phone || "---"} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
              <h2 className="text-xl font-bold">פירוט סחורה</h2>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg border-2 border-dashed border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-600 transition hover:border-blue-400 hover:bg-blue-50"
              >
                + הוסף פריט
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-right">מק״ט</th>
                    <th className="px-4 py-3 text-right">פרטים / שם הפריט</th>
                    <th className="px-4 py-3 text-right">כמות</th>
                    <th className="px-4 py-3 text-right">מחיר</th>
                    <th className="px-4 py-3 text-right">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-3">
                        <input
                          value={item.sku}
                          onChange={(event) => updateItem(item.id, "sku", event.target.value)}
                          placeholder="מק״ט"
                          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={item.name}
                          onChange={(event) => updateItem(item.id, "name", event.target.value)}
                          placeholder="שם הפריט"
                          className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                          placeholder="כמות"
                          className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={item.price}
                          onChange={(event) => updateItem(item.id, "price", event.target.value)}
                          placeholder="מחיר"
                          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                        >
                          {items.length === 1 && index === 0 ? "נקה" : "מחק"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 md:p-6">
            <div className="mb-5 border-b border-slate-200 pb-2">
              <h2 className="text-xl font-bold">אישור ומסירה</h2>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">שם המאשר <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.recipient_name}
                  onChange={setField("recipient_name")}
                  placeholder="שם מקבל הסחורה"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">שם החותם / נציג מוסר <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.delivery_agent}
                  onChange={setField("delivery_agent")}
                  placeholder="שם הנהג או איש השטח"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-bold text-slate-700">הערות למסירה</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={setField("notes")}
                placeholder="למשל: אספקה חלקית, פריט פגום, תיאום נוסף..."
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-700">חתימת המאשר <span className="text-red-500">*</span></label>
                <button type="button" onClick={clear} className="text-xs font-bold text-slate-500 hover:text-red-600">
                  נקה חתימה
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || loading || !serviceCallNumber}
            className="w-full rounded-xl bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "מפיק ושולח תעודת משלוח..." : "שלח תעודת משלוח"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReadOnly({ label, value, wide = false }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="mb-1 text-xs font-bold text-slate-500">{label}</div>
        <div className="min-h-6 font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
