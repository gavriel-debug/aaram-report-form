import DeliveryCertificateForm from "./DeliveryCertificateForm.jsx";
import TreatmentReportForm from "./TreatmentReportForm.jsx";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const formType = params.get("form") || params.get("type");

  if (formType === "delivery" || formType === "delivery-certificate") {
    return <DeliveryCertificateForm />;
  }

  return <TreatmentReportForm />;
}
