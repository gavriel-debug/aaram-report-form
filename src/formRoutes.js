export const DELIVERY_FORM_TYPES = new Set(["delivery", "delivery-certificate"]);

export const REPORT_FORM_TYPES = new Set([
  "report",
  "treatment-report",
  "report-copy",
  "treatment-report-copy",
  "compressor-report",
  "report-compressor",
]);

const PATH_FORM_TYPES = {
  report: "report",
  "treatment-report": "report",
  dryer: "report-copy",
  "dryer-report": "report-copy",
  compressor: "compressor-report",
  "compressor-report": "compressor-report",
  delivery: "delivery",
  "delivery-certificate": "delivery",
};

export function getRouteFormType() {
  const params = new URLSearchParams(window.location.search);
  const queryFormType = params.get("form") || params.get("type");
  if (queryFormType) return queryFormType;

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const lastPathPart = pathParts[pathParts.length - 1] || "";

  return PATH_FORM_TYPES[lastPathPart] || "";
}

export function getPagePath(pathName) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/${pathName}`;
}
