import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import LoadingScreen from "./LoadingScreen.jsx";

const DELIVERY_OPEN_WEBHOOK_URL = "https://hook.eu1.make.com/szndn2sqfmg0jpc53cisxb156sr47ssw";
const DELIVERY_SUBMIT_WEBHOOK_URL = "https://hook.eu1.make.com/bptpucgrbjofxo3lkk2yv64vy327dxdv";
const DELIVERY_PREFILL_PREFIX = "delivery-prefill:";
const INITIAL_LOAD_TIMEOUT_MS = 6000;

const COMPANY_CONFIG = {
  airnet: {
    code: "airnet",
    name: "קבוצת א.א.רם איירנט",
    brandName: "איירנט",
    legalLine: "טכנולוגיות אויר דחוס בע״מ",
    postalLine: "ת.ד. 626, כרכור 37100",
    contactLine: "נייד: 050-5960110, טל: 04-6372797, פקס: 04-6272414",
    subtitle: "תעודת משלוח דיגיטלית",
    accent: "#2563eb",
    phone: "",
    address: "",
  },
  aaram: {
    code: "aaram",
    name: "קבוצת א.א.רם",
    brandName: "א.א.רם",
    legalLine: "קבוצת א.א.רם בע״מ",
    postalLine: "ת.ד. 214, בנימינה",
    contactLine: "טלפון: 04-6377329, פקס: 04-6272414",
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
  const [canvasElement, setCanvasElement] = useState(null);
  const canvasRef = setCanvasElement;
  const drawingRef = useRef(false);
  const hasSigRef = useRef(false);

  useEffect(() => {
    const canvas = canvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
  }, [canvasElement]);

  const clear = () => {
    const canvas = canvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigRef.current = false;
  };

  const getDataUrl = () => (hasSigRef.current && canvasElement ? canvasElement.toDataURL("image/png") : "");

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
  customer_email: "",
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

const mapDeliveryResponseToForm = (data, current) => ({
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
  customer_email: getValue(data, ["customer_email", "email", "client_email"], current.customer_email),
});

function buildDeliveryPdfTemplate(data, items, company) {
  const ink = "#1f3f93";
  const red = "#d72836";
  const deliveryNumber = data.delivery_note_number || data.service_call_number || "";
  const brandName = company.brandName || data.company_name || company.name;
  const minimumRows = 13;
  const tableRows = Array.from({ length: Math.max(items.length, minimumRows) }, (_, index) => items[index] || {});
  const rows = items
    .length
    ? tableRows
        .map(
          (item) => `
        <tr>
          <td>${esc(item.quantity)}</td>
          <td>${esc(item.sku)}</td>
          <td>${item.name ? `<strong>${esc(item.name)}</strong>` : ""}</td>
          <td>${esc(item.price)}</td>
        </tr>`
        )
        .join("")
    : tableRows
        .map(
          () => `
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`
        )
        .join("");

  return `
    <div dir="rtl" style="width:794px;min-height:1123px;background:#fff;color:${ink};font-family:'Heebo',Arial,sans-serif;padding:44px 54px 34px;box-sizing:border-box;">
      <header style="position:relative;margin-bottom:28px;border-bottom:2px solid ${ink};padding-bottom:12px;text-align:center;">
        <div style="position:absolute;right:0;top:6px;width:92px;height:58px;border:3px solid ${ink};border-radius:50%;opacity:.95;">
          <div style="position:absolute;right:13px;top:12px;width:52px;height:18px;border-top:5px solid ${ink};border-radius:50%;transform:rotate(-13deg);"></div>
          <div style="position:absolute;right:17px;top:29px;width:50px;height:10px;background:${ink};border-radius:50%;transform:rotate(-13deg);"></div>
        </div>

        <div style="font-size:42px;line-height:1;font-weight:900;letter-spacing:0;color:${ink};">
          ${esc(brandName)}
        </div>
        <div style="margin-top:4px;font-size:21px;font-weight:900;color:${ink};">
          ${esc(company.legalLine || data.company_name || company.name)}
        </div>
        <div style="margin-top:6px;font-size:13px;font-weight:800;color:${ink};display:flex;justify-content:center;gap:18px;flex-wrap:wrap;">
          <span>${esc(company.postalLine || "")}</span>
          <span>${esc(company.contactLine || "")}</span>
        </div>
      </header>

      <section style="display:grid;grid-template-columns:1fr 150px 1fr;align-items:start;margin-bottom:18px;color:${ink};">
        <div style="font-size:17px;font-weight:900;text-align:right;padding-top:18px;">
          <div style="display:grid;grid-template-columns:60px 1fr;gap:8px;align-items:end;margin-bottom:13px;">
            <span>שעה:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:22px;text-align:center;color:#111827;">${esc(data.delivery_time)}</span>
          </div>
          <div style="display:grid;grid-template-columns:60px 1fr;gap:8px;align-items:end;margin-bottom:13px;">
            <span>תאריך:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:22px;text-align:center;color:#111827;">${esc(data.delivery_date)}</span>
          </div>
          <div style="display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:end;">
            <span>מס׳ הזמנה:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:22px;text-align:center;color:#111827;">${esc(data.order_id)}</span>
          </div>
        </div>

        <div style="text-align:center;padding-top:54px;font-size:34px;line-height:1;font-weight:900;letter-spacing:3px;color:${red};">
          ${esc(deliveryNumber)}
        </div>

        <div style="text-align:right;padding-top:34px;">
          <div style="font-size:31px;font-weight:900;color:${ink};">תעודת משלוח</div>
          <div style="margin-top:14px;font-size:13px;font-weight:800;color:${ink};">קריאת שירות: <span style="color:#111827;">${esc(data.service_call_number)}</span></div>
        </div>
      </section>

      <section style="font-size:17px;font-weight:900;margin-bottom:16px;color:${ink};">
        <div style="display:grid;grid-template-columns:70px 1fr 42px 230px;gap:8px;align-items:end;margin-bottom:13px;">
          <span>לכבוד:</span>
          <span style="border-bottom:2px dotted ${ink};min-height:24px;color:#111827;padding:0 8px;">${esc(data.customer_name)}</span>
          <span>טל׳:</span>
          <span style="border-bottom:2px dotted ${ink};min-height:24px;color:#111827;padding:0 8px;">${esc(data.customer_phone)}</span>
        </div>
        <div style="display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:end;">
          <span>כתובת:</span>
          <span style="border-bottom:2px dotted ${ink};min-height:24px;color:#111827;padding:0 8px;">${esc(data.customer_address)}</span>
        </div>
      </section>

      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px;color:${ink};table-layout:fixed;">
        <colgroup>
          <col style="width:10%;">
          <col style="width:28%;">
          <col style="width:42%;">
          <col style="width:20%;">
        </colgroup>
        <thead>
          <tr>
            <th>כמות</th>
            <th>מק״ט</th>
            <th>פרטים</th>
            <th>מחיר</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${
        data.notes
          ? `<div style="border:2px solid ${ink};border-top:0;padding:10px 12px;font-size:13px;color:#111827;min-height:38px;"><strong style="color:${ink};">הערות:</strong> ${esc(data.notes)}</div>`
          : ""
      }

      <footer style="margin-top:24px;font-size:16px;font-weight:900;color:${ink};">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:end;margin-bottom:14px;">
          <div style="display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:end;">
            <span>שם החותם:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:28px;color:#111827;padding:0 8px;">${esc(data.delivery_agent)}</span>
          </div>
          <div style="display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:end;">
            <span>שם המאשר:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:28px;color:#111827;padding:0 8px;">${esc(data.recipient_name)}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:end;">
          <div style="display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:end;">
            <span>כתובת:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:28px;color:#111827;padding:0 8px;">${esc(data.customer_address)}</span>
          </div>
          <div style="display:grid;grid-template-columns:112px 1fr;gap:8px;align-items:end;">
            <span>חתימת המאשר:</span>
            <span style="border-bottom:2px dotted ${ink};min-height:44px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
              ${data.signature_base64 ? `<img src="${data.signature_base64}" style="max-height:42px;max-width:190px;object-fit:contain;">` : ""}
            </span>
          </div>
        </div>
      </footer>
    </div>
    <style>
      th, td {
        border: 2px solid ${ink};
        padding: 7px 9px;
        text-align: center;
        vertical-align: middle;
        height: 29px;
        box-sizing: border-box;
      }
      th {
        font-size: 16px;
        font-weight: 900;
        color: ${ink};
        background: #ffffff;
      }
      td {
        color: #111827;
        font-size: 13px;
      }
      td:nth-child(3), th:nth-child(3) {
        text-align: center;
      }
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
  const [submitted, setSubmitted] = useState(false);
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
    let loadingTimer;
    const finishLoading = () => {
      if (!active) return;
      window.clearTimeout(loadingTimer);
      setLoading(false);
    };

    setLoading(true);
    setLoadError("");
    loadingTimer = window.setTimeout(finishLoading, INITIAL_LOAD_TIMEOUT_MS);

    const cacheKey = `${DELIVERY_PREFILL_PREFIX}${serviceCallNumber}`;
    const shouldUsePrefillOnly = params.get("prefill") === "1";
    const cachedPrefill = sessionStorage.getItem(cacheKey);

    if (cachedPrefill) {
      try {
        const parsed = JSON.parse(cachedPrefill);
        setForm((current) => mapDeliveryResponseToForm(parsed.data || parsed, current));
        sessionStorage.removeItem(cacheKey);
        if (shouldUsePrefillOnly) {
          finishLoading();
          return () => {
            active = false;
            window.clearTimeout(loadingTimer);
          };
        }
      } catch (err) {
        console.warn("נתוני תעודת המשלוח שנשמרו אינם תקינים:", err);
        sessionStorage.removeItem(cacheKey);
      }
    }

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

        setForm((current) => mapDeliveryResponseToForm(data, current));
      })
      .catch((err) => {
        console.error("שגיאה בשליפת תעודת המשלוח:", err);
        if (active) setLoadError("לא הצלחנו למשוך את נתוני תעודת המשלוח.");
      })
      .finally(() => {
        finishLoading();
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
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

      if (response.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert("שגיאה בשליחת תעודת המשלוח.");
      }
    } catch (err) {
      console.error("Error submitting delivery certificate:", err);
      alert("אירעה שגיאה בהפקת או שליחת תעודת המשלוח.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ThankYouPage
        company={company}
        companyName={form.company_name || company.name}
        deliveryNumber={form.delivery_note_number || form.service_call_number}
        customerName={form.customer_name}
      />
    );
  }

  if (loading) {
    return (
      <LoadingScreen
        title="מכין תעודת משלוח"
        message="מושך את נתוני הקריאה ותעודת המשלוח..."
        companyName={form.company_name || company.name}
        accentColor={company.accent}
      />
    );
  }

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
                <label className="mb-1.5 block text-sm font-bold text-slate-700">מייל לשליחת תעודה</label>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={setField("customer_email")}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
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

function ThankYouPage({ company, companyName, deliveryNumber, customerName }) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white"
            style={{ backgroundColor: company.accent }}
          >
            ✓
          </div>
          <h1 className="text-3xl font-black">{companyName}</h1>
          <p className="mt-2 text-xl font-bold text-slate-700">תעודת המשלוח נשלחה בהצלחה</p>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-1 gap-3 text-right text-sm md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500">מספר תעודה / קריאה</div>
              <div className="mt-1 font-black">{deliveryNumber || "---"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500">לכבוד</div>
              <div className="mt-1 font-black">{customerName || "---"}</div>
            </div>
          </div>
          <p className="mt-6 text-sm font-medium text-slate-500">
            אפשר לסגור את החלון. המסמך והחתימה נשלחו למערכת.
          </p>
        </section>
      </div>
    </div>
  );
}
