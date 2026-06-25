import DeliveryCertificateForm from "./DeliveryCertificateForm.jsx";
import TreatmentReportForm from "./TreatmentReportForm.jsx";
import { DELIVERY_FORM_TYPES, REPORT_FORM_TYPES, getRouteFormType } from "./formRoutes.js";

export default function App() {
  const formType = getRouteFormType();

  if (DELIVERY_FORM_TYPES.has(formType)) {
    return <DeliveryCertificateForm />;
  }

  if (!formType || REPORT_FORM_TYPES.has(formType)) {
    return <TreatmentReportForm />;
  }

  return <TreatmentReportForm />;
}
