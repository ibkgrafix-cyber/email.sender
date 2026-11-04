
export const emailTemplates = [
  {
    id: "account-verification",

    name: "Account Verification",

    subject: "Information About Your Account",

    senderName: "Spec-trum Assist Protal",

    body: `Hello,

We are making some changes to improve the way account information is managed on our platform.

As part of these changes, we are asking active account holders to review their details and confirm that their information is up to date by December 20, 2026.

You can complete this review by visiting our official website and signing in through your usual account access page.

If you have already reviewed your information, you do not need to take any further action.

Thank you for your cooperation.

Customer Support Team
Spec-trum Assist Protal`,

    button: {
      enabled: true,
      text: "Review Your Account Details",
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
