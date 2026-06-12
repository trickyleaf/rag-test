export type RoleAccessPolicy = {
  isAdmin: boolean;
  allowedTagKeys: readonly string[];
  deniedTagKeys: readonly string[];
};

export type DocumentAccessMetadata = {
  tagKeys: readonly string[];
};

export type QdrantAclFilter = {
  must?: Array<Record<string, unknown>>;
  must_not?: Array<Record<string, unknown>>;
};

export function normalizeTagKeys(tagKeys: readonly string[]) {
  return [...new Set(tagKeys.map((tagKey) => tagKey.trim()).filter(Boolean))];
}

export function resolveUploadTagKeys(tagKeys: readonly string[]) {
  const normalized = normalizeTagKeys(tagKeys);

  return normalized.length > 0 ? normalized : ["any"];
}

export function canAccessDocument(
  policy: RoleAccessPolicy,
  document: DocumentAccessMetadata,
) {
  if (policy.isAdmin) {
    return true;
  }

  const documentTags = new Set(normalizeTagKeys(document.tagKeys));
  const allowedTags = new Set(normalizeTagKeys(policy.allowedTagKeys));
  const deniedTags = new Set(normalizeTagKeys(policy.deniedTagKeys));

  const hasAllowedTag = [...documentTags].some((tagKey) =>
    allowedTags.has(tagKey),
  );
  const hasDeniedTag = [...documentTags].some((tagKey) => deniedTags.has(tagKey));

  return hasAllowedTag && !hasDeniedTag;
}

export function buildQdrantAclFilter(policy: RoleAccessPolicy): QdrantAclFilter {
  if (policy.isAdmin) {
    return {};
  }

  const allowedTagKeys = normalizeTagKeys(policy.allowedTagKeys);
  const deniedTagKeys = normalizeTagKeys(policy.deniedTagKeys);

  if (allowedTagKeys.length === 0) {
    return {
      must: [{ has_id: [] }],
    };
  }

  return {
    must: [
      {
        key: "tagKeys",
        match: {
          any: allowedTagKeys,
        },
      },
    ],
    ...(deniedTagKeys.length > 0
      ? {
          must_not: [
            {
              key: "tagKeys",
              match: {
                any: deniedTagKeys,
              },
            },
          ],
        }
      : {}),
  };
}
