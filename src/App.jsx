import DeliveryCertificateForm from "./DeliveryCertificateForm.jsx";
import TreatmentReportForm from "./TreatmentReportForm.jsx";

const DELIVERY_FORM_TYPES = new Set(["delivery", "delivery-certificate"]);
const REPORT_FORM_TYPES = new Set([
  "report",
  "treatment-report",
  "report-copy",
  "treatment-report-copy",
  "compressor-report",
  "report-compressor",
]);

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const formType = params.get("form") || params.get("type");

  if (DELIVERY_FORM_TYPES.has(formType)) {
    return <DeliveryCertificateForm />;
  }

  if (!formType || REPORT_FORM_TYPES.has(formType)) {
    return <TreatmentReportForm />;
  }

  return <TreatmentReportForm />;
}
