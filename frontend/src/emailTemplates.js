
export const emailTemplates = [
  {
    id: "account-verification",

    name: "Account Verification",

    subject: "Important Account Update",

    senderName: "Spec-trum Assist Portal",
    previewText: "Your attention is requested regarding your account information.",

    body: `Hello,

An important update regarding your account information requires your attention.

To ensure your account details remain accurate and current, please review the information associated with your account.

Click the button below to access the account portal and review your details.

Thank you for your prompt attention to this matter.

Kind regards,
Customer Support Team`,

    button: {
      enabled: true,
      text: "Review Account Information",
      url: "https://rentassistportal.org",
      color: "#2563EB",
    },

    footer: {
      copyright: "© 2026 Spectrum. All rights reserved.",
      privacyPolicyText: "Privacy Policy",
      privacyPolicyUrl: "",
      termsText: "Terms of Service",
      termsUrl: "",
      notice:
        "This is a system-generated message. Please do not reply.",
    },
  },
];
