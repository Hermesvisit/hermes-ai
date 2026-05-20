export type BusinessProfile = {
  name: string;
  type: string;
  industry: string;
  targetAudience: string;
  monetizationModel: string;
  priorities: string[];
  stage: string;
};

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: "Hermes",
  type: "AI Business Operating System",
  industry: "AI SaaS",
  targetAudience: "founders, solo builders, startups",
  monetizationModel: "subscription + enterprise",
  priorities: [
    "Developer productivity",
    "Safe planning (read-only)",
    "Memory and task continuity",
    "Business OS evolution",
  ],
  stage: "prototype",
};

let businessProfile: BusinessProfile = {
  ...DEFAULT_BUSINESS_PROFILE,
  priorities: [...DEFAULT_BUSINESS_PROFILE.priorities],
};

export function getBusinessProfile(): BusinessProfile {
  return {
    ...businessProfile,
    priorities: [...businessProfile.priorities],
  };
}

export function updateBusinessProfile(
  partial: Partial<BusinessProfile>
): BusinessProfile {
  businessProfile = {
    ...businessProfile,
    ...partial,
    priorities: partial.priorities
      ? [...partial.priorities]
      : [...businessProfile.priorities],
  };

  return getBusinessProfile();
}

export function summarizeBusinessIdentity(): string {
  const profile = getBusinessProfile();

  return `## Hermes İş Kimliği

**İsim:** ${profile.name}
**Tür:** ${profile.type}
**Sektör:** ${profile.industry}
**Hedef kitle:** ${profile.targetAudience}
**İş modeli:** ${profile.monetizationModel}
**Aşama:** ${profile.stage}

**Öncelikler:**
${profile.priorities.map((item) => `- ${item}`).join("\n")}`;
}

export function getBusinessContextPrompt(): string {
  const profile = getBusinessProfile();

  return `İŞ KİMLİĞİ (Business Identity Layer):
- İşletme/ürün adı: ${profile.name}
- Tür: ${profile.type}
- Sektör: ${profile.industry}
- Hedef kitle: ${profile.targetAudience}
- Monetizasyon: ${profile.monetizationModel}
- Aşama: ${profile.stage}
- Öncelikler: ${profile.priorities.join(", ")}

Planlama ve strateji cevaplarında bu kimliğe uygun düşün. Prototype aşamasında hız, güvenlik ve net değer önerisi önceliklidir.`;
}

export function getBusinessFieldAnswer(
  field: "identity" | "industry" | "audience" | "monetization"
): string {
  const profile = getBusinessProfile();

  switch (field) {
    case "identity":
      return `${profile.name}, ${profile.type} olarak konumlanıyor. Şu an **${profile.stage}** aşamasındayız.`;
    case "industry":
      return `Sektörümüz: **${profile.industry}** (${profile.type}).`;
    case "audience":
      return `Hedef kitlemiz: **${profile.targetAudience}**.`;
    case "monetization":
      return `İş modelimiz: **${profile.monetizationModel}**.`;
  }
}
