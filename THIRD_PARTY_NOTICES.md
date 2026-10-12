# 第三方内容

MIT 协议适用于 CarsonBench 的原创代码、界面与导读文字。下列第三方内容保留原有权利，MIT 不赋予对这些材料的额外授权。

## 《寂静的春天》节选

- 原著：Rachel Carson, *Silent Spring*（1962）。
- 用户提供的 EPUB：上海译文出版社，2007-11；译者吕瑞兰、李长生；ISBN 9787532742189。
- `src/data/reading-pack.json` 的 `excerpts[].text` 及 `corpus` 中引用的原著中译文用于有限的阅读、比较和评论，保留原著与译文权利。
- 仅收录三轮实验所需的有限节选；原始 EPUB 与本地完整提取文件未发布。
- 段号依据此 EPUB 的各章正文 `p` 元素，跳过装饰分隔符，不声称对应印刷页码。来源 EPUB 的 SHA256 随阅读包记录。
- 章节导读和评分参考由项目编写，不能替代原著或被当作现代科学、医疗与政策证据。

## Rachel Carson 肖像

`public/rachel-carson.jpg`：U.S. Fish and Wildlife Service 官方工作照片；来源 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rachel-Carson.jpg)，文件页标注 public domain / PD-USGov-FWS。

## 依赖

React、Vite、Tailwind CSS、Framer Motion、Lucide 及其传递依赖各自保留原有许可证。具体版本见 `package-lock.json`，许可证见各依赖包。
