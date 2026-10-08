import { createCaptcha } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 获取图形验证码：返回 { token, image }，image 可直接作为 <img src> */
export async function GET() {
  return Response.json(createCaptcha());
}
