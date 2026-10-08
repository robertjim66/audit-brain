/**
 * 衍生文件：基于 ai-smart-audit（https://github.com/xiangxiang088/ai-smart-audit）
 * 的 server/utils/snowflake.js 改写，原项目以 Apache License 2.0 授权。
 *
 * 修改说明：由 CommonJS 迁移为 ESM / TypeScript 实现，调整位分配与字符串返回。
 * 原始版权与许可声明见仓库根目录 LICENSE 及 README「来源与许可」一节。
 */

/**
 * 雪花算法 ID 生成器（64 位分布式唯一 ID，参考经典 Snowflake 设计）
 * ID 结构（64 位）：0 - 41 位时间戳 - 5 位数据中心 - 5 位机器 - 12 位序列号
 * 返回字符串形式，避免 JS 大数精度丢失（雪花 ID 为 18-19 位数字）。
 */

const EPOCH = 1704067200000n; // 2024-01-01 00:00:00

const WORKER_ID_BITS = 5n;
const DATACENTER_ID_BITS = 5n;
const SEQUENCE_BITS = 12n;

const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n;
const MAX_DATACENTER_ID = (1n << DATACENTER_ID_BITS) - 1n;
const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n;

const WORKER_ID_SHIFT = SEQUENCE_BITS;
const DATACENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS;

export class Snowflake {
  private workerId: bigint;
  private datacenterId: bigint;
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(workerId = 1, datacenterId = 1) {
    if (workerId > Number(MAX_WORKER_ID) || workerId < 0) {
      throw new Error(`workerId must be between 0 and ${MAX_WORKER_ID}`);
    }
    if (datacenterId > Number(MAX_DATACENTER_ID) || datacenterId < 0) {
      throw new Error(`datacenterId must be between 0 and ${MAX_DATACENTER_ID}`);
    }
    this.workerId = BigInt(workerId);
    this.datacenterId = BigInt(datacenterId);
  }

  private currentTime(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTime();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTime();
    }
    return timestamp;
  }

  /** 生成下一个 ID（字符串形式，避免精度丢失） */
  nextId(): string {
    let timestamp = this.currentTime();
    if (timestamp < this.lastTimestamp) {
      throw new Error(`Clock moved backwards. Refusing to generate id for ${this.lastTimestamp - timestamp}ms`);
    }
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SEQUENCE_MASK;
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }
    this.lastTimestamp = timestamp;
    const id =
      ((timestamp - EPOCH) << TIMESTAMP_SHIFT) |
      (this.datacenterId << DATACENTER_ID_SHIFT) |
      (this.workerId << WORKER_ID_SHIFT) |
      this.sequence;
    return id.toString();
  }

  nextIdBigInt(): bigint {
    return BigInt(this.nextId());
  }

  nextIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push(this.nextId());
    return ids;
  }
}

const workerId = parseInt(process.env.SNOWFLAKE_WORKER_ID || '1', 10);
const datacenterId = parseInt(process.env.SNOWFLAKE_DATACENTER_ID || '1', 10);
const snowflake = new Snowflake(workerId, datacenterId);

export default snowflake;
