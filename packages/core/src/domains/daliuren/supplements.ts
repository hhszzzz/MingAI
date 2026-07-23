/**
 * 大六壬补充计算 — 库未覆盖的部分
 * 包括：课体细分、课名、十二长生、五行旺衰、桃花、游都
 */

import { DI_ZHI, GAN_WUXING, TIAN_GAN, ZHI_WUXING } from '../../data/ganzhi.js';

export type SingleKeResolution = {
  method: '元首' | '重审';
  chu: string;
};

/** 地支序号 */
function zhiIndex(zhi: string): number {
  const i = DI_ZHI.indexOf(zhi as typeof DI_ZHI[number]);
  return i === -1 ? 0 : i;
}

/** 天干序号 */
function ganIndex(gan: string): number {
  const i = TIAN_GAN.indexOf(gan as typeof TIAN_GAN[number]);
  return i === -1 ? 0 : i;
}

/** 天干阴阳 */
function ganYinYang(gan: string): '阳' | '阴' {
  return ganIndex(gan) % 2 === 0 ? '阳' : '阴';
}

/** 月将名称 */
const YUE_JIANG_NAMES: Record<string, string> = {
  亥: '登明', 戌: '河魁', 酉: '从魁', 申: '传送',
  未: '小吉', 午: '胜光', 巳: '太乙', 辰: '天罡',
  卯: '太冲', 寅: '功曹', 丑: '大吉', 子: '神后',
};

/** 天将全称 */
const TIAN_JIANG_SHORT: Record<string, string> = {
  贵人: '贵', 腾蛇: '蛇', 朱雀: '雀', 六合: '合',
  勾陈: '勾', 青龙: '龙', 天空: '空', 白虎: '虎',
  太常: '常', 玄武: '玄', 太阴: '阴', 天后: '后',
};

// ===== 十二长生 =====

/**
 * 十二长生序列
 * 阳干顺行，阴干逆行
 */
const CHANG_SHENG_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;

/** 各五行阳干长生起始地支 */
const YANG_CHANG_SHENG_START: Record<string, number> = {
  木: zhiIndex('亥'), // 甲木长生在亥
  火: zhiIndex('寅'), // 丙火长生在寅
  土: zhiIndex('寅'), // 戊土长生在寅（同火）
  金: zhiIndex('巳'), // 庚金长生在巳
  水: zhiIndex('申'), // 壬水长生在申
};

/**
 * 计算某地支在日干五行下的十二长生状态
 */
export function getChangSheng(riGan: string, diZhi: string): string {
  const wx = GAN_WUXING[riGan];
  if (!wx) return '';
  const isYang = ganYinYang(riGan) === '阳';
  const start = YANG_CHANG_SHENG_START[wx];
  const pos = zhiIndex(diZhi);

  if (isYang) {
    // 阳干顺行
    const offset = (pos - start + 12) % 12;
    return CHANG_SHENG_NAMES[offset];
  } else {
    // 阴干逆行
    const offset = (start - pos + 12) % 12;
    return CHANG_SHENG_NAMES[offset];
  }
}

// ===== 五行旺衰 =====

/**
 * 根据月令（月支）判断五行旺衰
 * 旺：当令之行；相：旺所生；休：生旺者；囚：克旺者；死：旺所克
 */
const SHENG_CYCLE = ['木', '火', '土', '金', '水']; // 五行相生顺序

/** 月支对应当令五行 */
const YUE_LING_WUXING: Record<string, string> = {
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  亥: '水', 子: '水',
  辰: '土', 未: '土', 戌: '土', 丑: '土',
};

export function getWangShuai(yueZhi: string, wuXing: string): '旺' | '相' | '休' | '囚' | '死' {
  const wang = YUE_LING_WUXING[yueZhi] || '土';
  if (wuXing === wang) return '旺';

  const wangIdx = SHENG_CYCLE.indexOf(wang);
  const xiang = SHENG_CYCLE[(wangIdx + 1) % 5]; // 旺所生
  const xiu = SHENG_CYCLE[(wangIdx + 4) % 5];   // 生旺者
  const qiu = SHENG_CYCLE[(wangIdx + 3) % 5];   // 克旺者
  const si = SHENG_CYCLE[(wangIdx + 2) % 5];     // 旺所克

  if (wuXing === xiang) return '相';
  if (wuXing === xiu) return '休';
  if (wuXing === qiu) return '囚';
  if (wuXing === si) return '死';
  return '休';
}

// ===== 补充神煞 =====

/** 桃花（咸池）：寅午戌见卯，申子辰见酉，巳酉丑见午，亥卯未见子 */
export function getTaoHua(riZhi: string): string {
  if (['寅', '午', '戌'].includes(riZhi)) return '卯';
  if (['申', '子', '辰'].includes(riZhi)) return '酉';
  if (['巳', '酉', '丑'].includes(riZhi)) return '午';
  if (['亥', '卯', '未'].includes(riZhi)) return '子';
  return '';
}

