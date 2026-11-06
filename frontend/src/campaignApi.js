
const API_URL = "https://email-sender-0eoe.onrender.com";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return data;
}

export async function createCampaign(name, templateId, recipients) {
  return request("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name,
      template_id: templateId,
      recipients,
    }),
  });
}

export async function getCampaign(campaignId) {
  return request(`/api/campaigns/${encodeURIComponent(campaignId)}`);
}

export function downloadCampaignReport(campaign) {
  const rows = [
    ["Email", "Status", "Resend ID", "Error"],
    ...(campaign.results || []).map((result) => [
      result.email || "",
      result.status || "",
      result.resend_id || "",
      result.error || "",
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(campaign.name || "campaign").replace(/[^a-z0-9_-]+/gi, "_")}-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
