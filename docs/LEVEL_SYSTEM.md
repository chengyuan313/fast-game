# Level System — 找出那只猫

## 1. 目标

关卡必须数据驱动，避免手工制作 30 个独立页面。程序根据配置生成猫群、目标位置、倒计时和干扰项。

## 2. LevelConfig 建议结构

```ts
export type LevelConfig = {
  id: number;
  rows: number;
  cols: number;
  normalVariant: string;
  targetVariant: string;
  targetPrompt: string;
  timeLimitSec: number;
  wrongPenaltySec: number;
  decoyVariants?: string[];
};
```

## 3. MVP 关卡阶段

### Lv1–3：教学
- 4×4 左右
- 目标差异极明显
- 20–25 秒
- 不加入干扰变体

### Lv4–10：基础搜索
- 5×5 到 6×6
- 表情、眼睛、耳朵、尾巴等差异
- 18–22 秒

### Lv11–20：注意力挑战
- 7×7 到 9×9
- 颜色、斑纹、胡须、瞳孔等细节差异
- 加入 1–2 种相似干扰项
- 15–20 秒

### Lv21–30：高难
- 9×9 到 12×12
- 极小但公平的视觉差异
- 多种干扰项
- 12–18 秒

## 4. 生成规则

1. 根据 `rows × cols` 创建槽位。
2. 随机选择一个目标槽位。
3. 其余槽位默认填充 `normalVariant`。
4. 如存在 `decoyVariants`，按比例随机替换普通猫，但不得与目标完全一致。
5. 目标位置每次重试重新随机，防止死记坐标。
6. 同一局中目标只能有 1 个。

## 5. 难度控制

建议用配置控制，不在核心逻辑里硬编码。

后续可增加：
- `targetScaleDelta`
- `targetHueDelta`
- `rotationRange`
- `decoyRatio`
- `hintMode`

## 6. 内容扩展

第一套只做猫，后续同一引擎可以扩展：
- 找出那只狗
- 找出那只水豚
- 找出那只熊猫
- 找出那只鸭子

核心代码不应绑定具体动物素材。
