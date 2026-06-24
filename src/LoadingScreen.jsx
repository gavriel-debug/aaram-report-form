export default function LoadingScreen({
  title = "טוען נתונים",
  message = "מושך נתונים מהמערכת...",
  companyName = "קבוצת א.א.רם איירנט",
  accentColor = "#2563eb",
}) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 antialiased">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg text-white shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <div className="relative h-12 w-12">
              <span className="absolute inset-0 rounded-full border-4 border-white/25" />
              <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-white" />
              <span className="absolute inset-3 rounded-full bg-white/90" />
            </div>
          </div>

          <p className="text-sm font-black" style={{ color: accentColor }}>
            {companyName}
          </p>
          <h1 className="mt-2 text-2xl font-black">{title}</h1>
          <p className="mt-2 font-medium text-slate-500">{message}</p>

          <div className="mx-auto mt-6 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-2/3 animate-pulse rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
