
const API_URL = "https://email-sender-0eoe.onrender.com";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
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

export async function createCampaign(
  name,
  templateId,
  recipients,
  emailContent,
  attachments = []
) {
  const formData = new FormData();

  formData.append("name", name);
  formData.append("template_id", templateId);
  formData.append("recipients", JSON.stringify(recipients));
  formData.append("subject", emailContent.subject);
  formData.append("html_body", emailContent.htmlBody);
  formData.append("text_body", emailContent.textBody);

  attachments.forEach((file) => {
    formData.append("files", file);
  });

  return request("/api/campaigns", {
    method: "POST",
    body: formData,
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

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${(campaign.name || "campaign").replace(
    /[^a-z0-9_-]+/gi,
    "_"
  )}-report.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
