# OpenLIMS 宣传片头

独立的 [Remotion](https://www.remotion.dev/) 工程，不依赖主项目。产出 1080×1920、60fps 竖屏视频。

| 合成               | 说明                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `OpenLIMSShowreel` | 15 秒黑金版：混乱 → 冻结吸入 → Logo 爆发 → 被看见 / 有路走 / 能传承 → 开源定格，含配音与配乐 |
| `OpenLIMSIntroV1`  | 13 秒首版：界面碎片汇聚成 Logo，无声音                                                       |

## 使用

```bash
npm install
npm run preview   # 浏览器里拖时间轴预览
npm run render    # 先合成配乐，再输出 out/openlims-showreel.mp4
```

## 结构

- `src/timeline.json`：唯一时间轴，画面与配乐共用（转场、冲击、配音起点、短句帧）。
- `src/Showreel.jsx`：15 秒版动画；`src/IntroV1.jsx`：首版。
- `scripts/synth.mjs`（`npm run audio`）：纯代码合成配乐与音效，输出 `public/bgm.wav`，无采样、无版权素材。
- `scripts/prep-vo.mjs`（`npm run voice`）：整理 `public/vo-raw/l1–l5.wav` 配音——去头尾静音、句中停顿压到 0.25 秒、响度标准化到 −15 LUFS，输出 `public/vo/`，并回写 `timeline.json` 中的时长与短句起点。

## 替换配音

当前配音由微软神经语音 `zh-CN-YunxiNeural` 生成。换成真人录音时，把五句录音按顺序存为 `public/vo-raw/l1.wav`–`l5.wav`（单声道 48kHz 16bit），然后执行 `npm run voice && npm run render`。各句需大致落在原时长内，否则调整 `timeline.json` 里 `vo[].at`。

文案：

1. 群聊刷屏，表格散乱，新人无从下手。
2. 每一份努力，都被看见。
3. 每一位新人，都有路可走。
4. 每一届积累，都能传承。
5. OpenLIMS，为每一个实验室而开源。
