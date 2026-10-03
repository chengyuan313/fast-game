# 找出那只猫 / Find That Cat

中国区轻量 IAA 小游戏实验项目。当前仓库只保留《找出那只猫》，此前的 Orbit Shift 已废弃。

## V1 状态

浏览器 MVP 已进入可玩版本：

- 30 个数据驱动关卡
- 每次重试随机目标位置
- 程序化 SVG 猫咪，不依赖外部美术素材
- 眼睛、耳朵、胡须、斑纹、颜色等多种视觉差异
- 中后期加入相似干扰猫
- 倒计时与点错扣时
- 自动推进下一关
- 本地进度保存
- 手机竖屏优先布局
- Mock 激励广告：提示、+10 秒、超时续命
- 广告通过 `AdService` 抽象，后续可替换为微信小游戏广告 SDK
- 基础行为埋点目前输出到浏览器 console

## 本地运行

要求 Node.js 20+。

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 目录

```text
src/
  game/
    catSvg.ts       # 程序化猫咪绘制
    levels.ts       # 30 关配置
  services/
    adService.ts    # Mock 广告 / 后续平台适配层
  main.ts           # 游戏状态与主循环
  style.css         # 手机端优先 UI

docs/
  PRODUCT_SPEC.md
  GAME_RULES.md
  LEVEL_SYSTEM.md
```

## 当前路线

1. Browser V1：验证核心玩法和难度曲线。
2. 内部试玩：记录卡关点、误触、提示和续时使用情况。
3. 调整关卡与视觉可读性。
4. 适配微信小游戏运行环境。
5. 接入真实激励广告、分享和数据平台。

## 当前开发分支

`feat/find-that-cat-mvp`

Draft PR：#1 `feat: Find That Cat MVP`
