# 日记花园

一个小小的 3D 日记游戏。每天挑几个心情、写一句话，它就在你的花园里长成一朵花。花园旁边还有插花台、厨房和一间自己的小店：把开着的花剪去插瓶，用心情换来的食材摆一盘菜，再放进店里的玻璃柜，打烊时看看卖得怎么样。

纯静态网页，不用装任何东西，打开 `index.html` 所在的地址就能玩（需要用 http 服务打开，直接双击文件不行）。

## 数据只在你的浏览器里

写下的字、配的图、种的花、做的菜都存在当前浏览器的 IndexedDB 和 localStorage 里，不会上传到任何服务器。换浏览器或清掉网站数据就没了，可以在花园菜单里「把花园打包带走」存成一个 json 文件，以后再「从文件搬回来」。

## 页面

- `index.html` 花园（带 `?home` 直接进花园）
- `ikebana.html` 插花台
- `kitchen.html` 厨房
- `shop.html` 我的店

## 出处

这座花园拆自记忆小镇 暮园 · Hesperides。

## 第三方

- three.js r170（MIT，见 `vendor/three@0.170.0/LICENSE`）
- 猫啃网糖圆体 MaoKenTangYuan（SIL Open Font License，许可说明在 `fonts/maoken/result.css` 开头）
