
import { useEffect, useMemo, useState } from "react";
import { emailTemplates } from "./emailTemplates";
import {
  createCampaign,
  getCampaign,
  downloadCampaignReport,
} from "./campaignApi";
import "./App.css";

const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function App() {
  const [fileName, setFileName] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [manualEmail, setManualEmail] = useState("");
  const [manualRecipients, setManualRecipients] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState(null);

  const selectedTemplate = emailTemplates.find(
    (template) => template.id === templateId
  );

  const uniqueRecipients = useMemo(
    () => [...new Set([...recipients, ...manualRecipients])],
    [recipients, manualRecipients]
  );

  const isActive =
    campaign?.status === "queued" ||
    campaign?.status === "processing";

  const processed =
    (campaign?.sent || 0) + (campaign?.failed || 0);

  const progress = campaign?.total
    ? Math.round((processed / campaign.total) * 100)
    : 0;

  useEffect(() => {
    if (!campaign?.id || !isActive) return;

    let stopped = false;

    async function refreshCampaign() {
      try {
        const updated = await getCampaign(campaign.id);

        if (!stopped) {
          setCampaign(updated);
        }
      } catch (error) {
        if (!stopped) {
          setMessage(
            `Progress update failed: ${error.message}`
          );
        }
      }
    }

    refreshCampaign();

    const interval = setInterval(
      refreshCampaign,
      2000
    );

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [campaign?.id, isActive]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please upload a CSV file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Maximum file size is 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/);

      const emails = rows
        .flatMap((row) => row.split(","))
        .map((value) =>
          value
            .trim()
            .replace(/^["']|["']$/g, "")
            .toLowerCase()
        )
        .filter((value) => emailPattern.test(value));

      const uniqueEmails = [...new Set(emails)];

      setFileName(file.name);
      setRecipients(uniqueEmails);

      setMessage(
        `${uniqueEmails.length} valid unique email addresses loaded.`
      );
    } catch {
      setMessage("Unable to read the selected file.");
    }

    event.target.value = "";
  }

  function addManualEmail() {
    const email = manualEmail.trim().toLowerCase();

    if (!emailPattern.test(email)) {
      setMessage(
        "Please enter a valid email address."
      );
      return;
    }

    if (uniqueRecipients.includes(email)) {
      setMessage(
        "This email address is already in the recipient list."
      );
      return;
    }

    setManualRecipients((previous) => [
      ...previous,
      email,
    ]);

    setManualEmail("");
    setMessage("Email address added successfully.");
  }

  function removeManualEmail(email) {
    setManualRecipients((previous) =>
      previous.filter((item) => item !== email)
    );

    setMessage("");
  }

  function clearUploadedList() {
    setRecipients([]);
    setFileName("");
    setMessage("Uploaded email list cleared.");
  }

  async function handleSendCampaign() {
    if (submitting || isActive) return;

    if (!campaignName.trim()) {
      setMessage("Please enter a campaign name.");
      return;
    }

    if (!selectedTemplate) {
      setMessage(
        "Please select an email template."
      );
      return;
    }

    if (uniqueRecipients.length === 0) {
      setMessage(
        "Please add at least one recipient."
      );
      return;
    }

    if (uniqueRecipients.length > 10000) {
      setMessage(
        "Maximum recipients per campaign is 10,000."
      );
      return;
    }

    const confirmed = window.confirm(
      `Send "${campaignName}" to ${uniqueRecipients.length} recipient(s)?`
    );

    if (!confirmed) return;

    // Ask for the sending password only when
    // the client clicks Send Campaign.
    const password = window.prompt(
      "Enter the campaign sending password:"
    );

    if (password === null) {
      return;
    }

    if (!password.trim()) {
      setMessage(
        "Sending password is required."
      );
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const result = await createCampaign(
        campaignName.trim(),
        templateId,
        uniqueRecipients,
        password
      );

      setCampaign({
        id: result.campaign_id,
        name: campaignName.trim(),
        status: result.status,
        total: result.total,
        sent: 0,
        failed: 0,
        delivered: 0,
        bounced: 0,
        results: [],
      });

      setMessage(
        "Campaign submitted successfully. Sending has started."
      );
    } catch (error) {
      setMessage(
        `Unable to start campaign: ${error.message}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadReport() {
    if (!campaign) return;

    downloadCampaignReport(campaign);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>

          <div>
            <strong>Rent Assist</strong>
            <span>Email Platform</span>
          </div>
        </div>

        <nav>
          <div className="nav-item active">
            Dashboard
          </div>

          <div className="nav-item">
            Campaigns
          </div>

          <div className="nav-item">
            Email Templates
          </div>

          <div className="nav-item">
            Delivery Reports
          </div>

          <div className="nav-item">
            Settings
          </div>
        </nav>

        <div className="sidebar-footer">
          Platform v1.0
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              EMAIL MANAGEMENT
            </p>

            <h1>Campaign Dashboard</h1>

            <p className="muted">
              Create, preview, send, and manage
              customer email campaigns.
            </p>
          </div>

          <div className="account">
            Rent Assist Portal
          </div>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span>Recipients Added</span>

            <strong>
              {uniqueRecipients.length.toLocaleString()}
            </strong>

            <small>Current recipient list</small>
          </div>

          <div className="stat-card">
            <span>Emails Submitted</span>

            <strong>
              {(campaign?.sent || 0).toLocaleString()}
            </strong>

            <small>Accepted by email API</small>
          </div>

          <div className="stat-card">
            <span>Delivered</span>

            <strong>
              {(campaign?.delivered || 0).toLocaleString()}
            </strong>

            <small>Confirmed delivery events</small>
          </div>

          <div className="stat-card">
            <span>Failed / Bounced</span>

            <strong>
              {(
                (campaign?.failed || 0) +
                (campaign?.bounced || 0)
              ).toLocaleString()}
            </strong>

            <small>Reported failures</small>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>Create Email Campaign</h2>

              <span className="status">
                {campaign?.status || "Draft"}
              </span>
            </div>

            <label htmlFor="campaignName">
              Campaign Name
            </label>

            <input
              id="campaignName"
              type="text"
              placeholder="e.g. Account Verification Campaign"
              value={campaignName}
              disabled={isActive}
              onChange={(event) =>
                setCampaignName(event.target.value)
              }
            />

            <label htmlFor="customerFile">
              Upload Customer Email List
            </label>

            <div className="upload-box">
              <div className="upload-symbol">
                ↑
              </div>

              <strong>
                Choose a customer list
              </strong>

              <p>
                Upload a CSV file containing
                customer email addresses.
              </p>

              <input
                id="customerFile"
                type="file"
                accept=".csv,text/csv"
                disabled={isActive}
                onChange={handleFileUpload}
              />

              {fileName && (
                <div className="uploaded-file">
                  <small>
                    Selected: {fileName}
                  </small>

                  <button
                    type="button"
                    disabled={isActive}
                    onClick={clearUploadedList}
                  >
                    Clear List
                  </button>
                </div>
              )}
            </div>

            <div className="manual-email-section">
              <h3>
                Add Email Manually
              </h3>

              <p className="muted">
                Enter an individual customer
                email address. You can add
                multiple addresses without
                uploading a file.
              </p>

              <div className="manual-email-input">
                <input
                  type="email"
                  aria-label="Customer email address"
                  placeholder="customer@example.com"
                  value={manualEmail}
                  disabled={isActive}
                  onChange={(event) =>
                    setManualEmail(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addManualEmail();
                    }
                  }}
                />

                <button
                  type="button"
                  disabled={isActive}
                  onClick={addManualEmail}
                >
                  Add Email
                </button>
              </div>

              {manualRecipients.length > 0 && (
                <div className="manual-email-list">
                  <p className="manual-list-heading">
                    Manually Added Emails (
                    {manualRecipients.length})
                  </p>

                  {manualRecipients.map((email) => (
                    <div
                      className="manual-email-item"
                      key={email}
                    >
                      <span>{email}</span>

                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() =>
                          removeManualEmail(email)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {message && (
              <div
                className="notice"
                role="status"
              >
                {message}
              </div>
            )}

            <label htmlFor="template">
              Select Email Template
            </label>

            <select
              id="template"
              value={templateId}
              disabled={isActive}
              onChange={(event) =>
                setTemplateId(event.target.value)
              }
            >
              <option value="">
                Choose a template
              </option>

              {emailTemplates.map((template) => (
                <option
                  key={template.id}
                  value={template.id}
                >
                  {template.name}
                </option>
              ))}
            </select>

            <div className="notice">
              Select a saved email template
              to preview its message and
              action button before sending.
            </div>

            <button
              className="send-button"
              type="button"
              onClick={handleSendCampaign}
              disabled={
                submitting ||
                isActive ||
                !campaignName.trim() ||
                !selectedTemplate ||
                uniqueRecipients.length === 0 ||
                uniqueRecipients.length > 10000
              }
            >
              {submitting
                ? "Submitting Campaign..."
                : isActive
                ? "Campaign Sending..."
                : "Send Campaign"}
            </button>

            {campaign && (
              <div
                style={{
                  marginTop: "24px",
                }}
              >
                <h3>
                  Campaign Progress
                </h3>

                <div className="preview-row">
                  <span>Status</span>
                  <strong>
                    {campaign.status}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Processed</span>

                  <strong>
                    {processed.toLocaleString()} /{" "}
                    {campaign.total.toLocaleString()}
                  </strong>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "12px",
                    background: "#e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    marginTop: "12px",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "#2563eb",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <p className="muted">
                  {progress}% processed
                </p>

                <div className="preview-row">
                  <span>Submitted</span>

                  <strong>
                    {campaign.sent || 0}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Failed</span>

                  <strong>
                    {campaign.failed || 0}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Delivered</span>

                  <strong>
                    {campaign.delivered || 0}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Bounced</span>

                  <strong>
                    {campaign.bounced || 0}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={
                    !campaign.results?.length
                  }
                  style={{
                    marginTop: "16px",
                    padding: "12px 18px",
                    border: "none",
                    borderRadius: "6px",
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Download CSV Report
                </button>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>
                Campaign Preview
              </h2>
            </div>

            <div className="preview-row">
              <span>Campaign</span>

              <strong>
                {campaignName || "Not named"}
              </strong>
            </div>

            <div className="preview-row">
              <span>Total Recipients</span>

              <strong>
                {uniqueRecipients.length.toLocaleString()}
              </strong>
            </div>

            <div className="preview-row">
              <span>Uploaded Recipients</span>

              <strong>
                {recipients.length}
              </strong>
            </div>

            <div className="preview-row">
              <span>Manually Added</span>

              <strong>
                {manualRecipients.length}
              </strong>
            </div>

            <div className="preview-row">
              <span>Selected Template</span>

              <strong>
                {selectedTemplate?.name ||
                  "Not selected"}
              </strong>
            </div>

            <div className="preview-row">
              <span>Email Subject</span>

              <strong>
                {selectedTemplate?.subject || "—"}
              </strong>
            </div>

            <h3>
              Email Message Preview
            </h3>

            {selectedTemplate ? (
              <div
                style={{
                  padding: "20px",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  color: "#333333",
                }}
              >
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "14px",
                    lineHeight: "1.7",
                  }}
                >
                  {selectedTemplate.body}
                </div>

                {selectedTemplate.button?.enabled && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "24px",
                      marginBottom: "24px",
                    }}
                  >
                    <a
                      href={
                        selectedTemplate.button.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "14px 22px",
                        backgroundColor:
                          selectedTemplate.button.color,
                        color: "#ffffff",
                        textDecoration: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        fontFamily: "Arial, sans-serif",
                        fontSize: "14px",
                      }}
                    >
                      {
                        selectedTemplate.button.text
                      }
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">
                Select an email template
                to preview its content.
              </p>
            )}

            <h3>
              Recipient Preview
            </h3>

            <div className="recipient-list">
              {uniqueRecipients.length === 0 ? (
                <p className="muted">
                  Upload a CSV file or
                  manually add an email
                  address to preview recipients.
                </p>
              ) : (
                uniqueRecipients
                  .slice(0, 10)
                  .map((email) => (
                    <div
                      className="recipient"
                      key={email}
                    >
                      {email}
                    </div>
                  ))
              )}
            </div>

            {uniqueRecipients.length > 10 && (
              <p className="muted">
                +{uniqueRecipients.length - 10}
                {" "}more recipients
              </p>
            )}

            {campaign && (
              <div className="notice">
                <strong>
                  Campaign: {campaign.name}
                </strong>

                <div>
                  Status: {campaign.status}
                </div>

                <div>
                  Submitted: {campaign.sent || 0}
                </div>

                <div>
                  Failed: {campaign.failed || 0}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
