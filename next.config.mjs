/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14：原生/大依赖交由 Node 运行时直接 require，避免被打包器误处理
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'docx', 'xlsx', 'mammoth', 'bcryptjs', 'pdf-parse'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // 上传原件必须经过带鉴权的 /api/files；beforeFiles 保证优先于 public 静态命中，
        // 避免 public/uploads 下的文件被匿名直链（历史遗留文件同样被拦住）。
        { source: '/uploads/:path*', destination: '/api/files/:path*' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
