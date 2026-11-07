
export const emailTemplates = [
  {
    id: "account-verification",

    name: "Account Verification",

    subject: "Account Information Update",

    senderName: "Spec-trum Assist Portal",
    previewText: "Please review the latest information regarding your account.",

    body: `Hello,

We are currently making improvements to how account information is maintained and managed.

As part of these updates, we encourage you to review your account details to ensure that your information remains accurate and up to date.

You can review your account information by visiting the website you normally use to access your account.

If your information is already correct, no further action is required.

Thank you for your time and cooperation.

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
