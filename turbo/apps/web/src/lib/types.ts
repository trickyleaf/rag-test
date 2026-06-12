export type AppRole = {
  id: string;
  name: string;
  policy: {
    isAdmin: boolean;
    allowedTagKeys: string[];
    deniedTagKeys: string[];
  };
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
};

export type AppTag = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isSystem: boolean;
};

export type AppDocument = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploaded" | "processing" | "ready" | "failed";
  tagKeys: string[];
  uploadedByUserId: string;
  updatedAt: string;
};