// ===== 课体细分 =====

interface SiKeData {
  ganYang: string;  // 一课上神
  ganYing: string;  // 二课上神
  zhiYang: string;  // 三课上神
  zhiYing: string;  // 四课上神
  gan: string;      // 日干
  zhi: string;      // 日支
}

/**
 * 校验库返回的无克课体。
 *
 * 九宗门的昴星只应在四课没有明确上克下或下贼上时进入。第三方库
 * 使用静态课表，个别课例可能把唯一的贼克误标为昴星；这时可安全地
 * 用唯一贼克课的上神重建初传。多课并见的比用/涉害交由原库处理，避免
 * 在这里重复实现取比、涉害深浅等规则。
 */
export function resolveSingleKeMisclassifiedAsMaoXing(
  method: string,
  siKe: SiKeData,
): SingleKeResolution | null {
  if (method !== '昴星') return null;

  const lessons = [
    [siKe.ganYang, GAN_WUXING[siKe.gan]],
    [siKe.ganYing, ZHI_WUXING[siKe.ganYang]],
    [siKe.zhiYang, ZHI_WUXING[siKe.zhi]],
    [siKe.zhiYing, ZHI_WUXING[siKe.zhiYang]],
  ];

  // 上克下与下贼上不能混为一谈；有贼时优先按重审取传。
  const upperKeLower = lessons
    .filter(([upper, lower]) => upper && lower && keRelation(
      ZHI_WUXING[upper] || upper,
      lower,
    ))
    .map(([upper]) => upper);
  const lowerKeUpper = lessons
    .filter(([upper, lower]) => upper && lower && keRelation(
      lower,
      ZHI_WUXING[upper] || upper,
    ))
    .map(([upper]) => upper);

  const candidates = lowerKeUpper.length > 0 ? lowerKeUpper : upperKeLower;
  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length !== 1) return null;

  return {
    method: lowerKeUpper.length > 0 ? '重审' : '元首',
    chu: uniqueCandidates[0],
  };
}

/**
 * 判断课体细分
 * method: 库返回的取传大类
 * siKe: 四课数据
 * sanChuan: 三传数据
 * tianPan: 天盘
 */
export function classifyKeTi(
  method: string,
  siKe: SiKeData,
  sanChuan: { chu: string; zhong: string; mo: string; },
): { method: string; subTypes: string[]; extraTypes: string[]; } {
  const subTypes: string[] = [];
  const extraTypes: string[] = [];

  // --- 取传课体子类型 ---
  if (method === '遥克') {
    // 蒿失：遥克中，上神克日干（从外来克）
    // 弹射：遥克中，日干克上神（从内向外克）
    const chuWx = ZHI_WUXING[sanChuan.chu];
    const ganWx = GAN_WUXING[siKe.gan];
    if (chuWx && ganWx) {
      if (keRelation(chuWx, ganWx)) {
        subTypes.push('蒿失');
      } else if (keRelation(ganWx, chuWx)) {
        subTypes.push('弹射');
      }
    }
  } else if (method === '贼克') {
    // 统计上克下（元首）与下贼上（重审）的数量
    const keDownPairs = [
      [siKe.ganYang, GAN_WUXING[siKe.gan]],   // 一课：上神 vs 日干
      [siKe.zhiYang, ZHI_WUXING[siKe.zhi]],  // 三课：上神 vs 日支
    ].filter(([shangWx, xiaWx]) => shangWx && xiaWx && keRelation(ZHI_WUXING[shangWx] || '', xiaWx || ''));
    const keUpPairs = [
      [siKe.ganYang, GAN_WUXING[siKe.gan]],
      [siKe.zhiYang, ZHI_WUXING[siKe.zhi]],
    ].filter(([shangWx, xiaWx]) => shangWx && xiaWx && keRelation(xiaWx || '', ZHI_WUXING[shangWx] || ''));
    const totalKe = keDownPairs.length + keUpPairs.length;
    if (totalKe >= 2) {
      subTypes.push('知一');
    } else if (keDownPairs.length === 1 && keUpPairs.length === 0) {
      subTypes.push('元首');
    } else if (keUpPairs.length === 1 && keDownPairs.length === 0) {
      subTypes.push('重审');
    } else {
      subTypes.push('贼克');
    }
  } else if (method === '比用' || method === '涉害') {
    subTypes.push(method);
  } else if (method === '昴星') {
    subTypes.push('昴星');
  } else if (method === '别责') {
    subTypes.push('别责');
  } else if (method === '八专') {
    subTypes.push('八专');
  } else if (method === '伏吟') {
    subTypes.push('伏吟');
  } else if (method === '返吟') {
    subTypes.push('返吟');
  } else {
    subTypes.push(method);
  }

  // --- 第二维度课体 ---

  // 三交：四仲日占，四仲加支，仲神发用
  const siZhong = ['子', '卯', '午', '酉'];
  if (siZhong.includes(siKe.zhi)) {
    // 四仲日，检查支上神是否也是四仲
    if (siZhong.includes(siKe.zhiYang)) {
      // 四仲加支，检查初传是否是四仲
      if (siZhong.includes(sanChuan.chu)) {
        extraTypes.push('三交');
      }
    }
  }

  // 铸印：三传递生
  const chuWx = ZHI_WUXING[sanChuan.chu];
  const zhongWx = ZHI_WUXING[sanChuan.zhong];
  const moWx = ZHI_WUXING[sanChuan.mo];
  if (chuWx && zhongWx && moWx) {
    if (shengRelation(chuWx, zhongWx) && shengRelation(zhongWx, moWx)) {
      extraTypes.push('铸印');
    }
    // 连珠：三传相连（地支连续）
    const chuIdx = zhiIndex(sanChuan.chu);
    const zhongIdx = zhiIndex(sanChuan.zhong);
    const moIdx = zhiIndex(sanChuan.mo);
    if ((zhongIdx - chuIdx + 12) % 12 === 1 && (moIdx - zhongIdx + 12) % 12 === 1) {
      extraTypes.push('连珠');
    }
    if ((chuIdx - zhongIdx + 12) % 12 === 1 && (zhongIdx - moIdx + 12) % 12 === 1) {
      extraTypes.push('连珠');
    }
  }

  return { method, subTypes, extraTypes };
}

