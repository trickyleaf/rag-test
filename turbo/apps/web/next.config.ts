import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/db", "@repo/rag", "@repo/ui"],
};

export default withWorkflow(nextConfig);
