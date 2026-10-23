---
title: BPE 分词
slug: bpe
date: 2026-09-17
updated: 2026-09-25
summary: 按 Sennrich et al. (2016) 的算法逐步合并最高频符号对，再用学到的合并顺序切分新词。
tags: [sennrich, bpe]
preview: preview.js
category: tokenize
---

按 Sennrich et al. (2016) 的算法：训练阶段反复合并语料中最高频的相邻符号对，推理阶段按训练得到的合并顺序切分新词。词尾用 `</w>` 标记。

:::bpe-demo
:::
