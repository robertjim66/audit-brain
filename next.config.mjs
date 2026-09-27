/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14：原生/大依赖交由 Node 运行时直接 require，避免被打包器误处理
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'docx', 'xlsx', 'mammoth', 'bcryptjs', 'pdf-parse'],
  },
};

export default nextConfig;