/** 五行相克：a 克 b */
const KE_MAP: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
function keRelation(a: string, b: string): boolean {
  return KE_MAP[a] === b;
}

/** 五行相生：a 生 b */
const SHENG_MAP: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
function shengRelation(a: string, b: string): boolean {
  return SHENG_MAP[a] === b;
}

// ===== 课名生成 =====

/**
 * 生成课名，如 "戊子日第十局 干上申"
 * 局数 = 干上神(ganYang)的地支序号 + 1（子=1, 丑=2, ..., 亥=12）
 * 但传统上局数从1开始，申=第十局（申序号8+1=9? 不对）
 * 实际上传统课名的局数是按天盘排列顺序编号的
 * 同一日干支有12种不同的干上神，按子丑寅...亥排列为第一~十二局
 * 申 = 序号8 → 但截图显示"第十局"
 * 这说明局数是从寅(1)开始计数：寅=1,卯=2,...,子=11,丑=12
 * 或者从特定起点开始。根据截图验证：申→第十局
 * 亥(11)→第十局? 不对。让我重新算：
 * 如果从亥(11)开始：亥=1,子=2,丑=3,寅=4,卯=5,辰=6,巳=7,午=8,未=9,申=10 ✅
 * 所以局数 = (zhiIndex(ganYang) - zhiIndex('亥') + 12) % 12 + 1
 * = (8 - 11 + 12) % 12 + 1 = 9 % 12 + 1 = 10 ✅
 */
export function generateKeName(riGanZhi: string, ganYang: string): string {
  // 局数从亥开始计数
  const juNum = (zhiIndex(ganYang) - zhiIndex('亥') + 12) % 12 + 1;
  const juStr = numToChinese(juNum);

  return `${riGanZhi}日第${juStr}局 干上${ganYang}`;
}

function numToChinese(n: number): string {
  const nums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  return nums[n] || String(n);
}

// ===== 本命与行年 =====

/**
 * 计算本命（出生年干支）和行年
 */
export function calcBenMingXingNian(
  birthYear: number,
  currentYear: number,
  gender: 'male' | 'female',
): { benMing: string; xingNian: string; } {
  // 本命 = 出生年干支
  const benMingGanIdx = ((birthYear - 4) % 10 + 10) % 10;
  const benMingZhiIdx = ((birthYear - 4) % 12 + 12) % 12;
  const benMing = TIAN_GAN[benMingGanIdx] + DI_ZHI[benMingZhiIdx];

  // 行年：男从丙寅顺推，女从壬申逆推
  const age = currentYear - birthYear;
  let xingNianGanIdx: number;
  let xingNianZhiIdx: number;

  if (gender === 'male') {
    // 丙寅 = 干2支2，顺推
    xingNianGanIdx = (2 + age) % 10;
    xingNianZhiIdx = (2 + age) % 12;
  } else {
    // 壬申 = 干8支8，逆推
    xingNianGanIdx = (8 - age % 10 + 10) % 10;
    xingNianZhiIdx = (8 - age % 12 + 12) % 12;
  }

  const xingNian = TIAN_GAN[xingNianGanIdx] + DI_ZHI[xingNianZhiIdx];
  return { benMing, xingNian };
}

// ===== 导出常量 =====

export {
  DI_ZHI, GAN_WUXING, ganIndex, ganYinYang, TIAN_GAN, TIAN_JIANG_SHORT, YUE_JIANG_NAMES, ZHI_WUXING, zhiIndex
};
