# 插花台

日记花园里的插花台，单独拿出来先放在这里。挑花器，把花一枝枝插进去，拖花头调方向，拖远了就拔掉，插好可以存成图。

纯静态网页，用 http 服务打开 `index.html` 所在的地址就能玩（直接双击文件不行）。

## 数据只在你的浏览器里

插好的花存在当前浏览器的 IndexedDB 和 localStorage 里，不会上传到任何服务器。花园还没搬过来，「摆到园子」目前只是存在本机。

## 出处

拆自记忆小镇 暮园 · Hesperides。

## 第三方

- three.js r170（MIT，见 `vendor/three@0.170.0/LICENSE`）
- 猫啃网糖圆体 MaoKenTangYuan（SIL Open Font License，许可说明在 `fonts/maoken/result.css` 开头）
