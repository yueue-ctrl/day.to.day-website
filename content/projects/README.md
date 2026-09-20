# 项目内容使用说明

每个项目都是一个独立文件夹，放在 `play` 或 `pay` 目录中。

## 新增一个项目

1. 复制对应分类中的 `_template` 文件夹。
2. 把复制后的文件夹改成项目英文短名，例如 `my-project`。只使用小写字母、数字和短横线。
3. 编辑文件夹中的 `project.json`。
4. 把首页预览图放进 `cover`，把详情页图片放进 `images`。
5. 在 `manifest.json` 的 `projects` 数组中加入项目资料路径，例如：

```json
{
  "projects": [
    "content/projects/play/my-project/project.json",
    "content/projects/pay/client-project/project.json"
  ]
}
```

## Play 与 Pay

- `play`：自主实验、研究、日常探索、非委托项目。
- `pay`：客户委托、商业合作、受雇完成的项目。

## 预览图规则

- 首页始终保留一个正方形位置。
- `fit` 使用 `contain` 时，图片完整显示，不裁切；长图或宽图周围会留白。
- `fit` 改成 `cover` 时，图片会铺满正方形，边缘可能被裁切。
- `background` 控制图片周围留白的颜色。
- 暂时没有预览图时，把 `src` 留空；项目名仍会显示，正方形位置也会保留。

## 内容规则

- `title`：项目名，显示在预览图左下方。
- `subtitle`：短说明，显示在预览图右下方。
- `intro`：项目详情页的中英文简介。
- `caption`：每张详情图自己的中英文注释。
- `alt`：给屏幕阅读器使用的图片内容说明，不要写“图片”二字。
- `published`：`true` 时出现在首页；`false` 时作为草稿保留。
- `order`：数字越小，排列越靠前。
