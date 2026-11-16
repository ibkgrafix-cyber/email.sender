
import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

import { emailTemplates } from "./emailTemplates";
import {
  createCampaign,
  getCampaign,
  downloadCampaignReport,
} from "./campaignApi";

import "./App.css";

const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const STORAGE_KEY = "rent-assist-custom-email-templates";
const BLANK_TEMPLATE = "__blank__";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function textToHtml(value = "") {
  return String(value)
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function templateToHtml(template) {
  if (template.bodyHtml) return template.bodyHtml;

  let html = textToHtml(template.body || "");

  if (template.button?.enabled && template.button.url) {
    html += `
      <p style="text-align:center">
        <a href="${escapeHtml(template.button.url)}">
          ${escapeHtml(template.button.text || "Open")}
        </a>
      </p>
    `;
  }

  if (template.footer) {
    const footer = template.footer;

    html += `<hr>`;
    html += `<p>${escapeHtml(footer.copyright || "")}</p>`;
    html += `<p>`;

    if (footer.privacyPolicyText) {
      html += footer.privacyPolicyUrl
        ? `<a href="${escapeHtml(footer.privacyPolicyUrl)}">${escapeHtml(footer.privacyPolicyText)}</a>`
        : escapeHtml(footer.privacyPolicyText);
    }

    if (footer.termsText) {
      html += " / ";
      html += footer.termsUrl
        ? `<a href="${escapeHtml(footer.termsUrl)}">${escapeHtml(footer.termsText)}</a>`
        : escapeHtml(footer.termsText);
    }

    html += `</p>`;
    html += `<p>${escapeHtml(footer.notice || "")}</p>`;
  }

  return html;
}

function loadCustomTemplates() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function App() {
  const [fileName, setFileName] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [manualEmail, setManualEmail] = useState("");
  const [manualRecipients, setManualRecipients] = useState([]);

  const [customTemplates, setCustomTemplates] = useState(
    loadCustomTemplates
  );

  const [templateId, setTemplateId] = useState(BLANK_TEMPLATE);
  const [campaignName, setCampaignName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [modalError, setModalError] = useState("");
  const [message, setMessage] = useState("");

  const allTemplates = useMemo(
    () => [...emailTemplates, ...customTemplates],
    [customTemplates]
  );

  const selectedTemplate = allTemplates.find(
    (template) => template.id === templateId
  );

  const isCustomTemplate = customTemplates.some(
    (template) => template.id === templateId
  );

  const uniqueRecipients = useMemo(
    () => [...new Set([...recipients, ...manualRecipients])],
    [recipients, manualRecipients]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      setEmailHtml(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(customTemplates)
      );
    } catch {
      setMessage("Unable to save templates in this browser.");
    }
  }, [customTemplates]);

  useEffect(() => {
    if (!editor) return;

    if (templateId === BLANK_TEMPLATE) {
      setEmailSubject("");
      editor.commands.setContent("");
      setEmailHtml("");
      return;
    }

    if (selectedTemplate) {
      const html = templateToHtml(selectedTemplate);

      setEmailSubject(selectedTemplate.subject || "");
      editor.commands.setContent(html);
      setEmailHtml(html);
    }
  }, [editor, templateId]);

  const isActive =
    campaign?.status === "queued" ||
    campaign?.status === "processing";

  const editorText = editor?.getText().trim() || "";

  const canSend =
    !submitting &&
    !isActive &&
    campaignName.trim().length > 0 &&
    emailSubject.trim().length > 0 &&
    editorText.length > 0 &&
    uniqueRecipients.length > 0 &&
    uniqueRecipients.length <= 10000;

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
          setMessage(`Progress update failed: ${error.message}`);
        }
      }
    }

    refreshCampaign();

    const interval = setInterval(refreshCampaign, 2000);

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
          value.trim().replace(/^["']|["']$/g, "").toLowerCase()
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
      setMessage("Please enter a valid email address.");
      return;
    }

    if (uniqueRecipients.includes(email)) {
      setMessage("This email address is already in the recipient list.");
      return;
    }

    if (uniqueRecipients.length >= 10000) {
      setMessage("The maximum recipient limit is 10,000.");
      return;
    }

    setManualRecipients((previous) => [...previous, email]);
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

  function handleTemplateChange(event) {
    setTemplateId(event.target.value);
    setMessage("");
  }

  function addLink() {
    if (!editor) return;

    const url = window.prompt(
      "Enter the full link address (https://...)"
    );

    if (!url) return;

    let parsedUrl;

    try {
      parsedUrl = new URL(url.trim());
    } catch {
      setMessage("Please enter a valid link address.");
      return;
    }

    if (!["https:", "http:", "mailto:"].includes(parsedUrl.protocol)) {
      setMessage("Only web links and email links are supported.");
      return;
    }

    editor.chain().focus().extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();

    setMessage("Link added to the selected text.");
  }

  function removeLink() {
    editor?.chain().focus().unsetLink().run();
  }

  function saveTemplate() {
    if (!editor || !emailSubject.trim() || !editor.getText().trim()) {
      setMessage("Add an email subject and message before saving.");
      return;
    }

    const suggestedName = selectedTemplate?.name || "";
    const name = window.prompt(
      "Enter a name for this template:",
      suggestedName
    );

    if (!name?.trim()) return;

    const template = {
      id: isCustomTemplate
        ? templateId
        : `custom-${Date.now()}`,
      name: name.trim(),
      subject: emailSubject.trim(),
      body: editor.getText(),
      bodyHtml: editor.getHTML(),
    };

    setCustomTemplates((previous) => {
      if (isCustomTemplate) {
        return previous.map((item) =>
          item.id === templateId ? template : item
        );
      }

      return [...previous, template];
    });

    setTemplateId(template.id);
    setMessage(
      isCustomTemplate
        ? "Your template has been updated."
        : "Your new template has been saved."
    );
  }

  function deleteTemplate() {
    if (!isCustomTemplate) return;

    const confirmed = window.confirm(
      "Delete this saved template? This cannot be undone."
    );

    if (!confirmed) return;

    setCustomTemplates((previous) =>
      previous.filter((item) => item.id !== templateId)
    );

    setTemplateId(BLANK_TEMPLATE);
    setMessage("Template deleted.");
  }

  function openSendModal() {
    if (!canSend) return;

    setModalError("");
    setShowSendModal(true);
  }

  function closeSendModal() {
    if (submitting) return;

    setShowSendModal(false);
    setModalError("");
  }

  async function confirmSendCampaign(event) {
    event.preventDefault();

    if (submitting) return;

    if (!canSend || !editor) {
      setModalError(
        "Please complete the campaign details before sending."
      );
      return;
    }

    setSubmitting(true);
    setModalError("");
    setMessage("");

    try {
      const htmlBody = editor.getHTML();
      const textBody = editor.getText({ blockSeparator: "\n" });

      const result = await createCampaign(
        campaignName.trim(),
        templateId === BLANK_TEMPLATE ? "custom" : templateId,
        uniqueRecipients,
        {
          subject: emailSubject.trim(),
          htmlBody,
          textBody,
        }
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

      setShowSendModal(false);
      setMessage(
        "Campaign submitted successfully. Sending has started."
      );
    } catch (error) {
      setModalError(error.message || "Unable to start campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadReport() {
    if (campaign) downloadCampaignReport(campaign);
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
          <div className="nav-item active">Dashboard</div>
          <div className="nav-item">Campaigns</div>
          <div className="nav-item">Email Templates</div>
          <div className="nav-item">Delivery Reports</div>
          <div className="nav-item">Settings</div>
        </nav>

        <div className="sidebar-footer">Platform v1.1</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">EMAIL MANAGEMENT</p>
            <h1>Campaign Dashboard</h1>
            <p className="muted">
              Create, compose, preview and manage email campaigns.
            </p>
          </div>

          <div className="account">Rent Assist Portal</div>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span>Recipients Added</span>
            <strong>{uniqueRecipients.length.toLocaleString()}</strong>
            <small>Current recipient list</small>
          </div>

          <div className="stat-card">
            <span>Emails Submitted</span>
            <strong>{(campaign?.sent || 0).toLocaleString()}</strong>
            <small>Accepted by email API</small>
          </div>

          <div className="stat-card">
            <span>Delivered</span>
            <strong>{(campaign?.delivered || 0).toLocaleString()}</strong>
            <small>Confirmed delivery events</small>
          </div>

          <div className="stat-card">
            <span>Failed / Bounced</span>
            <strong>
              {((campaign?.failed || 0) + (campaign?.bounced || 0)).toLocaleString()}
            </strong>
            <small>Reported failures</small>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>Create Email Campaign</h2>
              <span className="status">{campaign?.status || "Draft"}</span>
            </div>

            <label htmlFor="campaignName">Campaign Name</label>
            <input
              id="campaignName"
              type="text"
              placeholder="Enter a campaign name"
              value={campaignName}
              disabled={isActive}
              onChange={(event) => setCampaignName(event.target.value)}
            />

            <label htmlFor="customerFile">Upload Customer Email List</label>
            <div className="upload-box">
              <div className="upload-symbol">↑</div>
              <strong>Choose a customer list</strong>
              <p>Upload a CSV file containing customer email addresses.</p>

              <input
                id="customerFile"
                type="file"
                accept=".csv,text/csv"
                disabled={isActive}
                onChange={handleFileUpload}
              />

              {fileName && (
                <div className="uploaded-file">
                  <small>Selected: {fileName}</small>
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
              <h3>Add Email Manually</h3>
              <p className="muted">
                Enter individual customer addresses. You can add multiple addresses.
              </p>

              <div className="manual-email-input">
                <input
                  type="email"
                  aria-label="Customer email address"
                  placeholder="customer@example.com"
                  value={manualEmail}
                  disabled={isActive}
                  onChange={(event) => setManualEmail(event.target.value)}
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
                    Manually Added Emails ({manualRecipients.length})
                  </p>

                  {manualRecipients.map((email) => (
                    <div className="manual-email-item" key={email}>
                      <span>{email}</span>
                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() => removeManualEmail(email)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label htmlFor="template">Choose a Template or Start Fresh</label>
            <select
              id="template"
              value={templateId}
              disabled={isActive}
              onChange={handleTemplateChange}
            >
              <option value={BLANK_TEMPLATE}>Compose from scratch</option>

              <optgroup label="Predefined Templates">
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </optgroup>

              {customTemplates.length > 0 && (
                <optgroup label="My Saved Templates">
                  {customTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <div className="composer-section">
              <div className="section-heading">
                <h3>Email Composer</h3>
                <span className="muted">Rich text editor</span>
              </div>

              <label htmlFor="emailSubject">Email Subject</label>
              <input
                id="emailSubject"
                type="text"
                maxLength={200}
                placeholder="Enter your email subject"
                value={emailSubject}
                disabled={isActive}
                onChange={(event) => setEmailSubject(event.target.value)}
              />

              <div className="editor-toolbar" aria-label="Text formatting">
                <button
                  type="button"
                  title="Bold"
                  disabled={!editor || isActive}
                  className={editor?.isActive("bold") ? "selected" : ""}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <strong>B</strong>
                </button>

                <button
                  type="button"
                  title="Italic"
                  disabled={!editor || isActive}
                  className={editor?.isActive("italic") ? "selected" : ""}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <em>I</em>
                </button>

                <button
                  type="button"
                  title="Underline"
                  disabled={!editor || isActive}
                  className={editor?.isActive("underline") ? "selected" : ""}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                >
                  <u>U</u>
                </button>

                <button
                  type="button"
                  title="Bulleted list"
                  disabled={!editor || isActive}
                  className={editor?.isActive("bulletList") ? "selected" : ""}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  • List
                </button>

                <button
                  type="button"
                  title="Numbered list"
                  disabled={!editor || isActive}
                  className={editor?.isActive("orderedList") ? "selected" : ""}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  1. List
                </button>

                <button
                  type="button"
                  title="Add hyperlink to selected text"
                  disabled={!editor || isActive}
                  onClick={addLink}
                >
                  Add Link
                </button>

                <button
                  type="button"
                  title="Remove hyperlink"
                  disabled={!editor || isActive}
                  onClick={removeLink}
                >
                  Remove Link
                </button>
              </div>

              <div className="rich-editor">
                <EditorContent editor={editor} />
              </div>

              <p className="muted editor-help">
                Select text before choosing Add Link to make that text clickable.
              </p>

              <div className="template-actions">
                <button
                  type="button"
                  disabled={isActive}
                  onClick={saveTemplate}
                >
                  {isCustomTemplate ? "Update Saved Template" : "Save as New Template"}
                </button>

                {isCustomTemplate && (
                  <button
                    type="button"
                    className="delete-template-button"
                    disabled={isActive}
                    onClick={deleteTemplate}
                  >
                    Delete Template
                  </button>
                )}
              </div>
            </div>

            {message && <div className="notice" role="status">{message}</div>}

            <button
              className="send-button"
              type="button"
              onClick={openSendModal}
              disabled={!canSend}
            >
              {submitting
                ? "Submitting Campaign..."
                : isActive
                ? "Campaign Sending..."
                : "Send Campaign"}
            </button>

            {campaign && (
              <div style={{ marginTop: "24px" }}>
                <h3>Campaign Progress</h3>

                <div className="preview-row">
                  <span>Status</span>
                  <strong>{campaign.status}</strong>
                </div>

                <div className="preview-row">
                  <span>Processed</span>
                  <strong>
                    {processed.toLocaleString()} / {campaign.total.toLocaleString()}
                  </strong>
                </div>

                <div className="campaign-progress-track">
                  <div
                    className="campaign-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="muted">{progress}% processed</p>

                <div className="preview-row">
                  <span>Submitted</span>
                  <strong>{campaign.sent || 0}</strong>
                </div>

                <div className="preview-row">
                  <span>Failed</span>
                  <strong>{campaign.failed || 0}</strong>
                </div>

                <div className="preview-row">
                  <span>Delivered</span>
                  <strong>{campaign.delivered || 0}</strong>
                </div>

                <div className="preview-row">
                  <span>Bounced</span>
                  <strong>{campaign.bounced || 0}</strong>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={!campaign.results?.length}
                  className="report-button"
                >
                  Download CSV Report
                </button>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Campaign Preview</h2>
            </div>

            <div className="preview-row">
              <span>Campaign</span>
              <strong>{campaignName || "Not named"}</strong>
            </div>

            <div className="preview-row">
              <span>Total Recipients</span>
              <strong>{uniqueRecipients.length.toLocaleString()}</strong>
            </div>

            <div className="preview-row">
              <span>Uploaded Recipients</span>
              <strong>{recipients.length}</strong>
            </div>

            <div className="preview-row">
              <span>Manually Added</span>
              <strong>{manualRecipients.length}</strong>
            </div>

            <div className="preview-row">
              <span>Selected Template</span>
              <strong>{selectedTemplate?.name || "Compose from scratch"}</strong>
            </div>

            <div className="preview-row">
              <span>Email Subject</span>
              <strong>{emailSubject || "—"}</strong>
            </div>

            <h3>Email Message Preview</h3>

            <div className="email-preview">
              {emailHtml ? (
                <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
              ) : (
                <p className="muted">Your composed email will appear here.</p>
              )}
            </div>

            <h3>Recipient Preview</h3>

            <div className="recipient-list">
              {uniqueRecipients.length === 0 ? (
                <p className="muted">
                  Upload a CSV file or manually add email addresses to preview recipients.
                </p>
              ) : (
                uniqueRecipients.slice(0, 10).map((email) => (
                  <div className="recipient" key={email}>{email}</div>
                ))
              )}
            </div>

            {uniqueRecipients.length > 10 && (
              <p className="muted">
                +{uniqueRecipients.length - 10} more recipients
              </p>
            )}

            {campaign && (
              <div className="notice">
                <strong>Campaign: {campaign.name}</strong>
                <div>Status: {campaign.status}</div>
                <div>Submitted: {campaign.sent || 0}</div>
                <div>Failed: {campaign.failed || 0}</div>
              </div>
            )}
          </section>
        </div>
      </main>

      {showSendModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSendModal();
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sendModalTitle"
          >
            <h2 id="sendModalTitle">Confirm Email Campaign</h2>
            <p>Review your campaign details before sending.</p>

            <div className="modal-details">
              <div>
                <span>Campaign</span>
                <strong>{campaignName}</strong>
              </div>

              <div>
                <span>Recipients</span>
                <strong>{uniqueRecipients.length}</strong>
              </div>

              <div>
                <span>Email Subject</span>
                <strong>{emailSubject}</strong>
              </div>

              <div>
                <span>Template</span>
                <strong>{selectedTemplate?.name || "Compose from scratch"}</strong>
              </div>
            </div>

            <form onSubmit={confirmSendCampaign}>
              {modalError && (
                <div className="modal-error" role="alert">{modalError}</div>
              )}

              <div className="modal-actions">
                <button
                  className="modal-cancel"
                  type="button"
                  disabled={submitting}
                  onClick={closeSendModal}
                >
                  Cancel
                </button>

                <button className="modal-confirm" type="submit" disabled={submitting}>
                  {submitting ? "Sending..." : "Confirm & Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
