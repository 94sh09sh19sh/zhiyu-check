#!/usr/bin/env node
// PreToolUse hook：在寫入前擋下含支語（中國大陸用語）或簡體字的內容。
// 只檢查「這次要寫進去的那段字」，不掃描既有檔案，所以不會被舊檔卡住。
// 詞庫：與本檔同目錄的 zhiyu-words.txt（一行一組，支語 <TAB> 建議用語）。
'use strict';
const fs = require('fs');
const path = require('path');

const ok = () => process.exit(0);

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  ok();
}

const ti = (payload && payload.tool_input) || {};

// hook 自己的檔案不檢查（詞庫本身就寫滿了支語）
const fp = String(ti.file_path || ti.notebook_path || '')
  .split(String.fromCharCode(92))
  .join('/');
if (fp.includes('/.claude/hooks/')) ok();

const chunks = [];
const push = (v) => {
  if (typeof v === 'string' && v) chunks.push(v);
};
push(ti.content); // Write
push(ti.new_string); // Edit
push(ti.new_source); // NotebookEdit
if (Array.isArray(ti.edits)) ti.edits.forEach((e) => e && push(e.new_string));

// Bash / PowerShell：只有看起來是在寫檔的指令才檢查，避免擋到單純的搜尋
const cmd = typeof ti.command === 'string' ? ti.command : '';
const WRITES_FILE = /<<\s*['"]?\w|>>?[^&|]|\btee\b|Set-Content|Add-Content|Out-File/;
if (cmd && WRITES_FILE.test(cmd)) push(cmd);

let text = chunks.join('\n');
if (!text) ok();

let pairs = [];
let allowed = [];
try {
  const lines = fs
    .readFileSync(path.join(__dirname, 'zhiyu-words.txt'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  // 以 ! 開頭的是放行詞組：先從內容中挖掉，再比對支語（例：「評分項目」可用，其餘「項目」照擋）
  allowed = lines
    .filter((l) => l.startsWith('!'))
    .map((l) => l.slice(1).trim())
    .filter(Boolean);
  pairs = lines
    .filter((l) => !l.startsWith('!'))
    .map((l) => l.split('\t').map((s) => s.trim()))
    .filter((p) => p[0]);
} catch {
  // 沒詞庫就只做簡體字檢查
}

// 由長到短挖掉，避免短詞組先把長詞組拆壞
allowed
  .sort((a, b) => b.length - a.length)
  .forEach((a) => {
    text = text.split(a).join(' ');
  });

const bad = pairs.filter(([w]) => text.includes(w));
// 去掉被較長詞包含的重複命中（例：「數據庫」命中時不必再報「數據」）
const hits = bad
  .filter(([w]) => !bad.some(([o]) => o !== w && o.includes(w)))
  .map(([w, g]) => (g ? `「${w}」→ 請改用「${g}」` : `「${w}」`));

// 繁體中文不會出現的簡體字
const SIMPLIFIED =
  /[这么们个关说时实现发会来对应还经过产业动员单击义习书买卖东车见觉认让该语请谢试记谈议论设访词译讯计训讲许报转轮软输边达运远连进适选释长门问间闻阅队阶险难页顶项顺须预领风飞马验体图团国园学宁宝审写层属岁岛币师带乐乡乱争亏亚亲仅从仓仪价众优伟传伤伦侧侦侨债倾偿储儿党兰兴养兽内册军农净减凤凭处备复够头夺奋奖孙宫寻导尔尽岂帅归当录彻忆怀态总恋恶惊惧惨愿忧战戏扑执扩扫扬担拟择挂挤挥损换据挣揽摄摆撑敌数断无旧显晓暂术机杀杂权条极构枢标栋树样档桥检楼横欢欧残毁毕汉汤沟浅测济浏涂润湾满滚滤滨灭灯灵热烦烧营爱狮猫玛环现琼疗痴皱盘监盖着睁矫码砖础确碍种积称竞笔笋筑简类粮纠红级纪纯纲纳纵纸纽线练组细织终绍经绑绘给络绝统继续绩绪绳维绿网罗罚驱驶驻骑鱼鲜鸟鸡鸣鸿鹅鹏黄齐齿龄龙龟]/;
if (SIMPLIFIED.test(text)) hits.push('內容含簡體字，請全部改成繁體中文');

if (!hits.length) ok();

const reason = [
  '這次寫入的內容含支語／簡體字，已擋下。請改寫成台灣用語後重新寫入：',
  ...hits.map((h) => '  ・' + h),
  '',
  '（若這是必須逐字保留的原文引用或第三方 API 欄位名，不要反覆重試 —— 直接告訴使用者，由使用者決定。）',
].join('\n');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
    systemMessage: '支語守門員：擋下一次寫入（' + hits.length + ' 項）',
  })
);
