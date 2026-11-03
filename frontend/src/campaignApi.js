
const API_URL = "https://email-sender-0eoe.onrender.com";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
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
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}`
  );
}

export function downloadCampaignReport(campaign) {
  const rows = [
    ["Email", "Status", "Resend ID", "Error"],
    ...(campaign.results || []).map((item) => [
      item.email,
      item.status,
      item.resend_id || "",
      item.error || "",
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) =>
          `"${String(value ?? "").replace(/"/g, '""')}"`
        )
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `campaign-${campaign.id}-report.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
